import { eq } from "drizzle-orm";
import type { DB } from "../db";
import { clientes, estudios, reservaEstudios, reservas } from "../db/schema";
import { montarComanda } from "./comanda";

/*
 * Resolução dos portais: o token opaco é a credencial — um por portal,
 * presente só na URL enviada ao cliente. Token errado devolve null e a
 * página mostra "link inválido"; nunca se lista nada por código.
 */
export async function buscarReservaPorToken(
  db: DB,
  token: string,
  portal: "reserva" | "produtor"
) {
  if (!/^[0-9a-f]{64}$/.test(token)) return null;
  const coluna =
    portal === "reserva"
      ? reservas.tokenPortalReserva
      : reservas.tokenPortalProdutor;

  const [linha] = await db
    .select({ reserva: reservas, clienteNome: clientes.nome })
    .from(reservas)
    .leftJoin(clientes, eq(reservas.clienteId, clientes.id))
    .where(eq(coluna, token))
    .limit(1);
  if (!linha) return null;

  const est = await db
    .select({ codigo: estudios.codigo, nome: estudios.nome })
    .from(reservaEstudios)
    .innerJoin(estudios, eq(reservaEstudios.estudioId, estudios.id))
    .where(eq(reservaEstudios.reservaId, linha.reserva.id));

  const comanda = montarComanda(linha.reserva);
  return {
    ...linha.reserva,
    clienteNome: linha.clienteNome,
    estudios: est,
    dias: comanda.dias,
    comanda,
    valorTotalCents: comanda.totalCents,
  };
}

export type ReservaDoPortal = NonNullable<
  Awaited<ReturnType<typeof buscarReservaPorToken>>
>;
