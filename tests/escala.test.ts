import { beforeEach, describe, expect, it } from "vitest";
import { pessoas } from "@/server/db/schema";
import type { DB } from "@/server/db";
import { compararJornada, minutosEntre } from "@/server/escala/jornada";
import { criarBancoDeTeste, criarCaller, sessaoFake } from "./helpers";

describe("jornada", () => {
  it("conta o turno normal e o que atravessa a meia-noite (a virada)", () => {
    expect(minutosEntre("06:00", "14:00")).toBe(480);
    expect(minutosEntre("22:00", "02:00")).toBe(240);
  });

  it("hora extra sai por diferença; sem ponto completo não inventa", () => {
    const turno = { horaInicio: "06:00", horaFim: "14:00" };
    expect(
      compararJornada(turno, { entrada: "06:00", saida: "16:30" }).diferencaMin
    ).toBe(150);
    expect(
      compararJornada(turno, { entrada: "06:00", saida: "13:00" }).diferencaMin
    ).toBe(-60);
    expect(compararJornada(turno, { entrada: "06:00", saida: null })).toEqual({
      esperadoMin: 480,
      trabalhadoMin: null,
      diferencaMin: null,
    });
    expect(compararJornada(turno, null).trabalhadoMin).toBeNull();
  });
});

describe("escala", () => {
  let db: DB;
  let michael: number;

  beforeEach(async () => {
    db = await criarBancoDeTeste();
    const [p] = await db
      .insert(pessoas)
      .values({ nome: "Michael", natureza: "funcionario" })
      .returning();
    michael = p.id;
  });

  const socio = () => criarCaller(db, sessaoFake("socio"));

  it("vaga existe sem ocupante e aparece como descoberta", async () => {
    const s = socio();
    await s.escala.criarTurno({
      data: "2026-09-12",
      horaInicio: "14:00",
      horaFim: "22:00",
    });
    const semana = await s.escala.escalaDaSemana({
      inicio: "2026-09-07",
      fim: "2026-09-13",
    });
    expect(semana.turnos).toHaveLength(1);
    expect(semana.turnos[0].descoberto).toBe(true);
    expect(semana.turnos[0].jornada.esperadoMin).toBe(480);
  });

  it("ocupar a vaga e bater ponto calcula a hora extra", async () => {
    const s = socio();
    const turno = await s.escala.criarTurno({
      data: "2026-09-07",
      horaInicio: "06:00",
      horaFim: "14:00",
      pessoaId: michael,
    });
    await s.escala.baterPonto({ turnoId: turno.id, entrada: "06:00" });
    const fim = await s.escala.baterPonto({ turnoId: turno.id, saida: "16:30" });
    expect(fim.jornada.diferencaMin).toBe(150);

    const semana = await s.escala.escalaDaSemana({
      inicio: "2026-09-07",
      fim: "2026-09-13",
    });
    expect(semana.turnos[0].pessoaNome).toBe("Michael");
    expect(semana.turnos[0].jornada.trabalhadoMin).toBe(630);
  });

  it("não bate ponto em vaga descoberta", async () => {
    const s = socio();
    const turno = await s.escala.criarTurno({
      data: "2026-09-08",
      horaInicio: "14:00",
      horaFim: "22:00",
    });
    await expect(
      s.escala.baterPonto({ turnoId: turno.id, entrada: "14:00" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("folga aparece na semana, sinalizando o turno descoberto", async () => {
    const s = socio();
    await s.escala.registrarFolga({ pessoaId: michael, data: "2026-09-09" });
    const semana = await s.escala.escalaDaSemana({
      inicio: "2026-09-07",
      fim: "2026-09-13",
    });
    expect(semana.folgas).toHaveLength(1);
    expect(semana.folgas[0].pessoaNome).toBe("Michael");
  });

  it("custo de cobertura soma as vagas que custaram a mais", async () => {
    const s = socio();
    await s.escala.criarTurno({
      data: "2026-09-07",
      horaInicio: "14:00",
      horaFim: "22:00",
      pessoaId: michael,
      custoCoberturaCents: 12000,
      observacao: "hora extra do Michael",
    });
    await s.escala.criarTurno({
      data: "2026-09-08",
      horaInicio: "14:00",
      horaFim: "22:00",
      custoCoberturaCents: 20000,
      observacao: "parceiro acionado",
    });
    /* turno normal, sem custo extra, não entra */
    await s.escala.criarTurno({
      data: "2026-09-09",
      horaInicio: "06:00",
      horaFim: "14:00",
      pessoaId: michael,
    });

    const r = await s.escala.custoDeCobertura({
      inicio: "2026-09-01",
      fim: "2026-09-30",
    });
    expect(r.totalCents).toBe(32000);
    expect(r.turnosComCusto).toHaveLength(2);
    /* a vaga de 08/09 tem custo e nenhum ocupante */
    expect(r.turnosDescobertos).toBe(1);
  });

  it("remover turno com ponto registrado é recusado", async () => {
    const s = socio();
    const turno = await s.escala.criarTurno({
      data: "2026-09-07",
      horaInicio: "06:00",
      horaFim: "14:00",
      pessoaId: michael,
    });
    await s.escala.baterPonto({ turnoId: turno.id, entrada: "06:00" });
    await expect(
      s.escala.removerTurno({ id: turno.id })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("funcionário vê a escala e bate ponto; não cria vaga", async () => {
    const s = socio();
    const turno = await s.escala.criarTurno({
      data: "2026-09-07",
      horaInicio: "06:00",
      horaFim: "14:00",
      pessoaId: michael,
    });
    const f = criarCaller(db, sessaoFake("funcionario"));
    await expect(
      f.escala.escalaDaSemana({ inicio: "2026-09-07", fim: "2026-09-13" })
    ).resolves.toBeDefined();
    await expect(
      f.escala.baterPonto({ turnoId: turno.id, entrada: "06:05" })
    ).resolves.toBeDefined();
    await expect(
      f.escala.criarTurno({
        data: "2026-09-10",
        horaInicio: "06:00",
        horaFim: "14:00",
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      f.escala.custoDeCobertura({ inicio: "2026-09-01", fim: "2026-09-30" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
