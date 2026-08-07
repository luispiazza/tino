import { asc, count, eq } from "drizzle-orm";
import type { DB } from "../db";
import {
  whatsappConfig,
  whatsappContatos,
  whatsappMensagens,
} from "../db/schema";
import { responder, type TurnoConversa } from "./agente";
import { enviarTexto } from "./cliente";
import { montarConhecimento } from "./conhecimento";
import { registrarContato } from "./identidade";

/* Quantos turnos vão para o modelo. Conversa de atendimento é curta. */
const JANELA = 20;

export type Config = typeof whatsappConfig.$inferSelect;

/** A linha única de configuração, criada na primeira leitura. */
export async function garantirConfig(db: DB): Promise<Config> {
  const [existente] = await db.select().from(whatsappConfig).limit(1);
  if (existente) return existente;
  const [nova] = await db.insert(whatsappConfig).values({ id: 1 }).returning();
  return nova;
}

/* Hora de São Paulo, não a do servidor — o Railway roda em UTC. */
function horaLocal(): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
}

function dentroDoHorario(config: Config): boolean {
  if (!config.limitarHorario || !config.horaInicio || !config.horaFim) return true;
  const agora = horaLocal();
  const inicio = config.horaInicio.slice(0, 5);
  const fim = config.horaFim.slice(0, 5);
  /* faixa que vira o dia (22:00–06:00) é intervalo aberto, não erro */
  if (inicio <= fim) return agora >= inicio && agora <= fim;
  return agora >= inicio || agora <= fim;
}

/** Grava a saída e envia. Falha de envio vira registro, nunca some. */
async function falar(
  db: DB,
  contatoId: number,
  telefone: string,
  texto: string,
  autor: "ia" | "humano"
) {
  const { wamid, erro } = await enviarTexto(telefone, texto);
  await db.insert(whatsappMensagens).values({
    contatoId,
    autor,
    texto,
    wamid,
    erro,
  });
  return { wamid, erro };
}

export interface MensagemRecebida {
  telefone: string;
  nomePerfil: string | null;
  texto: string;
  wamid: string;
}

/*
 * O caminho único de uma mensagem que chega. Cada porta abaixo é uma
 * decisão que a v1 não tinha, ou tinha errada:
 *
 *  - wamid único: a Meta reentrega o webhook que não respondeu 200; sem
 *    isso a IA responde duas vezes à mesma mensagem.
 *  - `iaPausadaAte` no futuro: humano está com a conversa. A v1 pausava
 *    para sempre; aqui o prazo expira e a IA volta sozinha.
 */
export async function atender(db: DB, msg: MensagemRecebida): Promise<void> {
  const config = await garantirConfig(db);
  const { contato, identidade } = await registrarContato(
    db,
    msg.telefone,
    msg.nomePerfil
  );

  /*
   * A gravação é o cadeado, não uma consulta antes dela: a reentrega da
   * Meta costuma chegar enquanto a primeira ainda está sendo processada, e
   * um `select` antes do `insert` deixa as duas passarem. Sem linha
   * devolvida, esta mensagem já está sendo atendida — sai.
   */
  const gravada = await db
    .insert(whatsappMensagens)
    .values({
      contatoId: contato.id,
      autor: "contato",
      texto: msg.texto,
      wamid: msg.wamid,
    })
    .onConflictDoNothing({ target: whatsappMensagens.wamid })
    .returning({ id: whatsappMensagens.id });
  if (gravada.length === 0) return;

  /* chave geral desligada: registra a conversa, não responde */
  if (!config.iaAtiva) return;

  /* humano assumiu e o prazo ainda não venceu */
  if (contato.iaPausadaAte && contato.iaPausadaAte > new Date()) return;

  /* prazo vencido: a IA volta, e o campo é limpo para não confundir a tela */
  if (contato.iaPausadaAte) {
    await db
      .update(whatsappContatos)
      .set({ iaPausadaAte: null })
      .where(eq(whatsappContatos.id, contato.id));
  }

  if (!dentroDoHorario(config)) {
    const fora =
      config.mensagemForaHorario?.trim() ||
      "Recebemos sua mensagem fora do horário de atendimento. Respondemos assim que abrirmos.";
    await falar(db, contato.id, msg.telefone, fora, "ia");
    return;
  }

  const [{ total }] = await db
    .select({ total: count() })
    .from(whatsappMensagens)
    .where(eq(whatsappMensagens.contatoId, contato.id));

  /* saudação só na estreia do contato */
  if (total === 1 && config.saudacao?.trim()) {
    await falar(db, contato.id, msg.telefone, config.saudacao.trim(), "ia");
  }

  const historico = await db
    .select({
      autor: whatsappMensagens.autor,
      texto: whatsappMensagens.texto,
      erro: whatsappMensagens.erro,
    })
    .from(whatsappMensagens)
    .where(eq(whatsappMensagens.contatoId, contato.id))
    .orderBy(asc(whatsappMensagens.criadaEm))
    .limit(JANELA);

  const conhecimento = await montarConhecimento(db);

  const resultado = await responder({
    ctx: {
      db,
      contatoId: contato.id,
      telefone: msg.telefone,
      nomeContato: contato.nome,
      clienteId: identidade.clienteId,
      telefoneAviso: config.telefoneAviso,
      retomadaHoras: config.retomadaHoras,
    },
    papel: identidade.papel,
    conhecimento,
    politica: config.politica,
    systemPrompt: config.systemPrompt,
    /* mensagem que não saiu não entra no histórico como se tivesse saído */
    historico: historico
      .filter((m) => !m.erro)
      .map((m) => ({ autor: m.autor, texto: m.texto })) as TurnoConversa[],
  });

  if (resultado.erro) {
    await db.insert(whatsappMensagens).values({
      contatoId: contato.id,
      autor: "ia",
      texto: "(sem resposta)",
      erro: resultado.erro,
    });
    return;
  }

  if (resultado.texto) {
    await falar(db, contato.id, msg.telefone, resultado.texto, "ia");
  }
}
