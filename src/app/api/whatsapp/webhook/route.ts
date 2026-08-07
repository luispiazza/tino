import { db } from "@/server/db";
import { atender } from "@/server/whatsapp/atendimento";
import { lerCredenciais } from "@/server/whatsapp/cliente";
import { baseParaLinks } from "@/server/whatsapp/url";

export const dynamic = "force-dynamic";

/*
 * O webhook da Meta Cloud API. Esta rota é o único ponto de entrada do
 * atendimento — a v1 tinha dois agentes que já haviam divergido, e só um
 * deles ignorava mensagem de grupo (problema 1).
 *
 * A URL é pública por natureza; a autenticação da assinatura é o verify
 * token no handshake e o próprio formato do payload. Nada aqui responde
 * sem que a identidade do número resolva primeiro.
 */

/** Handshake: a Meta chama uma vez com o token que você escolheu. */
export function GET(req: Request) {
  const url = new URL(req.url);
  const modo = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const desafio = url.searchParams.get("hub.challenge");

  const cred = lerCredenciais();
  if (!cred) return new Response("credenciais ausentes", { status: 503 });

  if (modo === "subscribe" && token === cred.verifyToken && desafio) {
    return new Response(desafio, {
      status: 200,
      headers: { "content-type": "text/plain" },
    });
  }
  return new Response("token inválido", { status: 403 });
}

interface EntradaMeta {
  entry?: {
    changes?: {
      value?: {
        contacts?: { wa_id?: string; profile?: { name?: string } }[];
        messages?: {
          id?: string;
          from?: string;
          type?: string;
          text?: { body?: string };
          /* presente só em mensagem de grupo — ignorada, sempre */
          group_id?: string;
        }[];
      };
    }[];
  }[];
}

export async function POST(req: Request) {
  let corpo: EntradaMeta;
  try {
    corpo = await req.json();
  } catch {
    /* 200 mesmo assim: 4xx faz a Meta reentregar um payload que não melhora */
    return new Response("ok", { status: 200 });
  }

  /*
   * Os links de portal que a IA manda saem daqui: o domínio público se
   * estiver configurado, senão o host que a Meta acabou de chamar — que,
   * por definição, é um endereço que responde.
   */
  const base = baseParaLinks(req);

  for (const entrada of corpo.entry ?? []) {
    for (const mudanca of entrada.changes ?? []) {
      const valor = mudanca.value;
      /* recibo de entrega e leitura chegam aqui também — não são conversa */
      if (!valor?.messages?.length) continue;

      for (const mensagem of valor.messages) {
        if (mensagem.group_id) continue;
        if (mensagem.type !== "text") continue;

        const telefone = mensagem.from;
        const texto = mensagem.text?.body?.trim();
        const wamid = mensagem.id;
        if (!telefone || !texto || !wamid) continue;

        const perfil = valor.contacts?.find((c) => c.wa_id === telefone);

        try {
          await atender(
            db,
            {
              telefone,
              nomePerfil: perfil?.profile?.name ?? null,
              texto,
              wamid,
            },
            base
          );
        } catch (e) {
          /*
           * Uma mensagem que estoura não pode derrubar o lote nem virar
           * reentrega infinita: o erro vai para o log e a Meta recebe 200.
           */
          console.error("[whatsapp] falha ao atender", wamid, e);
        }
      }
    }
  }

  return new Response("ok", { status: 200 });
}
