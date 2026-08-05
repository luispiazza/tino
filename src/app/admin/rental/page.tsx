import { RentalClient } from "./rental-client";

/*
 * Tino Rental — catálogo único de itens. Preço é coisa de sócio;
 * o funcionário consulta e monta pedido.
 */
export default function RentalPage() {
  return (
    <main className="mx-auto max-w-4xl p-4 sm:p-6">
      <RentalClient />
    </main>
  );
}
