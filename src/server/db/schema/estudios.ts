import {
  pgTable,
  serial,
  varchar,
  text,
  integer,
  boolean,
} from "drizzle-orm/pg-core";

/*
 * Domínio 1 — a ficha técnica é o maior ativo do produto e da busca orgânica.
 * Complementar não é produto: B e C nunca são vendidos sozinhos.
 */
export const estudios = pgTable("estudios", {
  id: serial("id").primaryKey(),
  codigo: varchar("codigo", { length: 8 }).notNull().unique(),
  nome: varchar("nome", { length: 100 }).notNull(),
  endereco: varchar("endereco", { length: 200 }),
  areaM2: integer("area_m2"),
  ehComplementar: boolean("eh_complementar").notNull().default(false),
  fichaTecnica: text("ficha_tecnica"),
});

/* B depende de A; C depende de A e de E. */
export const estudioDependencias = pgTable("estudio_dependencias", {
  id: serial("id").primaryKey(),
  estudioId: integer("estudio_id")
    .notNull()
    .references(() => estudios.id),
  dependeDeId: integer("depende_de_id")
    .notNull()
    .references(() => estudios.id),
});

/*
 * A unidade de venda e de apresentação: A+B, A+B+C, E+C…
 * A vitrine lista combinações, não estúdios.
 */
export const combinacoes = pgTable("combinacoes", {
  id: serial("id").primaryKey(),
  nome: varchar("nome", { length: 50 }).notNull(),
  areaM2: integer("area_m2"),
  destaque: boolean("destaque").notNull().default(false),
});
