import { drizzle } from "drizzle-orm/postgres-js";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import postgres from "postgres";
import * as schema from "./schema";

/*
 * Tipo abstrato para os routers e serviços: em produção é postgres-js,
 * nos testes é PGlite — mesma migração, banco isolado desde o dia 1.
 */
export type DB = PgDatabase<PgQueryResultHKT, typeof schema>;

const client = postgres(process.env.DATABASE_URL!);

export const db: DB = drizzle(client, { schema });
