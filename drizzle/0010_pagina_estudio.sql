ALTER TABLE "estudios" ADD COLUMN "visao_geral" text;--> statement-breakpoint
ALTER TABLE "estudios" ADD COLUMN "specs" jsonb;--> statement-breakpoint
ALTER TABLE "estudios" ADD COLUMN "caracteristicas" jsonb;--> statement-breakpoint
ALTER TABLE "estudios" ADD COLUMN "planta_baixa_url" varchar(300);--> statement-breakpoint
ALTER TABLE "estudios" ADD COLUMN "planta_eletrica_url" varchar(300);--> statement-breakpoint
ALTER TABLE "estudios" ADD COLUMN "foto_url" varchar(300);