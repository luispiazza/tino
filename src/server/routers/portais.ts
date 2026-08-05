import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { publicProcedure, router } from "../trpc";
import { reservas } from "../db/schema";
import { buscarReservaPorToken } from "../reservas/portal";

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
