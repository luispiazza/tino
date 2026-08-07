import { redirect } from "next/navigation";
import { sessaoAtual } from "@/server/sessao-server";
import { PainelClient } from "./painel-client";
import { Pagina } from "./pagina";

/*
 * Admin — Domínio 8. A Home dos sócios é o painel de vigilância;
 * o funcionário não tem financeiro para vigiar — o dia dele é o Dia.
 */
export default async function AdminHome() {
  const session = await sessaoAtual();
  if (session?.papel === "funcionario") redirect("/admin/dia");

  return (
    /* o cabeçalho vive no client: o resumo dele conta quantas coisas
       pedem decisão hoje, e esse número vem das queries */
    <Pagina>
      <PainelClient />
    </Pagina>
  );
}
