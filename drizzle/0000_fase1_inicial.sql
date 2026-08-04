CREATE TYPE "public"."papel_usuario" AS ENUM('socio', 'funcionario', 'fornecedor');--> statement-breakpoint
CREATE TYPE "public"."ancora_prazo" AS ENUM('shooting', 'emissao_nf');--> statement-breakpoint
CREATE TYPE "public"."categoria" AS ENUM('imovel', 'utilidades', 'pessoas', 'servicos', 'manutencao', 'operacao', 'fornecedor', 'impostos', 'seguros', 'marketing', 'financeiro', 'distribuicao', 'financiamento');--> statement-breakpoint
CREATE TYPE "public"."cobranca_estado" AS ENUM('aguardando_po', 'po_recebido', 'emitida', 'paga', 'nf_emitida', 'conciliada', 'cancelada');--> statement-breakpoint
CREATE TYPE "public"."lancamento_estado" AS ENUM('previsto', 'confirmado', 'pago');--> statement-breakpoint
CREATE TYPE "public"."linha_estado" AS ENUM('pendente', 'conciliada', 'ignorada');--> statement-breakpoint
CREATE TYPE "public"."natureza_obrigacao" AS ENUM('data_e_valor_conhecidos', 'valor_desconhecido', 'condicional_a_evento');--> statement-breakpoint
CREATE TYPE "public"."sentido" AS ENUM('entrada', 'saida');--> statement-breakpoint
CREATE TYPE "public"."reserva_status" AS ENUM('pendente', 'confirmada', 'cancelada');--> statement-breakpoint
CREATE TYPE "public"."natureza_pessoa" AS ENUM('funcionario', 'socio_executor', 'parceiro_pontual', 'fornecedor_recorrente');--> statement-breakpoint
CREATE TYPE "public"."dia_tipo" AS ENUM('shooting', 'livre');--> statement-breakpoint
CREATE TYPE "public"."modo_shooting" AS ENUM('shooting', 'livre', 'ambos');--> statement-breakpoint
CREATE TYPE "public"."tarefa_estado" AS ENUM('pendente', 'feita');--> statement-breakpoint
CREATE TYPE "public"."pedido_status" AS ENUM('aberto', 'entregue', 'conferido');--> statement-breakpoint
CREATE TABLE "sessoes" (
	"id" serial PRIMARY KEY NOT NULL,
	"token" varchar(64) NOT NULL,
	"usuario_id" integer NOT NULL,
	"expira_em" timestamp NOT NULL,
	"criada_em" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sessoes_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "usuarios" (
	"id" serial PRIMARY KEY NOT NULL,
	"nome" varchar(100) NOT NULL,
	"email" varchar(120) NOT NULL,
	"senha_hash" varchar(200) NOT NULL,
	"papel" "papel_usuario" NOT NULL,
	"pessoa_id" integer,
	"ativo" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "usuarios_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "campanhas" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" varchar(60) NOT NULL,
	"nome" varchar(100) NOT NULL,
	"canal" varchar(30),
	"segmento" varchar(30),
	"hero_video_url" varchar(300),
	"hero_titulo" varchar(120),
	"hero_subtitulo" varchar(200),
	"og_titulo" varchar(90),
	"og_descricao" varchar(200),
	"og_image_url" varchar(300),
	"ativa" boolean DEFAULT true NOT NULL,
	"criada_em" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "campanhas_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "montagens" (
	"id" serial PRIMARY KEY NOT NULL,
	"codigo_curto" varchar(8) NOT NULL,
	"combinacao" varchar(30),
	"data_desejada" date,
	"segmento" varchar(30),
	"canal" varchar(30),
	"campanha_id" integer,
	"termo" varchar(100),
	"etapa" varchar(20) DEFAULT 'iniciada' NOT NULL,
	"reserva_id" integer,
	"criada_em" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "montagens_codigo_curto_unique" UNIQUE("codigo_curto")
);
--> statement-breakpoint
CREATE TABLE "combinacoes" (
	"id" serial PRIMARY KEY NOT NULL,
	"nome" varchar(50) NOT NULL,
	"area_m2" integer,
	"destaque" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "estudio_dependencias" (
	"id" serial PRIMARY KEY NOT NULL,
	"estudio_id" integer NOT NULL,
	"depende_de_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "estudios" (
	"id" serial PRIMARY KEY NOT NULL,
	"codigo" varchar(8) NOT NULL,
	"nome" varchar(100) NOT NULL,
	"endereco" varchar(200),
	"area_m2" integer,
	"eh_complementar" boolean DEFAULT false NOT NULL,
	"ficha_tecnica" text,
	CONSTRAINT "estudios_codigo_unique" UNIQUE("codigo")
);
--> statement-breakpoint
CREATE TABLE "cobrancas" (
	"id" serial PRIMARY KEY NOT NULL,
	"reserva_id" integer,
	"valor_cents" integer NOT NULL,
	"estado" "cobranca_estado" NOT NULL,
	"ancora" "ancora_prazo" DEFAULT 'shooting' NOT NULL,
	"prazo_dias" integer DEFAULT 0 NOT NULL,
	"parcelas" integer DEFAULT 1 NOT NULL,
	"data_servico" date,
	"previsao_recebimento" date,
	"data_pagamento" date,
	"nf_numero" varchar(50),
	"nf_url" varchar(300)
);
--> statement-breakpoint
CREATE TABLE "conciliacoes" (
	"id" serial PRIMARY KEY NOT NULL,
	"linha_id" integer NOT NULL,
	"cobranca_id" integer,
	"lancamento_id" integer,
	"valor_cents" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contas_recorrentes" (
	"id" serial PRIMARY KEY NOT NULL,
	"descricao" varchar(200) NOT NULL,
	"categoria" "categoria" NOT NULL,
	"natureza" "natureza_obrigacao" NOT NULL,
	"valor_esperado_cents" integer,
	"dia_vencimento" integer,
	"ativo" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "extrato_linhas" (
	"id" serial PRIMARY KEY NOT NULL,
	"extrato_id" integer NOT NULL,
	"data" date NOT NULL,
	"descricao" varchar(300) NOT NULL,
	"valor_cents" integer NOT NULL,
	"estado" "linha_estado" DEFAULT 'pendente' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "extratos" (
	"id" serial PRIMARY KEY NOT NULL,
	"banco" varchar(50) NOT NULL,
	"arquivo" varchar(200) NOT NULL,
	"importado_em" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "financeiro_config" (
	"id" serial PRIMARY KEY NOT NULL,
	"data_virada" date NOT NULL,
	"saldo_inicial_cents" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lancamentos" (
	"id" serial PRIMARY KEY NOT NULL,
	"descricao" varchar(200) NOT NULL,
	"sentido" "sentido" DEFAULT 'saida' NOT NULL,
	"categoria" "categoria" NOT NULL,
	"natureza" "natureza_obrigacao" NOT NULL,
	"estado" "lancamento_estado" DEFAULT 'previsto' NOT NULL,
	"valor_cents" integer,
	"data_vencimento" date,
	"data_servico" date,
	"data_pagamento" date,
	"recorrente_id" integer,
	"cobre_turno_id" integer
);
--> statement-breakpoint
CREATE TABLE "reserva_estudios" (
	"id" serial PRIMARY KEY NOT NULL,
	"reserva_id" integer NOT NULL,
	"estudio_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reservas" (
	"id" serial PRIMARY KEY NOT NULL,
	"codigo" varchar(12) NOT NULL,
	"cliente_id" integer,
	"data_inicio" date NOT NULL,
	"data_fim" date NOT NULL,
	"hora_inicio" time NOT NULL,
	"hora_fim" time NOT NULL,
	"status" "reserva_status" DEFAULT 'pendente' NOT NULL,
	"token_portal_reserva" varchar(64),
	"token_portal_produtor" varchar(64),
	"criada_em" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "reservas_codigo_unique" UNIQUE("codigo")
);
--> statement-breakpoint
CREATE TABLE "pessoas" (
	"id" serial PRIMARY KEY NOT NULL,
	"nome" varchar(100) NOT NULL,
	"natureza" "natureza_pessoa" NOT NULL,
	"telefone" varchar(20),
	"email" varchar(120),
	"ativo" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "turnos" (
	"id" serial PRIMARY KEY NOT NULL,
	"data" date NOT NULL,
	"hora_inicio" time NOT NULL,
	"hora_fim" time NOT NULL,
	"pessoa_id" integer,
	"custo_cobertura_cents" integer
);
--> statement-breakpoint
CREATE TABLE "ajustes_do_dia" (
	"id" serial PRIMARY KEY NOT NULL,
	"data" date NOT NULL,
	"dia_tipo" "dia_tipo" NOT NULL,
	"descricao" varchar(300) NOT NULL,
	"criado_em" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "folgas" (
	"id" serial PRIMARY KEY NOT NULL,
	"pessoa_id" integer NOT NULL,
	"data" date NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ponto" (
	"id" serial PRIMARY KEY NOT NULL,
	"pessoa_id" integer NOT NULL,
	"data" date NOT NULL,
	"entrada" time,
	"saida" time
);
--> statement-breakpoint
CREATE TABLE "tarefa_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"titulo" varchar(150) NOT NULL,
	"frequencia_dias" integer DEFAULT 1 NOT NULL,
	"modo_shooting" "modo_shooting" DEFAULT 'ambos' NOT NULL,
	"requer_estudio_vago" boolean DEFAULT false NOT NULL,
	"depende_de_id" integer,
	"minutos_estimados" integer,
	"prioridade" integer DEFAULT 0 NOT NULL,
	"fornecedor_id" integer,
	"ativo" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tarefas" (
	"id" serial PRIMARY KEY NOT NULL,
	"data" date NOT NULL,
	"template_id" integer,
	"estudio_id" integer,
	"titulo" varchar(150) NOT NULL,
	"hora_prevista" time,
	"estado" "tarefa_estado" DEFAULT 'pendente' NOT NULL,
	"eh_arrasto" boolean DEFAULT false NOT NULL,
	"data_original" date,
	"feita_por_id" integer,
	"concluida_em" timestamp
);
--> statement-breakpoint
CREATE TABLE "itens" (
	"id" serial PRIMARY KEY NOT NULL,
	"nome" varchar(100) NOT NULL,
	"unidade" varchar(20) NOT NULL,
	"preco_cents" integer NOT NULL,
	"custo_fornecedor_cents_dia" integer,
	"fornecedor_id" integer,
	"qtd_total" integer,
	"qtd_esperada" integer
);
--> statement-breakpoint
CREATE TABLE "pedido_itens" (
	"id" serial PRIMARY KEY NOT NULL,
	"pedido_id" integer NOT NULL,
	"item_id" integer NOT NULL,
	"qtd" integer NOT NULL,
	"nome_item" varchar(100) NOT NULL,
	"preco_cents" integer NOT NULL,
	"multa_por_unidade_cents" integer,
	"qtd_faltante" integer
);
--> statement-breakpoint
CREATE TABLE "pedidos" (
	"id" serial PRIMARY KEY NOT NULL,
	"reserva_id" integer,
	"status" "pedido_status" DEFAULT 'aberto' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sessoes" ADD CONSTRAINT "sessoes_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_pessoa_id_pessoas_id_fk" FOREIGN KEY ("pessoa_id") REFERENCES "public"."pessoas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "montagens" ADD CONSTRAINT "montagens_campanha_id_campanhas_id_fk" FOREIGN KEY ("campanha_id") REFERENCES "public"."campanhas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estudio_dependencias" ADD CONSTRAINT "estudio_dependencias_estudio_id_estudios_id_fk" FOREIGN KEY ("estudio_id") REFERENCES "public"."estudios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estudio_dependencias" ADD CONSTRAINT "estudio_dependencias_depende_de_id_estudios_id_fk" FOREIGN KEY ("depende_de_id") REFERENCES "public"."estudios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cobrancas" ADD CONSTRAINT "cobrancas_reserva_id_reservas_id_fk" FOREIGN KEY ("reserva_id") REFERENCES "public"."reservas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conciliacoes" ADD CONSTRAINT "conciliacoes_linha_id_extrato_linhas_id_fk" FOREIGN KEY ("linha_id") REFERENCES "public"."extrato_linhas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conciliacoes" ADD CONSTRAINT "conciliacoes_cobranca_id_cobrancas_id_fk" FOREIGN KEY ("cobranca_id") REFERENCES "public"."cobrancas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conciliacoes" ADD CONSTRAINT "conciliacoes_lancamento_id_lancamentos_id_fk" FOREIGN KEY ("lancamento_id") REFERENCES "public"."lancamentos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extrato_linhas" ADD CONSTRAINT "extrato_linhas_extrato_id_extratos_id_fk" FOREIGN KEY ("extrato_id") REFERENCES "public"."extratos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lancamentos" ADD CONSTRAINT "lancamentos_recorrente_id_contas_recorrentes_id_fk" FOREIGN KEY ("recorrente_id") REFERENCES "public"."contas_recorrentes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reserva_estudios" ADD CONSTRAINT "reserva_estudios_reserva_id_reservas_id_fk" FOREIGN KEY ("reserva_id") REFERENCES "public"."reservas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reserva_estudios" ADD CONSTRAINT "reserva_estudios_estudio_id_estudios_id_fk" FOREIGN KEY ("estudio_id") REFERENCES "public"."estudios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "turnos" ADD CONSTRAINT "turnos_pessoa_id_pessoas_id_fk" FOREIGN KEY ("pessoa_id") REFERENCES "public"."pessoas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "folgas" ADD CONSTRAINT "folgas_pessoa_id_pessoas_id_fk" FOREIGN KEY ("pessoa_id") REFERENCES "public"."pessoas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ponto" ADD CONSTRAINT "ponto_pessoa_id_pessoas_id_fk" FOREIGN KEY ("pessoa_id") REFERENCES "public"."pessoas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tarefa_templates" ADD CONSTRAINT "tarefa_templates_depende_de_id_tarefa_templates_id_fk" FOREIGN KEY ("depende_de_id") REFERENCES "public"."tarefa_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tarefa_templates" ADD CONSTRAINT "tarefa_templates_fornecedor_id_pessoas_id_fk" FOREIGN KEY ("fornecedor_id") REFERENCES "public"."pessoas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tarefas" ADD CONSTRAINT "tarefas_template_id_tarefa_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."tarefa_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tarefas" ADD CONSTRAINT "tarefas_estudio_id_estudios_id_fk" FOREIGN KEY ("estudio_id") REFERENCES "public"."estudios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tarefas" ADD CONSTRAINT "tarefas_feita_por_id_pessoas_id_fk" FOREIGN KEY ("feita_por_id") REFERENCES "public"."pessoas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "itens" ADD CONSTRAINT "itens_fornecedor_id_pessoas_id_fk" FOREIGN KEY ("fornecedor_id") REFERENCES "public"."pessoas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pedido_itens" ADD CONSTRAINT "pedido_itens_pedido_id_pedidos_id_fk" FOREIGN KEY ("pedido_id") REFERENCES "public"."pedidos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pedido_itens" ADD CONSTRAINT "pedido_itens_item_id_itens_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."itens"("id") ON DELETE no action ON UPDATE no action;