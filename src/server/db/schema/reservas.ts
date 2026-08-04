import {
  pgTable,
  serial,
  varchar,
  integer,
  date,
  time,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";
import { estudios } from "./estudios";

export const reservaStatus = pgEnum("reserva_status", [
  "pendente",
  "confirmada",
  "cancelada",
]);

export const reservas = pgTable("reservas", {
  id: serial("id").primaryKey(),
  /* T_DDMMYYYY + letra — identificador humano. Vai na NF e na conversa. */
  codigo: varchar("codigo", { length: 12 }).notNull().unique(),
  clienteId: integer("cliente_id"),
  dataInicio: date("data_inicio").notNull(),
  dataFim: date("data_fim").notNull(),
  horaInicio: time("hora_inicio").notNull(),
  horaFim: time("hora_fim").notNull(),
  status: reservaStatus("status").notNull().default("pendente"),
  /*
   * Tokens opacos, um por portal — a credencial, separada do código.
   * Revogáveis, expiram após o fechamento da comanda.
   */
  tokenPortalReserva: varchar("token_portal_reserva", { length: 64 }),
  tokenPortalProdutor: varchar("token_portal_produtor", { length: 64 }),
  criadaEm: timestamp("criada_em").notNull().defaultNow(),
});

/*
 * Estúdios da reserva em junção — nunca JSON em varchar.
 * A checagem de conflito considera período e horário (diária parcial existe),
 * e a dependência: C locado com A fica indisponível para E.
 */
export const reservaEstudios = pgTable("reserva_estudios", {
  id: serial("id").primaryKey(),
  reservaId: integer("reserva_id")
    .notNull()
    .references(() => reservas.id),
  estudioId: integer("estudio_id")
    .notNull()
    .references(() => estudios.id),
});
