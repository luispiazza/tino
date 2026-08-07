import { paraEnvio } from "./telefone";

/*
 * Meta Cloud API. As credenciais moram no ambiente do serviço, nunca no
 * banco — é o problema 3 da v1 (`metaAccessToken` em texto plano numa
 * tabela) resolvido por onde ele nasce. A tela de Conexão lê o estado
 * daqui: diz se cada variável chegou, jamais o valor.
 */
const API = "https://graph.facebook.com/v21.0";

export interface CredenciaisWhatsapp {
  phoneNumberId: string;
  accessToken: string;
  verifyToken: string;
  wabaId: string | null;
}

export function lerCredenciais(): CredenciaisWhatsapp | null {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;
  if (!phoneNumberId || !accessToken || !verifyToken) return null;
  return {
    phoneNumberId,
    accessToken,
    verifyToken,
    wabaId: process.env.WHATSAPP_WABA_ID ?? null,
  };
}

/** O que a aba Conexão mostra: presença de cada credencial, sem os valores. */
export function estadoCredenciais() {
  return {
    accessToken: Boolean(process.env.WHATSAPP_ACCESS_TOKEN),
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID ?? null,
    wabaId: process.env.WHATSAPP_WABA_ID ?? null,
    verifyToken: Boolean(process.env.WHATSAPP_VERIFY_TOKEN),
    anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
  };
}

export interface StatusConexao {
  conectado: boolean;
  numero: string | null;
  nomeVerificado: string | null;
  erro: string | null;
}

/** "Verificar status": pergunta à Meta quem é este número. */
export async function verificarStatus(): Promise<StatusConexao> {
  const cred = lerCredenciais();
  if (!cred) {
    return {
      conectado: false,
      numero: null,
      nomeVerificado: null,
      erro: "Credenciais não configuradas no serviço",
    };
  }
  try {
    const r = await fetch(
      `${API}/${cred.phoneNumberId}?fields=display_phone_number,verified_name`,
      { headers: { Authorization: `Bearer ${cred.accessToken}` } }
    );
    const corpo = await r.json();
    if (!r.ok) {
      return {
        conectado: false,
        numero: null,
        nomeVerificado: null,
        erro: corpo?.error?.message ?? `HTTP ${r.status}`,
      };
    }
    return {
      conectado: true,
      numero: corpo.display_phone_number ?? null,
      nomeVerificado: corpo.verified_name ?? null,
      erro: null,
    };
  } catch (e) {
    return {
      conectado: false,
      numero: null,
      nomeVerificado: null,
      erro: e instanceof Error ? e.message : "falha de rede",
    };
  }
}

/**
 * Envia texto livre. Só vale dentro da janela de 24h desde a última
 * mensagem do contato — fora dela a Meta recusa e a resposta vira erro
 * gravado, nunca exceção silenciosa.
 */
export async function enviarTexto(
  telefone: string,
  texto: string
): Promise<{ wamid: string | null; erro: string | null }> {
  const cred = lerCredenciais();
  if (!cred) return { wamid: null, erro: "credenciais ausentes" };

  try {
    const r = await fetch(`${API}/${cred.phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cred.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: paraEnvio(telefone),
        type: "text",
        text: { preview_url: false, body: texto },
      }),
    });
    const corpo = await r.json();
    if (!r.ok) {
      return { wamid: null, erro: corpo?.error?.message ?? `HTTP ${r.status}` };
    }
    return { wamid: corpo?.messages?.[0]?.id ?? null, erro: null };
  } catch (e) {
    return { wamid: null, erro: e instanceof Error ? e.message : "falha de rede" };
  }
}

/**
 * Aviso de handoff ao sócio. Fora da janela de 24h só passa template
 * aprovado (§5.3.7); com `WHATSAPP_TEMPLATE_HANDOFF` configurado usa o
 * template, senão tenta texto — e o erro fica registrado de qualquer jeito.
 */
export async function enviarAvisoHandoff(
  telefone: string,
  texto: string
): Promise<{ wamid: string | null; erro: string | null }> {
  const cred = lerCredenciais();
  if (!cred) return { wamid: null, erro: "credenciais ausentes" };

  const template = process.env.WHATSAPP_TEMPLATE_HANDOFF;
  if (!template) return enviarTexto(telefone, texto);

  try {
    const r = await fetch(`${API}/${cred.phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cred.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: paraEnvio(telefone),
        type: "template",
        template: {
          name: template,
          language: { code: "pt_BR" },
          components: [
            { type: "body", parameters: [{ type: "text", text: texto }] },
          ],
        },
      }),
    });
    const corpo = await r.json();
    if (!r.ok) {
      /* template recusado não pode engolir o aviso: tenta texto */
      const fallback = await enviarTexto(telefone, texto);
      if (fallback.wamid) return fallback;
      return { wamid: null, erro: corpo?.error?.message ?? `HTTP ${r.status}` };
    }
    return { wamid: corpo?.messages?.[0]?.id ?? null, erro: null };
  } catch (e) {
    return { wamid: null, erro: e instanceof Error ? e.message : "falha de rede" };
  }
}
