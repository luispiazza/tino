import { WhatsappClient } from "./whatsapp-client";
import { Pagina } from "../pagina";

/*
 * Domínio 5 — WhatsApp IA. Onda 1: cliente (disponibilidade, dados da
 * própria reserva, links dos portais). Fornecedor, funcionário e sócio
 * entram nas ondas seguintes; até lá, caem em handoff.
 */
export default function WhatsappPage() {
  return (
    <Pagina>
      <WhatsappClient />
    </Pagina>
  );
}
