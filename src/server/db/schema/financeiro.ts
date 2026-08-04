import {
  pgTable,
  serial,
  varchar,
  integer,
  boolean,
  date,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";
import { reservas } from "./reservas";

/*
 * Domínio 7. Fluxo de caixa NÃO é tabela — é consulta derivada:
 * saldo inicial (config) + entradas e saídas por data de pagamento
 * (realizado) ou por previsão (projetado). Toda tela alterna
 * competência ↔ caixa, por isso todo registro carrega as duas datas.
 */

/* ---------- Contas a receber ---------- */

export const cobrancaEstado = pgEnum("cobranca_estado", [
  "aguardando_po",
  "po_recebido",
  "emitida",
  "paga",
  "nf_emitida",
  "conciliada",
  "cancelada",
]);

/* A âncora define quem controla o relógio: ancorada na NF, a previsão
 * de recebimento é nula até a nota existir — e isso é informação. */
export const ancoraPrazo = pgEnum("ancora_prazo", ["shooting", "emissao_nf"]);

export const cobrancas = pgTable("cobrancas", {
  id: serial("id").primaryKey(),
  reservaId: integer("reserva_id").references(() => reservas.id),
  valorCents: integer("valor_cents").notNull(),
  estado: cobrancaEstado("estado").notNull(),
  ancora: ancoraPrazo("ancora").notNull().default("shooting"),
  prazoDias: integer("prazo_dias").notNull().default(0),
  parcelas: integer("parcelas").notNull().default(1),
  dataServico: date("data_servico"),
  previsaoRecebimento: date("previsao_recebimento"),
  dataPagamento: date("data_pagamento"),
  nfNumero: varchar("nf_numero", { length: 50 }),
  nfUrl: varchar("nf_url", { length: 300 }),
});

/* ---------- Categorias — dois eixos ---------- */

/*
 * `categoria` = o que é (lê o resultado). As duas últimas ficam FORA
 * do resultado: distribuição é lucro saindo, financiamento é caixa
 * entrando sem ser venda. O caixa vê tudo; o resultado vê só operação.
 */
export const categoria = pgEnum("categoria", [
  "imovel",
  "utilidades",
  "pessoas",
  "servicos",
  "manutencao",
  "operacao",
  "fornecedor",
  "impostos",
  "seguros",
  "marketing",
  "financeiro",
  "distribuicao",
  "financiamento",
]);

/* `natureza` = como se comporta (define o lembrete). */
export const naturezaObrigacao = pgEnum("natureza_obrigacao", [
  "data_e_valor_conhecidos",
  "valor_desconhecido",
  "condicional_a_evento",
]);

/* ---------- Contas recorrentes ---------- */

/*
 * O molde: aluguel todo dia 5, luz que chega sem valor, Simples como
 * % da receita, fechamento mensal do Ronaldo em dia variável com valor
 * calculado. Um job materializa cada recorrência em lançamento
 * `previsto` do mês — o sócio confirma em dez segundos, nunca digita
 * planilha.
 */
export const contasRecorrentes = pgTable("contas_recorrentes", {
  id: serial("id").primaryKey(),
  descricao: varchar("descricao", { length: 200 }).notNull(),
  categoria: categoria("categoria").notNull(),
  natureza: naturezaObrigacao("natureza").notNull(),
  /* nulo = variável: aparece como "chegou a conta? lança o valor" */
  valorEsperadoCents: integer("valor_esperado_cents"),
  /* nulo = data variável (ex.: fechamento do Ronaldo) */
  diaVencimento: integer("dia_vencimento"),
  ativo: boolean("ativo").notNull().default(true),
});

/* ---------- Contas a pagar e lançamentos avulsos ---------- */

export const lancamentoEstado = pgEnum("lancamento_estado", [
  "previsto",
  "confirmado",
  "pago",
]);

export const sentido = pgEnum("sentido", ["entrada", "saida"]);

/*
 * Saídas (despesas) e entradas que não são venda (aporte, empréstimo).
 * Receita de operação NÃO entra aqui — vive em `cobrancas`.
 */
export const lancamentos = pgTable("lancamentos", {
  id: serial("id").primaryKey(),
  descricao: varchar("descricao", { length: 200 }).notNull(),
  sentido: sentido("sentido").notNull().default("saida"),
  categoria: categoria("categoria").notNull(),
  natureza: naturezaObrigacao("natureza").notNull(),
  estado: lancamentoEstado("estado").notNull().default("previsto"),
  /* nulo até a conta chegar — nunca um número inventado */
  valorCents: integer("valor_cents"),
  dataVencimento: date("data_vencimento"),
  dataServico: date("data_servico"),
  dataPagamento: date("data_pagamento"),
  recorrenteId: integer("recorrente_id").references(
    () => contasRecorrentes.id
  ),
  /* hora extra, extra de sócio, parceiro — soma o custo de cobertura */
  cobreTurnoId: integer("cobre_turno_id"),
});

/* ---------- Conciliação por extrato ---------- */

export const extratos = pgTable("extratos", {
  id: serial("id").primaryKey(),
  banco: varchar("banco", { length: 50 }).notNull(),
  arquivo: varchar("arquivo", { length: 200 }).notNull(),
  importadoEm: timestamp("importado_em").notNull().defaultNow(),
});

export const linhaEstado = pgEnum("linha_estado", [
  "pendente",
  "conciliada",
  "ignorada",
]);

export const extratoLinhas = pgTable("extrato_linhas", {
  id: serial("id").primaryKey(),
  extratoId: integer("extrato_id")
    .notNull()
    .references(() => extratos.id),
  data: date("data").notNull(),
  descricao: varchar("descricao", { length: 300 }).notNull(),
  /* negativo = saída */
  valorCents: integer("valor_cents").notNull(),
  estado: linhaEstado("estado").notNull().default("pendente"),
});

/*
 * Recebimento é PIX direto na conta — sem provedor. A conciliação é o
 * mecanismo que identifica o recebimento: casamento automático por
 * valor + data quando bate; linha sem identificação fica `pendente` e
 * o sócio associa manualmente a uma ou mais cobranças (N conciliações
 * por linha cobre PIX que paga duas cobranças, ou pagamento parcial).
 */
export const conciliacoes = pgTable("conciliacoes", {
  id: serial("id").primaryKey(),
  linhaId: integer("linha_id")
    .notNull()
    .references(() => extratoLinhas.id),
  cobrancaId: integer("cobranca_id").references(() => cobrancas.id),
  lancamentoId: integer("lancamento_id").references(() => lancamentos.id),
  valorCents: integer("valor_cents").notNull(),
});

/* ---------- Configuração ---------- */

/* O saldo em conta na data de virada — sem ele o caixa mente. */
export const financeiroConfig = pgTable("financeiro_config", {
  id: serial("id").primaryKey(),
  dataVirada: date("data_virada").notNull(),
  saldoInicialCents: integer("saldo_inicial_cents").notNull(),
});
