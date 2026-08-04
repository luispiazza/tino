import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { Context } from "./context";

const t = initTRPC.context<Context>().create({
  transformer: superjson,
});

export const router = t.router;

/** Aberto — vitrine e consultas públicas. Nunca retorna dado privado. */
export const publicProcedure = t.procedure;

/** Qualquer usuário logado (sócio, funcionário ou fornecedor). */
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session) throw new TRPCError({ code: "UNAUTHORIZED" });
  return next({ ctx: { ...ctx, session: ctx.session } });
});

/**
 * Só sócio. Preço de aluguel, financeiro, cadastros, configuração e
 * resultados vivem exclusivamente aqui — a lição da v1, em que
 * qualquer funcionário logado editava preço e apagava cadastro.
 */
export const socioProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.session.papel !== "socio") throw new TRPCError({ code: "FORBIDDEN" });
  return next();
});

/** Fornecedor — enxerga apenas o que é dele (turnos ou pedidos). */
export const fornecedorProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.session.papel !== "fornecedor")
    throw new TRPCError({ code: "FORBIDDEN" });
  return next();
});
