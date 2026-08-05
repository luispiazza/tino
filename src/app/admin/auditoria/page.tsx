import { AuditoriaClient } from "./auditoria-client";

/* Quem alterou o quê, quando — a Fase 1 fecha aqui. */
export default function AuditoriaPage() {
  return (
    <main className="mx-auto max-w-4xl p-4 sm:p-6">
      <AuditoriaClient />
    </main>
  );
}
