import { beforeEach, describe, expect, it, vi } from "vitest";

/*
 * O filtro do webhook num arquivo só dele: aqui `atender` é dublê, e o que
 * se afirma é exatamente o que importa — quantas vezes o atendimento foi
 * acionado. Mensagem de grupo passando adiante foi o problema 1 da v1
 * (dos dois agentes que coexistiam, só um a ignorava).
 */
const atender = vi.hoisted(() => vi.fn());
vi.mock("@/server/whatsapp/atendimento", () => ({ atender }));
vi.mock("@/server/db", () => ({ db: {} }));

import { POST } from "@/app/api/whatsapp/webhook/route";

beforeEach(() => atender.mockReset());

const entregar = (value: unknown) =>
  POST(
    new Request("http://local/api/whatsapp/webhook", {
      method: "POST",
      body: JSON.stringify({ entry: [{ changes: [{ value }] }] }),
    })
  );

const texto = (extra: Record<string, unknown> = {}) => ({
  messages: [
    {
      id: "wamid.A",
      from: "5511999350085",
      type: "text",
      text: { body: "tem estúdio livre dia 12?" },
      ...extra,
    },
  ],
  contacts: [{ wa_id: "5511999350085", profile: { name: "Ana" } }],
});

describe("webhook — o que vira atendimento e o que não vira", () => {
  it("mensagem de texto de um número comum é atendida, com o nome do perfil", async () => {
    const r = await entregar(texto());
    expect(r.status).toBe(200);
    expect(atender).toHaveBeenCalledTimes(1);
    expect(atender.mock.calls[0][1]).toEqual({
      telefone: "5511999350085",
      nomePerfil: "Ana",
      texto: "tem estúdio livre dia 12?",
      wamid: "wamid.A",
    });
  });

  it("mensagem de grupo nunca é atendida", async () => {
    await entregar(texto({ group_id: "123" }));
    expect(atender).not.toHaveBeenCalled();
  });

  it("áudio, imagem e recibo de entrega não são conversa", async () => {
    await entregar({
      messages: [{ id: "wamid.B", from: "5511999350085", type: "audio" }],
    });
    await entregar({
      messages: [{ id: "wamid.C", from: "5511999350085", type: "image" }],
    });
    await entregar({ statuses: [{ id: "wamid.D", status: "read" }] });
    expect(atender).not.toHaveBeenCalled();
  });

  it("uma mensagem que estoura não derruba as outras do lote", async () => {
    atender.mockRejectedValueOnce(new Error("banco fora"));
    const r = await POST(
      new Request("http://local/api/whatsapp/webhook", {
        method: "POST",
        body: JSON.stringify({
          entry: [
            {
              changes: [
                {
                  value: {
                    messages: [
                      { id: "w.1", from: "5511900000001", type: "text", text: { body: "a" } },
                      { id: "w.2", from: "5511900000002", type: "text", text: { body: "b" } },
                    ],
                  },
                },
              ],
            },
          ],
        }),
      })
    );
    /* 200 mesmo assim: 4xx só faria a Meta reentregar o mesmo erro */
    expect(r.status).toBe(200);
    expect(atender).toHaveBeenCalledTimes(2);
  });

  it("corpo que não é JSON devolve 200 em vez de virar reentrega infinita", async () => {
    const r = await POST(
      new Request("http://local/api/whatsapp/webhook", {
        method: "POST",
        body: "nao-e-json",
      })
    );
    expect(r.status).toBe(200);
    expect(atender).not.toHaveBeenCalled();
  });
});
