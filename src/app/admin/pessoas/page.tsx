import { PessoasClient } from "./pessoas-client";
import { Pagina } from "../pagina";

/* Cadastro único — as quatro naturezas do Domínio 2. */
export default function PessoasPage() {
  return (
    <Pagina>
      <PessoasClient />
    </Pagina>
  );
}
