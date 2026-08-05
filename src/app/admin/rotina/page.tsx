import { RotinaClient } from "./rotina-client";

/*
 * As regras da rotina — os templates que o gerador determinístico lê.
 * A execução vive no Dia; aqui é onde o sócio ensina o sistema.
 */
export default function RotinaPage() {
  return (
    <main className="mx-auto max-w-4xl p-4 sm:p-6">
      <RotinaClient />
    </main>
  );
}
