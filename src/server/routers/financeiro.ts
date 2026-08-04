import { z } from "zod";
import { router, socioProcedure } from "../trpc";

/*
 * Domínio 7 — inteiro atrás de socioProcedure.
 * Agenda de obrigações é o coração; extrato e fluxo de caixa saem dela.
 * Toda tela alterna competência ↔ caixa.
 */
export const financeiroRouter = router({
  agendaDeObrigacoes: socioProcedure.query(async () => {
    return [];
  }),

  importarExtrato: socioProcedure
    .input(z.object({ banco: z.string(), csv: z.string() }))
    .mutation(async () => {
      // TODO: parsear linhas, casar automático por valor + data,
      // deixar o resto como pendente
      throw new Error("não implementado");
    }),

  /*
   * PIX caiu na conta sem identificação: o sócio associa a linha
   * pendente a uma ou mais cobranças (ou a um lançamento de entrada).
   * A soma das associações precisa fechar com o valor da linha.
   */
  associarRecebimento: socioProcedure
    .input(
      z.object({
        linhaId: z.number(),
        associacoes: z
          .array(
            z.object({
              cobrancaId: z.number().optional(),
              lancamentoId: z.number().optional(),
              valorCents: z.number().int().positive(),
            })
          )
          .min(1),
      })
    )
    .mutation(async () => {
      // TODO: validar soma = valor da linha, gravar conciliações,
      // marcar cobrança como paga e a linha como conciliada
      throw new Error("não implementado");
    }),
});
