import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { and, eq, gt } from "drizzle-orm";
import type { DB } from "./db";
import { sessoes, usuarios } from "./db/schema";
import type { Session } from "./context";

const scryptAsync = promisify(scrypt);

export const COOKIE_SESSAO = "tino_sessao";
const SESSAO_DIAS = 30;

export async function hashSenha(senha: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const hash = (await scryptAsync(senha, salt, 64)) as Buffer;
  return `${salt}:${hash.toString("hex")}`;
}

export async function verificarSenha(
  senha: string,
  senhaHash: string
): Promise<boolean> {
  const [salt, hash] = senhaHash.split(":");
  if (!salt || !hash) return false;
  const candidato = (await scryptAsync(senha, salt, 64)) as Buffer;
  const esperado = Buffer.from(hash, "hex");
  return (
    candidato.length === esperado.length && timingSafeEqual(candidato, esperado)
  );
}

export async function criarSessao(
  db: DB,
  usuarioId: number
): Promise<{ token: string; expiraEm: Date }> {
  const token = randomBytes(32).toString("hex");
  const expiraEm = new Date(Date.now() + SESSAO_DIAS * 24 * 60 * 60 * 1000);
  await db.insert(sessoes).values({ token, usuarioId, expiraEm });
  return { token, expiraEm };
}

/* Sessão válida = token existe, não expirou, e o usuário segue ativo. */
export async function resolverSessao(
  db: DB,
  token: string
): Promise<Session | null> {
  const [linha] = await db
    .select({
      usuarioId: usuarios.id,
      nome: usuarios.nome,
      papel: usuarios.papel,
    })
    .from(sessoes)
    .innerJoin(usuarios, eq(sessoes.usuarioId, usuarios.id))
    .where(
      and(
        eq(sessoes.token, token),
        gt(sessoes.expiraEm, new Date()),
        eq(usuarios.ativo, true)
      )
    )
    .limit(1);
  if (!linha) return null;
  return { ...linha, token };
}

export async function encerrarSessao(db: DB, token: string): Promise<void> {
  await db.delete(sessoes).where(eq(sessoes.token, token));
}

export function lerCookieSessao(req: Request): string | null {
  const cookies = req.headers.get("cookie");
  if (!cookies) return null;
  for (const par of cookies.split(";")) {
    const [nome, ...resto] = par.trim().split("=");
    if (nome === COOKIE_SESSAO) return resto.join("=") || null;
  }
  return null;
}

export function cookieDeSessao(token: string, expiraEm: Date): string {
  return `${COOKIE_SESSAO}=${token}; Path=/; HttpOnly; SameSite=Lax; Secure; Expires=${expiraEm.toUTCString()}`;
}

export function cookieDeLogout(): string {
  return `${COOKIE_SESSAO}=; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=0`;
}
