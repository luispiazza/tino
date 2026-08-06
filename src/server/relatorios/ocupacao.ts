import { and, eq, gte, lte, ne } from "drizzle-orm";
import type { DB } from "../db";
import { estudios, reservaEstudios, reservas } from "../db/schema";
import { montarComanda } from "../reservas/comanda";

/*
 * Ocupação por estúdio — o relatório que o planejamento aponta como
 * inexistente desde a v1. Conta DIAS ocupados, não reservas: uma
 * reserva de 3 dias ocupa 3; duas reservas no mesmo dia (diária
 * parcial) ocupam 1. Cancelada não ocupa nada.
 *
 * A receita é rateada entre os estúdios da reserva — A+B divide o
 * total em dois. É uma atribuição, não uma verdade contábil, e a tela
 * diz isso.
 */
export async function ocupacaoPorEstudio(
  db: DB,
  periodo: { inicio: string; fim: string }
) {
  const lista = await db.select().from(estudios).orderBy(estudios.codigo);

  const linhas = await db
    .select({ reserva: reservas, estudioId: reservaEstudios.estudioId })
    .from(reservas)
    .innerJoin(reservaEstudios, eq(reservaEstudios.reservaId, reservas.id))
    .where(
      and(
        ne(reservas.status, "cancelada"),
        lte(reservas.dataInicio, periodo.fim),
        gte(reservas.dataFim, periodo.inicio)
      )
    );

  /* dias distintos por estúdio, limitados à janela do relatório */
  const diasPorEstudio = new Map<number, Set<string>>();
  const receitaPorEstudio = new Map<number, number>();
  const diasDoPeriodo = new Set<string>();

  for (const { reserva, estudioId } of linhas) {
    const fim = new Date(
      (reserva.dataFim < periodo.fim ? reserva.dataFim : periodo.fim) + "T12:00Z"
    );
    const dias = diasPorEstudio.get(estudioId) ?? new Set<string>();
    for (
      let d = new Date(
        (reserva.dataInicio > periodo.inicio
          ? reserva.dataInicio
          : periodo.inicio) + "T12:00Z"
      );
      d <= fim;
      d.setUTCDate(d.getUTCDate() + 1)
    ) {
      const iso = d.toISOString().slice(0, 10);
      dias.add(iso);
      diasDoPeriodo.add(iso);
    }
    diasPorEstudio.set(estudioId, dias);

    const total = montarComanda(reserva).totalCents ?? 0;
    const quantosEstudios = linhas.filter(
      (l) => l.reserva.id === reserva.id
    ).length;
    receitaPorEstudio.set(
      estudioId,
      (receitaPorEstudio.get(estudioId) ?? 0) + total / quantosEstudios
    );
  }

  const totalDias =
    Math.round(
      (new Date(periodo.fim + "T12:00Z").getTime() -
        new Date(periodo.inicio + "T12:00Z").getTime()) /
        86400000
    ) + 1;

  return {
    totalDias,
    diasComShooting: diasDoPeriodo.size,
    estudios: lista.map((e) => {
      const dias = diasPorEstudio.get(e.id)?.size ?? 0;
      return {
        id: e.id,
        codigo: e.codigo,
        nome: e.nome,
        ehComplementar: e.ehComplementar,
        dias,
        taxa: totalDias > 0 ? dias / totalDias : 0,
        receitaCents: Math.round(receitaPorEstudio.get(e.id) ?? 0),
      };
    }),
  };
}
