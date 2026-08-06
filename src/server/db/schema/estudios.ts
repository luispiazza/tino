import {
  pgTable,
  serial,
  varchar,
  text,
  integer,
  boolean,
  jsonb,
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
  /*
   * A página do estúdio é o que responde antes da ligação — e o que o
   * Google indexa. Tudo aqui é cadastro, editável no admin: nenhum
   * texto de venda mora no código.
   */
  visaoGeral: text("visao_geral"),
  /* [{ valor: "60a", rotulo: "PTV e Camlock" }] — os números que decidem */
  specs: jsonb("specs").$type<{ valor: string; rotulo: string }[]>(),
  /* ["Camarim exclusivo com banheiro", "Cozinha completa"] */
  caracteristicas: jsonb("caracteristicas").$type<string[]>(),
  plantaBaixaUrl: varchar("planta_baixa_url", { length: 300 }),
  plantaEletricaUrl: varchar("planta_eletrica_url", { length: 300 }),
  fotoUrl: varchar("foto_url", { length: 300 }),
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
