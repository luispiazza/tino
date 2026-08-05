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

/*
 * Matriz de permissões (25/07): três papéis com login. Cliente/produtor
 * nunca aparece aqui — token opaco na URL do portal, sem conta.
 */
export const papelUsuario = pgEnum("papel_usuario", [
  "socio",
  "funcionario",
  "fornecedor",
]);

export const usuarios = pgTable("usuarios", {
  id: serial("id").primaryKey(),
  nome: varchar("nome", { length: 100 }).notNull(),
  email: varchar("email", { length: 120 }).notNull().unique(),
  /* scrypt — `salt:hash`, os dois em hex */
  senhaHash: varchar("senha_hash", { length: 200 }).notNull(),
  papel: papelUsuario("papel").notNull(),
  /* liga o login ao cadastro de pessoas (fornecedor vê só o que é dele) */
  pessoaId: integer("pessoa_id").references(() => pessoas.id),
  ativo: boolean("ativo").notNull().default(true),
  criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
});

export const sessoes = pgTable("sessoes", {
  id: serial("id").primaryKey(),
  token: varchar("token", { length: 64 }).notNull().unique(),
  usuarioId: integer("usuario_id")
    .notNull()
    .references(() => usuarios.id),
  expiraEm: timestamp("expira_em", { withTimezone: true }).notNull(),
  criadaEm: timestamp("criada_em", { withTimezone: true }).notNull().defaultNow(),
});
