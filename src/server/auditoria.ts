import type { DB } from "./db";
import { auditoria } from "./db/schema";
import type { Session } from "./context";

/*
 * Chamar dentro da mesma transação da mutação, quando houver — a trilha
 * nunca diverge do dado que ela descreve.
 */
export async function auditar(
  db: DB,
  session: Session,
  acao: string,
  entidade: string,
  entidadeId: number | null,
  detalhe?: unknown
): Promise<void> {
  await db.insert(auditoria).values({
    usuarioId: session.usuarioId,
    usuarioNome: session.nome,
    acao,
    entidade,
    entidadeId,
    detalhe: detalhe ?? null,
  });
}
