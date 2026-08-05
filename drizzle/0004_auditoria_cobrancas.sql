CREATE TABLE "auditoria" (
	"id" serial PRIMARY KEY NOT NULL,
	"usuario_id" integer NOT NULL,
	"usuario_nome" varchar(100) NOT NULL,
	"acao" varchar(40) NOT NULL,
	"entidade" varchar(30) NOT NULL,
	"entidade_id" integer,
	"detalhe" jsonb,
	"criado_em" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cobrancas" ADD COLUMN "criada_em" timestamp DEFAULT now() NOT NULL;