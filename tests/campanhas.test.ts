import { beforeEach, describe, expect, it } from "vitest";
import { estudios } from "@/server/db/schema";
import type { DB } from "@/server/db";
import { criarBancoDeTeste, criarCaller, sessaoFake } from "./helpers";

let db: DB;

beforeEach(async () => {
  db = await criarBancoDeTeste();
});

const socio = () => criarCaller(db, sessaoFake("socio"));
const publico = () => criarCaller(db);

describe("campanhas e instrumentação", () => {
  it("porSlug devolve só campanha ativa; pausada cai no padrão (null)", async () => {
    const s = socio();
    const c = await s.campanhas.criar({
      slug: "moda-verao",
      nome: "Moda Verão",
      heroTitulo: "Seu editorial de verão",
    });
    const ativa = await publico().campanhas.porSlug({ slug: "moda-verao" });
    expect(ativa?.heroTitulo).toBe("Seu editorial de verão");

    await s.campanhas.atualizar({ id: c.id, ativa: false });
    expect(await publico().campanhas.porSlug({ slug: "moda-verao" })).toBeNull();
    expect(await publico().campanhas.porSlug({ slug: "nao-existe" })).toBeNull();
  });

  it("montagem grava com código curto e resolve a origem pelo slug", async () => {
    await socio().campanhas.criar({ slug: "moda-verao", nome: "Moda Verão" });
    const { codigoCurto } = await publico().campanhas.gravarMontagem({
      combinacao: "A+B",
      dataDesejada: "2026-10-01",
      campanhaSlug: "moda-verao",
    });
    expect(codigoCurto).toMatch(/^M-[2-9A-HJ-NP-Z]{4}$/);

    await publico().campanhas.marcarCliqueWhatsapp({ codigoCurto });
    const funil = await socio().campanhas.funil();
    expect(funil).toHaveLength(1);
    expect(funil[0].etapa).toBe("clique_whatsapp");
    expect(funil[0].campanhaId).not.toBeNull();
    expect(funil[0].total).toBe(1);
  });

  it("montagem sem campanha (orgânico) grava com origem nula", async () => {
    const { codigoCurto } = await publico().campanhas.gravarMontagem({
      combinacao: "E+C",
    });
    expect(codigoCurto).toMatch(/^M-/);
    const funil = await socio().campanhas.funil();
    expect(funil[0].campanhaId).toBeNull();
  });

  it("o código do site na reserva fecha o funil e atribui a receita", async () => {
    const s = socio();
    await s.campanhas.criar({ slug: "moda-verao", nome: "Moda Verão" });
    const { codigoCurto } = await publico().campanhas.gravarMontagem({
      combinacao: "A+B",
      campanhaSlug: "moda-verao",
    });
    await publico().campanhas.marcarCliqueWhatsapp({ codigoCurto });

    const [estudio] = await db
      .insert(estudios)
      .values({ codigo: "A", nome: "Estúdio A" })
      .returning();
    await s.reservas.criar({
      dataInicio: "2026-10-01",
      dataFim: "2026-10-01",
      horaInicio: "07:00",
      horaFim: "19:00",
      estudioIds: [estudio.id],
      valorDiariaCents: 300000,
      descontoCents: 0,
      codigoMontagem: codigoCurto,
    });

    const [origem] = await s.campanhas.resultados();
    expect(origem.nome).toBe("Moda Verão");
    expect(origem.montagens).toBe(1);
    expect(origem.conversas).toBe(1);
    expect(origem.reservas).toBe(1);
    expect(origem.receitaCents).toBe(300000);
  });

  it("sem código, a origem fica desconhecida — não se chuta campanha", async () => {
    const s = socio();
    await s.campanhas.criar({ slug: "moda-verao", nome: "Moda Verão" });
    await publico().campanhas.gravarMontagem({ campanhaSlug: "moda-verao" });

    const [estudio] = await db
      .insert(estudios)
      .values({ codigo: "A", nome: "Estúdio A" })
      .returning();
    await s.reservas.criar({
      dataInicio: "2026-10-02",
      dataFim: "2026-10-02",
      horaInicio: "07:00",
      horaFim: "19:00",
      estudioIds: [estudio.id],
      valorDiariaCents: 300000,
      descontoCents: 0,
    });

    const [origem] = await s.campanhas.resultados();
    expect(origem.montagens).toBe(1);
    expect(origem.reservas).toBe(0);
    expect(origem.receitaCents).toBe(0);
  });

  it("montagem orgânica aparece como origem própria", async () => {
    await publico().campanhas.gravarMontagem({ combinacao: "E+C" });
    const [origem] = await socio().campanhas.resultados();
    expect(origem.nome).toBe("Orgânico / direto");
    expect(origem.campanhaId).toBeNull();
  });

  it("funcionário não cria campanha; público não lê o funil", async () => {
    await expect(
      criarCaller(db, sessaoFake("funcionario")).campanhas.criar({
        slug: "abc",
        nome: "x",
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(publico().campanhas.funil()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });
});
