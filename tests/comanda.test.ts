import { beforeEach, describe, expect, it } from "vitest";
import { estudios, reservas } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import type { DB } from "@/server/db";
import { horasExtras, montarComanda } from "@/server/reservas/comanda";
import { criarBancoDeTeste, criarCaller, sessaoFake } from "./helpers";

/* 05/08/2026, diária padrão 07:00–19:00 (fim = 22:00 UTC) */
const DATA = "2026-08-05";
const FIM = "19:00:00";
const emSP = (hhmm: string, dia = DATA) => new Date(`${dia}T${hhmm}-03:00`);

describe("hora extra", () => {
  it("dentro do horário e dentro da tolerância não cobra", () => {
    expect(horasExtras(DATA, FIM, emSP("18:30"))).toBe(0);
    expect(horasExtras(DATA, FIM, emSP("19:00"))).toBe(0);
    expect(horasExtras(DATA, FIM, emSP("19:30"))).toBe(0);
  });

  it("passada a tolerância, cada hora começada conta", () => {
    expect(horasExtras(DATA, FIM, emSP("19:31"))).toBe(1);
    expect(horasExtras(DATA, FIM, emSP("19:45"))).toBe(1);
    expect(horasExtras(DATA, FIM, emSP("20:00"))).toBe(1);
    expect(horasExtras(DATA, FIM, emSP("20:30"))).toBe(2);
    expect(horasExtras(DATA, FIM, emSP("22:45"))).toBe(4);
  });

  it("saída que vira o dia continua contando", () => {
    expect(horasExtras(DATA, FIM, emSP("02:00", "2026-08-06"))).toBe(7);
  });

  it("sem check-out, não há hora extra", () => {
    expect(horasExtras(DATA, FIM, null)).toBe(0);
  });
});

describe("comanda", () => {
  const base = {
    dataInicio: DATA,
    dataFim: DATA,
    horaFim: FIM,
    valorDiariaCents: 300000,
    valorHoraExtraCents: 30000,
    descontoCents: 0,
    checkOutEm: null as Date | null,
  };

  it("total = diárias + hora extra − desconto", () => {
    const c = montarComanda({
      ...base,
      descontoCents: 50000,
      checkOutEm: emSP("21:00"),
    });
    expect(c.horasExtras).toBe(2);
    expect(c.horaExtraCents).toBe(60000);
    expect(c.totalCents).toBe(300000 + 60000 - 50000);
  });

  it("hora extra sem preço é contada e declarada, nunca chutada", () => {
    const c = montarComanda({
      ...base,
      valorHoraExtraCents: null,
      checkOutEm: emSP("21:00"),
    });
    expect(c.horasExtras).toBe(2);
    expect(c.horaExtraCents).toBeNull();
    expect(c.horaExtraSemPreco).toBe(true);
    /* o total não inventa a hora extra: soma o que sabe */
    expect(c.totalCents).toBe(300000);
  });

  it("sem diária definida, total continua nulo", () => {
    const c = montarComanda({ ...base, valorDiariaCents: null });
    expect(c.totalCents).toBeNull();
  });
});

describe("portal do produtor", () => {
  let db: DB;
  let token: string;
  let reservaId: number;

  beforeEach(async () => {
    db = await criarBancoDeTeste();
    const [a] = await db
      .insert(estudios)
      .values({ codigo: "A", nome: "Estúdio A" })
      .returning();
    const r = await criarCaller(db, sessaoFake("socio")).reservas.criar({
      dataInicio: DATA,
      dataFim: DATA,
      horaInicio: "07:00",
      horaFim: "19:00",
      estudioIds: [a.id],
      valorDiariaCents: 300000,
      valorHoraExtraCents: 30000,
      descontoCents: 0,
    });
    token = r.tokenPortalProdutor!;
    reservaId = r.id;
  });

  it("registra chegada e saída pelo token, uma vez cada", async () => {
    const p = criarCaller(db);
    const entrada = await p.portais.registrarCheckIn({ token });
    expect(entrada.checkInEm).toBeInstanceOf(Date);
    await expect(p.portais.registrarCheckIn({ token })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });

    const saida = await p.portais.registrarCheckOut({ token });
    expect(saida.checkOutEm).toBeInstanceOf(Date);
    await expect(p.portais.registrarCheckOut({ token })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });

  it("token do outro portal e token inventado não registram nada", async () => {
    const p = criarCaller(db);
    const [reserva] = await db
      .select()
      .from(reservas)
      .where(eq(reservas.id, reservaId));
    await expect(
      p.portais.registrarCheckIn({ token: reserva.tokenPortalReserva! })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      p.portais.registrarCheckIn({ token: "f".repeat(64) })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("reserva cancelada não aceita registro", async () => {
    await criarCaller(db, sessaoFake("socio")).reservas.cancelar({
      id: reservaId,
    });
    await expect(
      criarCaller(db).portais.registrarCheckIn({ token })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
