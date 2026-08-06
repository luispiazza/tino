CREATE TABLE "inventario_itens" (
	"id" serial PRIMARY KEY NOT NULL,
	"inventario_id" integer NOT NULL,
	"item_id" integer NOT NULL,
	"nome_item" varchar(100) NOT NULL,
	"qtd_esperada" integer NOT NULL,
	"qtd_contada" integer
);
--> statement-breakpoint
CREATE TABLE "inventarios" (
	"id" serial PRIMARY KEY NOT NULL,
	"data" date NOT NULL,
	"fechado_em" timestamp with time zone,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "inventario_itens" ADD CONSTRAINT "inventario_itens_inventario_id_inventarios_id_fk" FOREIGN KEY ("inventario_id") REFERENCES "public"."inventarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventario_itens" ADD CONSTRAINT "inventario_itens_item_id_itens_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."itens"("id") ON DELETE no action ON UPDATE no action;