import Image from "next/image";
import { redirect } from "next/navigation";
import { sessaoAtual } from "@/server/sessao-server";
import { LoginForm } from "./login-form";

/*
 * Login do front único — sócio e funcionário entram aqui; o papel decide
 * o que aparece lá dentro. Cliente/produtor nunca passa por esta tela
 * (portal por token). Block oficial login-01, sem design próprio.
 */
export default async function LoginPage() {
  const session = await sessaoAtual();
  if (session) redirect("/admin");

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 p-6">
      <div className="flex flex-col items-center gap-2">
        <Image
          src="/logo.png"
          alt="Tino Estúdio"
          width={944}
          height={411}
          priority
          className="h-10 w-auto"
        />
        <p className="text-sm text-muted-foreground">Painel interno</p>
      </div>
      <LoginForm />
    </main>
  );
}
