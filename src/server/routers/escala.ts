import { z } from "zod";
import { router, protectedProcedure, socioProcedure } from "../trpc";
import type { tarefas } from "../db/schema";

export type Tarefa = typeof tarefas.$inferSelect;

/*
 * Domínio 2. Geração determinística, sem LLM: lê reservas (nunca um
 * cache de calendário), pendência não evapora, folga sinaliza turno
 * descoberto. O plano roda direto, sem aprovação prévia — a rede de
 * proteção é corrigir em poucos toques, com todo ajuste registrado.
 *
 * O front é único: o papel do login limita ÁREAS, não o conteúdo do
 * dia. A timeline é a mesma para todos que estiverem no turno.
 */
export const escalaRouter = router({
  timelineDoDia: protectedProcedure
    .input(z.object({ data: z.string().date().optional() }))
    .query(async (): Promise<Tarefa[]> => {
      // TODO: todas as tarefas do dia (hoje se não vier data), em ordem
      // cronológica por horaPrevista, com as sem hora no fim
      return [];
    }),

  concluirTarefa: protectedProcedure
    .input(z.object({ tarefaId: z.number() }))
    .mutation(async () => {
      // TODO: marcar feita e gravar feitaPorId a partir da sessão —
      // a atribuição acontece aqui, não no planejamento
      throw new Error("não implementado");
    }),

  /*
   * O ajuste do sócio no plano gerado. Registrar é obrigatório:
   * o volume de ajustes por tipo de dia é a métrica de regra errada.
   */
  ajustarDia: socioProcedure
    .input(
      z.object({
        data: z.string().date(),
        descricao: z.string().min(1).max(300),
      })
    )
    .mutation(async () => {
      // TODO: aplicar o ajuste e gravar em ajustes_do_dia com o tipo
      // do dia (shooting ou livre) resolvido das reservas
      throw new Error("não implementado");
    }),

  relatorioDeAjustes: socioProcedure.query(async () => {
    // TODO: ajustes agrupados por tipo de dia — onde a regra erra
    return [];
  }),

  overviewSemanal: socioProcedure.query(async () => {
    // TODO: determinístico, sem LLM — feitas vs arrastadas, ajustes,
    // custo de cobertura da semana
    return null;
  }),
});
