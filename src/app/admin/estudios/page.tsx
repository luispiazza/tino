import { EstudiosClient } from "./estudios-client";
import { Pagina } from "../pagina";

/*
 * Cadastro de estúdios — Domínio 1. A ficha técnica é o maior ativo da
 * busca orgânica; aqui é onde ela é mantida. Editar é coisa de sócio.
 */
export default function EstudiosPage() {
  return (
    <Pagina>
      <EstudiosClient />
    </Pagina>
  );
}
