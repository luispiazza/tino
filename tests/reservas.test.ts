import { beforeEach, describe, expect, it } from "vitest";
import { estudioDependencias, estudios } from "@/server/db/schema";
import type { DB } from "@/server/db";
import { criarBancoDeTeste, criarCaller, sessaoFake } from "./helpers";

let db: DB;
let ids: Record<string, number>;

/* A e E principais; B depende de A; C depende de A e de E */
async function semearEstudios(db: DB) {
  const linhas = await db
    .insert(estudios)
    .values([
      { codigo: "A", nome: "Estúdio A" },
      { codigo: "B", nome: "Estúdio B", ehComplementar: true },
      { codigo: "C", nome: "Estúdio C", ehComplementar: true },
      { codigo: "E", nome: "Estúdio E" },
    ])
    .returning();
  const porCodigo = Object.fromEntries(linhas.map((l) => [l.codigo, l.id]));
  await db.insert(estudioDependencias).values([
    { estudioId: porCodigo.B, dependeDeId: porCodigo.A },
    { estudioId: porCodigo.C, dependeDeId: porCodigo.A },
    { estudioId: porCodigo.C, dependeDeId: porCodigo.E },
  ]);
  return porCodigo;
}

beforeEach(async () => {
  db = await criarBancoDeTeste();
  ids = await semearEstudios(db);
});

const socio = () => criarCaller(db, sessaoFake("socio"));

const diaria = (estudioIds: number[], extra: Partial<Parameters<ReturnType<typeof socio>["reservas"]["criar"]>[0]> = {}) => ({
  dataInicio: "2026-08-10",
  dataFim: "2026-08-10",
  horaInicio: "07:00",
  horaFim: "19:00",
  estudioIds,
  ...extra,
});

describe("reservas.criar", () => {
  it("cria com código T_DDMMYYYYA e tokens opacos de 64 chars", async () => {
    const r = await socio().reservas.criar(diaria([ids.A]));
    expect(r.codigo).toBe("T_10082026A");
    expect(r.tokenPortalReserva).toMatch(/^[0-9a-f]{64}$/);
    expect(r.tokenPortalProdutor).toMatch(/^[0-9a-f]{64}$/);
    expect(r.tokenPortalReserva).not.toBe(r.tokenPortalProdutor);
  });

  it("segunda reserva do dia recebe sufixo B", async () => {
    await socio().reservas.criar(diaria([ids.A]));
    const r2 = await socio().reservas.criar(diaria([ids.E]));
    expect(r2.codigo).toBe("T_10082026B");
  });

  it("recusa conflito no mesmo estúdio com horário sobreposto", async () => {
    await socio().reservas.criar(diaria([ids.A]));
    await expect(
      socio().reservas.criar(diaria([ids.A], { horaInicio: "18:00", horaFim: "22:00" }))
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("aceita diária parcial: mesmo dia, horários disjuntos", async () => {
    await socio().reservas.criar(
      diaria([ids.A], { horaInicio: "10:00", horaFim: "15:00" })
    );
    const r = await socio().reservas.criar(
      diaria([ids.A], { horaInicio: "17:00", horaFim: "19:00" })
    );
    expect(r.codigo).toBe("T_10082026B");
  });

  it("recusa sobreposição de período em reserva de vários dias", async () => {
    await socio().reservas.criar(
      diaria([ids.A], { dataInicio: "2026-08-10", dataFim: "2026-08-12" })
    );
    await expect(
      socio().reservas.criar(
        diaria([ids.A], { dataInicio: "2026-08-12", dataFim: "2026-08-13" })
      )
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("confirmar muda o status e a reserva segue bloqueando", async () => {
    const r = await socio().reservas.criar(diaria([ids.A]));
    const confirmada = await socio().reservas.confirmar({ id: r.id });
    expect(confirmada.status).toBe("confirmada");
    await expect(
      socio().reservas.criar(diaria([ids.A]))
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("reserva cancelada não bloqueia a agenda", async () => {
    const r = await socio().reservas.criar(diaria([ids.A]));
    await socio().reservas.cancelar({ id: r.id });
    const r2 = await socio().reservas.criar(diaria([ids.A]));
    expect(r2.codigo).toBe("T_10082026B");
  });

  it("conflita quando qualquer estúdio da combinação está ocupado", async () => {
    await socio().reservas.criar(diaria([ids.A, ids.B]));
    await expect(
      socio().reservas.criar(diaria([ids.B], { estudioIds: [ids.A] }))
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("recusa complementar sem a base na mesma reserva (B sem A)", async () => {
    await expect(
      socio().reservas.criar(diaria([ids.B]))
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("aceita C com E (C depende de A OU de E)", async () => {
    const r = await socio().reservas.criar(diaria([ids.E, ids.C]));
    expect(r.estudioIds).toEqual([ids.E, ids.C]);
  });

  it("funcionário não cria reserva", async () => {
    await expect(
      criarCaller(db, sessaoFake("funcionario")).reservas.criar(diaria([ids.A]))
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("sem login não cria reserva", async () => {
    await expect(
      criarCaller(db).reservas.criar(diaria([ids.A]))
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});

describe("reservas.disponibilidade", () => {
  it("é a mesma regra da criação: aponta o conflito com código", async () => {
    await socio().reservas.criar(diaria([ids.A]));
    const ocupado = await criarCaller(db).reservas.disponibilidade({
      dataInicio: "2026-08-10",
      dataFim: "2026-08-10",
      horaInicio: "09:00",
      horaFim: "12:00",
      estudioIds: [ids.A],
    });
    expect(ocupado.disponivel).toBe(false);
    expect(ocupado.conflitos[0].codigo).toBe("T_10082026A");

    const livre = await criarCaller(db).reservas.disponibilidade({
      dataInicio: "2026-08-11",
      dataFim: "2026-08-11",
      estudioIds: [ids.A],
    });
    expect(livre.disponivel).toBe(true);
  });

  it("sem horário, considera o dia inteiro", async () => {
    await socio().reservas.criar(
      diaria([ids.A], { horaInicio: "10:00", horaFim: "15:00" })
    );
    const res = await criarCaller(db).reservas.disponibilidade({
      dataInicio: "2026-08-10",
      dataFim: "2026-08-10",
      estudioIds: [ids.A],
    });
    expect(res.disponivel).toBe(false);
  });
});
