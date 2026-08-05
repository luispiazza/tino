import { beforeEach, describe, expect, it } from "vitest";
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
