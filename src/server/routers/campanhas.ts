import { z } from "zod";
import { router, publicProcedure, socioProcedure } from "../trpc";
import type { campanhas } from "../db/schema";

export type Campanha = typeof campanhas.$inferSelect;

/*
 * Domínio 9. Gravar montagem e ler campanha são públicos — acontecem
 * na vitrine, antes de qualquer login. Criar campanha e ler o funil
 * são coisa de sócio.
 */
export const campanhasRouter = router({
  listar: socioProcedure.query(async (): Promise<Campanha[]> => {
    // TODO: todas as campanhas, ativas primeiro, mais recente no topo
    return [];
  }),

  criar: socioProcedure
    .input(
      z.object({
        slug: z
          .string()
          .min(3)
          .max(60)
          .regex(/^[a-z0-9-]+$/, "só letras minúsculas, números e hífen"),
        nome: z.string().min(1).max(100),
        canal: z.string().max(30).optional(),
        segmento: z.string().max(30).optional(),
        heroVideoUrl: z.string().url().optional(),
        heroTitulo: z.string().max(120).optional(),
        heroSubtitulo: z.string().max(200).optional(),
        ogTitulo: z.string().max(90).optional(),
        ogDescricao: z.string().max(200).optional(),
        ogImageUrl: z.string().url().optional(),
      })
    )
    .mutation(async () => {
      // TODO: gravar campanha; upload de vídeo e imagem OG vai ao S3
      // por URL pré-assinada, aqui só chegam as URLs finais
      throw new Error("não implementado");
    }),

  porSlug: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async () => {
      // TODO: retornar campanha ativa ou null (página cai no padrão)
      return null;
    }),

  gravarMontagem: publicProcedure
    .input(
      z.object({
        combinacao: z.string().optional(),
        dataDesejada: z.string().date().optional(),
        segmento: z.string().optional(),
        canal: z.string().optional(),
        campanhaSlug: z.string().optional(),
        termo: z.string().optional(),
      })
    )
    .mutation(async () => {
      // TODO: resolver campanhaSlug → campanhaId, gerar código curto
      // e gravar, mesmo incompleta
      throw new Error("não implementado");
    }),

  funil: socioProcedure.query(async () => {
    return [];
  }),
});
