import { and, eq, gte, inArray, lte, ne, sql } from "drizzle-orm";
import type { DB } from "../db";
import { itens, pedidoItens, pedidos, reservas } from "../db/schema";

/*
 * Domínio 3 — a disponibilidade de um item é por PERÍODO, não por dia:
 * uma arara pedida numa reserva de 3 dias fica ocupada os 3 dias. Item
 * sem qtdTotal é consumível/ilimitado e nunca trava pedido.
 *
 * Reserva cancelada não segura equipamento.
 */
export async function catalogoComDisponibilidade(
  db: DB,
  periodo: { dataInicio: string; dataFim: string; ignorarReservaId?: number }
) {
  const catalogo = await db
    .select()
    .from(itens)
    .where(eq(itens.ativo, true))
    .orderBy(itens.nome);

  /* quanto de cada item já está comprometido em reservas que cruzam o período */
  const condicoes = [
    ne(reservas.status, "cancelada"),
    lte(reservas.dataInicio, periodo.dataFim),
    gte(reservas.dataFim, periodo.dataInicio),
  ];
  if (periodo.ignorarReservaId !== undefined) {
    condicoes.push(ne(reservas.id, periodo.ignorarReservaId));
  }

  const comprometidos = await db
    .select({
      itemId: pedidoItens.itemId,
      qtd: sql<number>`coalesce(sum(${pedidoItens.qtd}), 0)::int`,
    })
    .from(pedidoItens)
    .innerJoin(pedidos, eq(pedidoItens.pedidoId, pedidos.id))
    .innerJoin(reservas, eq(pedidos.reservaId, reservas.id))
    .where(and(...condicoes))
    .groupBy(pedidoItens.itemId);

  const ocupado = new Map(comprometidos.map((c) => [c.itemId, c.qtd]));

  return catalogo.map((item) => ({
    ...item,
    /* null = sem limite de estoque */
    disponivel:
      item.qtdTotal === null
        ? null
        : Math.max(0, item.qtdTotal - (ocupado.get(item.id) ?? 0)),
  }));
}

export async function itensDaReserva(db: DB, reservaId: number) {
  return db
    .select({
      pedidoId: pedidoItens.pedidoId,
      itemId: pedidoItens.itemId,
      nomeItem: pedidoItens.nomeItem,
      qtd: pedidoItens.qtd,
      precoCents: pedidoItens.precoCents,
      status: pedidos.status,
    })
    .from(pedidoItens)
    .innerJoin(pedidos, eq(pedidoItens.pedidoId, pedidos.id))
    .where(eq(pedidos.reservaId, reservaId));
}

export async function totalExtrasCents(
  db: DB,
  reservaIds: number[]
): Promise<Map<number, number>> {
  if (reservaIds.length === 0) return new Map();
  const linhas = await db
    .select({
      reservaId: pedidos.reservaId,
      total: sql<number>`coalesce(sum(${pedidoItens.qtd} * ${pedidoItens.precoCents}), 0)::int`,
    })
    .from(pedidoItens)
    .innerJoin(pedidos, eq(pedidoItens.pedidoId, pedidos.id))
    .where(inArray(pedidos.reservaId, reservaIds))
    .groupBy(pedidos.reservaId);
  return new Map(linhas.map((l) => [l.reservaId, l.total]));
}
