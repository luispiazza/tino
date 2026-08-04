/*
 * Contexto de cada request. A identidade resolve para um papel da matriz
 * de permissões antes de qualquer procedure rodar:
 * sócio e funcionário via sessão (login); cliente/produtor via token opaco
 * na URL do portal; fornecedor via login próprio (Fase 4).
 */
export type Papel = "socio" | "funcionario" | "fornecedor";

export interface Session {
  userId: number;
  papel: Papel;
}

export async function createContext(
  req: Request
): Promise<{ req: Request; session: Session | null }> {
  // TODO(auth): resolver sessão a partir do cookie
  return { req, session: null };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
