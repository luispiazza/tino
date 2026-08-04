import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { desc, eq, inArray } from "drizzle-orm";
import { publicProcedure, socioProcedure, router } from "../trpc";
import { reservaEstudios, reservas } from "../db/schema";
import {
  buscarConflitos,
  complementaresSemBase,
} from "../reservas/disponibilidade";
import { gerarTokenPortal, proximoCodigo } from "../reservas/codigo";

const dataISO = z.string().date();
const hora = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "use HH:MM");

const periodoInput = z
  .object({
    dataInicio: dataISO,
    dataFim: dataISO,
    /* sem horário = o dia inteiro (qualquer reserva no período conflita) */
    horaInicio: hora.default("00:00"),
    horaFim: hora.default("23:59"),
    estudioIds: z.array(z.number().int()).min(1),
  })
  .refine((p) => p.dataFim >= p.dataInicio, {
    message: "dataFim antes de dataInicio",
  })
  .refine((p) => p.horaFim > p.horaInicio, {
    message: "horaFim deve ser depois de horaInicio",
  });

/*
 * Domínio 1. A criação SEMPRE checa conflito de agenda — período e
 * horário (diária parcial existe) — pela mesma regra que a consulta
 * pública usa. Complementar nunca entra sem a base (B sem A, C sem A/E).
 */
export const reservasRouter = router({
  disponibilidade: publicProcedure
    .input(periodoInput)
    .query(async ({ ctx, input }) => {
      const conflitos = await buscarConflitos(ctx.db, input);
      return { disponivel: conflitos.length === 0, conflitos };
    }),

  criar: socioProcedure
    .input(
      z
        .object({
          dataInicio: dataISO,
          dataFim: dataISO,
          horaInicio: hora,
          horaFim: hora,
          estudioIds: z.array(z.number().int()).min(1),
          clienteId: z.number().int().nullish(),
        })
        .refine((p) => p.dataFim >= p.dataInicio, {
          message: "dataFim antes de dataInicio",
        })
        .refine((p) => p.horaFim > p.horaInicio, {
          message: "horaFim deve ser depois de horaInicio",
        })
    )
    .mutation(async ({ ctx, input }) => {
      const semBase = await complementaresSemBase(ctx.db, input.estudioIds);
      if (semBase.length > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Complementar não é vendido sozinho: ${semBase.join(", ")} exige o estúdio de que depende na mesma reserva`,
        });
      }

      return ctx.db.transaction(async (tx) => {
        const conflitos = await buscarConflitos(tx, input);
        if (conflitos.length > 0) {
          const codigos = [...new Set(conflitos.map((c) => c.codigo))];
          throw new TRPCError({
            code: "CONFLICT",
            message: `Conflito de agenda com ${codigos.join(", ")}`,
          });
        }

        const codigo = await proximoCodigo(tx, input.dataInicio);
        const [reserva] = await tx
          .insert(reservas)
          .values({
            codigo,
            clienteId: input.clienteId ?? null,
            dataInicio: input.dataInicio,
            dataFim: input.dataFim,
            horaInicio: input.horaInicio,
            horaFim: input.horaFim,
            tokenPortalReserva: gerarTokenPortal(),
            tokenPortalProdutor: gerarTokenPortal(),
          })
          .returning();
        await tx.insert(reservaEstudios).values(
          input.estudioIds.map((estudioId) => ({
            reservaId: reserva.id,
            estudioId,
          }))
        );
        return { ...reserva, estudioIds: input.estudioIds };
      });
    }),

  listar: socioProcedure.query(async ({ ctx }) => {
    const lista = await ctx.db
      .select()
      .from(reservas)
      .orderBy(desc(reservas.dataInicio));
    const juncao = lista.length
      ? await ctx.db
          .select()
          .from(reservaEstudios)
          .where(
            inArray(
              reservaEstudios.reservaId,
              lista.map((r) => r.id)
            )
          )
      : [];
    return lista.map((r) => ({
      ...r,
      estudioIds: juncao
        .filter((j) => j.reservaId === r.id)
        .map((j) => j.estudioId),
    }));
  }),

  confirmar: socioProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const [reserva] = await ctx.db
        .update(reservas)
        .set({ status: "confirmada" })
        .where(eq(reservas.id, input.id))
        .returning();
      if (!reserva) throw new TRPCError({ code: "NOT_FOUND" });
      return reserva;
    }),

  cancelar: socioProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const [reserva] = await ctx.db
        .update(reservas)
        .set({ status: "cancelada" })
        .where(eq(reservas.id, input.id))
        .returning();
      if (!reserva) throw new TRPCError({ code: "NOT_FOUND" });
      return reserva;
    }),
});
