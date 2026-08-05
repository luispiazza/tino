ALTER TABLE "reservas" ADD COLUMN "valor_hora_extra_cents" integer;--> statement-breakpoint
ALTER TABLE "reservas" ADD COLUMN "check_in_em" timestamp;--> statement-breakpoint
ALTER TABLE "reservas" ADD COLUMN "check_out_em" timestamp;