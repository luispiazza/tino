import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { publicProcedure, router } from "../trpc";
import { pedidoItens, pedidos, reservas } from "../db/schema";
import { buscarReservaPorToken } from "../reservas/portal";
import { catalogoComDisponibilidade } from "../rental/disponibilidade";

/*
 * Ações dos portais — sem login, autenticadas pelo token opaco da URL.
 * É `publicProcedure` de propósito: o cliente/produtor muda a cada job,
 * criar conta seria atrito. A credencial é o token (64 hex, aleatório e
 * revogável), nunca o código da reserva — a lição do problema 2 da v1,
 * em que adivinhar T_01042026A abria dados e alterava check-in alheio.
 */

const token = z.string().regex(/^[0-9a-f]{64}$/, "token inválido");

async function reservaDoProdutor(
  db: Parameters<typeof buscarReservaPorToken>[0],
  tokenPortalProdutor: string
) {
  const reserva = await buscarReservaPorToken(
    db,
    tokenPortalProdutor,
    "produtor"
  );
  if (!reserva) throw new TRPCError({ code: "NOT_FOUND" });
  if (reserva.status === "cancelada")
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Esta reserva foi cancelada",
    });
  return reserva;
}

export const portaisRouter = router({
  /* catálogo do dia da reserva, com o que sobra de cada item */
  catalogoExtras: publicProcedure
    .input(z.object({ token }))
    .query(async ({ ctx, input }) => {
      const reserva = await reservaDoProdutor(ctx.db, input.token);
      /* o que esta reserva já pediu também sai do estoque — o número
       * na tela tem que ser o mesmo que a validação aplica */
      const catalogo = await catalogoComDisponibilidade(ctx.db, {
        dataInicio: reserva.dataInicio,
        dataFim: reserva.dataFim,
      });
      /* o portal não precisa saber custo de fornecedor nem multa */
      return catalogo.map((i) => ({
        id: i.id,
        nome: i.nome,
        unidade: i.unidade,
        precoCents: i.precoCents,
        disponivel: i.disponivel,
      }));
    }),

  /*
   * O pedido do produtor. O cliente manda APENAS id e quantidade — preço,
   * nome e unidade são resolvidos aqui. Na v1 o preço vinha no corpo do
   * pedido, e o portal era público: qualquer um pedia arara por R$ 0,01.
   */
  pedirExtras: publicProcedure
    .input(
      z.object({
        token,
        itens: z
          .array(
            z.object({
              itemId: z.number().int(),
              qtd: z.number().int().positive().max(999),
            })
          )
          .min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const reserva = await reservaDoProdutor(ctx.db, input.token);
      const catalogo = await catalogoComDisponibilidade(ctx.db, {
        dataInicio: reserva.dataInicio,
        dataFim: reserva.dataFim,
      });
      const porId = new Map(catalogo.map((i) => [i.id, i]));

      for (const pedido of input.itens) {
        const item = porId.get(pedido.itemId);
        if (!item)
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Item indisponível",
          });
        if (item.disponivel !== null && pedido.qtd > item.disponivel) {
          throw new TRPCError({
            code: "CONFLICT",
            message:
              item.disponivel > 0
                ? `Só temos ${item.disponivel} de ${item.nome} para esta data`
                : `${item.nome} não está disponível para esta data`,
          });
        }
      }

      return ctx.db.transaction(async (tx) => {
        const [pedido] = await tx
          .insert(pedidos)
          .values({ reservaId: reserva.id })
          .returning();
        const linhas = await tx
          .insert(pedidoItens)
          .values(
            input.itens.map((p) => {
              const item = porId.get(p.itemId)!;
              return {
                pedidoId: pedido.id,
                itemId: item.id,
                qtd: p.qtd,
                /* snapshot: reajuste de amanhã não reescreve o pedido de hoje */
                nomeItem: item.nome,
                precoCents: item.precoCents,
                multaPorUnidadeCents: item.multaPorUnidadeCents,
              };
            })
          )
          .returning();
        return { pedidoId: pedido.id, itens: linhas.length };
      });
    }),

  registrarCheckIn: publicProcedure
    .input(z.object({ token }))
    .mutation(async ({ ctx, input }) => {
      const reserva = await reservaDoProdutor(ctx.db, input.token);
      if (reserva.checkInEm)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Chegada já registrada",
        });
      const [atualizada] = await ctx.db
        .update(reservas)
        .set({ checkInEm: new Date() })
        .where(
          and(
            eq(reservas.id, reserva.id),
            eq(reservas.tokenPortalProdutor, input.token)
          )
        )
        .returning({ checkInEm: reservas.checkInEm });
      return atualizada;
    }),

  registrarCheckOut: publicProcedure
    .input(z.object({ token }))
    .mutation(async ({ ctx, input }) => {
      const reserva = await reservaDoProdutor(ctx.db, input.token);
      if (reserva.checkOutEm)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Saída já registrada",
        });
      const [atualizada] = await ctx.db
        .update(reservas)
        .set({ checkOutEm: new Date() })
        .where(
          and(
            eq(reservas.id, reserva.id),
            eq(reservas.tokenPortalProdutor, input.token)
          )
        )
        .returning({ checkOutEm: reservas.checkOutEm });
      return atualizada;
    }),
});
