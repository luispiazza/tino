import { randomBytes } from "node:crypto";
import { like } from "drizzle-orm";
import type { DB } from "../db";
import { reservas } from "../db/schema";

/*
 * T_DDMMYYYY + letra: identificador humano — vai na NF, nos e-mails e
 * na conversa. Adivinhável de propósito: quem autentica é o token opaco,
 * um por portal, presente só na URL enviada ao cliente.
 */
export async function proximoCodigo(
  db: DB,
  dataInicio: string
): Promise<string> {
  const [ano, mes, dia] = dataInicio.split("-");
  const prefixo = `T_${dia}${mes}${ano}`;
  const existentes = await db
    .select({ codigo: reservas.codigo })
    .from(reservas)
    .where(like(reservas.codigo, `${prefixo}%`));

  let maior = -1;
  for (const { codigo } of existentes) {
    const sufixo = codigo.slice(prefixo.length);
    if (sufixo.length === 1) {
      maior = Math.max(maior, sufixo.charCodeAt(0) - 65);
    }
  }
  if (maior >= 25) {
    throw new Error(`Esgotaram as letras do dia para ${prefixo}`);
  }
  return `${prefixo}${String.fromCharCode(65 + maior + 1)}`;
}

export function gerarTokenPortal(): string {
  return randomBytes(32).toString("hex");
}
