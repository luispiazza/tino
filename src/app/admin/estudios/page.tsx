import { EstudiosClient } from "./estudios-client";

/*
 * Cadastro de estúdios — Domínio 1. A ficha técnica é o maior ativo da
 * busca orgânica; aqui é onde ela é mantida. Editar é coisa de sócio.
 */
export default function EstudiosPage() {
  return (
    <main className="mx-auto max-w-4xl p-4 sm:p-6">
      <EstudiosClient />
    </main>
  );
}
