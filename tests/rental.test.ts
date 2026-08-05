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
const publico = () => criarCaller(db);

async function reserva(dataInicio: string, dataFim = dataInicio) {
  return socio().reservas.criar({
    dataInicio,
    dataFim,
    horaInicio: "07:00",
    horaFim: "19:00",
    estudioIds: [estudioA],
    valorDiariaCents: 300000,
    descontoCents: 0,
  });
}

async function arara(qtdTotal: number | null = 4) {
  return socio().rental.criarItem({
    nome: "Arara",
    unidade: "unidade",
    precoCents: 5000,
    qtdTotal,
  });
}

describe("Tino Rental", () => {
  it("preço vem do servidor: o cliente manda só id e quantidade", async () => {
    const item = await arara();
    const r = await reserva("2026-09-10");
    await publico().portais.pedirExtras({
      token: r.tokenPortalProdutor!,
      itens: [{ itemId: item.id, qtd: 2 }],
    });
    const detalhe = await socio().reservas.obter({ id: r.id });
    expect(detalhe.extras).toHaveLength(1);
    expect(detalhe.extras[0].precoCents).toBe(5000);
    expect(detalhe.comanda.extrasCents).toBe(10000);
    /* extras entram no total da comanda */
    expect(detalhe.valorTotalCents).toBe(300000 + 10000);
  });

  it("estoque é por período: outra reserva no mesmo dia disputa o item", async () => {
    const item = await arara(4);
    const r1 = await reserva("2026-09-10");
    await publico().portais.pedirExtras({
      token: r1.tokenPortalProdutor!,
      itens: [{ itemId: item.id, qtd: 3 }],
    });

    const r2 = await socio().reservas.criar({
      dataInicio: "2026-09-10",
      dataFim: "2026-09-10",
      horaInicio: "20:00",
      horaFim: "23:00",
      estudioIds: [estudioA],
    });
    const catalogo = await publico().portais.catalogoExtras({
      token: r2.tokenPortalProdutor!,
    });
    expect(catalogo[0].disponivel).toBe(1);
    /* o número na tela é o mesmo que a validação aplica */

    await expect(
      publico().portais.pedirExtras({
        token: r2.tokenPortalProdutor!,
        itens: [{ itemId: item.id, qtd: 2 }],
      })
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("reserva em outra data não disputa estoque", async () => {
    const item = await arara(4);
    const r1 = await reserva("2026-09-10");
    await publico().portais.pedirExtras({
      token: r1.tokenPortalProdutor!,
      itens: [{ itemId: item.id, qtd: 4 }],
    });
    const r2 = await reserva("2026-09-20");
    const catalogo = await publico().portais.catalogoExtras({
      token: r2.tokenPortalProdutor!,
    });
    expect(catalogo[0].disponivel).toBe(4);
  });

  it("o que a própria reserva já pediu sai do estoque, na tela e na regra", async () => {
    const item = await arara(4);
    const r = await reserva("2026-09-10");
    await publico().portais.pedirExtras({
      token: r.tokenPortalProdutor!,
      itens: [{ itemId: item.id, qtd: 3 }],
    });
    const catalogo = await publico().portais.catalogoExtras({
      token: r.tokenPortalProdutor!,
    });
    expect(catalogo[0].disponivel).toBe(1);
    await expect(
      publico().portais.pedirExtras({
        token: r.tokenPortalProdutor!,
        itens: [{ itemId: item.id, qtd: 2 }],
      })
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("consumível (sem estoque definido) nunca trava", async () => {
    const cafe = await socio().rental.criarItem({
      nome: "Café",
      unidade: "pacote",
      precoCents: 2000,
      qtdTotal: null,
    });
    const r = await reserva("2026-09-10");
    const pedido = await publico().portais.pedirExtras({
      token: r.tokenPortalProdutor!,
      itens: [{ itemId: cafe.id, qtd: 99 }],
    });
    expect(pedido.itens).toBe(1);
  });

  it("catálogo do portal não expõe custo de fornecedor", async () => {
    await socio().rental.criarItem({
      nome: "Pranchão",
      unidade: "unidade",
      precoCents: 8000,
      custoFornecedorCentsDia: 3000,
      qtdTotal: 2,
    });
    const r = await reserva("2026-09-10");
    const catalogo = await publico().portais.catalogoExtras({
      token: r.tokenPortalProdutor!,
    });
    expect(catalogo[0]).not.toHaveProperty("custoFornecedorCentsDia");
    expect(catalogo[0]).not.toHaveProperty("multaPorUnidadeCents");
  });

  it("funcionário consulta o catálogo, mas não edita preço", async () => {
    await arara();
    const f = criarCaller(db, sessaoFake("funcionario"));
    await expect(f.rental.catalogo()).resolves.toHaveLength(1);
    await expect(
      f.rental.criarItem({ nome: "X", unidade: "un", precoCents: 1 })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("token inválido não pede nada", async () => {
    const item = await arara();
    await expect(
      publico().portais.pedirExtras({
        token: "a".repeat(64),
        itens: [{ itemId: item.id, qtd: 1 }],
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
