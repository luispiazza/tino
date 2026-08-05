import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, gte, lte, ne, sql } from "drizzle-orm";
import { router, protectedProcedure, socioProcedure } from "../trpc";
import {
  ajustes,
  reservas,
  tarefaTemplates,
  tarefas,
  usuarios,
} from "../db/schema";
import { gerarDia } from "../rotina/gerador";
import { auditar } from "../auditoria";

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
