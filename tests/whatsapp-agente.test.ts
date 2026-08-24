import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { estudios, whatsappContatos } from "@/server/db/schema";
import type { DB } from "@/server/db";
import { responder } from "@/server/whatsapp/agente";
import { criarBancoDeTeste } from "./helpers";

/*
 * O agente conversa com o Gemini por HTTP, em API compatível com a da
 * OpenAI. Aqui o `fetch` é dublê: o que se afirma é o envelope que sai e o
 * laço de ferramentas que volta, que é exatamente a parte impossível de
 * exercitar sem gastar chamada real.
 */
const BASE_TESTE = "https://tino-v2-production.up.railway.app";

let db: DB;
let contatoId: number;

const respostas: unknown[] = [];
const chamadas: { url: string; init: RequestInit }[] = [];

function enfileirar(corpo: unknown) {
  respostas.push(corpo);
}

const textoSimples = (texto: string) => ({
  choices: [{ message: { content: texto }, finish_reason: "stop" }],
});

const pedeFerramenta = (nome: string, args: unknown) => ({
  choices: [
    {
      message: {
        content: "",
        tool_calls: [
          {
            id: "call_1",
            type: "function",
            function: { name: nome, arguments: JSON.stringify(args) },
          },
        ],
      },
      finish_reason: "tool_calls",
    },
  ],
});

beforeEach(async () => {
  db = await criarBancoDeTeste();
  const [c] = await db
    .insert(whatsappContatos)
    .values({ telefone: "5511999350085", papel: "desconhecido" })
    .returning();
  contatoId = c.id;

  respostas.length = 0;
  chamadas.length = 0;
  process.env.LLM_API_KEY = "chave-de-teste";

  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    chamadas.push({ url, init });
    const corpo = respostas.shift() ?? textoSimples("ok");
    return new Response(JSON.stringify(corpo), { status: 200 });
  });
});

afterEach(() => vi.unstubAllGlobals());

const pedir = () =>
  responder({
    ctx: {
      db,
      contatoId,
      telefone: "5511999350085",
      nomeContato: null,
      clienteId: null,
      telefoneAviso: null,
      retomadaHoras: 24,
      baseUrl: BASE_TESTE,
    },
    papel: "desconhecido",
    conhecimento: "## Estúdios\n### A — Estúdio A",
    politica: null,
    systemPrompt: null,
    historico: [{ autor: "contato", texto: "oi" }],
  });

const corpoDaChamada = (i = 0) =>
  JSON.parse(String(chamadas[i].init.body)) as {
    model: string;
    messages: {
      role: string;
      content: string;
      tool_calls?: unknown[];
      extra_content?: unknown;
    }[];
    tools: { function: { name: string } }[];
    tool_choice: string;
    reasoning_effort?: string;
    thinking?: unknown;
  };

describe("agente — o envelope que vai para o modelo", () => {
  it("sem chave, nem tenta a chamada", async () => {
    delete process.env.LLM_API_KEY;

    const r = await responder({
      ctx: {
        db,
        contatoId,
        telefone: "5511999350085",
        nomeContato: null,
        clienteId: null,
        telefoneAviso: null,
        retomadaHoras: 24,
        baseUrl: BASE_TESTE,
      },
      papel: "cliente",
      conhecimento: "",
      politica: null,
      systemPrompt: null,
      historico: [{ autor: "contato", texto: "oi" }],
    });

    expect(r.erro).toContain("LLM_API_KEY");
    expect(chamadas).toHaveLength(0);
  });

  it("acerta endpoint, chave e modelo", async () => {
    enfileirar(textoSimples("Oi! Como posso ajudar?"));
    const r = await pedir();

    /* o /v1beta/openai do Google no lugar do /v1 — errar isso dá 404 */
    expect(chamadas[0].url).toBe(
      "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"
    );
    expect((chamadas[0].init.headers as Record<string, string>).authorization).toBe(
      "Bearer chave-de-teste"
    );
    expect(corpoDaChamada().model).toBe("gemini-3.6-flash");
    expect(corpoDaChamada().tool_choice).toBe("auto");
    expect(r.texto).toBe("Oi! Como posso ajudar?");
    expect(r.erro).toBeNull();
  });

  /*
   * O que derrubou a chamada quando o provedor mudou: `thinking` era campo
   * do Forge e vira 400 no Google. Este teste é a trava para ele não
   * voltar por cópia de código antigo.
   */
  it("não manda o campo de thinking do Forge, e pede o piso de raciocínio", async () => {
    enfileirar(textoSimples("ok"));
    await pedir();

    expect(corpoDaChamada().thinking).toBeUndefined();
    expect(corpoDaChamada().reasoning_effort).toBe("low");
  });

  /*
   * O Gemini 3 devolve a assinatura cifrada do raciocínio junto da chamada
   * de ferramenta, e cobra que ela volte intacta no turno seguinte. Como
   * quem monta o histórico é este código, perder o campo aqui degradaria
   * exatamente as conversas que usam ferramenta — as que mais importam.
   */
  it("devolve a assinatura de raciocínio intacta na volta da ferramenta", async () => {
    const assinatura = { google: { thought_signature: "EmcKZQERTTIP" } };
    const pedido = pedeFerramenta("escalar_para_humano", { motivo: "teste" });
    (pedido.choices[0].message as Record<string, unknown>).extra_content =
      assinatura;
    enfileirar(pedido);
    enfileirar(textoSimples("Já chamei alguém."));

    await pedir();

    const doAssistente = corpoDaChamada(1).messages.find(
      (m) => m.role === "assistant"
    );
    expect(doAssistente?.extra_content).toEqual(assinatura);
  });

  it("as três ferramentas da Onda 1 vão no formato de function calling", () => {
    enfileirar(textoSimples("ok"));
    return pedir().then(() => {
      const nomes = corpoDaChamada().tools.map((t) => t.function.name);
      expect(nomes).toEqual([
        "consultar_disponibilidade",
        "buscar_reserva",
        "escalar_para_humano",
      ]);
    });
  });

  it("guardrails, papel e data de hoje entram na mensagem de sistema", async () => {
    enfileirar(textoSimples("ok"));
    await pedir();

    const sistema = corpoDaChamada().messages[0];
    expect(sistema.role).toBe("system");
    expect(sistema.content).toContain("Nunca confirma uma reserva");
    expect(sistema.content).toContain("NÃO está no cadastro");
    expect(sistema.content).toContain("Estúdio A");
    expect(sistema.content).toContain("# Hoje");
  });

  it("resultado de ferramenta volta como role tool e o modelo responde na volta seguinte", async () => {
    await db.insert(estudios).values({ codigo: "A", nome: "Estúdio A" });
    enfileirar(
      pedeFerramenta("consultar_disponibilidade", {
        estudios: ["A"],
        data_inicio: "2026-09-10",
        data_fim: "2026-09-10",
        hora_inicio: "09:00",
        hora_fim: "18:00",
      })
    );
    enfileirar(textoSimples("O A está livre nesse dia."));

    const r = await pedir();
    expect(chamadas).toHaveLength(2);

    const segunda = corpoDaChamada(1).messages;
    const doAssistente = segunda.find((m) => m.role === "assistant");
    const daFerramenta = segunda.find((m) => m.role === "tool");
    expect(doAssistente?.tool_calls).toHaveLength(1);
    expect(daFerramenta?.content).toContain("LIVRES");
    expect(r.texto).toBe("O A está livre nesse dia.");
  });

  it("escalar marca a resposta como escalada", async () => {
    enfileirar(
      pedeFerramenta("escalar_para_humano", {
        motivo: "pedido_explicito",
        resumo: "pediu para falar com alguém",
      })
    );
    enfileirar(textoSimples("Já chamei alguém do estúdio."));

    const r = await pedir();
    expect(r.escalou).toBe(true);
  });

  it("argumento que não é JSON vira recado, não derruba a conversa", async () => {
    enfileirar({
      choices: [
        {
          message: {
            content: "",
            tool_calls: [
              {
                id: "call_1",
                type: "function",
                function: { name: "buscar_reserva", arguments: "{isso não é json" },
              },
            ],
          },
        },
      ],
    });
    enfileirar(textoSimples("Deixa eu tentar de outro jeito."));

    const r = await pedir();
    const daFerramenta = corpoDaChamada(1).messages.find((m) => m.role === "tool");
    expect(daFerramenta?.content).toContain("Argumentos inválidos");
    expect(r.texto).toBe("Deixa eu tentar de outro jeito.");
    expect(r.erro).toBeNull();
  });

  it("erro HTTP do provedor vira erro registrado, não exceção solta", async () => {
    vi.stubGlobal("fetch", async () => new Response("sem cota", { status: 429 }));
    const r = await pedir();
    expect(r.texto).toBeNull();
    expect(r.erro).toContain("429");
  });

  it("modelo que fica pedindo ferramenta para de rodar em algum momento", async () => {
    for (let i = 0; i < 10; i++) {
      enfileirar(pedeFerramenta("buscar_reserva", {}));
    }
    const r = await pedir();
    expect(r.erro).toContain("6 voltas");
    expect(chamadas.length).toBeLessThanOrEqual(6);
  });
});
