import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { desc, eq } from "drizzle-orm";
import { router, socioProcedure } from "../trpc";
import { clientes, cobrancas, reservas } from "../db/schema";
import { diasDaReserva, totalCents } from "../reservas/valores";
import {
  somarDias,
  validarTransicao,
  type EstadoCobranca,
} from "../financeiro/esteira";
import { auditar } from "../auditoria";

/*
 * Domínio 7 — inteiro atrás de socioProcedure.
 * Agenda de obrigações é o coração; extrato e fluxo de caixa saem dela.
 * Toda tela alterna competência ↔ caixa.
 */
export const financeiroRouter = router({
  listarCobrancas: socioProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select({
        cobranca: cobrancas,
        reservaCodigo: reservas.codigo,
        clienteNome: clientes.nome,
      })
      .from(cobrancas)
      .leftJoin(reservas, eq(cobrancas.reservaId, reservas.id))
      .leftJoin(clientes, eq(reservas.clienteId, clientes.id))
      .orderBy(desc(cobrancas.criadaEm))
      .then((linhas) =>
        linhas.map(({ cobranca, reservaCodigo, clienteNome }) => ({
          ...cobranca,
          reservaCodigo,
          clienteNome,
        }))
      );
  }),

  /*
   * Faturar tudo no fechamento (decisão 25/07): a cobrança nasce da
   * reserva com o valor negociado. Exige PO → começa em aguardando_po;
   * senão nasce emitida. Âncora no shooting: previsão = fim + prazo.
   */
  criarCobranca: socioProcedure
    .input(
      z.object({
        reservaId: z.number().int(),
        valorCents: z.number().int().positive().optional(),
        exigePo: z.boolean().default(false),
        prazoDias: z.number().int().min(0).max(120).default(0),
        parcelas: z.number().int().min(1).max(12).default(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [reserva] = await ctx.db
        .select()
        .from(reservas)
        .where(eq(reservas.id, input.reservaId));
      if (!reserva) throw new TRPCError({ code: "NOT_FOUND" });
      if (reserva.status === "cancelada") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Reserva cancelada não gera cobrança",
        });
      }
      const valorDaReserva = totalCents(
        reserva.valorDiariaCents,
        reserva.descontoCents,
        diasDaReserva(reserva.dataInicio, reserva.dataFim)
      );
      const valorCents = input.valorCents ?? valorDaReserva;
      if (valorCents === null || valorCents <= 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Defina o valor da reserva (ou informe o valor da cobrança)",
        });
      }
      const [cobranca] = await ctx.db
        .insert(cobrancas)
        .values({
          reservaId: reserva.id,
          valorCents,
          estado: input.exigePo ? "aguardando_po" : "emitida",
          ancora: "shooting",
          prazoDias: input.prazoDias,
          parcelas: input.parcelas,
          dataServico: reserva.dataFim,
          previsaoRecebimento: somarDias(reserva.dataFim, input.prazoDias),
        })
        .returning();
      await auditar(
        ctx.db,
        ctx.session,
        "criar",
        "cobranca",
        cobranca.id,
        { reserva: reserva.codigo, valorCents, estado: cobranca.estado }
      );
      return cobranca;
    }),

  /*
   * A esteira anda um passo por vez, sempre validada — pagar exige a
   * data (caixa), e NF emitida guarda número/URL para a conciliação.
   */
  avancarCobranca: socioProcedure
    .input(
      z.object({
        id: z.number().int(),
        para: z.enum([
          "po_recebido",
          "emitida",
          "paga",
          "nf_emitida",
          "conciliada",
          "cancelada",
        ]),
        dataPagamento: z.string().date().optional(),
        nfNumero: z.string().max(50).optional(),
        nfUrl: z.string().url().max(300).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [existente] = await ctx.db
        .select()
        .from(cobrancas)
        .where(eq(cobrancas.id, input.id));
      if (!existente) throw new TRPCError({ code: "NOT_FOUND" });
      validarTransicao(existente.estado as EstadoCobranca, input.para);

      const mudanca: Partial<typeof cobrancas.$inferInsert> = {
        estado: input.para,
      };
      if (input.para === "paga") {
        mudanca.dataPagamento =
          input.dataPagamento ?? new Date().toISOString().slice(0, 10);
      }
      if (input.para === "nf_emitida") {
        mudanca.nfNumero = input.nfNumero ?? null;
        mudanca.nfUrl = input.nfUrl ?? null;
      }
      const [cobranca] = await ctx.db
        .update(cobrancas)
        .set(mudanca)
        .where(eq(cobrancas.id, input.id))
        .returning();
      await auditar(ctx.db, ctx.session, "avancar", "cobranca", cobranca.id, {
        de: existente.estado,
        para: input.para,
      });
      return cobranca;
    }),

  agendaDeObrigacoes: socioProcedure.query(async () => {
    return [];
  }),

  importarExtrato: socioProcedure
    .input(z.object({ banco: z.string(), csv: z.string() }))
    .mutation(async () => {
      // TODO: parsear linhas, casar automático por valor + data,
      // deixar o resto como pendente
      throw new Error("não implementado");
    }),

  /*
   * PIX caiu na conta sem identificação: o sócio associa a linha
   * pendente a uma ou mais cobranças (ou a um lançamento de entrada).
   * A soma das associações precisa fechar com o valor da linha.
   */
  associarRecebimento: socioProcedure
    .input(
      z.object({
        linhaId: z.number(),
        associacoes: z
          .array(
            z.object({
              cobrancaId: z.number().optional(),
              lancamentoId: z.number().optional(),
              valorCents: z.number().int().positive(),
            })
          )
          .min(1),
      })
    )
    .mutation(async () => {
      // TODO: validar soma = valor da linha, gravar conciliações,
      // marcar cobrança como paga e a linha como conciliada
      throw new Error("não implementado");
    }),
});
