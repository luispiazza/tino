import { EscalaClient } from "./escala-client";

/*
 * Domínio 2 — a escala. Turno é vaga com data e jornada; quem ocupa
 * muda a cada dia. Vaga sem ocupante é a condição normal de hoje.
 */
export default function EscalaPage() {
  return (
    <main className="mx-auto max-w-4xl p-4 sm:p-6">
      <EscalaClient />
    </main>
  );
}
