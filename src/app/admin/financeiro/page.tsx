import { FinanceiroClient } from "./financeiro-client";

/*
 * Domínio 7, começo: a esteira de cobranças. Agenda de obrigações,
 * lançamentos e conciliação por extrato entram na Fase 3.
 */
export default function FinanceiroPage() {
  return (
    <main className="mx-auto max-w-5xl p-4 sm:p-6">
      <FinanceiroClient />
    </main>
  );
}
