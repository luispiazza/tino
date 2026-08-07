import { RotinaClient } from "./rotina-client";
import { Pagina } from "../pagina";

/*
 * As regras da rotina — os templates que o gerador determinístico lê.
 * A execução vive no Dia; aqui é onde o sócio ensina o sistema.
 */
export default function RotinaPage() {
  return (
    <Pagina>
      <RotinaClient />
    </Pagina>
  );
}
