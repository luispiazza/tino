import { ReservasClient } from "./reservas-client";

/*
 * Reservas — Domínio 1. A criação SEMPRE passa pela regra única de
 * disponibilidade, e o formulário mostra o resultado dela ao vivo:
 * o sócio vê o conflito antes de tentar, não depois.
 */
export default function ReservasPage() {
  return (
    <main className="mx-auto max-w-5xl p-4 sm:p-6">
      <ReservasClient />
    </main>
  );
}
