import { and, gt, inArray, lt, ne, gte, lte, eq } from "drizzle-orm";
import type { DB } from "../db";
import {
  estudioDependencias,
  estudios,
  reservaEstudios,
  reservas,
} from "../db/schema";

export interface PeriodoConsulta {
  dataInicio: string; // YYYY-MM-DD
  dataFim: string;
  horaInicio: string; // HH:MM
  horaFim: string;
  estudioIds: number[];
  /* edição de reserva: a própria não conta como conflito */
  ignorarReservaId?: number;
}

export interface Conflito {
  reservaId: number;
  codigo: string;
  estudioId: number;
  dataInicio: string;
  dataFim: string;
  horaInicio: string;
  horaFim: string;
}

/*
 * A única regra de disponibilidade do sistema — todos consultam aqui
 * (admin, portais, vitrine, agente de WhatsApp).
 *
 * Conflito = mesmo estúdio, períodos de datas que se cruzam E horários
 * que se cruzam. Diária parcial existe (28/05: A vendido 10:00–15:00 e
 * 17:00–19:00), por isso horário disjunto no mesmo dia NÃO conflita.
 * Cancelada nunca bloqueia; pendente bloqueia — reserva em negociação
 * segura a agenda até ser confirmada ou cancelada.
 */
export async function buscarConflitos(
  db: DB,
  consulta: PeriodoConsulta
): Promise<Conflito[]> {
  const condicoes = [
    inArray(reservaEstudios.estudioId, consulta.estudioIds),
    ne(reservas.status, "cancelada"),
    lte(reservas.dataInicio, consulta.dataFim),
    gte(reservas.dataFim, consulta.dataInicio),
    lt(reservas.horaInicio, consulta.horaFim),
    gt(reservas.horaFim, consulta.horaInicio),
  ];
  if (consulta.ignorarReservaId !== undefined) {
    condicoes.push(ne(reservas.id, consulta.ignorarReservaId));
  }
  return db
    .select({
      reservaId: reservas.id,
      codigo: reservas.codigo,
      estudioId: reservaEstudios.estudioId,
      dataInicio: reservas.dataInicio,
      dataFim: reservas.dataFim,
      horaInicio: reservas.horaInicio,
      horaFim: reservas.horaFim,
    })
    .from(reservaEstudios)
    .innerJoin(reservas, eq(reservaEstudios.reservaId, reservas.id))
    .where(and(...condicoes));
}

/*
 * Complementar não é produto: B só entra junto de A; C, junto de A ou
 * de E. Retorna os códigos dos complementares pedidos sem nenhum dos
 * estúdios de que dependem na mesma reserva.
 */
export async function complementaresSemBase(
  db: DB,
  estudioIds: number[]
): Promise<string[]> {
  const pedidos = await db
    .select({
      id: estudios.id,
      codigo: estudios.codigo,
      ehComplementar: estudios.ehComplementar,
    })
    .from(estudios)
    .where(inArray(estudios.id, estudioIds));

  const complementares = pedidos.filter((e) => e.ehComplementar);
  if (complementares.length === 0) return [];

  const dependencias = await db
    .select({
      estudioId: estudioDependencias.estudioId,
      dependeDeId: estudioDependencias.dependeDeId,
    })
    .from(estudioDependencias)
    .where(
      inArray(
        estudioDependencias.estudioId,
        complementares.map((e) => e.id)
      )
    );

  const incluidos = new Set(estudioIds);
  return complementares
    .filter((c) => {
      const bases = dependencias
        .filter((d) => d.estudioId === c.id)
        .map((d) => d.dependeDeId);
      return bases.length > 0 && !bases.some((b) => incluidos.has(b));
    })
    .map((c) => c.codigo);
}
