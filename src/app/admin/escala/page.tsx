import { EscalaClient } from "./escala-client";
import { Pagina } from "../pagina";

/*
 * Domínio 2 — a escala. Turno é vaga com data e jornada; quem ocupa
 * muda a cada dia. Vaga sem ocupante é a condição normal de hoje.
 */
export default function EscalaPage() {
  return (
    <Pagina>
      <EscalaClient />
    </Pagina>
  );
}
