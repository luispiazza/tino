import { RentalClient } from "./rental-client";
import { Pagina } from "../pagina";

/*
 * Tino Rental — catálogo único de itens. Preço é coisa de sócio;
 * o funcionário consulta e monta pedido.
 */
export default function RentalPage() {
  return (
    <Pagina>
      <RentalClient />
    </Pagina>
  );
}
