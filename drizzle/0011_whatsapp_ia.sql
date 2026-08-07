CREATE TYPE "public"."whatsapp_autor" AS ENUM('contato', 'ia', 'humano');--> statement-breakpoint
CREATE TYPE "public"."whatsapp_handoff_motivo" AS ENUM('pedido_explicito', 'confianca_baixa', 'sentimento_negativo', 'fechar_reserva', 'valor', 'reclamacao', 'fora_de_escopo');--> statement-breakpoint
CREATE TYPE "public"."whatsapp_papel" AS ENUM('cliente', 'fornecedor', 'funcionario', 'socio', 'desconhecido');--> statement-breakpoint
CREATE TABLE "whatsapp_config" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"ia_ativa" boolean DEFAULT false NOT NULL,
	"saudacao" text,
	"system_prompt" text,
	"politica" text,
	"limitar_horario" boolean DEFAULT false NOT NULL,
	"hora_inicio" time,
	"hora_fim" time,
	"mensagem_fora_horario" text,
	"telefone_aviso" varchar(20),
	"retomada_horas" integer DEFAULT 24 NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "whatsapp_contatos" (
	"id" serial PRIMARY KEY NOT NULL,
	"telefone" varchar(20) NOT NULL,
	"nome" varchar(120),
	"papel" "whatsapp_papel" DEFAULT 'desconhecido' NOT NULL,
	"cliente_id" integer,
	"pessoa_id" integer,
	"ia_pausada_ate" timestamp with time zone,
	"ultima_mensagem_em" timestamp with time zone,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "whatsapp_contatos_telefone_unique" UNIQUE("telefone")
);
--> statement-breakpoint
CREATE TABLE "whatsapp_handoffs" (
	"id" serial PRIMARY KEY NOT NULL,
	"contato_id" integer NOT NULL,
	"motivo" "whatsapp_handoff_motivo" NOT NULL,
	"resumo" text NOT NULL,
	"aviso_enviado_em" timestamp with time zone,
	"resolvido_em" timestamp with time zone,
	"resolvido_por" varchar(100),
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "whatsapp_mensagens" (
	"id" serial PRIMARY KEY NOT NULL,
	"contato_id" integer NOT NULL,
	"autor" "whatsapp_autor" NOT NULL,
	"texto" text NOT NULL,
	"wamid" varchar(128),
	"erro" varchar(300),
	"criada_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "whatsapp_mensagens_wamid_unique" UNIQUE("wamid")
);
--> statement-breakpoint
ALTER TABLE "whatsapp_contatos" ADD CONSTRAINT "whatsapp_contatos_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_contatos" ADD CONSTRAINT "whatsapp_contatos_pessoa_id_pessoas_id_fk" FOREIGN KEY ("pessoa_id") REFERENCES "public"."pessoas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_handoffs" ADD CONSTRAINT "whatsapp_handoffs_contato_id_whatsapp_contatos_id_fk" FOREIGN KEY ("contato_id") REFERENCES "public"."whatsapp_contatos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_mensagens" ADD CONSTRAINT "whatsapp_mensagens_contato_id_whatsapp_contatos_id_fk" FOREIGN KEY ("contato_id") REFERENCES "public"."whatsapp_contatos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "whatsapp_contatos_ultima_msg" ON "whatsapp_contatos" USING btree ("ultima_mensagem_em");--> statement-breakpoint
CREATE INDEX "whatsapp_mensagens_contato" ON "whatsapp_mensagens" USING btree ("contato_id","criada_em");