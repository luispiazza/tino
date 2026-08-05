import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, gte, inArray, isNotNull, lte } from "drizzle-orm";
import { router, socioProcedure } from "../trpc";
import {
  categoria,
  clientes,
  cobrancas,
  contasRecorrentes,
  financeiroConfig,
  lancamentos,
  naturezaObrigacao,
  reservas,
} from "../db/schema";
import { diasDaReserva, totalCents } from "../reservas/valores";
import {
  somarDias,
  validarTransicao,
  type EstadoCobranca,
} from "../financeiro/esteira";
import { auditar } from "../auditoria";

const hojeSP = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(
    new Date()
  );

const mesDe = (iso: string) => iso.slice(0, 7);
const proximosMeses = (base: string, quantos: number) => {
  const [ano, mes] = base.split("-").map(Number);
  return Array.from({ length: quantos }, (_, i) => {
    const d = new Date(Date.UTC(ano, mes - 1 + i, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  });
};

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

  /*
   * O painel de vigilância: tudo que tem data e ainda não aconteceu —
   * a receber (cobranças com previsão) e a pagar (lançamentos com
   * vencimento) — numa lista só, ordenada, com o atraso na cara.
   */
  agendaDeObrigacoes: socioProcedure.query(async ({ ctx }) => {
    const hoje = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
    }).format(new Date());

    const aReceber = await ctx.db
      .select({
        cobranca: cobrancas,
        reservaCodigo: reservas.codigo,
        clienteNome: clientes.nome,
      })
      .from(cobrancas)
      .leftJoin(reservas, eq(cobrancas.reservaId, reservas.id))
      .leftJoin(clientes, eq(reservas.clienteId, clientes.id))
      .where(
        and(
          inArray(cobrancas.estado, [
            "aguardando_po",
            "po_recebido",
            "emitida",
          ]),
          isNotNull(cobrancas.previsaoRecebimento)
        )
      );

    const aPagar = await ctx.db
      .select()
      .from(lancamentos)
      .where(
        and(
          inArray(lancamentos.estado, ["previsto", "confirmado"]),
          isNotNull(lancamentos.dataVencimento)
        )
      );

    const itens = [
      ...aReceber.map(({ cobranca, reservaCodigo, clienteNome }) => ({
        tipo: "receber" as const,
        id: cobranca.id,
        descricao: `${reservaCodigo ?? "cobrança"}${clienteNome ? ` · ${clienteNome}` : ""}`,
        valorCents: cobranca.valorCents as number | null,
        data: cobranca.previsaoRecebimento!,
        estado: cobranca.estado as string,
      })),
      ...aPagar.map((l) => ({
        tipo: "pagar" as const,
        id: l.id,
        descricao: l.descricao,
        valorCents: l.valorCents,
        data: l.dataVencimento!,
        estado: l.estado as string,
      })),
    ]
      .map((i) => ({ ...i, atrasada: i.data < hoje }))
      .sort((a, b) => a.data.localeCompare(b.data));

    return { hoje, itens };
  }),

  /* ---------- Caixa ---------- */

  /*
   * O saldo em conta na data da virada. Sem ele o fluxo parte do zero e
   * exibe um saldo que não existe — é o único número que o sistema não
   * consegue deduzir, e por isso ele é pedido na tela, não chutado.
   */
  obterConfig: socioProcedure.query(async ({ ctx }) => {
    const [config] = await ctx.db.select().from(financeiroConfig).limit(1);
    return config ?? null;
  }),

  definirSaldoInicial: socioProcedure
    .input(
      z.object({
        dataVirada: z.string().date(),
        saldoInicialCents: z.number().int(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [existente] = await ctx.db.select().from(financeiroConfig).limit(1);
      const [config] = existente
        ? await ctx.db
            .update(financeiroConfig)
            .set(input)
            .where(eq(financeiroConfig.id, existente.id))
            .returning()
        : await ctx.db.insert(financeiroConfig).values(input).returning();
      await auditar(
        ctx.db,
        ctx.session,
        existente ? "atualizar" : "criar",
        "financeiro_config",
        config.id,
        input
      );
      return config;
    }),

  /*
   * Fluxo de caixa é consulta derivada, nunca tabela (princípio 3).
   * Realizado: o que passou pela conta desde a virada — cobrança com
   * dataPagamento, lançamento pago. Projetado: o que tem data e ainda
   * não aconteceu. Lançamento sem valor entra como zero e é contado
   * à parte: o mês é otimista enquanto a conta não chega, e a tela diz.
   */
  fluxoDeCaixa: socioProcedure
    .input(z.object({ meses: z.number().int().min(1).max(12).default(3) }))
    .query(async ({ ctx, input }) => {
      const hoje = hojeSP();
      const [config] = await ctx.db.select().from(financeiroConfig).limit(1);

      const todasCobrancas = await ctx.db.select().from(cobrancas);
      const todosLancamentos = await ctx.db.select().from(lancamentos);

      const desdeVirada = (data: string | null) =>
        data !== null && (!config || data >= config.dataVirada);

      const recebido = todasCobrancas
        .filter((c) => desdeVirada(c.dataPagamento) && c.dataPagamento! <= hoje)
        .reduce((s, c) => s + c.valorCents, 0);
      const pago = todosLancamentos
        .filter(
          (l) =>
            l.estado === "pago" &&
            desdeVirada(l.dataPagamento) &&
            l.dataPagamento! <= hoje
        )
        .reduce((s, l) => s + (l.valorCents ?? 0), 0);

      const saldoInicial = config?.saldoInicialCents ?? 0;
      const saldoHoje = saldoInicial + recebido - pago;

      /* projeção: parte do saldo de hoje e empilha mês a mês */
      const meses = proximosMeses(mesDe(hoje), input.meses);
      let acumulado = saldoHoje;
      const projecao = meses.map((mes) => {
        const entradas = todasCobrancas
          .filter(
            (c) =>
              c.estado !== "cancelada" &&
              c.dataPagamento === null &&
              c.previsaoRecebimento !== null &&
              mesDe(c.previsaoRecebimento) === mes &&
              c.previsaoRecebimento > hoje
          )
          .reduce((s, c) => s + c.valorCents, 0);

        const aPagarNoMes = todosLancamentos.filter(
          (l) =>
            l.estado !== "pago" &&
            l.dataVencimento !== null &&
            mesDe(l.dataVencimento) === mes &&
            l.dataVencimento > hoje
        );
        const saidas = aPagarNoMes.reduce((s, l) => s + (l.valorCents ?? 0), 0);
        const semValor = aPagarNoMes.filter((l) => l.valorCents === null).length;

        acumulado += entradas - saidas;
        return { mes, entradas, saidas, semValor, saldoFinal: acumulado };
      });

      return {
        hoje,
        configurado: config !== undefined,
        dataVirada: config?.dataVirada ?? null,
        saldoInicial,
        recebido,
        pago,
        saldoHoje,
        projecao,
      };
    }),

  /* ---------- Despesas: recorrentes e lançamentos ---------- */

  listarRecorrentes: socioProcedure.query(({ ctx }) =>
    ctx.db
      .select()
      .from(contasRecorrentes)
      .orderBy(asc(contasRecorrentes.descricao))
  ),

  criarRecorrente: socioProcedure
    .input(
      z.object({
        descricao: z.string().min(1).max(200),
        categoria: z.enum(categoria.enumValues),
        natureza: z.enum(naturezaObrigacao.enumValues),
        valorEsperadoCents: z.number().int().positive().nullish(),
        diaVencimento: z.number().int().min(1).max(31).nullish(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [conta] = await ctx.db
        .insert(contasRecorrentes)
        .values(input)
        .returning();
      await auditar(ctx.db, ctx.session, "criar", "recorrente", conta.id, {
        descricao: conta.descricao,
      });
      return conta;
    }),

  atualizarRecorrente: socioProcedure
    .input(
      z.object({
        id: z.number().int(),
        valorEsperadoCents: z.number().int().positive().nullish(),
        diaVencimento: z.number().int().min(1).max(31).nullish(),
        ativo: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...dados } = input;
      const [conta] = await ctx.db
        .update(contasRecorrentes)
        .set(dados)
        .where(eq(contasRecorrentes.id, id))
        .returning();
      if (!conta) throw new TRPCError({ code: "NOT_FOUND" });
      await auditar(ctx.db, ctx.session, "atualizar", "recorrente", conta.id, {
        descricao: conta.descricao,
        campos: Object.keys(dados),
      });
      return conta;
    }),

  /*
   * A materialização do mês: cada recorrente ativa vira UM lançamento
   * `previsto` no mês visível — idempotente, o sócio confirma em dez
   * segundos, nunca digita planilha. (Vira cron junto do gerador da
   * Fase 4; até lá roda ao abrir a tela.)
   */
  materializarMes: socioProcedure
    .input(z.object({ ano: z.number().int(), mes: z.number().int().min(1).max(12) }))
    .mutation(async ({ ctx, input }) => {
      const prefixo = `${input.ano}-${String(input.mes).padStart(2, "0")}`;
      const inicio = `${prefixo}-01`;
      const ultimoDia = new Date(input.ano, input.mes, 0).getDate();
      const fim = `${prefixo}-${String(ultimoDia).padStart(2, "0")}`;
      const ativas = await ctx.db
        .select()
        .from(contasRecorrentes)
        .where(eq(contasRecorrentes.ativo, true));
      const existentes = await ctx.db
        .select({ recorrenteId: lancamentos.recorrenteId })
        .from(lancamentos)
        .where(
          and(
            isNotNull(lancamentos.recorrenteId),
            gte(lancamentos.dataVencimento, inicio),
            lte(lancamentos.dataVencimento, fim)
          )
        );
      const jaTem = new Set(existentes.map((e) => e.recorrenteId));
      const novas = ativas.filter((c) => !jaTem.has(c.id));
      let criados = 0;
      for (const conta of novas) {
        const dia = Math.min(
          conta.diaVencimento ?? 28,
          new Date(input.ano, input.mes, 0).getDate()
        );
        await ctx.db.insert(lancamentos).values({
          descricao: conta.descricao,
          sentido: "saida",
          categoria: conta.categoria,
          natureza: conta.natureza,
          estado: "previsto",
          /* nulo até a conta chegar — nunca um número inventado */
          valorCents: conta.valorEsperadoCents,
          dataVencimento: `${prefixo}-${String(dia).padStart(2, "0")}`,
          recorrenteId: conta.id,
        });
        criados++;
      }
      return { criados };
    }),

  listarLancamentos: socioProcedure
    .input(
      z.object({ ano: z.number().int(), mes: z.number().int().min(1).max(12) })
    )
    .query(({ ctx, input }) => {
      const prefixo = `${input.ano}-${String(input.mes).padStart(2, "0")}`;
      const ultimoDia = new Date(input.ano, input.mes, 0).getDate();
      return ctx.db
        .select()
        .from(lancamentos)
        .where(
          and(
            gte(lancamentos.dataVencimento, `${prefixo}-01`),
            lte(
              lancamentos.dataVencimento,
              `${prefixo}-${String(ultimoDia).padStart(2, "0")}`
            )
          )
        )
        .orderBy(asc(lancamentos.dataVencimento));
    }),

  criarLancamento: socioProcedure
    .input(
      z.object({
        descricao: z.string().min(1).max(200),
        sentido: z.enum(["entrada", "saida"]).default("saida"),
        categoria: z.enum(categoria.enumValues),
        natureza: z
          .enum(naturezaObrigacao.enumValues)
          .default("data_e_valor_conhecidos"),
        valorCents: z.number().int().positive().nullish(),
        dataVencimento: z.string().date().nullish(),
        dataServico: z.string().date().nullish(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [lancamento] = await ctx.db
        .insert(lancamentos)
        .values(input)
        .returning();
      await auditar(ctx.db, ctx.session, "criar", "lancamento", lancamento.id, {
        descricao: lancamento.descricao,
        valorCents: lancamento.valorCents,
      });
      return lancamento;
    }),

  /*
   * previsto → confirmado (a conta chegou, valor real) → pago (caixa).
   * Confirmar exige valor; pagar exige a data — as duas datas, sempre.
   */
  confirmarLancamento: socioProcedure
    .input(
      z.object({
        id: z.number().int(),
        valorCents: z.number().int().positive(),
        dataVencimento: z.string().date().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [existente] = await ctx.db
        .select()
        .from(lancamentos)
        .where(eq(lancamentos.id, input.id));
      if (!existente) throw new TRPCError({ code: "NOT_FOUND" });
      if (existente.estado !== "previsto") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Só lançamento previsto se confirma",
        });
      }
      const [lancamento] = await ctx.db
        .update(lancamentos)
        .set({
          estado: "confirmado",
          valorCents: input.valorCents,
          ...(input.dataVencimento
            ? { dataVencimento: input.dataVencimento }
            : {}),
        })
        .where(eq(lancamentos.id, input.id))
        .returning();
      await auditar(
        ctx.db,
        ctx.session,
        "confirmar",
        "lancamento",
        lancamento.id,
        { descricao: lancamento.descricao, valorCents: input.valorCents }
      );
      return lancamento;
    }),

  pagarLancamento: socioProcedure
    .input(
      z.object({ id: z.number().int(), dataPagamento: z.string().date().optional() })
    )
    .mutation(async ({ ctx, input }) => {
      const [existente] = await ctx.db
        .select()
        .from(lancamentos)
        .where(eq(lancamentos.id, input.id));
      if (!existente) throw new TRPCError({ code: "NOT_FOUND" });
      if (existente.estado === "pago") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Lançamento já pago",
        });
      }
      if (existente.valorCents === null) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Confirme o valor antes de pagar",
        });
      }
      const [lancamento] = await ctx.db
        .update(lancamentos)
        .set({
          estado: "pago",
          dataPagamento:
            input.dataPagamento ??
            new Intl.DateTimeFormat("en-CA", {
              timeZone: "America/Sao_Paulo",
            }).format(new Date()),
        })
        .where(eq(lancamentos.id, input.id))
        .returning();
      await auditar(ctx.db, ctx.session, "pagar", "lancamento", lancamento.id, {
        descricao: lancamento.descricao,
        valorCents: lancamento.valorCents,
      });
      return lancamento;
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
