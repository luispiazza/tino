import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  and,
  asc,
  desc,
  eq,
  gte,
  isNotNull,
  isNull,
  lte,
  ne,
  sql,
} from "drizzle-orm";
import { router, protectedProcedure, socioProcedure } from "../trpc";
import {
  ajustes,
  folgas,
  pessoas,
  ponto,
  reservas,
  tarefaTemplates,
  tarefas,
  turnos,
  usuarios,
} from "../db/schema";
import { gerarDia } from "../rotina/gerador";
import { compararJornada } from "../escala/jornada";
import { auditar } from "../auditoria";

const hora = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "use HH:MM");

export type Tarefa = typeof tarefas.$inferSelect;

const hojeSP = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(
    new Date()
  );

/*
 * Domínio 2. Geração determinística, sem LLM: lê reservas (nunca um
 * cache de calendário), pendência não evapora, e o plano roda direto —
 * a rede de proteção é corrigir em poucos toques, com ajuste registrado.
 */
export const escalaRouter = router({
  timelineDoDia: protectedProcedure
    .input(z.object({ data: z.string().date().optional() }))
    .query(async ({ ctx, input }): Promise<Tarefa[]> => {
      const data = input.data ?? hojeSP();
      /* gera sob demanda — vira cron quando o job entrar no Railway */
      await gerarDia(ctx.db, data);
      return ctx.db
        .select()
        .from(tarefas)
        .where(eq(tarefas.data, data))
        .orderBy(
          /* com hora primeiro, em ordem; sem hora no fim */
          sql`${tarefas.horaPrevista} nulls last`,
          asc(tarefas.id)
        );
    }),

  concluirTarefa: protectedProcedure
    .input(z.object({ tarefaId: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      /* a atribuição acontece AQUI, não no planejamento */
      const [usuario] = await ctx.db
        .select({ pessoaId: usuarios.pessoaId })
        .from(usuarios)
        .where(eq(usuarios.id, ctx.session.usuarioId));
      const [tarefa] = await ctx.db
        .update(tarefas)
        .set({
          estado: "feita",
          feitaPorId: usuario?.pessoaId ?? null,
          concluidaEm: new Date(),
        })
        .where(
          and(eq(tarefas.id, input.tarefaId), eq(tarefas.estado, "pendente"))
        )
        .returning();
      if (!tarefa)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Tarefa não encontrada ou já concluída",
        });
      await auditar(ctx.db, ctx.session, "concluir", "tarefa", tarefa.id, {
        titulo: tarefa.titulo,
        data: tarefa.data,
      });
      return tarefa;
    }),

  /* ---------- Escala: vagas de turno ---------- */

  /*
   * A vaga existe antes do ocupante: "sábado 14h–22h" é um turno que
   * precisa ser coberto, com ou sem alguém. Vaga sem pessoa aparece
   * como descoberta — condição normal da operação de hoje, não erro.
   */
  criarTurno: socioProcedure
    .input(
      z.object({
        data: z.string().date(),
        horaInicio: hora,
        horaFim: hora,
        pessoaId: z.number().int().nullish(),
        custoCoberturaCents: z.number().int().nonnegative().nullish(),
        observacao: z.string().max(200).nullish(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [turno] = await ctx.db.insert(turnos).values(input).returning();
      await auditar(ctx.db, ctx.session, "criar", "turno", turno.id, {
        data: turno.data,
        pessoaId: turno.pessoaId,
      });
      return turno;
    }),

  atualizarTurno: socioProcedure
    .input(
      z.object({
        id: z.number().int(),
        pessoaId: z.number().int().nullable().optional(),
        custoCoberturaCents: z.number().int().nonnegative().nullable().optional(),
        observacao: z.string().max(200).nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...dados } = input;
      const [turno] = await ctx.db
        .update(turnos)
        .set(dados)
        .where(eq(turnos.id, id))
        .returning();
      if (!turno) throw new TRPCError({ code: "NOT_FOUND" });
      await auditar(ctx.db, ctx.session, "atualizar", "turno", turno.id, {
        data: turno.data,
        campos: Object.keys(dados),
      });
      return turno;
    }),

  removerTurno: socioProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const [comPonto] = await ctx.db
        .select({ id: ponto.id })
        .from(ponto)
        .where(eq(ponto.turnoId, input.id))
        .limit(1);
      if (comPonto)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Turno já tem ponto registrado",
        });
      await ctx.db.delete(turnos).where(eq(turnos.id, input.id));
      await auditar(ctx.db, ctx.session, "remover", "turno", input.id, null);
      return { ok: true };
    }),

  /* A escala da semana: vagas, quem ocupa, folgas e o ponto do dia. */
  escalaDaSemana: protectedProcedure
    .input(z.object({ inicio: z.string().date(), fim: z.string().date() }))
    .query(async ({ ctx, input }) => {
      const vagas = await ctx.db
        .select({
          turno: turnos,
          pessoaNome: pessoas.nome,
        })
        .from(turnos)
        .leftJoin(pessoas, eq(turnos.pessoaId, pessoas.id))
        .where(and(gte(turnos.data, input.inicio), lte(turnos.data, input.fim)))
        .orderBy(asc(turnos.data), asc(turnos.horaInicio));

      const pontos = await ctx.db
        .select()
        .from(ponto)
        .where(and(gte(ponto.data, input.inicio), lte(ponto.data, input.fim)));

      const folgasDaSemana = await ctx.db
        .select({ folga: folgas, pessoaNome: pessoas.nome })
        .from(folgas)
        .innerJoin(pessoas, eq(folgas.pessoaId, pessoas.id))
        .where(and(gte(folgas.data, input.inicio), lte(folgas.data, input.fim)));

      return {
        turnos: vagas.map(({ turno, pessoaNome }) => {
          const p = pontos.find((x) => x.turnoId === turno.id) ?? null;
          return {
            ...turno,
            pessoaNome,
            ponto: p,
            jornada: compararJornada(turno, p),
            descoberto: turno.pessoaId === null,
          };
        }),
        folgas: folgasDaSemana.map((f) => ({ ...f.folga, pessoaNome: f.pessoaNome })),
      };
    }),

  /* Folga não reatribui tarefa — sinaliza que o turno ficou descoberto */
  registrarFolga: socioProcedure
    .input(z.object({ pessoaId: z.number().int(), data: z.string().date() }))
    .mutation(async ({ ctx, input }) => {
      const [folga] = await ctx.db.insert(folgas).values(input).returning();
      await auditar(ctx.db, ctx.session, "registrar", "folga", folga.id, input);
      return folga;
    }),

  /* ---------- Ponto ---------- */

  /*
   * Um registro por pessoa e dia. Entrada e saída chegam em momentos
   * diferentes: o mesmo endpoint completa o que faltar.
   */
  baterPonto: protectedProcedure
    .input(
      z.object({
        turnoId: z.number().int(),
        entrada: hora.optional(),
        saida: hora.optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [turno] = await ctx.db
        .select()
        .from(turnos)
        .where(eq(turnos.id, input.turnoId));
      if (!turno) throw new TRPCError({ code: "NOT_FOUND" });
      if (!turno.pessoaId)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Defina quem cobre o turno antes de bater ponto",
        });

      const [existente] = await ctx.db
        .select()
        .from(ponto)
        .where(eq(ponto.turnoId, input.turnoId))
        .limit(1);

      const [registro] = existente
        ? await ctx.db
            .update(ponto)
            .set({
              ...(input.entrada ? { entrada: input.entrada } : {}),
              ...(input.saida ? { saida: input.saida } : {}),
            })
            .where(eq(ponto.id, existente.id))
            .returning()
        : await ctx.db
            .insert(ponto)
            .values({
              pessoaId: turno.pessoaId,
              data: turno.data,
              turnoId: turno.id,
              entrada: input.entrada ?? null,
              saida: input.saida ?? null,
            })
            .returning();

      await auditar(ctx.db, ctx.session, "bater_ponto", "ponto", registro.id, {
        turnoId: turno.id,
        entrada: registro.entrada,
        saida: registro.saida,
      });
      return { ...registro, jornada: compararJornada(turno, registro) };
    }),

  /*
   * A conta que justifica a contratação: quanto custou cobrir turno no
   * período — soma o custo declarado na vaga e as despesas marcadas
   * como cobertura. Sem base de comparação cadastrada, mostra o custo
   * sem veredito (comparar contra zero concluiria que contratar é
   * sempre mais caro).
   */
  custoDeCobertura: socioProcedure
    .input(z.object({ inicio: z.string().date(), fim: z.string().date() }))
    .query(async ({ ctx, input }) => {
      const vagas = await ctx.db
        .select({
          turno: turnos,
          pessoaNome: pessoas.nome,
        })
        .from(turnos)
        .leftJoin(pessoas, eq(turnos.pessoaId, pessoas.id))
        .where(
          and(
            gte(turnos.data, input.inicio),
            lte(turnos.data, input.fim),
            isNotNull(turnos.custoCoberturaCents)
          )
        )
        .orderBy(asc(turnos.data));

      const totalCents = vagas.reduce(
        (s, v) => s + (v.turno.custoCoberturaCents ?? 0),
        0
      );
      const descobertos = await ctx.db
        .select({ id: turnos.id })
        .from(turnos)
        .where(
          and(
            gte(turnos.data, input.inicio),
            lte(turnos.data, input.fim),
            isNull(turnos.pessoaId)
          )
        );

      return {
        totalCents,
        turnosComCusto: vagas.map((v) => ({
          id: v.turno.id,
          data: v.turno.data,
          pessoaNome: v.pessoaNome,
          custoCents: v.turno.custoCoberturaCents ?? 0,
          observacao: v.turno.observacao,
        })),
        turnosDescobertos: descobertos.length,
      };
    }),

  /* ---------- Templates — o cadastro das regras ---------- */

  listarTemplates: socioProcedure.query(({ ctx }) =>
    ctx.db
      .select()
      .from(tarefaTemplates)
      .orderBy(desc(tarefaTemplates.prioridade), asc(tarefaTemplates.titulo))
  ),

  criarTemplate: socioProcedure
    .input(
      z.object({
        titulo: z.string().min(1).max(150),
        frequenciaDias: z.number().int().min(1).max(365).default(1),
        modoShooting: z.enum(["shooting", "livre", "ambos"]).default("ambos"),
        requerEstudioVago: z.boolean().default(false),
        minutosEstimados: z.number().int().positive().nullish(),
        prioridade: z.number().int().min(0).max(10).default(0),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [template] = await ctx.db
        .insert(tarefaTemplates)
        .values(input)
        .returning();
      await auditar(ctx.db, ctx.session, "criar", "template", template.id, {
        titulo: template.titulo,
      });
      return template;
    }),

  atualizarTemplate: socioProcedure
    .input(
      z.object({
        id: z.number().int(),
        titulo: z.string().min(1).max(150).optional(),
        frequenciaDias: z.number().int().min(1).max(365).optional(),
        modoShooting: z.enum(["shooting", "livre", "ambos"]).optional(),
        requerEstudioVago: z.boolean().optional(),
        prioridade: z.number().int().min(0).max(10).optional(),
        ativo: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...dados } = input;
      const [template] = await ctx.db
        .update(tarefaTemplates)
        .set(dados)
        .where(eq(tarefaTemplates.id, id))
        .returning();
      if (!template) throw new TRPCError({ code: "NOT_FOUND" });
      await auditar(ctx.db, ctx.session, "atualizar", "template", template.id, {
        titulo: template.titulo,
        campos: Object.keys(dados),
      });
      return template;
    }),

  /* ---------- Ajustes — a métrica de regra errada ---------- */

  ajustarDia: socioProcedure
    .input(
      z.object({
        data: z.string().date(),
        descricao: z.string().min(1).max(300),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [reservaNoDia] = await ctx.db
        .select({ id: reservas.id })
        .from(reservas)
        .where(
          and(
            lte(reservas.dataInicio, input.data),
            gte(reservas.dataFim, input.data),
            ne(reservas.status, "cancelada")
          )
        )
        .limit(1);
      const [ajuste] = await ctx.db
        .insert(ajustes)
        .values({
          data: input.data,
          diaTipo: reservaNoDia ? "shooting" : "livre",
          descricao: input.descricao,
        })
        .returning();
      await auditar(ctx.db, ctx.session, "ajustar", "dia", null, {
        data: input.data,
        descricao: input.descricao,
      });
      return ajuste;
    }),

  relatorioDeAjustes: socioProcedure.query(async ({ ctx }) => {
    const todos = await ctx.db
      .select()
      .from(ajustes)
      .orderBy(desc(ajustes.criadoEm))
      .limit(100);
    const porTipo = { shooting: 0, livre: 0 };
    for (const a of todos) porTipo[a.diaTipo]++;
    return { porTipo, ultimos: todos };
  }),
});
