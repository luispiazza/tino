import { beforeEach, describe, expect, it } from "vitest";
import type { DB } from "@/server/db";
import { criarBancoDeTeste, criarCaller, sessaoFake } from "./helpers";

let db: DB;

beforeEach(async () => {
  db = await criarBancoDeTeste();
});

describe("estudios", () => {
  it("sócio cadastra; a listagem é pública e traz dependências", async () => {
    const socio = criarCaller(db, sessaoFake("socio"));
    const a = await socio.estudios.criar({
      codigo: "A",
      nome: "Estúdio A",
      areaM2: 240,
      ehComplementar: false,
      dependeDeIds: [],
    });
    await socio.estudios.criar({
      codigo: "B",
      nome: "Estúdio B",
      ehComplementar: true,
      dependeDeIds: [a.id],
    });

    const lista = await criarCaller(db).estudios.listar();
    expect(lista).toHaveLength(2);
    const b = lista.find((e) => e.codigo === "B")!;
    expect(b.dependeDeIds).toEqual([a.id]);
  });

  it("estúdio principal não pode declarar dependência", async () => {
    const socio = criarCaller(db, sessaoFake("socio"));
    const a = await socio.estudios.criar({
      codigo: "A",
      nome: "Estúdio A",
      ehComplementar: false,
      dependeDeIds: [],
    });
    await expect(
      socio.estudios.criar({
        codigo: "E",
        nome: "Estúdio E",
        ehComplementar: false,
        dependeDeIds: [a.id],
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("funcionário não edita cadastro", async () => {
    await expect(
      criarCaller(db, sessaoFake("funcionario")).estudios.criar({
        codigo: "A",
        nome: "Estúdio A",
        ehComplementar: false,
        dependeDeIds: [],
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("atualizar troca dados e dependências", async () => {
    const socio = criarCaller(db, sessaoFake("socio"));
    const a = await socio.estudios.criar({
      codigo: "A",
      nome: "Estúdio A",
      ehComplementar: false,
      dependeDeIds: [],
    });
    const e = await socio.estudios.criar({
      codigo: "E",
      nome: "Estúdio E",
      ehComplementar: false,
      dependeDeIds: [],
    });
    const c = await socio.estudios.criar({
      codigo: "C",
      nome: "Estúdio C",
      ehComplementar: true,
      dependeDeIds: [a.id],
    });

    await socio.estudios.atualizar({
      id: c.id,
      areaM2: 84,
      dependeDeIds: [a.id, e.id],
    });
    const lista = await criarCaller(db).estudios.listar();
    const cAtual = lista.find((x) => x.id === c.id)!;
    expect(cAtual.areaM2).toBe(84);
    expect(cAtual.dependeDeIds.sort()).toEqual([a.id, e.id].sort());
  });
});
