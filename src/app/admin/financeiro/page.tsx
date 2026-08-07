import { FinanceiroClient } from "./financeiro-client";
import { Pagina } from "../pagina";

/*
 * Domínio 7, começo: a esteira de cobranças. Agenda de obrigações,
 * lançamentos e conciliação por extrato entram na Fase 3.
 */
export default function FinanceiroPage() {
  return (
    <Pagina>
      <FinanceiroClient />
    </Pagina>
  );
}
