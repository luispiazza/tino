import { beforeEach, describe, expect, it } from "vitest";
import { estudios } from "@/server/db/schema";
import type { DB } from "@/server/db";
import { criarBancoDeTeste, criarCaller, sessaoFake } from "./helpers";

let db: DB;
let ids: Record<string, number>;

beforeEach(async () => {
  db = await criarBancoDeTeste();
  const linhas = await db
    .insert(estudios)
    .values([
      { codigo: "A", nome: "Estúdio A" },
      { codigo: "B", nome: "Estúdio B", ehComplementar: true },
    ])
    .returning();
  ids = Object.fromEntries(linhas.map((l) => [l.codigo, l.id]));
});

const socio = () => criarCaller(db, sessaoFake("socio"));

describe("inventário periódico", () => {
  it("só entra item com quantidade esperada; consumível fica fora", async () => {
    const s = socio();
    await s.rental.criarItem({
      nome: "Prato",
      unidade: "unidade",
      precoCents: 0,
      qtdEsperada: 12,
    });
    await s.rental.criarItem({
      nome: "Café",
      unidade: "pacote",
      precoCents: 2000,
      qtdEsperada: null,
    });

    await s.rental.abrirInventario({ data: "2026-09-07" });
    const aberto = await s.rental.inventarioAberto();
    expect(aberto?.itens.map((i) => i.nomeItem)).toEqual(["Prato"]);
    expect(aberto?.itens[0].qtdEsperada).toBe(12);
  });

  it("abrir duas vezes não duplica: devolve o inventário aberto", async () => {
    const s = socio();
    await s.rental.criarItem({
      nome: "Prato",
      unidade: "unidade",
      precoCents: 0,
      qtdEsperada: 12,
    });
    const um = await s.rental.abrirInventario({ data: "2026-09-07" });
    const dois = await s.rental.abrirInventario({ data: "2026-09-08" });
    expect(dois.id).toBe(um.id);
  });

  it("fechar registra o que faltou, sem cobrar ninguém", async () => {
    const s = socio();
    await s.rental.criarItem({
      nome: "Prato",
      unidade: "unidade",
      precoCents: 0,
      qtdEsperada: 12,
    });
    const inv = await s.rental.abrirInventario({ data: "2026-09-07" });
    const aberto = await s.rental.inventarioAberto();
    await s.rental.contar({
      inventarioItemId: aberto!.itens[0].id,
      qtdContada: 9,
    });
    const fechado = await s.rental.fecharInventario({ id: inv.id });
    expect(fechado.faltantes).toEqual([{ item: "Prato", falta: 3 }]);
    expect(fechado.fechadoEm).toBeInstanceOf(Date);
    /* fechado sai da tela de contagem e vira histórico */
    expect(await s.rental.inventarioAberto()).toBeNull();
    const hist = await s.rental.historicoInventarios();
    expect(hist[0].faltando).toBe(3);
  });

  it("sem item durável, abrir explica em vez de criar vazio", async () => {
    await expect(socio().rental.abrirInventario({})).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });

  it("funcionário conta (é ele que faz), mas não vê o histórico", async () => {
    const s = socio();
    await s.rental.criarItem({
      nome: "Prato",
      unidade: "unidade",
      precoCents: 0,
      qtdEsperada: 12,
    });
    const f = criarCaller(db, sessaoFake("funcionario"));
    await expect(f.rental.abrirInventario({})).resolves.toBeDefined();
    await expect(f.rental.historicoInventarios()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});

describe("ocupação por estúdio", () => {
  async function reservar(
    dataInicio: string,
    dataFim: string,
    estudioIds: number[],
    valorDiariaCents = 300000,
    horaInicio = "07:00",
    horaFim = "19:00"
  ) {
    return socio().reservas.criar({
      dataInicio,
      dataFim,
      horaInicio,
      horaFim,
      estudioIds,
      valorDiariaCents,
      descontoCents: 0,
    });
  }

  it("conta dias, não reservas — multi-dia soma; parcial no mesmo dia conta 1", async () => {
    await reservar("2026-09-01", "2026-09-03", [ids.A]);
    /* duas reservas no mesmo dia, horários disjuntos */
    await reservar("2026-09-10", "2026-09-10", [ids.A], 300000, "07:00", "12:00");
    await reservar("2026-09-10", "2026-09-10", [ids.A], 300000, "14:00", "19:00");

    const r = await socio().reservas.ocupacao({
      inicio: "2026-09-01",
      fim: "2026-09-30",
    });
    const a = r.estudios.find((e) => e.codigo === "A")!;
    expect(a.dias).toBe(4);
    expect(r.totalDias).toBe(30);
    expect(a.taxa).toBeCloseTo(4 / 30, 4);
  });

  it("cancelada não ocupa; receita é rateada entre os estúdios", async () => {
    const cancelada = await reservar("2026-09-05", "2026-09-05", [ids.A]);
    await socio().reservas.cancelar({ id: cancelada.id });
    await reservar("2026-09-08", "2026-09-08", [ids.A, ids.B], 400000);

    const r = await socio().reservas.ocupacao({
      inicio: "2026-09-01",
      fim: "2026-09-30",
    });
    const a = r.estudios.find((e) => e.codigo === "A")!;
    const b = r.estudios.find((e) => e.codigo === "B")!;
    expect(a.dias).toBe(1);
    expect(a.receitaCents).toBe(200000);
    expect(b.receitaCents).toBe(200000);
  });

  it("reserva que atravessa a borda conta só os dias dentro do período", async () => {
    await reservar("2026-08-30", "2026-09-02", [ids.A]);
    const r = await socio().reservas.ocupacao({
      inicio: "2026-09-01",
      fim: "2026-09-30",
    });
    expect(r.estudios.find((e) => e.codigo === "A")!.dias).toBe(2);
  });
});
