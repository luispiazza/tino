import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { desc, eq, inArray } from "drizzle-orm";
import { publicProcedure, socioProcedure, router } from "../trpc";
import { clientes, reservaEstudios, reservas } from "../db/schema";
import {
  buscarConflitos,
  complementaresSemBase,
} from "../reservas/disponibilidade";
import { gerarTokenPortal, proximoCodigo } from "../reservas/codigo";
import {
  diasDaReserva,
  totalCents,
  validarValores,
} from "../reservas/valores";

const dataISO = z.string().date();
const hora = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "use HH:MM");

const periodoInput = z
  .object({
    dataInicio: dataISO,
    dataFim: dataISO,
    /* sem horário = o dia inteiro (qualquer reserva no período conflita) */
    horaInicio: hora.default("00:00"),
    horaFim: hora.default("23:59"),
    estudioIds: z.array(z.number().int()).min(1),
  })
  .refine((p) => p.dataFim >= p.dataInicio, {
    message: "dataFim antes de dataInicio",
  })
  .refine((p) => p.horaFim > p.horaInicio, {
    message: "horaFim deve ser depois de horaInicio",
  });

/*
 * Domínio 1. A criação SEMPRE checa conflito de agenda — período e
 * horário (diária parcial existe) — pela mesma regra que a consulta
 * pública usa. Complementar nunca entra sem a base (B sem A, C sem A/E).
 */
export const reservasRouter = router({
  disponibilidade: publicProcedure
    .input(periodoInput)
    .query(async ({ ctx, input }) => {
      const conflitos = await buscarConflitos(ctx.db, input);
      return { disponivel: conflitos.length === 0, conflitos };
    }),

  criar: socioProcedure
    .input(
      z
        .object({
          dataInicio: dataISO,
          dataFim: dataISO,
          horaInicio: hora,
          horaFim: hora,
          estudioIds: z.array(z.number().int()).min(1),
          clienteId: z.number().int().nullish(),
          valorDiariaCents: z.number().int().nonnegative().nullish(),
          descontoCents: z.number().int().nonnegative().default(0),
        })
        .refine((p) => p.dataFim >= p.dataInicio, {
          message: "dataFim antes de dataInicio",
        })
        .refine((p) => p.horaFim > p.horaInicio, {
          message: "horaFim deve ser depois de horaInicio",
        })
    )
    .mutation(async ({ ctx, input }) => {
      validarValores(
        input.valorDiariaCents ?? null,
        input.descontoCents,
        diasDaReserva(input.dataInicio, input.dataFim)
      );
      const semBase = await complementaresSemBase(ctx.db, input.estudioIds);
      if (semBase.length > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Complementar não é vendido sozinho: ${semBase.join(", ")} exige o estúdio de que depende na mesma reserva`,
        });
      }

      return ctx.db.transaction(async (tx) => {
        const conflitos = await buscarConflitos(tx, input);
        if (conflitos.length > 0) {
          const codigos = [...new Set(conflitos.map((c) => c.codigo))];
          throw new TRPCError({
            code: "CONFLICT",
            message: `Conflito de agenda com ${codigos.join(", ")}`,
          });
        }

        const codigo = await proximoCodigo(tx, input.dataInicio);
        const [reserva] = await tx
          .insert(reservas)
          .values({
            codigo,
            clienteId: input.clienteId ?? null,
            dataInicio: input.dataInicio,
            dataFim: input.dataFim,
            horaInicio: input.horaInicio,
            horaFim: input.horaFim,
            valorDiariaCents: input.valorDiariaCents ?? null,
            descontoCents: input.descontoCents,
            tokenPortalReserva: gerarTokenPortal(),
            tokenPortalProdutor: gerarTokenPortal(),
          })
          .returning();
        await tx.insert(reservaEstudios).values(
          input.estudioIds.map((estudioId) => ({
            reservaId: reserva.id,
            estudioId,
          }))
        );
        return { ...reserva, estudioIds: input.estudioIds };
      });
    }),

  listar: socioProcedure.query(async ({ ctx }) => {
    const lista = await ctx.db
      .select({
        reserva: reservas,
        clienteNome: clientes.nome,
      })
      .from(reservas)
      .leftJoin(clientes, eq(reservas.clienteId, clientes.id))
      .orderBy(desc(reservas.dataInicio))
      .then((linhas) =>
        linhas.map(({ reserva, clienteNome }) => ({ ...reserva, clienteNome }))
      );
    const juncao = lista.length
      ? await ctx.db
          .select()
          .from(reservaEstudios)
          .where(
            inArray(
              reservaEstudios.reservaId,
              lista.map((r) => r.id)
            )
          )
      : [];
    return lista.map((r) => ({
      ...r,
      estudioIds: juncao
        .filter((j) => j.reservaId === r.id)
        .map((j) => j.estudioId),
      valorTotalCents: totalCents(
        r.valorDiariaCents,
        r.descontoCents,
        diasDaReserva(r.dataInicio, r.dataFim)
      ),
    }));
  }),

  /* Detalhe para o painel: única rota que expõe os tokens dos portais. */
  obter: socioProcedure
    .input(z.object({ id: z.number().int() }))
    .query(async ({ ctx, input }) => {
      const [linha] = await ctx.db
        .select({
          reserva: reservas,
          clienteNome: clientes.nome,
          clienteTelefone: clientes.telefone,
        })
        .from(reservas)
        .leftJoin(clientes, eq(reservas.clienteId, clientes.id))
        .where(eq(reservas.id, input.id))
        .limit(1);
      if (!linha) throw new TRPCError({ code: "NOT_FOUND" });
      const estudioIds = (
        await ctx.db
          .select({ estudioId: reservaEstudios.estudioId })
          .from(reservaEstudios)
          .where(eq(reservaEstudios.reservaId, input.id))
      ).map((j) => j.estudioId);
      return {
        ...linha.reserva,
        clienteNome: linha.clienteNome,
        clienteTelefone: linha.clienteTelefone,
        estudioIds,
        valorTotalCents: totalCents(
          linha.reserva.valorDiariaCents,
          linha.reserva.descontoCents,
          diasDaReserva(linha.reserva.dataInicio, linha.reserva.dataFim)
        ),
      };
    }),

  /*
   * O envio acontece no WhatsApp do sócio (wa.me) — aqui só se registra
   * QUANDO foi enviado, para o estado aparecer na lista em vez de sumir.
   */
  marcarWhatsappEnviado: socioProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const [reserva] = await ctx.db
        .update(reservas)
        .set({ whatsappEnviadoEm: new Date() })
        .where(eq(reservas.id, input.id))
        .returning();
      if (!reserva) throw new TRPCError({ code: "NOT_FOUND" });
      return reserva;
    }),

  atualizarValores: socioProcedure
    .input(
      z.object({
        id: z.number().int(),
        valorDiariaCents: z.number().int().nonnegative().nullable(),
        descontoCents: z.number().int().nonnegative(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [existente] = await ctx.db
        .select()
        .from(reservas)
        .where(eq(reservas.id, input.id));
      if (!existente) throw new TRPCError({ code: "NOT_FOUND" });
      validarValores(
        input.valorDiariaCents,
        input.descontoCents,
        diasDaReserva(existente.dataInicio, existente.dataFim)
      );
      const [reserva] = await ctx.db
        .update(reservas)
        .set({
          valorDiariaCents: input.valorDiariaCents,
          descontoCents: input.descontoCents,
        })
        .where(eq(reservas.id, input.id))
        .returning();
      return reserva;
    }),

  confirmar: socioProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const [reserva] = await ctx.db
        .update(reservas)
        .set({ status: "confirmada" })
        .where(eq(reservas.id, input.id))
        .returning();
      if (!reserva) throw new TRPCError({ code: "NOT_FOUND" });
      return reserva;
    }),

  cancelar: socioProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const [reserva] = await ctx.db
        .update(reservas)
        .set({ status: "cancelada" })
        .where(eq(reservas.id, input.id))
        .returning();
      if (!reserva) throw new TRPCError({ code: "NOT_FOUND" });
      return reserva;
    }),
});
