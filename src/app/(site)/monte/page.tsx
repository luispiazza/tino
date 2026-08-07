import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { asc } from "drizzle-orm";
import { db } from "@/server/db";
import { combinacoes as tabelaCombinacoes, estudios } from "@/server/db/schema";
import { COMBINACOES_PADRAO, type Combinacao } from "../conteudo";
import { Combinador, type BlocoEstudio } from "./combinador";

/*
 * Monte seu Tino — a página que responde "cabe?" antes da ligação. É a
 * única ação creme da vitrine, e todo caminho leva aqui.
 *
 * `origem` é o slug da campanha que trouxe o visitante; `combinacao`
 * abre com a combinação já escolhida, para link compartilhado.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Monte seu Tino — combine os espaços e veja a área total",
  description:
    "Escolha a combinação de estúdios, a data e o tipo de produção. A conversa no WhatsApp já começa com tudo anotado.",
};

async function carregar() {
  const lista = await db
    .select({
      codigo: estudios.codigo,
      nome: estudios.nome,
      areaM2: estudios.areaM2,
      endereco: estudios.endereco,
    })
    .from(estudios)
    .orderBy(asc(estudios.codigo));

  const cadastradas = await db
    .select()
    .from(tabelaCombinacoes)
    .orderBy(asc(tabelaCombinacoes.id));

  /* o nome é a fórmula: "A+B" já diz quais espaços entram */
  const combinacoes: Combinacao[] =
    cadastradas.length > 0
      ? cadastradas.map((c) => ({
          nome: c.nome,
          partes: c.nome.split("+").map((p) => p.trim().toUpperCase()),
          areaM2: c.areaM2 ?? 0,
        }))
      : COMBINACOES_PADRAO;

  return { blocos: lista as BlocoEstudio[], combinacoes };
}

export default async function PaginaMonte({
  searchParams,
}: {
  searchParams: Promise<{ combinacao?: string; origem?: string }>;
}) {
  const [{ blocos, combinacoes }, { combinacao, origem }] = await Promise.all([
    carregar(),
    searchParams,
  ]);

  return (
    <main className="mx-auto w-full max-w-4xl px-6 pt-8 pb-24">
      <nav className="flex items-center justify-between">
        <Link
          href="/"
          className="font-mono text-[0.6875rem] tracking-[0.16em] text-concreto uppercase transition-colors hover:text-papel focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-creme"
        >
          ← Tino Estúdio
        </Link>
        <Image
          src="/logo.png"
          alt=""
          width={944}
          height={411}
          className="h-6 w-auto opacity-60"
        />
      </nav>

      <header className="mt-14 flex flex-col gap-5 sm:mt-20">
        <h1 className="font-condensed text-[clamp(2.5rem,9vw,5rem)] leading-[0.95] font-semibold tracking-tight uppercase">
          Monte seu Tino
        </h1>
        <p className="max-w-xl text-concreto">
          Os espaços se somam. Escolha a combinação e veja a área que você leva
          — a largura de cada bloco é a área dele.
        </p>
      </header>

      <div className="mt-14 sm:mt-20">
        <Combinador
          blocos={blocos}
          combinacoes={combinacoes}
          numeroWhatsapp={process.env.NEXT_PUBLIC_WHATSAPP_NUMERO}
          inicial={combinacao}
          campanhaSlug={origem}
        />
      </div>
    </main>
  );
}
