import { existsSync } from "node:fs";
import path from "node:path";
import Image from "next/image";
import Link from "next/link";
import type { Campanha } from "@/server/routers/campanhas";
import { Acao } from "./acao";
import { Anotacao, Cota } from "./cota";
import { ENDERECOS, FOTOS, INSTAGRAM } from "./conteudo";
import { carregarEstudios, type EstudioVitrine } from "./dados";

/*
 * A vitrine — Domínio 6. A ficha técnica sai no HTML do servidor: é dela
 * que vem a busca orgânica, e o crawler não executa JS.
 *
 * A ordem responde à pergunta do produtor, nessa sequência: serve para o
 * que eu quero fazer? cabe? como fecho? Hero, espaços, e a saída para o
 * combinador de quem ainda não sabe escolher. A campanha troca o hero e
 * nada mais — página só de hero é página-porta para o Google.
 */

/* O vídeo é opcional e entra sem código novo: basta pôr o arquivo em
 * public/video/hero.mp4. Sem ele, a foto segura o hero. */
function videoDoHero(): string | null {
  return existsSync(path.join(process.cwd(), "public", "video", "hero.mp4"))
    ? "/video/hero.mp4"
    : null;
}

export async function Vitrine({ campanha }: { campanha: Campanha | null }) {
  const lista = await carregarEstudios();
  const principais = lista.filter((e) => !e.ehComplementar);
  const complementares = lista.filter((e) => e.ehComplementar);
  const video = campanha?.heroVideoUrl ?? videoDoHero();

  /* a campanha segue o visitante até o combinador: é a origem do funil */
  const linkMonte = campanha?.slug
    ? `/monte?origem=${encodeURIComponent(campanha.slug)}`
    : "/monte";

  return (
    <>
      <Hero campanha={campanha} video={video} linkMonte={linkMonte} />

      {/* Os espaços — a ficha técnica que o Google indexa */}
      <section
        id="espacos"
        className="mx-auto w-full max-w-6xl scroll-mt-8 px-6 py-20 sm:py-28"
      >
        <Anotacao>Os espaços</Anotacao>

        {principais.length > 0 && (
          <div className="mt-8 grid gap-10 sm:grid-cols-2 sm:gap-8">
            {principais.map((e) => (
              <CartaoEspaco key={e.id} estudio={e} />
            ))}
          </div>
        )}

        {complementares.length > 0 && (
          /*
           * A regra vira estrutura: o complementar não aparece em pé de
           * igualdade com o principal. A cota diz o porquê, e a hierarquia
           * também é largura — o bloco ocupa menos página.
           */
          <div className="mt-16 max-w-4xl">
            <Cota>Complementar · não se aluga sozinho</Cota>
            <div className="mt-8 grid gap-10 sm:grid-cols-2 sm:gap-8">
              {complementares.map((e) => (
                <CartaoEspaco key={e.id} estudio={e} complementar />
              ))}
            </div>
          </div>
        )}
      </section>

      {/* A saída de quem não sabe escolher — leva ao combinador */}
      <section className="border-y border-fio">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 px-6 py-20 text-center sm:py-28">
          <h2 className="font-condensed text-3xl leading-[1.0] font-semibold tracking-tight uppercase sm:text-5xl">
            Não sabe qual estúdio escolher?
          </h2>
          <p className="max-w-xl text-concreto">
            Monte a combinação por área, data e tipo de produção. A conversa no
            WhatsApp já começa com tudo anotado.
          </p>
          <Acao href={linkMonte} className="mt-2">
            Monte seu Tino
          </Acao>
        </div>
      </section>

      <Sobre />
      <Rodape />
    </>
  );
}

function Hero({
  campanha,
  video,
  linkMonte,
}: {
  campanha: Campanha | null;
  video: string | null;
  linkMonte: string;
}) {
  return (
    /* isolate + camadas positivas: z negativo escaparia para trás do fundo
       da página e o hero apareceria preto */
    <header className="relative isolate flex min-h-svh flex-col items-center justify-center px-6 py-28 text-center">
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
      {/* o estúdio é branco: no escuro a foto vira a luz da página, e o
          texto precisa ganhar dela sempre */}
      <div className="absolute inset-0 z-10 bg-linear-to-b from-fundo/88 via-fundo/74 to-fundo" />

      <div className="relative z-20 flex w-full max-w-4xl flex-col items-center">
        {/* a marca se apresenta entre dois fios */}
        <div className="flex items-center gap-5" data-entra>
          <span className="h-px w-10 bg-papel/25 sm:w-16" />
          <Image
            src="/logo.png"
            alt="Tino Estúdio"
            width={944}
            height={411}
            priority
            className="h-8 w-auto sm:h-10"
          />
          <span className="h-px w-10 bg-papel/25 sm:w-16" />
        </div>

        <p
          className="mt-6 font-mono text-[0.6875rem] tracking-[0.22em] text-concreto uppercase"
          data-entra
          style={{ animationDelay: "80ms" }}
        >
          Vila Romana · São Paulo
        </p>

        {/*
         * O hero é uma cota: o que se vende aqui é medida, e a página
         * anuncia o total do jeito que a planta anuncia — ticks, fio
         * tracejado e o valor no meio.
         */}
        <div
          className="mt-10 w-full"
          data-desenha
          style={{ animationDelay: "160ms" }}
        >
          <Cota>+ de 500 m²</Cota>
        </div>

        <h1
          /* caixa alta em português carrega cedilha e til: entrelinha
             apertada demais faz o Ç bater na linha de baixo */
          className="mt-5 font-condensed text-[clamp(2.25rem,8vw,5.5rem)] leading-[1.02] font-semibold tracking-tight uppercase"
          data-entra
          style={{ animationDelay: "240ms" }}
        >
          {campanha?.heroTitulo ?? "Quatro espaços que se somam"}
        </h1>

        <p
          className="mt-7 max-w-xl text-base text-papel/75 sm:text-lg"
          data-entra
          style={{ animationDelay: "340ms" }}
        >
          {campanha?.heroSubtitulo ??
            "Duas entradas independentes, ciclorama de 54 m² e pé-direito de 10 m — montados do tamanho da sua produção."}
        </p>

        <div
          className="mt-9 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center"
          data-entra
          style={{ animationDelay: "420ms" }}
        >
          <Acao href={linkMonte}>Monte seu Tino</Acao>
          <Acao href="#espacos" variante="fio">
            Ver estúdios
          </Acao>
        </div>
      </div>
    </header>
  );
}

function CartaoEspaco({
  estudio: e,
  complementar = false,
}: {
  estudio: EstudioVitrine;
  complementar?: boolean;
}) {
  const foto = e.fotoUrl ?? FOTOS[e.codigo];
  const resumo = e.visaoGeral ?? e.fichaTecnica;

  return (
    /* o cartão inteiro leva à página do estúdio: alvo grande, nada de
       link de 12px no fim do texto */
    <Link
      href={`/estudio/${e.codigo.toLowerCase()}`}
      className="group block focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-creme"
    >
      {foto && (
        <div className="relative overflow-hidden border border-fio">
          <Image
            src={foto}
            alt={`Estúdio ${e.codigo} — ${e.nome}`}
            width={1920}
            height={1080}
            sizes="(min-width: 640px) 50vw, 100vw"
            className={`w-full object-cover brightness-[0.82] transition duration-700 group-hover:scale-[1.02] group-hover:brightness-100 motion-reduce:transition-none ${
              complementar ? "aspect-16/9" : "aspect-4/3"
            }`}
          />
          <span className="absolute top-3 left-3 bg-fundo/70 px-2 py-1 font-mono text-[0.6875rem] tracking-[0.2em] text-papel">
            {e.codigo}
          </span>
        </div>
      )}

      <div className="mt-4 flex items-baseline gap-3">
        <h3 className="font-condensed text-2xl leading-none font-semibold tracking-tight uppercase">
          {e.nome}
        </h3>
        {e.areaM2 && (
          <span className="ml-auto font-mono text-sm text-concreto tabular-nums">
            {e.areaM2} m²
          </span>
        )}
      </div>

      {complementar && e.bases.length > 0 && (
        <p className="mt-1.5 font-mono text-[0.6875rem] tracking-[0.16em] text-concreto uppercase">
          Entra junto de {e.bases.map((b) => b.codigo).join(" ou ")}
        </p>
      )}

      {resumo && (
        <p className="mt-2.5 line-clamp-2 text-sm text-concreto">{resumo}</p>
      )}

      {/* o creme é a cor da ação e a página já tem a dela: aqui o convite
          é tipográfico, senão o sinal vira decoração */}
      <span className="mt-3 inline-block font-mono text-[0.6875rem] tracking-[0.16em] text-concreto uppercase transition-colors group-hover:text-papel">
        Ficha e planta →
      </span>
    </Link>
  );
}

function Sobre() {
  return (
    <section className="mx-auto w-full max-w-6xl px-6 py-20 sm:py-28">
      <Anotacao>Sobre</Anotacao>
      <div className="mt-8 grid gap-10 sm:grid-cols-[1fr_1.5fr] sm:gap-16">
        <p className="font-condensed text-2xl leading-[1.12] font-semibold tracking-tight uppercase sm:text-3xl">
          Infraestrutura de produção grande, sem exigir produção grande.
        </p>
        <div className="flex max-w-[58ch] flex-col gap-4 text-concreto">
          <p>
            O Tino Estúdio nasceu da necessidade de ter um espaço que entendesse
            de verdade o que uma produção audiovisual precisa. Criado por dois
            sócios com anos de mercado criativo, com a convicção de que
            infraestrutura de qualidade não deveria ser privilégio de grandes
            produções.
          </p>
          <p>
            O A e o E têm entradas separadas e funcionam de forma totalmente
            autônoma — dá para rodar duas produções ao mesmo tempo. B e C são
            complementares: entram junto de um principal e ampliam o que cabe
            em cada projeto.
          </p>
        </div>
      </div>
    </section>
  );
}

function Rodape() {
  return (
    <footer className="border-t border-fio">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 px-6 py-14 sm:flex-row sm:justify-between">
        <div className="flex flex-col gap-4">
          <Image
            src="/logo.png"
            alt="Tino Estúdio"
            width={944}
            height={411}
            className="h-7 w-auto"
          />
          <span className="font-mono text-[0.6875rem] tracking-[0.2em] text-concreto uppercase">
            Vila Romana · São Paulo
          </span>
        </div>

        <div className="flex flex-col gap-2 text-sm text-concreto">
          {ENDERECOS.map((endereco) => (
            <span key={endereco}>{endereco}</span>
          ))}
        </div>

        <a
          href={INSTAGRAM}
          target="_blank"
          rel="noreferrer"
          className="h-fit font-mono text-[0.6875rem] tracking-[0.2em] text-concreto uppercase transition-colors hover:text-papel focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-creme"
        >
          @tino.estudios
        </a>
      </div>
    </footer>
  );
}
