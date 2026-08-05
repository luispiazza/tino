import {
  pgTable,
  serial,
  varchar,
  integer,
  boolean,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";
import { pessoas } from "./pessoas";
import { reservas } from "./reservas";

/*
 * Domínio 3 — catálogo ÚNICO de itens (a v1 mantinha dois em paralelo).
 * Dois regimes de controle:
 *  - conferência por pedido, com multa (araras, pranchões — valor justifica)
 *  - inventário periódico semanal, sem multa (kit cozinha, papel)
 * expectedQty nulo marca consumível — não entra no inventário.
 */
export const itens = pgTable("itens", {
  id: serial("id").primaryKey(),
  nome: varchar("nome", { length: 100 }).notNull(),
  unidade: varchar("unidade", { length: 20 }).notNull(),
  precoCents: integer("preco_cents").notNull(),
  /* custo de repasse por unidade POR DIA — multiplica pelos dias da locação */
  custoFornecedorCentsDia: integer("custo_fornecedor_cents_dia"),
  fornecedorId: integer("fornecedor_id").references(() => pessoas.id),
  /* nulo = ilimitado (consumível); número = estoque que trava o pedido */
  qtdTotal: integer("qtd_total"),
  qtdEsperada: integer("qtd_esperada"),
  /* padrão do item, copiado como snapshot no pedido */
  multaPorUnidadeCents: integer("multa_por_unidade_cents"),
  ativo: boolean("ativo").notNull().default(true),
});

export const pedidoStatus = pgEnum("pedido_status", [
  "aberto",
  "entregue",
  "conferido",
]);

/*
 * Os extras chegam em ondas: cada adição do cliente empilha aqui,
 * validando disponibilidade contra o período inteiro da reserva.
 * Preço, nome e unidade são resolvidos pelo servidor (nunca pelo cliente)
 * e copiados como snapshot no momento do pedido.
 */
export const pedidos = pgTable("pedidos", {
  id: serial("id").primaryKey(),
  reservaId: integer("reserva_id")
    .notNull()
    .references(() => reservas.id),
  status: pedidoStatus("status").notNull().default("aberto"),
  criadoEm: timestamp("criado_em", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const pedidoItens = pgTable("pedido_itens", {
  id: serial("id").primaryKey(),
  pedidoId: integer("pedido_id")
    .notNull()
    .references(() => pedidos.id),
  itemId: integer("item_id")
    .notNull()
    .references(() => itens.id),
  qtd: integer("qtd").notNull(),
  /* snapshots do momento do pedido */
  nomeItem: varchar("nome_item", { length: 100 }).notNull(),
  precoCents: integer("preco_cents").notNull(),
  multaPorUnidadeCents: integer("multa_por_unidade_cents"),
  qtdFaltante: integer("qtd_faltante"),
});
