import { redirect } from "next/navigation";
import { sessaoAtual } from "@/server/sessao-server";
import { BotaoSair } from "./botao-sair";

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
      <header className="flex items-center justify-between border-b px-6 py-3">
        <span className="text-sm font-semibold tracking-tight">
          Tino Estúdio
        </span>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{session.nome}</span>
          <BotaoSair />
        </div>
      </header>
      {children}
    </div>
  );
}
