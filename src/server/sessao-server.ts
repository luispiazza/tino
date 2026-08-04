import { cookies } from "next/headers";
import { COOKIE_SESSAO, resolverSessao } from "./auth";
import { db } from "./db";
import type { Session } from "./context";

/* Sessão em Server Component (layouts e páginas do admin). */
export async function sessaoAtual(): Promise<Session | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE_SESSAO)?.value;
  if (!token) return null;
  return resolverSessao(db, token);
}
