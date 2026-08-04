import { z } from "zod";
import { router, publicProcedure, socioProcedure } from "../trpc";

/*
 * Domínio 1. A criação SEMPRE checa conflito de agenda — período e horário,
 * incluindo a dependência dos complementares (C com A bloqueia C para E).
 */
export const reservasRouter = router({
  disponibilidade: publicProcedure
    .input(
      z.object({
        dataInicio: z.string().date(),
        dataFim: z.string().date(),
        estudioIds: z.array(z.number()),
      })
    )
    .query(async () => {
      // TODO: única regra de disponibilidade do sistema — todos consultam aqui
      return { disponivel: true as boolean };
    }),

  criar: socioProcedure
    .input(
      z.object({
        dataInicio: z.string().date(),
        dataFim: z.string().date(),
        horaInicio: z.string(),
        horaFim: z.string(),
        estudioIds: z.array(z.number()).min(1),
      })
    )
    .mutation(async () => {
      // TODO: checar conflito, gerar código T_DDMMYYYYX, gerar tokens opacos,
      // avisar viabilidade de virada (nunca recusar)
      throw new Error("não implementado");
    }),
});
