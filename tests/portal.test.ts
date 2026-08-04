import { beforeEach, describe, expect, it } from "vitest";
import { estudios } from "@/server/db/schema";
import type { DB } from "@/server/db";
import { buscarReservaPorToken } from "@/server/reservas/portal";
import { criarBancoDeTeste, criarCaller, sessaoFake } from "./helpers";

let db: DB;
let estudioA: number;

beforeEach(async () => {
  db = await criarBancoDeTeste();
  const [a] = await db
    .insert(estudios)
    .values({ codigo: "A", nome: "Estúdio A" })
    .returning();
  estudioA = a.id;
});

async function criarReserva() {
  return criarCaller(db, sessaoFake("socio")).reservas.criar({
    dataInicio: "2026-08-10",
    dataFim: "2026-08-11",
    horaInicio: "07:00",
    horaFim: "19:00",
    estudioIds: [estudioA],
    valorDiariaCents: 300000,
    descontoCents: 50000,
  });
}

describe("portais por token", () => {
  it("token do portal da reserva abre a ficha com estúdios e total", async () => {
    const r = await criarReserva();
    const ficha = await buscarReservaPorToken(
      db,
      r.tokenPortalReserva!,
      "reserva"
    );
    expect(ficha?.codigo).toBe(r.codigo);
    expect(ficha?.estudios).toEqual([{ codigo: "A", nome: "Estúdio A" }]);
    expect(ficha?.dias).toBe(2);
    expect(ficha?.valorTotalCents).toBe(2 * 300000 - 50000);
  });

  it("token de um portal não abre o outro", async () => {
    const r = await criarReserva();
    expect(
      await buscarReservaPorToken(db, r.tokenPortalProdutor!, "reserva")
    ).toBeNull();
    expect(
      await buscarReservaPorToken(db, r.tokenPortalReserva!, "produtor")
    ).toBeNull();
  });

  it("token desconhecido ou malformado devolve null", async () => {
    await criarReserva();
    expect(await buscarReservaPorToken(db, "f".repeat(64), "reserva")).toBeNull();
    expect(await buscarReservaPorToken(db, "abc", "reserva")).toBeNull();
    expect(await buscarReservaPorToken(db, "", "produtor")).toBeNull();
  });
});
