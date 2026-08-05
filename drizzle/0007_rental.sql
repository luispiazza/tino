ALTER TABLE "pedidos" ALTER COLUMN "reserva_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "itens" ADD COLUMN "multa_por_unidade_cents" integer;--> statement-breakpoint
ALTER TABLE "itens" ADD COLUMN "ativo" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "pedidos" ADD COLUMN "criado_em" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_reserva_id_reservas_id_fk" FOREIGN KEY ("reserva_id") REFERENCES "public"."reservas"("id") ON DELETE no action ON UPDATE no action;