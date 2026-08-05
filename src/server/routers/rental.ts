import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { asc, eq } from "drizzle-orm";
import { router, protectedProcedure, socioProcedure } from "../trpc";
import { itens } from "../db/schema";
import { catalogoComDisponibilidade } from "../rental/disponibilidade";
import { auditar } from "../auditoria";

const itemInput = z.object({
  nome: z.string().min(1).max(100),
  unidade: z.string().min(1).max(20),
  precoCents: z.number().int().nonnegative(),
  custoFornecedorCentsDia: z.number().int().nonnegative().nullish(),
  fornecedorId: z.number().int().nullish(),
  qtdTotal: z.number().int().nonnegative().nullish(),
  qtdEsperada: z.number().int().nonnegative().nullish(),
  multaPorUnidadeCents: z.number().int().nonnegative().nullish(),
});

/*
 * Domínio 3. Preço, nome e unidade sempre resolvidos pelo servidor.
 * Editar preço e apagar cadastro é socioProcedure — funcionário consulta
 * e monta pedido (a v1 deixava qualquer logado editar preço).
 */
export const rentalRouter = router({
  catalogo: protectedProcedure
    .input(
      z
        .object({
          dataInicio: z.string().date(),
          dataFim: z.string().date(),
          ignorarReservaId: z.number().int().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      if (!input) {
        return (await ctx.db.select().from(itens).orderBy(asc(itens.nome))).map(
          (i) => ({ ...i, disponivel: i.qtdTotal })
        );
      }
      return catalogoComDisponibilidade(ctx.db, input);
    }),

  criarItem: socioProcedure
    .input(itemInput)
    .mutation(async ({ ctx, input }) => {
      const [item] = await ctx.db.insert(itens).values(input).returning();
      await auditar(ctx.db, ctx.session, "criar", "item", item.id, {
        nome: item.nome,
        precoCents: item.precoCents,
      });
      return item;
    }),

  atualizarItem: socioProcedure
    .input(itemInput.partial().extend({ id: z.number().int(), ativo: z.boolean().optional() }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...dados } = input;
      const [item] = await ctx.db
        .update(itens)
        .set(dados)
        .where(eq(itens.id, id))
        .returning();
      if (!item) throw new TRPCError({ code: "NOT_FOUND" });
      await auditar(ctx.db, ctx.session, "atualizar", "item", item.id, {
        nome: item.nome,
        campos: Object.keys(dados),
      });
      return item;
    }),
});
