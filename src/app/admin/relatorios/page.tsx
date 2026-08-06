import { OcupacaoClient } from "./ocupacao-client";

/*
 * Domínio 8 — a pergunta que o negócio não conseguia responder:
 * quanto cada estúdio roda, e quanto entra por ele.
 */
export default function RelatoriosPage() {
  return (
    <main className="mx-auto max-w-4xl p-4 sm:p-6">
      <OcupacaoClient />
    </main>
  );
}
