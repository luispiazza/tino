import Image from "next/image";
import Link from "next/link";
import { Acao } from "./acao";
import { Anotacao, Cota } from "./cota";
import { FOTOS, PLANTAS } from "./conteudo";
import type { EstudioVitrine } from "./dados";
import { Planta } from "./planta";

/*
 * A ficha do estúdio — a página que responde antes da ligação, e o que o
 * Google indexa. Tudo vem do cadastro: o sócio edita no admin e a página
 * muda, sem deploy. Campo vazio some da página; nada é preenchido com
 * texto genérico só para ocupar espaço.
 */
export function Ficha({ estudio: e }: { estudio: EstudioVitrine }) {
  const foto = e.fotoUrl ?? FOTOS[e.codigo];
  const planta = e.plantaBaixaUrl
    ? { baixa: e.plantaBaixaUrl, eletrica: e.plantaEletricaUrl ?? undefined }
    : PLANTAS[e.codigo];
  const specs = e.specs ?? [];
  const caracteristicas = e.caracteristicas ?? [];

  return (
    <main className="mx-auto w-full max-w-5xl px-6 pt-8 pb-20 sm:pb-28">
      <nav className="flex items-center gap-2 font-mono text-[0.6875rem] tracking-[0.16em] text-concreto uppercase">
        <Link
          href="/"
          className="transition-colors hover:text-papel focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-creme"
        >
          Tino Estúdio
        </Link>
        <span aria-hidden="true">/</span>
        <span className="text-papel">{e.nome}</span>
      </nav>

      {/* o código é como a casa chama o espaço — vira a marca da página */}
      <header className="mt-12 flex flex-col gap-6 sm:mt-16">
        <div className="flex items-end gap-5">
          <span className="font-mono text-[clamp(3.5rem,14vw,8rem)] leading-[0.8] font-medium">
            {e.codigo}
          </span>
          <div className="pb-2">
            <h1 className="font-condensed text-2xl leading-none font-semibold tracking-tight uppercase sm:text-4xl">
              {e.nome}
            </h1>
            {e.endereco && (
              <p className="mt-2 font-mono text-[0.6875rem] tracking-[0.16em] text-concreto uppercase">
                {e.endereco}
              </p>
            )}
          </div>
        </div>

        {e.areaM2 && <Cota>{e.areaM2} m²</Cota>}

        {e.visaoGeral && (
          <p className="max-w-2xl text-lg text-concreto">{e.visaoGeral}</p>
        )}

        {e.ehComplementar && e.bases.length > 0 && (
          <p className="font-mono text-[0.6875rem] tracking-[0.16em] text-concreto uppercase">
            Complementar — entra junto de{" "}
            {e.bases.map((b) => b.nome).join(" ou ")}
          </p>
        )}
      </header>

      {foto && (
        <Image
          src={foto}
          alt={e.nome}
          width={1920}
          height={1080}
          priority
          sizes="(min-width: 1024px) 1000px, 100vw"
          className="mt-12 aspect-video w-full border border-fio object-cover"
        />
      )}

      {/* os números que decidem a contratação */}
      {specs.length > 0 && (
        <section className="mt-16">
          <Anotacao>Ficha técnica</Anotacao>
          <dl className="mt-6 grid grid-cols-2 border-t border-l border-fio sm:grid-cols-4">
            {specs.map((s) => (
              <div
                key={s.rotulo}
                className="flex flex-col gap-1.5 border-r border-b border-fio p-5"
              >
                <dt className="sr-only">{s.rotulo}</dt>
                <dd className="font-mono text-2xl leading-none tabular-nums">
                  {s.valor}
                </dd>
                <span
                  aria-hidden="true"
                  className="font-mono text-[0.6875rem] tracking-[0.16em] text-concreto uppercase"
                >
                  {s.rotulo}
                </span>
              </div>
            ))}
          </dl>
        </section>
      )}

      {caracteristicas.length > 0 && (
        <section className="mt-16">
          <Anotacao>O que tem dentro</Anotacao>
          <ul className="mt-6 grid gap-x-12 gap-y-3 sm:grid-cols-2">
            {caracteristicas.map((c) => (
              <li
                key={c}
                className="flex gap-3 border-b border-fio pb-3 text-sm"
              >
                <span aria-hidden="true" className="text-creme">
                  —
                </span>
                <span>{c}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {planta && (
        <section className="mt-16">
          <Planta
            estudio={e.codigo}
            baixa={planta.baixa}
            eletrica={planta.eletrica}
          />
        </section>
      )}

      {/* a ficha em texto só aparece se não houver specs — senão a página
          repetiria os mesmos números duas vezes */}
      {e.fichaTecnica && specs.length === 0 && (
        <section className="mt-16">
          <Anotacao>Ficha técnica</Anotacao>
          <p className="mt-6 max-w-2xl text-sm whitespace-pre-line text-concreto">
            {e.fichaTecnica}
          </p>
        </section>
      )}

      <section className="mt-20 flex flex-col items-start gap-5 border border-fio p-8 sm:p-12">
        <h2 className="font-condensed text-3xl leading-[1.0] font-semibold tracking-tight uppercase sm:text-4xl">
          Cabe na sua produção?
        </h2>
        <p className="max-w-xl text-concreto">
          Monte a combinação com {e.codigo} e veja a área total. A conversa no
          WhatsApp já começa com tudo anotado.
        </p>
        <Acao href="/monte" className="mt-1">
          Monte seu Tino
        </Acao>
      </section>
    </main>
  );
}
