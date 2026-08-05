import { beforeEach, describe, expect, it } from "vitest";
import { cobrancas, estudios, lancamentos } from "@/server/db/schema";
import type { DB } from "@/server/db";
import { criarBancoDeTeste, criarCaller, sessaoFake } from "./helpers";

let db: DB;

const hoje = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo",
}).format(new Date());
const somar = (dias: number) => {
  const d = new Date(hoje + "T12:00Z");
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
};

beforeEach(async () => {
  db = await criarBancoDeTeste();
  await db.insert(estudios).values({ codigo: "A", nome: "Estúdio A" });
});

const socio = () => criarCaller(db, sessaoFake("socio"));

describe("fluxo de caixa", () => {
  it("sem saldo informado, não finge: configurado = false e zero", async () => {
    const caixa = await socio().financeiro.fluxoDeCaixa({ meses: 3 });
    expect(caixa.configurado).toBe(false);
    expect(caixa.saldoHoje).toBe(0);
  });

  it("saldo de hoje = virada + recebido − pago, ignorando o que é anterior", async () => {
    const s = socio();
    await s.financeiro.definirSaldoInicial({
      dataVirada: somar(-30),
      saldoInicialCents: 1000000,
    });
    await db.insert(cobrancas).values([
      /* recebida depois da virada: entra */
      {
        valorCents: 300000,
        estado: "paga",
        prazoDias: 0,
        dataPagamento: somar(-10),
      },
      /* recebida ANTES da virada: já estava no saldo, não entra de novo */
      {
        valorCents: 999900,
        estado: "paga",
        prazoDias: 0,
        dataPagamento: somar(-45),
      },
    ]);
    await db.insert(lancamentos).values({
      descricao: "Aluguel",
      categoria: "imovel",
      natureza: "data_e_valor_conhecidos",
      estado: "pago",
      valorCents: 200000,
      dataPagamento: somar(-5),
    });

    const caixa = await s.financeiro.fluxoDeCaixa({ meses: 3 });
    expect(caixa.recebido).toBe(300000);
    expect(caixa.pago).toBe(200000);
    expect(caixa.saldoHoje).toBe(1000000 + 300000 - 200000);
  });

  it("projeção empilha meses e sinaliza conta sem valor", async () => {
    const s = socio();
    await s.financeiro.definirSaldoInicial({
      dataVirada: hoje,
      saldoInicialCents: 500000,
    });
    await db.insert(cobrancas).values({
      valorCents: 400000,
      estado: "emitida",
      prazoDias: 0,
      previsaoRecebimento: somar(10),
    });
    await db.insert(lancamentos).values([
      {
        descricao: "Luz",
        categoria: "utilidades",
        natureza: "valor_desconhecido",
        estado: "previsto",
        valorCents: null,
        dataVencimento: somar(12),
      },
      {
        descricao: "Aluguel",
        categoria: "imovel",
        natureza: "data_e_valor_conhecidos",
        estado: "previsto",
        valorCents: 150000,
        dataVencimento: somar(12),
      },
    ]);

    const caixa = await s.financeiro.fluxoDeCaixa({ meses: 3 });
    const total = caixa.projecao.reduce(
      (s, m) => s + m.entradas - m.saidas,
      0
    );
    expect(total).toBe(400000 - 150000);
    expect(caixa.projecao.at(-1)!.saldoFinal).toBe(500000 + 400000 - 150000);
    expect(caixa.projecao.some((m) => m.semValor === 1)).toBe(true);
  });

  it("funcionário não vê o caixa", async () => {
    await expect(
      criarCaller(db, sessaoFake("funcionario")).financeiro.fluxoDeCaixa({
        meses: 3,
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
