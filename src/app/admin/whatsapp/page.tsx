import { WhatsappClient } from "./whatsapp-client";
import { Pagina } from "../pagina";

/*
 * Domínio 5 — WhatsApp IA. Onda 1: cliente (disponibilidade, dados da
 * própria reserva, links dos portais). Fornecedor, funcionário e sócio
 * entram nas ondas seguintes; até lá, caem em handoff.
 *
 * A aba vem da URL para o painel poder apontar direto para as conversas
 * que esperam resposta. Lido no servidor e passado como prop: assim o
 * client não precisa de useSearchParams nem de fronteira de Suspense.
 */
export default async function WhatsappPage({
  searchParams,
}: {
  searchParams: Promise<{ aba?: string }>;
}) {
  const { aba } = await searchParams;
  return (
    <Pagina>
      <WhatsappClient abaInicial={aba} />
    </Pagina>
  );
}
