import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Toaster } from "@/components/ui/sonner";
import { sessaoAtual } from "@/server/sessao-server";
import { BotaoSair } from "./botao-sair";
import { BarraDoPolegar, MenuCompleto, SidebarAdmin } from "./nav";

/*
 * Guarda do front único: sem sessão, /login. Fornecedor tem login mas
 * a área dele é própria (Fase 4) — aqui dentro só sócio e funcionário;
 * o que cada um vê é decidido pelos middlewares do tRPC, não por telas.
 *
 * A casca tem duas formas, porque tem dois usos: no desktop a sidebar
 * agrupada fica sempre à vista, e no celular ela sai do caminho — o
 * turno do Michael começa às 06:00 com o telefone na mão, então os
 * destinos dele ficam na barra de baixo, no alcance do polegar.
 */
export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await sessaoAtual();
  if (!session) redirect("/login");
  if (session.papel === "fornecedor") redirect("/");

  return (
    <div className="min-h-svh lg:grid lg:grid-cols-[15rem_1fr]">
      {/* A coluna do desktop: marca em cima, mapa no meio, quem sou embaixo */}
      <div className="sticky top-0 hidden h-svh flex-col gap-6 border-r px-3 py-5 lg:flex">
        <Link href="/admin" className="px-3">
          <Image
            src="/logo.png"
            alt="Tino Estúdio"
            width={944}
            height={411}
            className="h-5 w-auto"
          />
        </Link>

        <div className="flex-1 overflow-y-auto">
          <SidebarAdmin papel={session.papel} />
        </div>

        <div className="flex items-center justify-between gap-2 border-t px-3 pt-4">
          <span className="truncate text-sm text-muted-foreground">
            {session.nome}
          </span>
          <BotaoSair />
        </div>
      </div>

      {/* O topo do celular: marca, o mapa inteiro e a saída */}
      <div className="flex min-w-0 flex-col">
        <header className="flex items-center justify-between gap-4 border-b px-4 py-3 lg:hidden">
          <Link href="/admin">
            <Image
              src="/logo.png"
              alt="Tino Estúdio"
              width={944}
              height={411}
              className="h-5 w-auto"
            />
          </Link>
          <div className="flex items-center gap-1">
            <MenuCompleto papel={session.papel} />
            <BotaoSair />
          </div>
        </header>

        {/* o respiro embaixo é a altura da barra do polegar */}
        <div className="flex-1 pb-20 lg:pb-0">{children}</div>
      </div>

      <BarraDoPolegar papel={session.papel} />
      <Toaster />
    </div>
  );
}
