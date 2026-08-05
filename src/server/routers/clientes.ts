import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { asc, eq } from "drizzle-orm";
import { socioProcedure, router } from "../trpc";
import { clientes } from "../db/schema";
import { auditar } from "../auditoria";

const clienteInput = z.object({
  nome: z.string().min(1).max(120),
  empresa: z.string().max(120).nullish(),
  telefone: z.string().max(20).nullish(),
  email: z.string().email().max(120).nullish(),
});

/* Valores e cadastro de cliente são coisa de sócio (matriz de permissões). */
export const clientesRouter = router({
  listar: socioProcedure.query(({ ctx }) =>
    ctx.db.select().from(clientes).orderBy(asc(clientes.nome))
  ),

  criar: socioProcedure
    .input(clienteInput)
    .mutation(async ({ ctx, input }) => {
      const [cliente] = await ctx.db.insert(clientes).values(input).returning();
      await auditar(ctx.db, ctx.session, "criar", "cliente", cliente.id, {
        nome: cliente.nome,
      });
      return cliente;
    }),

  atualizar: socioProcedure
    .input(clienteInput.partial().extend({ id: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...dados } = input;
      const [cliente] = await ctx.db
        .update(clientes)
        .set(dados)
        .where(eq(clientes.id, id))
        .returning();
      if (!cliente) throw new TRPCError({ code: "NOT_FOUND" });
      await auditar(ctx.db, ctx.session, "atualizar", "cliente", cliente.id, {
        nome: cliente.nome,
        campos: Object.keys(dados),
      });
      return cliente;
    }),
});
