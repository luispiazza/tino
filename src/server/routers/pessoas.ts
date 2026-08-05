import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { asc, eq } from "drizzle-orm";
import { protectedProcedure, socioProcedure, router } from "../trpc";
import { naturezaPessoa, pessoas } from "../db/schema";
import { auditar } from "../auditoria";

const pessoaInput = z.object({
  nome: z.string().min(1).max(100),
  natureza: z.enum(naturezaPessoa.enumValues),
  telefone: z.string().max(20).nullish(),
  email: z.string().email().max(120).nullish(),
});

/*
 * Cadastro único das quatro naturezas (Domínio 2): funcionário, sócio
 * executor, parceiro pontual, fornecedor recorrente. Editar é de sócio;
 * consultar é de qualquer logado (a timeline mostra quem fez o quê).
 */
export const pessoasRouter = router({
  listar: protectedProcedure.query(({ ctx }) =>
    ctx.db.select().from(pessoas).orderBy(asc(pessoas.nome))
  ),

  criar: socioProcedure.input(pessoaInput).mutation(async ({ ctx, input }) => {
    const [pessoa] = await ctx.db.insert(pessoas).values(input).returning();
    await auditar(ctx.db, ctx.session, "criar", "pessoa", pessoa.id, {
      nome: pessoa.nome,
      natureza: pessoa.natureza,
    });
    return pessoa;
  }),

  atualizar: socioProcedure
    .input(pessoaInput.partial().extend({ id: z.number().int(), ativo: z.boolean().optional() }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...dados } = input;
      const [pessoa] = await ctx.db
        .update(pessoas)
        .set(dados)
        .where(eq(pessoas.id, id))
        .returning();
      if (!pessoa) throw new TRPCError({ code: "NOT_FOUND" });
      await auditar(ctx.db, ctx.session, "atualizar", "pessoa", pessoa.id, {
        nome: pessoa.nome,
        campos: Object.keys(dados),
      });
      return pessoa;
    }),
});
