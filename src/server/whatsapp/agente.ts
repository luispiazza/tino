import {
  executarFerramenta,
  ferramentasCliente,
  type ContextoFerramentas,
} from "./ferramentas";
import type { PapelWhatsapp } from "./identidade";

/*
 * Um agente só. A v1 tinha dois (`whatsappWebhook.ts` e `routers/whatsappAi.ts`)
 * que já haviam divergido — só um deles ignorava mensagem de grupo. Aqui
 * existe este caminho e nenhum outro.
 *
 * Gemini pelo Google, em API compatível com a da OpenAI. Até 24/08 o
 * caminho era o gateway do Forge (Manus); nesse dia `forge.manus.im` saiu
 * do DNS e levou o atendimento junto. Era a amarra que este comentário já
 * previa, e o conserto foi o previsto: variável de ambiente, porque só
 * este arquivo fala com o modelo.
 *
 * O modelo deixou de ser o `gemini-2.5-flash` da v1 no mesmo dia, e não
 * por escolha: o Google fechou o 2.5 para contas novas, e a chave nova
 * levava 404. Trocar de geração não é só trocar o nome — ver o
 * `reasoning_effort` lá embaixo.
 *
 * Os nomes das variáveis são genéricos de propósito. Batizar a
 * configuração com o nome de um fornecedor foi metade do problema da vez
 * passada — quando ele caiu, o código todo ainda dizia "Forge".
 */
const MODELO = process.env.LLM_MODELO ?? "gemini-3.6-flash";

/*
 * Base no sentido dos SDKs da OpenAI: tudo que vem antes de
 * `/chat/completions`, incluindo o `/v1` — ou o que o provedor use no
 * lugar dele. No Google esse trecho é `/v1beta/openai`, e é justamente por
 * isso que ele não pode ficar fixo na hora do fetch.
 */
const BASE_LLM =
  process.env.LLM_API_URL ??
  "https://generativelanguage.googleapis.com/v1beta/openai";

const chave = () => process.env.LLM_API_KEY;

/* ------------------------- o envelope da API compatível com a da OpenAI */

interface ChamadaFerramenta {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

interface MensagemLLM {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  name?: string;
  tool_call_id?: string;
  tool_calls?: ChamadaFerramenta[];
  /*
   * O Gemini 3 devolve aqui a assinatura cifrada do raciocínio daquele
   * turno. Quem monta o histórico do lado do cliente — nós — é obrigado a
   * devolvê-la intacta na volta seguinte, ou o modelo perde o fio do que
   * estava pensando quando pediu a ferramenta. Opaco de propósito: não se
   * lê nem se remonta, só se repassa. Provedor que não usa isso não manda
   * o campo, e `JSON.stringify` some com ele sozinho.
   */
  extra_content?: unknown;
}

interface RespostaLLM {
  choices?: {
    message?: {
      content?: string | null;
      tool_calls?: ChamadaFerramenta[];
      extra_content?: unknown;
    };
    finish_reason?: string | null;
  }[];
}

/*
 * §5.3.3 — o que a IA nunca faz. A linha que não pode ser cruzada numa IA
 * que fala com cliente sobre dinheiro. A v1 já proibia confirmar reserva
 * sozinha; as outras seis vêm da especificação v2.
 */
const GUARDRAILS = `# O que você NUNCA faz
- Nunca confirma uma reserva. Coleta o que der e passa para um humano.
- Nunca negocia preço nem concede desconto.
- Nunca informa valor de diária de estúdio — isso é negociado caso a caso.
- Nunca confirma pagamento como recebido.
- Nunca emite nem promete nota fiscal.
- Nunca revela dado de um contato a outro, nem confirma que alguém tem reserva.
- Nunca cancela nada.
- Nunca promete disponibilidade sem chamar consultar_disponibilidade antes.

Ao esbarrar em qualquer um destes, chame escalar_para_humano.`;

const ESTILO = `# Como você escreve
É WhatsApp: escreva curto. Uma ou duas frases por mensagem, em português
brasileiro, no tom de quem trabalha no estúdio — direto e cordial, sem
formalidade de e-mail. Nada de listas com marcadores, títulos ou negrito.
Nada de emoji, a menos que a pessoa use primeiro. Responda o que foi
perguntado; não ofereça um resumo do que você pode fazer.`;

/*
 * A data de hoje entra em toda conversa. Sem ela o modelo responde a
 * partir do que sabia quando foi treinado: "dia 12" vira chute, "sexta
 * que vem" não resolve e o ano sai errado na virada. Num agente que
 * consulta agenda, isso não é detalhe — é a diferença entre confirmar a
 * data certa e a de um ano atrás. Vem do relógio, nunca do cadastro.
 */
export function contextoDeHoje(): string {
  const agora = new Date();
  const dia = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(agora);
  const hora = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(agora);
  const iso = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
  }).format(agora);

  return `# Hoje
É ${dia}, ${hora} em São Paulo. Em formato de data: ${iso}.
Data sem ano é o ano corrente — ou o próximo, se o dia já passou. Nunca
pergunte que ano é. Ao chamar uma ferramenta, converta o que a pessoa
disse ("dia 12", "sexta que vem") para AAAA-MM-DD a partir de hoje.`;
}

const POR_PAPEL: Record<PapelWhatsapp, string> = {
  cliente:
    "Quem fala é um cliente já cadastrado. Você pode consultar disponibilidade, " +
    "os dados das reservas dele e mandar os links dos portais.",
  desconhecido:
    "Este número NÃO está no cadastro. Responda só o que é público — estúdios, " +
    "estrutura, endereço, como funciona. Não confirme nem negue a existência de " +
    "nenhuma reserva. Se pedirem qualquer dado privado, chame escalar_para_humano.",
  fornecedor:
    "Quem fala é fornecedor. O atendimento a fornecedor ainda não está no ar: " +
    "chame escalar_para_humano.",
  funcionario:
    "Quem fala é da equipe. O atendimento à equipe ainda não está no ar: " +
    "chame escalar_para_humano.",
  socio:
    "Quem fala é sócio do estúdio. Consultas de sócio ainda não estão no ar: " +
    "chame escalar_para_humano.",
};

export interface TurnoConversa {
  autor: "contato" | "ia" | "humano";
  texto: string;
}

export interface PedidoResposta {
  ctx: ContextoFerramentas;
  papel: PapelWhatsapp;
  conhecimento: string;
  politica: string | null;
  systemPrompt: string | null;
  historico: TurnoConversa[];
}

export interface RespostaAgente {
  texto: string | null;
  escalou: boolean;
  erro: string | null;
}

/* Nome do estúdio à parte: quem responde é o estúdio, não "a assistente". */
const PAPEL_BASE =
  "Você atende o WhatsApp do Tino Estúdio, um complexo de estúdios de " +
  "fotografia e vídeo na Vila Romana, em São Paulo. Você fala em nome do " +
  "estúdio com quem procura o número comercial.";

async function chamarLLM(
  mensagens: MensagemLLM[],
  apiKey: string
): Promise<RespostaLLM> {
  const r = await fetch(`${BASE_LLM.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODELO,
      messages: mensagens,
      tools: ferramentasCliente,
      tool_choice: "auto",
      max_tokens: 32768,
      /*
       * O `thinking: { budget_tokens: 128 }` da v1 era extensão do Forge:
       * em qualquer outro provedor vira campo desconhecido e derruba a
       * chamada com 400.
       *
       * Aqui o valor é o piso, não um meio-termo: atendimento não precisa
       * raciocinar antes de responder e raciocínio é cobrado como saída.
       * No 2.5 o piso era `none`; a família 3 não deixa desligar, e o
       * mínimo que a camada compatível aceita é `low`. Se um dia mudar de
       * modelo, confira este valor antes — é o campo que dá 400.
       */
      reasoning_effort: "low",
    }),
  });

  if (!r.ok) {
    throw new Error(`LLM ${r.status}: ${(await r.text()).slice(0, 200)}`);
  }
  return (await r.json()) as RespostaLLM;
}

export async function responder(
  pedido: PedidoResposta
): Promise<RespostaAgente> {
  const apiKey = chave();
  if (!apiKey) {
    return { texto: null, escalou: false, erro: "LLM_API_KEY ausente" };
  }

  const instrucoes = [
    pedido.systemPrompt?.trim() || PAPEL_BASE,
    POR_PAPEL[pedido.papel],
    ESTILO,
    GUARDRAILS,
    pedido.politica?.trim()
      ? `# Política comercial e tom (cadastro do estúdio)\n${pedido.politica.trim()}`
      : null,
    `# Cadastro do estúdio\nEstes dados vêm do sistema e estão sempre atuais.\n\n${pedido.conhecimento}`,
    contextoDeHoje(),
  ]
    .filter(Boolean)
    .join("\n\n");

  const mensagens: MensagemLLM[] = [
    { role: "system", content: instrucoes },
    ...pedido.historico.map((t) => ({
      role: t.autor === "contato" ? ("user" as const) : ("assistant" as const),
      content: t.texto,
    })),
  ];

  let escalou = false;

  /* teto de voltas: nenhuma conversa de atendimento precisa de mais */
  for (let volta = 0; volta < 6; volta++) {
    let resposta: RespostaLLM;
    try {
      resposta = await chamarLLM(mensagens, apiKey);
    } catch (e) {
      return {
        texto: null,
        escalou,
        erro: e instanceof Error ? e.message : "falha ao chamar o agente",
      };
    }

    const escolha = resposta.choices?.[0];
    const chamadas = escolha?.message?.tool_calls ?? [];

    if (chamadas.length === 0) {
      const texto = escolha?.message?.content?.trim() ?? "";
      return { texto: texto || null, escalou, erro: null };
    }

    mensagens.push({
      role: "assistant",
      content: escolha?.message?.content ?? "",
      tool_calls: chamadas,
      extra_content: escolha?.message?.extra_content,
    });

    for (const chamada of chamadas) {
      /*
       * Argumento vem como string de JSON e o modelo às vezes erra a mão.
       * Devolver o erro como resultado deixa ele corrigir na volta
       * seguinte; estourar aqui perderia a conversa inteira.
       */
      let entrada: Record<string, unknown> = {};
      let saida: { texto: string; escalou: boolean };
      try {
        entrada = JSON.parse(chamada.function.arguments || "{}");
      } catch {
        mensagens.push({
          role: "tool",
          tool_call_id: chamada.id,
          name: chamada.function.name,
          content: "Argumentos inválidos: mande um JSON válido.",
        });
        continue;
      }

      try {
        saida = await executarFerramenta(
          pedido.ctx,
          chamada.function.name,
          entrada
        );
      } catch (e) {
        console.error("[whatsapp] ferramenta falhou", chamada.function.name, e);
        saida = {
          texto: "Não foi possível completar essa consulta agora.",
          escalou: false,
        };
      }

      if (saida.escalou) escalou = true;
      mensagens.push({
        role: "tool",
        tool_call_id: chamada.id,
        name: chamada.function.name,
        content: saida.texto,
      });
    }
  }

  return {
    texto: null,
    escalou,
    erro: "o agente não fechou a resposta em 6 voltas",
  };
}
