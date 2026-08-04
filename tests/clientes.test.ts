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

describe("clientes", () => {
  it("sócio cria e a reserva liga ao cliente; listar traz o nome", async () => {
    const socio = criarCaller(db, sessaoFake("socio"));
    const cliente = await socio.clientes.criar({
      nome: "EGREY",
      telefone: "11999990000",
    });
    await socio.reservas.criar({
      dataInicio: "2026-08-10",
      dataFim: "2026-08-10",
      horaInicio: "07:00",
      horaFim: "19:00",
      estudioIds: [estudioA],
      clienteId: cliente.id,
    });
    const lista = await socio.reservas.listar();
    expect(lista[0].clienteNome).toBe("EGREY");
  });

  it("funcionário não acessa cadastro de clientes", async () => {
    await expect(
      criarCaller(db, sessaoFake("funcionario")).clientes.listar()
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("atualizar corrige o cadastro", async () => {
    const socio = criarCaller(db, sessaoFake("socio"));
    const c = await socio.clientes.criar({ nome: "Egrey" });
    const atualizado = await socio.clientes.atualizar({
      id: c.id,
      nome: "EGREY",
      empresa: "EGREY Filmes",
    });
    expect(atualizado.nome).toBe("EGREY");
    expect(atualizado.empresa).toBe("EGREY Filmes");
  });
});
