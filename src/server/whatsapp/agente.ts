import Anthropic from "@anthropic-ai/sdk";
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
 */
const MODELO = "claude-opus-5";

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

export async function responder(
  pedido: PedidoResposta
): Promise<RespostaAgente> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { texto: null, escalou: false, erro: "ANTHROPIC_API_KEY ausente" };
  }

  const client = new Anthropic();

  const instrucoes = [
    pedido.systemPrompt?.trim() || PAPEL_BASE,
    POR_PAPEL[pedido.papel],
    ESTILO,
    GUARDRAILS,
    pedido.politica?.trim()
      ? `# Política comercial e tom (cadastro do estúdio)\n${pedido.politica.trim()}`
      : null,
    `# Cadastro do estúdio\nEstes dados vêm do sistema e estão sempre atuais.\n\n${pedido.conhecimento}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const mensagens: Anthropic.MessageParam[] = pedido.historico.map((t) => ({
    role: t.autor === "contato" ? ("user" as const) : ("assistant" as const),
    content: t.texto,
  }));

  let escalou = false;

  /* teto de voltas: nenhuma conversa de atendimento precisa de mais */
  for (let volta = 0; volta < 6; volta++) {
    let resposta: Anthropic.Message;
    try {
      resposta = await client.messages.create({
        model: MODELO,
        max_tokens: 8192,
        thinking: { type: "adaptive" },
        /* atendimento é síncrono: quem mandou a mensagem está esperando */
        output_config: { effort: "low" },
        system: [
          {
            type: "text",
            text: instrucoes,
            /* prefixo estável entre conversas — cabe cache */
            cache_control: { type: "ephemeral" },
          },
        ],
        tools: ferramentasCliente,
        messages: mensagens,
      });
    } catch (e) {
      return {
        texto: null,
        escalou,
        erro: e instanceof Error ? e.message : "falha ao chamar o agente",
      };
    }

    /* checar antes de ler o conteúdo: numa recusa ele vem vazio */
    if (resposta.stop_reason === "refusal") {
      return { texto: null, escalou, erro: "resposta recusada pelo modelo" };
    }

    if (resposta.stop_reason !== "tool_use") {
      const texto = resposta.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();
      return { texto: texto || null, escalou, erro: null };
    }

    mensagens.push({ role: "assistant", content: resposta.content });

    const resultados: Anthropic.ToolResultBlockParam[] = [];
    for (const bloco of resposta.content) {
      if (bloco.type !== "tool_use") continue;
      const saida = await executarFerramenta(
        pedido.ctx,
        bloco.name,
        (bloco.input ?? {}) as Record<string, unknown>
      );
      if (saida.escalou) escalou = true;
      resultados.push({
        type: "tool_result",
        tool_use_id: bloco.id,
        content: saida.texto,
      });
    }
    mensagens.push({ role: "user", content: resultados });
  }

  return {
    texto: null,
    escalou,
    erro: "o agente não fechou a resposta em 6 voltas",
  };
}
