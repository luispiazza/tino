import { beforeEach, describe, expect, it } from "vitest";
import { estudios } from "@/server/db/schema";
import type { DB } from "@/server/db";
import { gerarDia } from "@/server/rotina/gerador";
import { criarBancoDeTeste, criarCaller, sessaoFake } from "./helpers";

/* 2026-09-07 é segunda; 12 é sábado; 13 é domingo */
const SEG = "2026-09-07";
const TER = "2026-09-08";
const SAB = "2026-09-12";

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

const socio = () => criarCaller(db, sessaoFake("socio"));

async function reservaEm(data: string, dataFim = data) {
  return socio().reservas.criar({
    dataInicio: data,
    dataFim,
    horaInicio: "07:00",
    horaFim: "19:00",
    estudioIds: [estudioA],
  });
}

describe("gerador determinístico", () => {
  it("gera template diário em dia útil e é idempotente", async () => {
    await socio().escala.criarTemplate({
      titulo: "Limpar banheiros",
      frequenciaDias: 1,
      modoShooting: "ambos",
      requerEstudioVago: false,
      prioridade: 0,
    });
    const r1 = await gerarDia(db, SEG);
    expect(r1.gerado).toBe(true);
    const r2 = await gerarDia(db, SEG);
    expect(r2.gerado).toBe(false);
    const timeline = await socio().escala.timelineDoDia({ data: SEG });
    expect(timeline.map((t) => t.titulo)).toContain("Limpar banheiros");
  });

  it("modo shooting respeita o dia; frequência semanal respeita o intervalo", async () => {
    const s = socio();
    await s.escala.criarTemplate({
      titulo: "Preparar ciclorama",
      frequenciaDias: 1,
      modoShooting: "shooting",
      requerEstudioVago: false,
      prioridade: 0,
    });
    await s.escala.criarTemplate({
      titulo: "Lavar janelas",
      frequenciaDias: 7,
      modoShooting: "livre",
      requerEstudioVago: false,
      prioridade: 0,
    });
    await reservaEm(TER);

    /* segunda sem shooting: só a semanal de dia livre */
    const seg = await s.escala.timelineDoDia({ data: SEG });
    expect(seg.map((t) => t.titulo)).toContain("Lavar janelas");
    expect(seg.map((t) => t.titulo)).not.toContain("Preparar ciclorama");

    /* terça com shooting: a de shooting entra; a semanal não gera de
     * novo — mas ARRASTA, porque ninguém fez na segunda */
    const ter = await s.escala.timelineDoDia({ data: TER });
    expect(ter.map((t) => t.titulo)).toContain("Preparar ciclorama");
    const frescas = ter.filter((t) => !t.ehArrasto);
    expect(frescas.map((t) => t.titulo)).not.toContain("Lavar janelas");
    const arrasto = ter.find((t) => t.titulo === "Lavar janelas");
    expect(arrasto?.ehArrasto).toBe(true);
  });

  it("fim de semana sem shooting não gera; com shooting gera", async () => {
    const s = socio();
    await s.escala.criarTemplate({
      titulo: "Limpar banheiros",
      frequenciaDias: 1,
      modoShooting: "ambos",
      requerEstudioVago: false,
      prioridade: 0,
    });
    const sabVazio = await s.escala.timelineDoDia({ data: SAB });
    expect(sabVazio).toHaveLength(0);

    await reservaEm(SAB);
    const sabComShooting = await gerarDia(db, SAB);
    expect(sabComShooting.gerado).toBe(true);
  });

  it("virada: amanhã com shooting gera virada com a hora do fim do dia", async () => {
    await reservaEm(SEG);
    await reservaEm(TER);
    const seg = await socio().escala.timelineDoDia({ data: SEG });
    const virada = seg.find((t) => t.titulo.startsWith("Virada"));
    expect(virada).toBeDefined();
    expect(virada!.horaPrevista?.slice(0, 5)).toBe("19:00");
  });

  it("sem shooting amanhã, o dia fecha com recolher lixo", async () => {
    await reservaEm(SEG);
    const seg = await socio().escala.timelineDoDia({ data: SEG });
    expect(
      seg.find((t) => t.titulo.startsWith("Fechamento"))
    ).toBeDefined();
    expect(seg.find((t) => t.titulo.startsWith("Virada"))).toBeUndefined();
  });

  it("pendência não evapora: arrasta com dataOriginal", async () => {
    const s = socio();
    await s.escala.criarTemplate({
      titulo: "Limpar banheiros",
      frequenciaDias: 7,
      modoShooting: "ambos",
      requerEstudioVago: false,
      prioridade: 0,
    });
    await s.escala.timelineDoDia({ data: SEG });
    /* ninguém fez na segunda; na terça reaparece como arrasto */
    const ter = await s.escala.timelineDoDia({ data: TER });
    const arrasto = ter.find((t) => t.ehArrasto);
    expect(arrasto).toBeDefined();
    expect(arrasto!.titulo).toBe("Limpar banheiros");
    expect(arrasto!.dataOriginal).toBe(SEG);
  });

  it("concluir grava a atribuição e não conclui duas vezes", async () => {
    const s = socio();
    await s.escala.criarTemplate({
      titulo: "Limpar banheiros",
      frequenciaDias: 1,
      modoShooting: "ambos",
      requerEstudioVago: false,
      prioridade: 0,
    });
    const [tarefa] = await s.escala.timelineDoDia({ data: SEG });
    const feita = await s.escala.concluirTarefa({ tarefaId: tarefa.id });
    expect(feita.estado).toBe("feita");
    expect(feita.concluidaEm).toBeInstanceOf(Date);
    await expect(
      s.escala.concluirTarefa({ tarefaId: tarefa.id })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("funcionário vê a timeline e conclui; não cria template", async () => {
    const f = criarCaller(db, sessaoFake("funcionario"));
    await expect(f.escala.timelineDoDia({ data: SEG })).resolves.toBeDefined();
    await expect(
      f.escala.criarTemplate({
        titulo: "X",
        frequenciaDias: 1,
        modoShooting: "ambos",
        requerEstudioVago: false,
        prioridade: 0,
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
