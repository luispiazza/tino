import { WhatsappClient } from "./whatsapp-client";

/*
 * Domínio 5 — WhatsApp IA. Onda 1: cliente (disponibilidade, dados da
 * própria reserva, links dos portais). Fornecedor, funcionário e sócio
 * entram nas ondas seguintes; até lá, caem em handoff.
 */
export default function WhatsappPage() {
  return (
    <main className="mx-auto max-w-5xl p-4 sm:p-6">
      <WhatsappClient />
    </main>
  );
}
