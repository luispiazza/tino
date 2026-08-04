ALTER TABLE "reservas" ADD COLUMN "valor_diaria_cents" integer;--> statement-breakpoint
ALTER TABLE "reservas" ADD COLUMN "desconto_cents" integer DEFAULT 0 NOT NULL;