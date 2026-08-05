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

describe("despesas", () => {
  it("materializa o mês uma vez só (idempotente) e respeita dia/valor", async () => {
    const s = socio();
    await s.financeiro.criarRecorrente({
      descricao: "Aluguel",
      categoria: "imovel",
      natureza: "data_e_valor_conhecidos",
      valorEsperadoCents: 1200000,
      diaVencimento: 5,
    });
    await s.financeiro.criarRecorrente({
      descricao: "Luz",
      categoria: "utilidades",
      natureza: "valor_desconhecido",
      valorEsperadoCents: null,
      diaVencimento: null,
    });

    const r1 = await s.financeiro.materializarMes({ ano: 2026, mes: 9 });
    expect(r1.criados).toBe(2);
    const r2 = await s.financeiro.materializarMes({ ano: 2026, mes: 9 });
    expect(r2.criados).toBe(0);

    const mes = await s.financeiro.listarLancamentos({ ano: 2026, mes: 9 });
    expect(mes).toHaveLength(2);
    const aluguel = mes.find((l) => l.descricao === "Aluguel")!;
    const luz = mes.find((l) => l.descricao === "Luz")!;
    expect(aluguel.dataVencimento).toBe("2026-09-05");
    expect(aluguel.valorCents).toBe(1200000);
    expect(luz.valorCents).toBeNull();
  });

  it("previsto sem valor: confirma com o valor real, depois paga", async () => {
    const s = socio();
    await s.financeiro.criarRecorrente({
      descricao: "Luz",
      categoria: "utilidades",
      natureza: "valor_desconhecido",
      valorEsperadoCents: null,
      diaVencimento: 10,
    });
    await s.financeiro.materializarMes({ ano: 2026, mes: 9 });
    const [luz] = await s.financeiro.listarLancamentos({ ano: 2026, mes: 9 });

    /* pagar sem valor é recusado */
    await expect(
      s.financeiro.pagarLancamento({ id: luz.id })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    const confirmado = await s.financeiro.confirmarLancamento({
      id: luz.id,
      valorCents: 87500,
    });
    expect(confirmado.estado).toBe("confirmado");
    const pago = await s.financeiro.pagarLancamento({
      id: luz.id,
      dataPagamento: "2026-09-12",
    });
    expect(pago.estado).toBe("pago");
    expect(pago.dataPagamento).toBe("2026-09-12");
  });

  it("agenda de obrigações junta a receber e a pagar por data, com atraso", async () => {
    const s = socio();
    const r = await s.reservas.criar({
      dataInicio: "2026-01-10",
      dataFim: "2026-01-10",
      horaInicio: "07:00",
      horaFim: "19:00",
      estudioIds: [estudioA],
      valorDiariaCents: 300000,
      descontoCents: 0,
    });
    /* cobrança com previsão no passado → atrasada */
    await s.financeiro.criarCobranca({
      reservaId: r.id,
      exigePo: false,
      prazoDias: 0,
      parcelas: 1,
    });
    await s.financeiro.criarLancamento({
      descricao: "Dedetização",
      sentido: "saida",
      categoria: "manutencao",
      natureza: "data_e_valor_conhecidos",
      valorCents: 40000,
      dataVencimento: "2030-01-15",
    });

    const agenda = await s.financeiro.agendaDeObrigacoes();
    expect(agenda.itens).toHaveLength(2);
    expect(agenda.itens[0].tipo).toBe("receber");
    expect(agenda.itens[0].atrasada).toBe(true);
    expect(agenda.itens[1].tipo).toBe("pagar");
    expect(agenda.itens[1].atrasada).toBe(false);
  });

  it("funcionário não vê despesas nem obrigações", async () => {
    const f = criarCaller(db, sessaoFake("funcionario"));
    await expect(
      f.financeiro.listarLancamentos({ ano: 2026, mes: 9 })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(f.financeiro.agendaDeObrigacoes()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});
