import {
  pgTable,
  serial,
  varchar,
  integer,
  boolean,
  date,
  timestamp,
} from "drizzle-orm/pg-core";

/*
 * Domínio 9 — o gerador de campanha.
 * Cada campanha ganha uma URL própria (/c/slug) que troca o vídeo de
 * fundo e os textos do hero, e alimenta as OG tags dinamicamente.
 * O slug é a origem: quem chega por ele já entra medido, sem UTM.
 */
export const campanhas = pgTable("campanhas", {
  id: serial("id").primaryKey(),
  slug: varchar("slug", { length: 60 }).notNull().unique(),
  nome: varchar("nome", { length: 100 }).notNull(),
  canal: varchar("canal", { length: 30 }),
  segmento: varchar("segmento", { length: 30 }),
  /* hero da página */
  heroVideoUrl: varchar("hero_video_url", { length: 300 }),
  heroTitulo: varchar("hero_titulo", { length: 120 }),
  heroSubtitulo: varchar("hero_subtitulo", { length: 200 }),
  /* OG tags — imagem em 1200×630, textos nos limites de exibição */
  ogTitulo: varchar("og_titulo", { length: 90 }),
  ogDescricao: varchar("og_descricao", { length: 200 }),
  ogImageUrl: varchar("og_image_url", { length: 300 }),
  ativa: boolean("ativa").notNull().default(true),
  criadaEm: timestamp("criada_em").notNull().defaultNow(),
});

/*
 * Cada montagem do configurador é gravada, mesmo incompleta, com origem.
 * O código curto sobrevive ao pulo para o wa.me e costura reserva ↔ campanha.
 */
export const montagens = pgTable("montagens", {
  id: serial("id").primaryKey(),
  codigoCurto: varchar("codigo_curto", { length: 8 }).notNull().unique(),
  combinacao: varchar("combinacao", { length: 30 }),
  dataDesejada: date("data_desejada"),
  segmento: varchar("segmento", { length: 30 }),
  canal: varchar("canal", { length: 30 }),
  campanhaId: integer("campanha_id").references(() => campanhas.id),
  termo: varchar("termo", { length: 100 }),
  /* funil: iniciada → concluída → clique_whatsapp → reserva */
  etapa: varchar("etapa", { length: 20 }).notNull().default("iniciada"),
  reservaId: integer("reserva_id"),
  criadaEm: timestamp("criada_em").notNull().defaultNow(),
});
