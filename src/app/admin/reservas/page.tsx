import { ReservasClient } from "./reservas-client";
import { Pagina } from "../pagina";

/*
 * Reservas — Domínio 1. A criação SEMPRE passa pela regra única de
 * disponibilidade, e o formulário mostra o resultado dela ao vivo:
 * o sócio vê o conflito antes de tentar, não depois.
 */
export default function ReservasPage() {
  return (
    <Pagina>
      <ReservasClient />
    </Pagina>
  );
}
