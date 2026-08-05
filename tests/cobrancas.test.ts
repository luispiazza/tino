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

const socio = () => criarCaller(db, sessaoFake("socio"));

async function reservaComValor() {
  return socio().reservas.criar({
    dataInicio: "2026-09-10",
    dataFim: "2026-09-11",
    horaInicio: "07:00",
    horaFim: "19:00",
    estudioIds: [estudioA],
    valorDiariaCents: 300000,
    descontoCents: 0,
  });
}

describe("cobranças", () => {
  it("nasce da reserva com o valor negociado e previsão = fim + prazo", async () => {
    const r = await reservaComValor();
    const c = await socio().financeiro.criarCobranca({
      reservaId: r.id,
      prazoDias: 30,
      exigePo: false,
      parcelas: 1,
    });
    expect(c.valorCents).toBe(600000);
    expect(c.estado).toBe("emitida");
    expect(c.dataServico).toBe("2026-09-11");
    expect(c.previsaoRecebimento).toBe("2026-10-11");
  });

  it("com PO começa em aguardando_po e percorre a esteira inteira", async () => {
    const r = await reservaComValor();
    const c = await socio().financeiro.criarCobranca({
      reservaId: r.id,
      exigePo: true,
      prazoDias: 0,
      parcelas: 1,
    });
    expect(c.estado).toBe("aguardando_po");
    const s = socio();
    await s.financeiro.avancarCobranca({ id: c.id, para: "po_recebido" });
    await s.financeiro.avancarCobranca({ id: c.id, para: "emitida" });
    const paga = await s.financeiro.avancarCobranca({
      id: c.id,
      para: "paga",
      dataPagamento: "2026-09-20",
    });
    expect(paga.dataPagamento).toBe("2026-09-20");
    await s.financeiro.avancarCobranca({
      id: c.id,
      para: "nf_emitida",
      nfNumero: "123",
    });
    const fim = await s.financeiro.avancarCobranca({
      id: c.id,
      para: "conciliada",
    });
    expect(fim.estado).toBe("conciliada");
  });

  it("transição fora da ordem é recusada", async () => {
    const r = await reservaComValor();
    const c = await socio().financeiro.criarCobranca({
      reservaId: r.id,
      exigePo: false,
      prazoDias: 0,
      parcelas: 1,
    });
    await expect(
      socio().financeiro.avancarCobranca({ id: c.id, para: "conciliada" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("reserva sem valor não gera cobrança sem valor explícito", async () => {
    const r = await socio().reservas.criar({
      dataInicio: "2026-09-15",
      dataFim: "2026-09-15",
      horaInicio: "07:00",
      horaFim: "19:00",
      estudioIds: [estudioA],
    });
    await expect(
      socio().financeiro.criarCobranca({
        reservaId: r.id,
        exigePo: false,
        prazoDias: 0,
        parcelas: 1,
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    const c = await socio().financeiro.criarCobranca({
      reservaId: r.id,
      valorCents: 150000,
      exigePo: false,
      prazoDias: 0,
      parcelas: 1,
    });
    expect(c.valorCents).toBe(150000);
  });

  it("cancelar a reserva cancela cobrança aberta, mas não a paga", async () => {
    const r = await reservaComValor();
    const s = socio();
    const aberta = await s.financeiro.criarCobranca({
      reservaId: r.id,
      exigePo: false,
      prazoDias: 0,
      parcelas: 1,
    });
    await s.reservas.cancelar({ id: r.id });
    const lista = await s.financeiro.listarCobrancas();
    expect(lista.find((c) => c.id === aberta.id)?.estado).toBe("cancelada");

    const r2 = await s.reservas.criar({
      dataInicio: "2026-09-10",
      dataFim: "2026-09-11",
      horaInicio: "07:00",
      horaFim: "19:00",
      estudioIds: [estudioA],
      valorDiariaCents: 100000,
      descontoCents: 0,
    });
    const c2 = await s.financeiro.criarCobranca({
      reservaId: r2.id,
      exigePo: false,
      prazoDias: 0,
      parcelas: 1,
    });
    await s.financeiro.avancarCobranca({ id: c2.id, para: "paga" });
    await s.reservas.cancelar({ id: r2.id });
    const lista2 = await s.financeiro.listarCobrancas();
    expect(lista2.find((c) => c.id === c2.id)?.estado).toBe("paga");
  });

  it("funcionário não vê o financeiro", async () => {
    await expect(
      criarCaller(db, sessaoFake("funcionario")).financeiro.listarCobrancas()
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
