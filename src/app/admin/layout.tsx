import { redirect } from "next/navigation";
import { Toaster } from "@/components/ui/sonner";
import { sessaoAtual } from "@/server/sessao-server";
import { BotaoSair } from "./botao-sair";
import { NavAdmin } from "./nav";

/*
 * Guarda do front único: sem sessão, /login. Fornecedor tem login mas
 * a área dele é própria (Fase 4) — aqui dentro só sócio e funcionário;
 * o que cada um vê é decidido pelos middlewares do tRPC, não por telas.
 */
export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await sessaoAtual();
  if (!session) redirect("/login");
  if (session.papel === "fornecedor") redirect("/");

  return (
    <div className="min-h-svh">
      <header className="flex items-center justify-between gap-4 border-b px-4 py-3 sm:px-6">
        <div className="flex items-center gap-6">
          <span className="text-sm font-semibold tracking-tight">
            Tino Estúdio
          </span>
          <NavAdmin papel={session.papel} />
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-muted-foreground sm:inline">
            {session.nome}
          </span>
          <BotaoSair />
        </div>
      </header>
      {children}
      <Toaster />
    </div>
  );
}
