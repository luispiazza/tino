import {
  pgTable,
  serial,
  varchar,
  text,
  integer,
  boolean,
  time,
  timestamp,
  index,
  pgEnum,
} from "drizzle-orm/pg-core";
import { pessoas } from "./pessoas";
import { clientes } from "./reservas";

/*
 * Domínio 5 — o atendimento por WhatsApp com IA.
 *
 * Três dos seis problemas da v1 são resolvidos aqui, no formato das tabelas:
 *
 *  - credencial não mora no banco (problema 3). Access token e verify token
 *    ficam no ambiente do serviço; a tela mostra se chegaram, nunca o valor.
 *  - `iaPausadaAte` no lugar de um booleano (problema 4). Handoff aposentava
 *    a IA naquele contato para sempre; agora a pausa tem prazo e volta sozinha.
 *  - a base de conhecimento não é campo de texto (problema 2). Ficha técnica,
 *    preço e regra saem do cadastro em `conhecimento.ts`; aqui só sobra o que
 *    não é estruturado — tom de voz, política comercial, FAQ.
 */

/* Linha única (id = 1). É configuração do estúdio, não de cada contato. */
export const whatsappConfig = pgTable("whatsapp_config", {
  id: integer("id").primaryKey().default(1),
  /* a chave geral: desligada, o webhook recebe e grava, mas não responde */
  iaAtiva: boolean("ia_ativa").notNull().default(false),
  saudacao: text("saudacao"),
  systemPrompt: text("system_prompt"),
  /* só o que NÃO é estruturado — o resto vem das tabelas */
  politica: text("politica"),
  limitarHorario: boolean("limitar_horario").notNull().default(false),
  horaInicio: time("hora_inicio"),
  horaFim: time("hora_fim"),
  mensagemForaHorario: text("mensagem_fora_horario"),
  /* quem recebe o aviso de handoff — número, não segredo */
  telefoneAviso: varchar("telefone_aviso", { length: 20 }),
  /* a retomada que faltava na v1: 0 = só volta na mão */
  retomadaHoras: integer("retomada_horas").notNull().default(24),
  atualizadoEm: timestamp("atualizado_em", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/*
 * §5.3.1 — o número resolve para um papel ANTES de qualquer resposta, e as
 * ferramentas disponíveis mudam por papel. Regra de ouro: número não
 * reconhecido nunca recebe dado privado.
 */
export const whatsappPapel = pgEnum("whatsapp_papel", [
  "cliente",
  "fornecedor",
  "funcionario",
  "socio",
  "desconhecido",
]);

export const whatsappContatos = pgTable(
  "whatsapp_contatos",
  {
    id: serial("id").primaryKey(),
    /* E.164 sem o "+", como a Meta entrega: 5511999350085 */
    telefone: varchar("telefone", { length: 20 }).notNull().unique(),
    nome: varchar("nome", { length: 120 }),
    /* resolvido a cada mensagem — cadastro muda, o papel acompanha */
    papel: whatsappPapel("papel").notNull().default("desconhecido"),
    clienteId: integer("cliente_id").references(() => clientes.id),
    pessoaId: integer("pessoa_id").references(() => pessoas.id),
    /*
     * Nulo = IA respondendo. Preenchido = humano assumiu até esse instante.
     * Prazo, não interruptor: é a correção do problema 4 da v1.
     */
    iaPausadaAte: timestamp("ia_pausada_ate", { withTimezone: true }),
    /* a janela de 24h da Meta: fora dela, só template aprovado */
    ultimaMensagemEm: timestamp("ultima_mensagem_em", { withTimezone: true }),
    criadoEm: timestamp("criado_em", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("whatsapp_contatos_ultima_msg").on(t.ultimaMensagemEm)]
);

export const whatsappAutor = pgEnum("whatsapp_autor", [
  "contato",
  "ia",
  "humano",
]);

export const whatsappMensagens = pgTable(
  "whatsapp_mensagens",
  {
    id: serial("id").primaryKey(),
    contatoId: integer("contato_id")
      .notNull()
      .references(() => whatsappContatos.id),
    autor: whatsappAutor("autor").notNull(),
    texto: text("texto").notNull(),
    /*
     * O id da Meta. A Meta reentrega o webhook quando não recebe 200 —
     * sem esta unicidade, a IA responde duas vezes à mesma mensagem.
     */
    wamid: varchar("wamid", { length: 128 }).unique(),
    /* envio que falhou vira registro, nunca some (princípio do Resend) */
    erro: varchar("erro", { length: 300 }),
    criadaEm: timestamp("criada_em", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("whatsapp_mensagens_contato").on(t.contatoId, t.criadaEm)]
);

/*
 * §5.3.2 — três gatilhos, não um. E o aviso carrega contexto, não só o
 * alerta: quem assume recebe identidade, motivo e o que a IA já coletou.
 */
export const whatsappHandoffMotivo = pgEnum("whatsapp_handoff_motivo", [
  "pedido_explicito",
  "confianca_baixa",
  "sentimento_negativo",
  "fechar_reserva",
  "valor",
  "reclamacao",
  "fora_de_escopo",
]);

export const whatsappHandoffs = pgTable("whatsapp_handoffs", {
  id: serial("id").primaryKey(),
  contatoId: integer("contato_id")
    .notNull()
    .references(() => whatsappContatos.id),
  motivo: whatsappHandoffMotivo("motivo").notNull(),
  /* o que a IA já apurou — para o humano não pedir tudo de novo */
  resumo: text("resumo").notNull(),
  avisoEnviadoEm: timestamp("aviso_enviado_em", { withTimezone: true }),
  resolvidoEm: timestamp("resolvido_em", { withTimezone: true }),
  resolvidoPor: varchar("resolvido_por", { length: 100 }),
  criadoEm: timestamp("criado_em", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
