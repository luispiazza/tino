import { redirect } from "next/navigation";
import { sessaoAtual } from "@/server/sessao-server";
import { PainelClient } from "./painel-client";

/*
 * Admin — Domínio 8. A Home dos sócios é o painel de vigilância;
 * o funcionário não tem financeiro para vigiar — o dia dele é o Dia.
 */
export default async function AdminHome() {
  const session = await sessaoAtual();
  if (session?.papel === "funcionario") redirect("/admin/dia");

  return (
    <main className="mx-auto max-w-5xl p-4 sm:p-6">
      <h1 className="mb-4 text-xl font-semibold tracking-tight">Painel</h1>
      <PainelClient />
    </main>
  );
}
