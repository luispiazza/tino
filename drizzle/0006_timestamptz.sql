ALTER TABLE "auditoria" ALTER COLUMN "criado_em" SET DATA TYPE timestamp with time zone USING "criado_em" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "auditoria" ALTER COLUMN "criado_em" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "sessoes" ALTER COLUMN "expira_em" SET DATA TYPE timestamp with time zone USING "expira_em" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "sessoes" ALTER COLUMN "criada_em" SET DATA TYPE timestamp with time zone USING "criada_em" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "sessoes" ALTER COLUMN "criada_em" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "usuarios" ALTER COLUMN "criado_em" SET DATA TYPE timestamp with time zone USING "criado_em" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "usuarios" ALTER COLUMN "criado_em" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "campanhas" ALTER COLUMN "criada_em" SET DATA TYPE timestamp with time zone USING "criada_em" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "campanhas" ALTER COLUMN "criada_em" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "montagens" ALTER COLUMN "criada_em" SET DATA TYPE timestamp with time zone USING "criada_em" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "montagens" ALTER COLUMN "criada_em" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "cobrancas" ALTER COLUMN "criada_em" SET DATA TYPE timestamp with time zone USING "criada_em" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "cobrancas" ALTER COLUMN "criada_em" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "extratos" ALTER COLUMN "importado_em" SET DATA TYPE timestamp with time zone USING "importado_em" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "extratos" ALTER COLUMN "importado_em" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "clientes" ALTER COLUMN "criado_em" SET DATA TYPE timestamp with time zone USING "criado_em" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "clientes" ALTER COLUMN "criado_em" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "reservas" ALTER COLUMN "check_in_em" SET DATA TYPE timestamp with time zone USING "check_in_em" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "reservas" ALTER COLUMN "check_out_em" SET DATA TYPE timestamp with time zone USING "check_out_em" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "reservas" ALTER COLUMN "whatsapp_enviado_em" SET DATA TYPE timestamp with time zone USING "whatsapp_enviado_em" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "reservas" ALTER COLUMN "criada_em" SET DATA TYPE timestamp with time zone USING "criada_em" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "reservas" ALTER COLUMN "criada_em" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "ajustes_do_dia" ALTER COLUMN "criado_em" SET DATA TYPE timestamp with time zone USING "criado_em" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "ajustes_do_dia" ALTER COLUMN "criado_em" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "tarefas" ALTER COLUMN "concluida_em" SET DATA TYPE timestamp with time zone USING "concluida_em" AT TIME ZONE 'UTC';