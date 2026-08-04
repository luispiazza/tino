import {
  pgTable,
  serial,
  varchar,
  integer,
  boolean,
  date,
  time,
  pgEnum,
} from "drizzle-orm/pg-core";

/*
 * Domínio 2 — as quatro naturezas do cadastro único.
 * Fornecedor de equipamento (Ronaldo) e de serviço (pintor, faxineira)
 * compartilham a natureza; o que muda é o que cada um enxerga.
 */
export const naturezaPessoa = pgEnum("natureza_pessoa", [
  "funcionario",
  "socio_executor",
  "parceiro_pontual",
  "fornecedor_recorrente",
]);

export const pessoas = pgTable("pessoas", {
  id: serial("id").primaryKey(),
  nome: varchar("nome", { length: 100 }).notNull(),
  natureza: naturezaPessoa("natureza").notNull(),
  telefone: varchar("telefone", { length: 20 }),
  email: varchar("email", { length: 120 }),
  ativo: boolean("ativo").notNull().default(true),
});

/*
 * Escala: turno é vaga com data e jornada, não atributo da pessoa.
 * Vaga sem ocupante = turno descoberto (condição normal, não exceção).
 * O custo de cobertura vira despesa no financeiro.
 */
export const turnos = pgTable("turnos", {
  id: serial("id").primaryKey(),
  data: date("data").notNull(),
  horaInicio: time("hora_inicio").notNull(),
  horaFim: time("hora_fim").notNull(),
  pessoaId: integer("pessoa_id").references(() => pessoas.id),
  custoCoberturaCents: integer("custo_cobertura_cents"),
});
