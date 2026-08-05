import type { Metadata } from "next";
import { and, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { campanhas } from "@/server/db/schema";
import { Vitrine } from "../../vitrine";

export const revalidate = 60;

/*
 * Página de campanha — /c/[slug].
 * O crawler do WhatsApp/Meta não executa JS: as OG tags saem no HTML
 * do servidor. Slug desconhecido ou campanha pausada caem no conteúdo
 * padrão — nunca 404: link antigo compartilhado continua vendendo.
 */

async function buscarCampanha(slug: string) {
  const [campanha] = await db
    .select()
    .from(campanhas)
    .where(and(eq(campanhas.slug, slug), eq(campanhas.ativa, true)))
    .limit(1);
  return campanha ?? null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const campanha = await buscarCampanha(slug);
  if (!campanha) return {};
  return {
    title: campanha.ogTitulo ?? campanha.heroTitulo ?? undefined,
    description: campanha.ogDescricao ?? campanha.heroSubtitulo ?? undefined,
    openGraph: {
      title: campanha.ogTitulo ?? undefined,
      description: campanha.ogDescricao ?? undefined,
      images: campanha.ogImageUrl
        ? [{ url: campanha.ogImageUrl, width: 1200, height: 630 }]
        : undefined,
    },
  };
}

export default async function PaginaCampanha({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const campanha = await buscarCampanha(slug);
  return <Vitrine campanha={campanha} />;
}
