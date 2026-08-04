import type { Metadata } from "next";

/*
 * Página de campanha — /c/[slug].
 * O crawler do WhatsApp/Meta não executa JS: as OG tags têm que sair
 * no HTML do servidor, por isso generateMetadata e não client-side.
 * Slug desconhecido ou campanha pausada caem no conteúdo padrão da
 * vitrine — nunca 404: link antigo compartilhado continua vendendo.
 */

type Campanha = {
  heroVideoUrl: string | null;
  heroTitulo: string | null;
  heroSubtitulo: string | null;
  ogTitulo: string | null;
  ogDescricao: string | null;
  ogImageUrl: string | null;
};

async function buscarCampanha(slug: string): Promise<Campanha | null> {
  // TODO: buscar campanha ativa pelo slug no banco
  void slug;
  return null;
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
    title: campanha.ogTitulo,
    description: campanha.ogDescricao,
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
  // TODO: hero com vídeo de fundo e textos da campanha; abaixo dele, a
  // vitrine completa — página só de hero é página-porta para o Google
  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="text-2xl font-semibold">
        {campanha?.heroTitulo ?? "Tino Estúdio"}
      </h1>
      <p className="mt-2 text-[--muted]">
        {campanha?.heroSubtitulo ??
          "Mais de 500m² em São Paulo. Quatro espaços que se combinam."}
      </p>
      <p className="mt-4 font-mono text-xs text-[--muted]">{slug}</p>
    </main>
  );
}
