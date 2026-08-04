import { lerCookieSessao, resolverSessao } from "./auth";
import { db, type DB } from "./db";

/*
 * Contexto de cada request. A identidade resolve para um papel da matriz
 * de permissões antes de qualquer procedure rodar:
 * sócio e funcionário via sessão (login); cliente/produtor via token opaco
 * na URL do portal; fornecedor via login próprio (Fase 4).
 */
export type Papel = "socio" | "funcionario" | "fornecedor";

export interface Session {
  usuarioId: number;
  nome: string;
  papel: Papel;
  token: string;
}

export interface Context {
  req: Request;
  /* headers da resposta — o login grava o cookie de sessão aqui */
  resHeaders: Headers;
  session: Session | null;
  db: DB;
}

export async function createContext(
  req: Request,
  resHeaders: Headers
): Promise<Context> {
  const token = lerCookieSessao(req);
  const session = token ? await resolverSessao(db, token) : null;
  return { req, resHeaders, session, db };
}
