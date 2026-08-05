import { randomBytes } from "node:crypto";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, sql } from "drizzle-orm";
import { router, publicProcedure, socioProcedure } from "../trpc";
import { campanhas, montagens } from "../db/schema";
import { auditar } from "../auditoria";

export type Campanha = typeof campanhas.$inferSelect;

const camposCampanha = z.object({
  nome: z.string().min(1).max(100),
  canal: z.string().max(30).nullish(),
  segmento: z.string().max(30).nullish(),
  heroVideoUrl: z.string().url().max(300).nullish(),
  heroTitulo: z.string().max(120).nullish(),
  heroSubtitulo: z.string().max(200).nullish(),
  ogTitulo: z.string().max(90).nullish(),
  ogDescricao: z.string().max(200).nullish(),
  ogImageUrl: z.string().url().max(300).nullish(),
});

/* M- + 4 caracteres sem ambiguidade (sem 0/O, 1/I) — cabe falado */
function gerarCodigoCurto(): string {
  const alfabeto = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  const bytes = randomBytes(4);
  let codigo = "M-";
  for (const b of bytes) codigo += alfabeto[b % alfabeto.length];
  return codigo;
}

/*
 * Domínio 9. Gravar montagem e ler campanha são públicos — acontecem
 * na vitrine, antes de qualquer login. Criar campanha e ler o funil
 * são coisa de sócio.
 */
export const campanhasRouter = router({
  listar: socioProcedure.query(
    async ({ ctx }): Promise<Campanha[]> =>
      ctx.db
        .select()
        .from(campanhas)
        .orderBy(desc(campanhas.ativa), desc(campanhas.criadaEm))
  ),

  criar: socioProcedure
    .input(
      camposCampanha.extend({
        slug: z
          .string()
          .min(3)
          .max(60)
          .regex(/^[a-z0-9-]+$/, "só letras minúsculas, números e hífen"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [campanha] = await ctx.db
        .insert(campanhas)
        .values(input)
        .returning();
      await auditar(ctx.db, ctx.session, "criar", "campanha", campanha.id, {
        slug: campanha.slug,
      });
      return campanha;
    }),

  atualizar: socioProcedure
    .input(
      camposCampanha.partial().extend({
        id: z.number().int(),
        ativa: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...dados } = input;
      const [campanha] = await ctx.db
        .update(campanhas)
        .set(dados)
        .where(eq(campanhas.id, id))
        .returning();
      if (!campanha) throw new TRPCError({ code: "NOT_FOUND" });
      await auditar(ctx.db, ctx.session, "atualizar", "campanha", campanha.id, {
        slug: campanha.slug,
        campos: Object.keys(dados),
      });
      return campanha;
    }),

  porSlug: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ ctx, input }) => {
      const [campanha] = await ctx.db
        .select()
        .from(campanhas)
        .where(and(eq(campanhas.slug, input.slug), eq(campanhas.ativa, true)))
        .limit(1);
      /* null = a página cai no conteúdo padrão, nunca 404 */
      return campanha ?? null;
    }),

  /*
   * Toda montagem grava, mesmo incompleta — a instrumentação da Fase 1.
   * O código curto sobrevive ao pulo para o wa.me e costura
   * montagem ↔ conversa ↔ reserva.
   */
  gravarMontagem: publicProcedure
    .input(
      z.object({
        combinacao: z.string().max(30).optional(),
        dataDesejada: z.string().date().optional(),
        segmento: z.string().max(30).optional(),
        canal: z.string().max(30).optional(),
        campanhaSlug: z.string().max(60).optional(),
        termo: z.string().max(100).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      let campanhaId: number | null = null;
      if (input.campanhaSlug) {
        const [c] = await ctx.db
          .select({ id: campanhas.id })
          .from(campanhas)
          .where(eq(campanhas.slug, input.campanhaSlug))
          .limit(1);
        campanhaId = c?.id ?? null;
      }
      /* colisão de código é rara (32^4) — tenta de novo até entrar */
      for (let tentativa = 0; tentativa < 5; tentativa++) {
        try {
          const [montagem] = await ctx.db
            .insert(montagens)
            .values({
              codigoCurto: gerarCodigoCurto(),
              combinacao: input.combinacao ?? null,
              dataDesejada: input.dataDesejada ?? null,
              segmento: input.segmento ?? null,
              canal: input.canal ?? null,
              campanhaId,
              termo: input.termo ?? null,
              etapa: "concluida",
            })
            .returning();
          return { codigoCurto: montagem.codigoCurto };
        } catch {
          continue;
        }
      }
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    }),

  marcarCliqueWhatsapp: publicProcedure
    .input(z.object({ codigoCurto: z.string().max(8) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(montagens)
        .set({ etapa: "clique_whatsapp" })
        .where(
          and(
            eq(montagens.codigoCurto, input.codigoCurto),
            eq(montagens.etapa, "concluida")
          )
        );
      return { ok: true };
    }),

  funil: socioProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select({
        campanhaId: montagens.campanhaId,
        etapa: montagens.etapa,
        total: sql<number>`count(*)::int`,
      })
      .from(montagens)
      .groupBy(montagens.campanhaId, montagens.etapa);
  }),
});
