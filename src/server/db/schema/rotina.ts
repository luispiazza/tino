import {
  pgTable,
  serial,
  varchar,
  integer,
  boolean,
  date,
  time,
  timestamp,
  pgEnum,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { pessoas } from "./pessoas";
import { estudios } from "./estudios";

/*
 * Domínio 2 — geração determinística, sem LLM. O gerador lê reservas
 * (nunca um cache de calendário), aplica os templates e as regras de
 * virada, e o plano vai direto ao funcionário. A rede de proteção é a
 * facilidade de corrigir: todo ajuste manual fica registrado.
 */

export const modoShooting = pgEnum("modo_shooting", [
  "shooting",
  "livre",
  "ambos",
]);

export const tarefaTemplates = pgTable("tarefa_templates", {
  id: serial("id").primaryKey(),
  titulo: varchar("titulo", { length: 150 }).notNull(),
  /* 1 = diária, 7 = semanal, 15 = quinzenal, 30 = mensal */
  frequenciaDias: integer("frequencia_dias").notNull().default(1),
  modoShooting: modoShooting("modo_shooting").notNull().default("ambos"),
  requerEstudioVago: boolean("requer_estudio_vago").notNull().default(false),
  dependeDeId: integer("depende_de_id").references(
    (): AnyPgColumn => tarefaTemplates.id
  ),
  minutosEstimados: integer("minutos_estimados"),
  prioridade: integer("prioridade").notNull().default(0),
  /* preenchido = manutenção periódica externa (dedetização, ar):
   * "chamar o dedetizador" é o mesmo motor de "lavar as janelas" */
  fornecedorId: integer("fornecedor_id").references(() => pessoas.id),
  ativo: boolean("ativo").notNull().default(true),
});

export const tarefaEstado = pgEnum("tarefa_estado", ["pendente", "feita"]);

/*
 * A tarefa pertence ao ESTÚDIO e ao horário, nunca à pessoa. A timeline
 * do dia é uma só, igual para quem estiver no turno — com duas pessoas
 * cobrindo, a lista é a mesma; quem faz se decide na hora, e a
 * atribuição é registrada na conclusão (feitaPorId).
 */
export const tarefas = pgTable("tarefas", {
  id: serial("id").primaryKey(),
  data: date("data").notNull(),
  templateId: integer("template_id").references(() => tarefaTemplates.id),
  /* nulo = tarefa geral do complexo */
  estudioId: integer("estudio_id").references(() => estudios.id),
  /* snapshot — editar o template não reescreve o histórico */
  titulo: varchar("titulo", { length: 150 }).notNull(),
  /* ordena a timeline */
  horaPrevista: time("hora_prevista"),
  estado: tarefaEstado("estado").notNull().default("pendente"),
  /* pendência não evapora: arrasta com data de corte e teto por lista */
  ehArrasto: boolean("eh_arrasto").notNull().default(false),
  dataOriginal: date("data_original"),
  feitaPorId: integer("feita_por_id").references(() => pessoas.id),
  concluidaEm: timestamp("concluida_em", { withTimezone: true }),
});

export const diaTipo = pgEnum("dia_tipo", ["shooting", "livre"]);

/*
 * Todo ajuste manual do sócio no plano gerado. Sem isso não se descobre
 * que a regra está errada — apenas que "o sistema é meio doido". Muitos
 * ajustes no mesmo tipo de dia = regra a corrigir.
 */
export const ajustes = pgTable("ajustes_do_dia", {
  id: serial("id").primaryKey(),
  data: date("data").notNull(),
  diaTipo: diaTipo("dia_tipo").notNull(),
  descricao: varchar("descricao", { length: 300 }).notNull(),
  criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
});

/* Jornada esperada vem do turno; hora extra sai por diferença
 * e vira lançamento no financeiro. */
export const ponto = pgTable("ponto", {
  id: serial("id").primaryKey(),
  pessoaId: integer("pessoa_id")
    .notNull()
    .references(() => pessoas.id),
  data: date("data").notNull(),
  entrada: time("entrada"),
  saida: time("saida"),
});

/* Folga não reatribui tarefa — sinaliza o turno descoberto. */
export const folgas = pgTable("folgas", {
  id: serial("id").primaryKey(),
  pessoaId: integer("pessoa_id")
    .notNull()
    .references(() => pessoas.id),
  data: date("data").notNull(),
});
