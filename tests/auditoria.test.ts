import { beforeEach, describe, expect, it } from "vitest";
import { estudios } from "@/server/db/schema";
import type { DB } from "@/server/db";
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

describe("trilha de auditoria", () => {
  it("mutações de reserva deixam rastro com quem e o quê", async () => {
    const s = criarCaller(db, sessaoFake("socio"));
    const r = await s.reservas.criar({
      dataInicio: "2026-09-10",
      dataFim: "2026-09-10",
      horaInicio: "07:00",
      horaFim: "19:00",
      estudioIds: [estudioA],
    });
    await s.reservas.confirmar({ id: r.id });
    await s.reservas.cancelar({ id: r.id });

    const trilha = await s.auditoria.listar();
    const acoes = trilha.map((t) => `${t.acao}:${t.entidade}`);
    expect(acoes).toContain("criar:reserva");
    expect(acoes).toContain("confirmar:reserva");
    expect(acoes).toContain("cancelar:reserva");
    expect(trilha.every((t) => t.usuarioNome === "Teste")).toBe(true);
  });

  it("funcionário não lê a trilha", async () => {
    await expect(
      criarCaller(db, sessaoFake("funcionario")).auditoria.listar()
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("agenda do dia", () => {
  it("funcionário vê a agenda sem valores nem tokens", async () => {
    const hoje = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
    }).format(new Date());
    await criarCaller(db, sessaoFake("socio")).reservas.criar({
      dataInicio: hoje,
      dataFim: hoje,
      horaInicio: "07:00",
      horaFim: "19:00",
      estudioIds: [estudioA],
      valorDiariaCents: 300000,
      descontoCents: 0,
    });
    const agenda = await criarCaller(
      db,
      sessaoFake("funcionario")
    ).reservas.agendaDoDia();
    expect(agenda.hoje).toHaveLength(1);
    const reserva = agenda.hoje[0] as Record<string, unknown>;
    expect(reserva.valorDiariaCents).toBeUndefined();
    expect(reserva.tokenPortalReserva).toBeUndefined();
    expect(reserva.estudioIds).toEqual([estudioA]);
  });

  it("sem login não vê agenda", async () => {
    await expect(criarCaller(db).reservas.agendaDoDia()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });
});
