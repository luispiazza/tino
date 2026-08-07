import { AuditoriaClient } from "./auditoria-client";
import { Pagina } from "../pagina";

/* Quem alterou o quê, quando — a Fase 1 fecha aqui. */
export default function AuditoriaPage() {
  return (
    <Pagina>
      <AuditoriaClient />
    </Pagina>
  );
}
