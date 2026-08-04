import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "@/server/db/schema";
import type { DB } from "@/server/db";
import type { Context, Session, Papel } from "@/server/context";
import { appRouter } from "@/server/routers/_app";

/*
 * Banco de teste isolado desde o dia 1: PGlite em memória, rodando a
 * MESMA migração de produção — teste nunca encosta em banco real.
 */
export async function criarBancoDeTeste(): Promise<DB> {
  const client = new PGlite();
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: "./drizzle" });
  return db as unknown as DB;
}

export function sessaoFake(papel: Papel, usuarioId = 1): Session {
  return { usuarioId, nome: "Teste", papel, token: "token-de-teste" };
}

export function criarCtx(db: DB, session: Session | null = null): Context {
  return {
    req: new Request("http://teste.local"),
    resHeaders: new Headers(),
    session,
    db,
  };
}

export function criarCaller(db: DB, session: Session | null = null) {
  return appRouter.createCaller(criarCtx(db, session));
}
