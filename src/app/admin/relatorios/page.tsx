import { OcupacaoClient } from "./ocupacao-client";
import { Pagina } from "../pagina";

/*
 * Domínio 8 — a pergunta que o negócio não conseguia responder:
 * quanto cada estúdio roda, e quanto entra por ele.
 */
export default function RelatoriosPage() {
  return (
    <Pagina>
      <OcupacaoClient />
    </Pagina>
  );
}
