import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eq, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { estudioDependencias, estudios } from "@/server/db/schema";
import { Planta } from "../../planta";

export const dynamic = "force-dynamic";

/*
 * A página de cada estúdio — o que responde antes da ligação, e o que o
 * Google indexa. Todo o conteúdo vem do cadastro: os sócios editam no
 * admin e a página muda, sem deploy.
 */

async function buscar(codigo: string) {
  const [estudio] = await db
    .select()
    .from(estudios)
    .where(sql`upper(${estudios.codigo}) = ${codigo.toUpperCase()}`)
    .limit(1);
  if (!estudio) return null;

  const bases = await db
    .select({ codigo: estudios.codigo, nome: estudios.nome })
    .from(estudioDependencias)
    .innerJoin(estudios, eq(estudioDependencias.dependeDeId, estudios.id))
    .where(eq(estudioDependencias.estudioId, estudio.id));

  return { ...estudio, bases };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ codigo: string }>;
}): Promise<Metadata> {
  const { codigo } = await params;
  const e = await buscar(codigo);
  if (!e) return {};

  const specs = (e.specs ?? []).map((s) => `${s.valor} ${s.rotulo}`).join(" · ");
  const titulo = `${e.nome} — ${e.areaM2 ? `${e.areaM2}m² ` : ""}para foto e vídeo em São Paulo`;
  const descricao =
    e.visaoGeral?.slice(0, 155) ??
    `${e.nome} no Tino Estúdio, Vila Romana. ${specs}`;

  return {
    title: titulo,
    description: descricao,
    openGraph: {
      title: titulo,
      description: descricao,
      images: e.fotoUrl ? [{ url: e.fotoUrl }] : undefined,
      type: "website",
    },
  };
}

export default async function PaginaEstudio({
  params,
}: {
  params: Promise<{ codigo: string }>;
}) {
  const { codigo } = await params;
  const e = await buscar(codigo);
  if (!e) notFound();

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-12 px-6 py-10 sm:py-16">
      <nav className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/" className="hover:text-foreground">
          Tino Estúdio
        </Link>
        <span>/</span>
        <span className="text-foreground">{e.nome}</span>
      </nav>

      <header className="flex flex-col gap-4">
        <div className="flex items-baseline gap-4">
          <span className="font-mono text-6xl leading-none font-semibold sm:text-7xl">
            {e.codigo}
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{e.nome}</h1>
            {e.endereco && (
              <p className="text-sm text-muted-foreground">{e.endereco}</p>
            )}
          </div>
        </div>
        {e.visaoGeral && (
          <p className="max-w-2xl text-lg text-muted-foreground">
            {e.visaoGeral}
          </p>
        )}
        {e.ehComplementar && e.bases.length > 0 && (
          <p className="text-sm text-muted-foreground">
            Complementar — entra junto de{" "}
            {e.bases.map((b) => b.nome).join(" ou ")}.
          </p>
        )}
      </header>

      {e.fotoUrl && (
        <Image
          src={e.fotoUrl}
          alt={e.nome}
          width={1920}
          height={1080}
          priority
          sizes="(min-width: 1024px) 900px, 100vw"
          className="aspect-[16/9] w-full rounded-2xl object-cover"
        />
      )}

      {/* os números que decidem a contratação */}
      {(e.specs ?? []).length > 0 && (
        <section className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border bg-border sm:grid-cols-4">
          {(e.specs ?? []).map((s) => (
            <div
              key={s.rotulo}
              className="flex flex-col gap-1 bg-background p-5"
            >
              <span className="font-mono text-2xl leading-none tabular-nums">
                {s.valor}
              </span>
              <span className="text-xs text-muted-foreground">{s.rotulo}</span>
            </div>
          ))}
        </section>
      )}

      {(e.caracteristicas ?? []).length > 0 && (
        <section className="flex flex-col gap-4">
          <h2 className="text-sm tracking-widest text-muted-foreground uppercase">
            O que tem dentro
          </h2>
          <ul className="grid gap-x-8 gap-y-2 sm:grid-cols-2">
            {(e.caracteristicas ?? []).map((c) => (
              <li key={c} className="flex gap-3 text-sm">
                <span className="text-primary">—</span>
                <span>{c}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {e.plantaBaixaUrl && (
        <section className="flex flex-col gap-4">
          <Planta
            estudio={e.codigo}
            baixa={e.plantaBaixaUrl}
            eletrica={e.plantaEletricaUrl ?? undefined}
          />
        </section>
      )}

      {/* a ficha antiga só aparece se não houver specs — senão repetiria
          os mesmos números duas vezes na mesma página */}
      {e.fichaTecnica && (e.specs ?? []).length === 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm tracking-widest text-muted-foreground uppercase">
            Ficha técnica
          </h2>
          <p className="max-w-2xl text-sm whitespace-pre-line text-muted-foreground">
            {e.fichaTecnica}
          </p>
        </section>
      )}

      <section className="flex flex-col items-start gap-4 rounded-2xl border p-8">
        <h2 className="text-2xl font-semibold tracking-tight">
          Cabe na sua produção?
        </h2>
        <p className="text-muted-foreground">
          Monte a combinação com a data e fale com a gente — a conversa já
          começa com tudo anotado.
        </p>
        <Link
          href="/#monte"
          className="rounded-full bg-primary px-8 py-3 text-sm font-semibold tracking-wide text-primary-foreground uppercase transition-opacity hover:opacity-90"
        >
          Montar meu Tino
        </Link>
      </section>
    </main>
  );
}
