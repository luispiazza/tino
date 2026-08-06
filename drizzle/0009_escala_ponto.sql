ALTER TABLE "turnos" ADD COLUMN "observacao" varchar(200);--> statement-breakpoint
ALTER TABLE "ponto" ADD COLUMN "turno_id" integer;--> statement-breakpoint
ALTER TABLE "ponto" ADD CONSTRAINT "ponto_turno_id_turnos_id_fk" FOREIGN KEY ("turno_id") REFERENCES "public"."turnos"("id") ON DELETE no action ON UPDATE no action;