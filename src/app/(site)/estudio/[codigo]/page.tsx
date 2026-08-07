import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { eq, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { estudioDependencias, estudios } from "@/server/db/schema";
import type { EstudioVitrine } from "../../dados";
import { Ficha } from "../../ficha";

/*
 * SSR obrigatório: a ficha técnica é o ativo de busca orgânica e precisa
 * sair no HTML. O conteúdo vem do cadastro — muda sem deploy.
 */
export const dynamic = "force-dynamic";

async function buscar(codigo: string): Promise<EstudioVitrine | null> {
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

  return <Ficha estudio={e} />;
}
