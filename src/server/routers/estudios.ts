import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, inArray } from "drizzle-orm";
import { publicProcedure, socioProcedure, router } from "../trpc";
import { estudioDependencias, estudios } from "../db/schema";
import type { DB } from "../db";

const estudioInput = z.object({
  codigo: z.string().min(1).max(8),
  nome: z.string().min(1).max(100),
  endereco: z.string().max(200).nullish(),
  areaM2: z.number().int().positive().nullish(),
  ehComplementar: z.boolean().default(false),
  fichaTecnica: z.string().nullish(),
  /* de quem o complementar depende: B de A; C de A e de E */
  dependeDeIds: z.array(z.number().int()).default([]),
});

/*
 * Cadastro é coisa de sócio (matriz de permissões); a listagem é
 * pública — a ficha técnica alimenta a vitrine com SSR.
 */
export const estudiosRouter = router({
  listar: publicProcedure.query(async ({ ctx }) => {
    const lista = await ctx.db.select().from(estudios);
    const dependencias = await ctx.db.select().from(estudioDependencias);
    return lista.map((e) => ({
      ...e,
      dependeDeIds: dependencias
        .filter((d) => d.estudioId === e.id)
        .map((d) => d.dependeDeId),
    }));
  }),

  criar: socioProcedure.input(estudioInput).mutation(async ({ ctx, input }) => {
    const { dependeDeIds, ...dados } = input;
    await validarDependencias(ctx.db, dependeDeIds, input.ehComplementar);
    return ctx.db.transaction(async (tx) => {
      const [estudio] = await tx.insert(estudios).values(dados).returning();
      if (dependeDeIds.length > 0) {
        await tx.insert(estudioDependencias).values(
          dependeDeIds.map((dependeDeId) => ({
            estudioId: estudio.id,
            dependeDeId,
          }))
        );
      }
      return estudio;
    });
  }),

  atualizar: socioProcedure
    .input(estudioInput.partial().extend({ id: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const { id, dependeDeIds, ...dados } = input;
      return ctx.db.transaction(async (tx) => {
        const [estudio] = await tx
          .update(estudios)
          .set(dados)
          .where(eq(estudios.id, id))
          .returning();
        if (!estudio) throw new TRPCError({ code: "NOT_FOUND" });
        if (dependeDeIds !== undefined) {
          await tx
            .delete(estudioDependencias)
            .where(eq(estudioDependencias.estudioId, id));
          if (dependeDeIds.length > 0) {
            await tx.insert(estudioDependencias).values(
              dependeDeIds.map((dependeDeId) => ({
                estudioId: id,
                dependeDeId,
              }))
            );
          }
        }
        return estudio;
      });
    }),
});

async function validarDependencias(
  db: DB,
  dependeDeIds: number[],
  ehComplementar: boolean
) {
  if (dependeDeIds.length === 0) return;
  if (!ehComplementar) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Só estúdio complementar depende de outro",
    });
  }
  const bases = await db
    .select({ id: estudios.id })
    .from(estudios)
    .where(inArray(estudios.id, dependeDeIds));
  if (bases.length !== dependeDeIds.length) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Dependência aponta para estúdio inexistente",
    });
  }
}
