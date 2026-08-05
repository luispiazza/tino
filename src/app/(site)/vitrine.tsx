import { existsSync } from "node:fs";
import path from "node:path";
import Image from "next/image";
import { db } from "@/server/db";
import { estudios } from "@/server/db/schema";
import type { Campanha } from "@/server/routers/campanhas";
import { MonteSeuTino } from "./monte-seu-tino";

/*
 * A vitrine — Domínio 6, decisões de 29/07: uma vitrine forte, não
 * quatro homes; a unidade de apresentação é a COMBINAÇÃO; a única ação
 * creme é o Monte seu Tino. Campanha troca o hero; o resto é o mesmo
 * (página só de hero é página-porta). SSR: a ficha vai no HTML.
 *
 * Fotos e vídeo entram nos espaços já reservados quando o material
 * chegar; até lá o hero é tipográfico.
 */

const INSTAGRAM = "https://www.instagram.com/tino.estudios";

/*
 * O vídeo do hero é opcional e entra sem código novo: basta colocar o
 * arquivo em public/video/hero.mp4. Sem ele, a foto segura o hero (e
 * serve de poster enquanto o vídeo carrega).
 */
function videoDoHero(): string | null {
  const arquivo = path.join(process.cwd(), "public", "video", "hero.mp4");
  return existsSync(arquivo) ? "/video/hero.mp4" : null;
}

/* Fotos do acervo do estúdio (repo tino-estudio). Estúdio sem foto
 * aparece sem imagem, nunca com placeholder genérico. */
const FOTOS: Record<string, string> = {
  A: "/fotos/estudio-a.jpg",
  B: "/fotos/estudio-b.jpg",
  C: "/fotos/estudio-c.jpg",
  E: "/fotos/estudio-e.jpg",
};

/* As três que mais saem lideram (29/07). Vira cadastro quando as
 * combinações ganharem tela — por ora é conteúdo, não dado. */
const COMBINACOES = [
  {
    nome: "A+B",
    areaM2: 360,
    descricao: "O principal com o complementar direto — o mais pedido.",
  },
  {
    nome: "A+B+C",
    areaM2: 444,
    descricao: "O complexo quase inteiro, para produções grandes.",
  },
  {
    nome: "E+C",
    areaM2: 144,
    descricao: "Compacto e completo, para equipes menores.",
  },
];

export async function Vitrine({ campanha }: { campanha: Campanha | null }) {
  const lista = await db.select().from(estudios);
  const principais = lista.filter((e) => !e.ehComplementar);
  const complementares = lista.filter((e) => e.ehComplementar);

  const video = campanha?.heroVideoUrl ?? videoDoHero();

  return (
    <>
      {/*
       * Hero em tela cheia, fora da caixa de conteúdo: vídeo de fundo
       * (campanha troca o arquivo), logo, e a única ação creme da página.
       */}
      {/* isolate + camadas positivas: z negativo escaparia para trás do
          fundo da página e o hero apareceria preto */}
      <header className="relative isolate flex min-h-svh flex-col items-center justify-center gap-6 px-6 text-center">
        {video ? (
          <video
            src={video}
            poster="/fotos/hero.jpg"
            autoPlay
            muted
            loop
            playsInline
            className="absolute inset-0 z-0 h-full w-full object-cover"
          />
        ) : (
          <Image
            src="/fotos/hero.jpg"
            alt=""
            fill
            priority
            sizes="100vw"
            className="z-0 object-cover"
          />
        )}
        {/* o texto precisa ganhar do vídeo, sempre */}
        <div className="absolute inset-0 z-10 bg-gradient-to-b from-background/70 via-background/40 to-background" />

        <div className="relative z-20 flex flex-col items-center gap-6">
        {/* logo entre dois fios, como a marca se apresenta */}
        <div className="flex items-center gap-5">
          <span className="h-px w-10 bg-foreground/30 sm:w-16" />
          <Image
            src="/logo.png"
            alt="Tino Estúdio"
            width={944}
            height={411}
            priority
            className="h-9 w-auto sm:h-11"
          />
          <span className="h-px w-10 bg-foreground/30 sm:w-16" />
        </div>

        <p className="text-xs tracking-[0.25em] text-foreground/70 uppercase">
          Vila Romana · São Paulo
        </p>

        <h1 className="max-w-3xl text-5xl leading-[0.95] font-semibold tracking-tight uppercase sm:text-7xl">
          {campanha?.heroTitulo ?? "Monte seu Tino"}
        </h1>

        <p className="max-w-xl text-base text-foreground/80 sm:text-lg">
          {campanha?.heroSubtitulo ??
            "Mais de 500m² e duas entradas independentes: ciclorama de 54m², pé-direito de 10m — montados do tamanho da sua produção."}
        </p>

        <div className="mt-2 flex flex-col items-center gap-4">
          <a
            href="#monte"
            className="rounded-full bg-primary px-8 py-3 text-sm font-semibold tracking-wide text-primary-foreground uppercase transition-opacity hover:opacity-90"
          >
            Comece já
          </a>
          <a
            href={INSTAGRAM}
            target="_blank"
            rel="noreferrer"
            className="text-xs tracking-[0.2em] text-foreground/60 uppercase transition-colors hover:text-foreground"
          >
            Instagram
          </a>
        </div>
        </div>

        <a
          href="#monte"
          aria-label="Ver os espaços"
          className="absolute bottom-8 z-20 text-foreground/50 transition-colors hover:text-foreground"
        >
          ↓
        </a>
      </header>

      <div className="mx-auto flex max-w-4xl flex-col gap-20 px-6 py-16 sm:py-24">
      {/* Combinações — a prateleira. Complementar não aparece sozinho. */}
      <section className="flex flex-col gap-6">
        <h2 className="text-sm tracking-widest text-muted-foreground uppercase">
          As combinações que mais rodam
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {COMBINACOES.map((c) => (
            <div
              key={c.nome}
              className="flex flex-col gap-2 rounded-2xl border p-6"
            >
              <span className="font-mono text-2xl font-semibold">{c.nome}</span>
              <span className="text-sm text-muted-foreground tabular-nums">
                {c.areaM2} m²
              </span>
              <p className="mt-2 text-sm text-muted-foreground">
                {c.descricao}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Monte seu Tino — a única ação creme da página */}
      <section id="monte" className="flex flex-col gap-6">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">
            Monte seu Tino
          </h2>
          <p className="mt-1 text-muted-foreground">
            Escolha a combinação e a data — a conversa já começa com tudo
            anotado.
          </p>
        </div>
        <MonteSeuTino
          combinacoes={COMBINACOES.map((c) => c.nome)}
          campanhaSlug={campanha?.slug ?? null}
        />
      </section>

      {/* Ficha técnica — o SEO orgânico mora aqui, em HTML de servidor */}
      {lista.length > 0 && (
        <section className="flex flex-col gap-6">
          <h2 className="text-sm tracking-widest text-muted-foreground uppercase">
            Os espaços
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {[...principais, ...complementares].map((e) => (
              <div key={e.id} className="overflow-hidden rounded-2xl border">
                {FOTOS[e.codigo] && (
                  <Image
                    src={FOTOS[e.codigo]}
                    alt={`Estúdio ${e.codigo}`}
                    width={1920}
                    height={1080}
                    sizes="(min-width: 640px) 50vw, 100vw"
                    className="aspect-[16/10] w-full object-cover"
                  />
                )}
                <div className="p-6">
                <div className="flex items-baseline gap-3">
                  <span className="font-mono text-xl font-semibold">
                    {e.codigo}
                  </span>
                  <span className="text-muted-foreground">{e.nome}</span>
                  {e.areaM2 && (
                    <span className="ml-auto text-sm text-muted-foreground tabular-nums">
                      {e.areaM2} m²
                    </span>
                  )}
                </div>
                {e.ehComplementar && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    complementar — entra junto de um principal
                  </p>
                )}
                {e.fichaTecnica && (
                  <p className="mt-3 text-sm whitespace-pre-line text-muted-foreground">
                    {e.fichaTecnica}
                  </p>
                )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Quem somos — o texto do estúdio, não o meu */}
      <section className="flex max-w-2xl flex-col gap-4">
        <h2 className="text-sm tracking-widest text-muted-foreground uppercase">
          Quem somos
        </h2>
        <p className="text-muted-foreground">
          O Tino Estúdio nasceu da necessidade de ter um espaço que entendesse
          de verdade o que uma produção audiovisual precisa. Criado por dois
          sócios com anos de experiência no mercado criativo, com a convicção
          de que infraestrutura de qualidade não deveria ser privilégio de
          grandes produções.
        </p>
        <p className="text-muted-foreground">
          O A e o E possuem entradas separadas e funcionam de forma totalmente
          autônoma — ideal para produções simultâneas. B e C são complementares,
          pensados para ampliar as possibilidades de cada projeto.
        </p>
      </section>

      <footer className="flex flex-col gap-1 border-t pt-8 text-sm text-muted-foreground">
        <span>Tino Estúdio · Vila Romana, São Paulo</span>
        <span>Rua Camilo, 789 · Rua Marco Aurélio, 268</span>
        <a
          href={INSTAGRAM}
          target="_blank"
          rel="noreferrer"
          className="w-fit hover:text-foreground"
        >
          @tino.estudios
        </a>
      </footer>
      </div>
    </>
  );
}
