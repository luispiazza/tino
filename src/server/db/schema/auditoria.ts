import {
  pgTable,
  serial,
  varchar,
  integer,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";

/*
 * Trilha de auditoria — Fase 1. Toda mutation de negócio grava quem,
 * o quê e quando. O nome vai de snapshot (como o preço nos pedidos do
 * Rental): trocar o nome do usuário não reescreve a história — e sem
 * FK, apagar um usuário não apaga o rastro do que ele fez.
 */
export const auditoria = pgTable("auditoria", {
  id: serial("id").primaryKey(),
  usuarioId: integer("usuario_id").notNull(),
  usuarioNome: varchar("usuario_nome", { length: 100 }).notNull(),
  acao: varchar("acao", { length: 40 }).notNull(),
  entidade: varchar("entidade", { length: 30 }).notNull(),
  entidadeId: integer("entidade_id"),
  detalhe: jsonb("detalhe"),
  criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
});
