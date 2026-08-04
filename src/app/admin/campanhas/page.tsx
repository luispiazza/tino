"use client";

import { trpc } from "@/lib/trpc/client";

/*
 * Campanhas — lista com preview do que está gravado em cada landing:
 * à esquerda o hero como o visitante vê, à direita o cartão de link
 * como o WhatsApp renderiza a partir das OG tags. O que estiver
 * faltando aparece dito, não em branco.
 */
export default function CampanhasAdmin() {
  const { data: campanhas, isLoading } = trpc.campanhas.listar.useQuery();

  return (
    <main className="mx-auto max-w-4xl p-6">
      <h1 className="text-xl font-semibold">Campanhas</h1>

      {isLoading && <p className="mt-4 text-[--muted]">Carregando…</p>}
      {campanhas?.length === 0 && (
        <p className="mt-4 text-[--muted]">Nenhuma campanha cadastrada.</p>
      )}

      <div className="mt-6 grid gap-6">
        {campanhas?.map((c) => (
          <article
            key={c.id}
            className="rounded-xl border border-[--border] p-4"
          >
            <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h2 className="font-semibold">{c.nome}</h2>
              <span className="font-mono text-xs text-[--muted]">
                /c/{c.slug}
              </span>
              {c.canal && (
                <span className="text-xs text-[--muted]">{c.canal}</span>
              )}
              {c.segmento && (
                <span className="text-xs text-[--muted]">{c.segmento}</span>
              )}
              {!c.ativa && (
                <span className="text-xs text-[--attention]">pausada</span>
              )}
            </header>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <section>
                <h3 className="text-xs text-[--muted]">Hero da página</h3>
                <div className="mt-2 flex aspect-video flex-col justify-end rounded-lg border border-[--border] bg-black/40 p-4">
                  <p className="text-lg font-semibold">
                    {c.heroTitulo ?? "— sem título"}
                  </p>
                  <p className="mt-1 text-sm text-[--muted]">
                    {c.heroSubtitulo ?? "— sem subtítulo"}
                  </p>
                </div>
                <p className="mt-1 text-xs text-[--muted]">
                  {c.heroVideoUrl ? "vídeo de fundo: ok" : "vídeo de fundo: faltando"}
                </p>
              </section>

              <section>
                <h3 className="text-xs text-[--muted]">
                  Preview do link (WhatsApp)
                </h3>
                <div className="mt-2 overflow-hidden rounded-lg border border-[--border]">
                  {c.ogImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={c.ogImageUrl}
                      alt=""
                      className="aspect-[1200/630] w-full object-cover"
                    />
                  ) : (
                    <div className="flex aspect-[1200/630] items-center justify-center bg-black/40 text-xs text-[--muted]">
                      imagem OG faltando
                    </div>
                  )}
                  <div className="p-3">
                    <p className="text-sm font-semibold">
                      {c.ogTitulo ?? "— sem título OG"}
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-[--muted]">
                      {c.ogDescricao ?? "— sem descrição OG"}
                    </p>
                    <p className="mt-1 text-xs text-[--muted]">
                      tinoestudio.com.br
                    </p>
                  </div>
                </div>
              </section>
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}
