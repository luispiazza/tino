"use client";

import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { Anotacao, Cota } from "../cota";
import { INSTAGRAM, SEGMENTOS, type Combinacao } from "../conteudo";

/*
 * O combinador.
 *
 * O que o Tino vende não é um estúdio, é a soma — A+B, A+B+C, E+C. Uma
 * fileira de cartões *descreve* isso; a faixa proporcional *mostra*: cada
 * bloco tem a largura da sua área, a cota em cima mede exatamente o que
 * está contratado, e a combinação acende os blocos que entram.
 *
 * A ordem A · B · C · E não é arbitrária: nela as três combinações que
 * mais saem ficam contíguas, e a cota consegue medir um trecho só.
 */

export type BlocoEstudio = {
  codigo: string;
  nome: string;
  areaM2: number | null;
  endereco: string | null;
};

export function Combinador({
  blocos,
  combinacoes,
  numeroWhatsapp,
  inicial,
  campanhaSlug,
}: {
  blocos: BlocoEstudio[];
  combinacoes: Combinacao[];
  numeroWhatsapp?: string;
  /* link compartilhado ou campanha pode chegar com a combinação escolhida */
  inicial?: string | null;
  /* a origem do funil: de qual campanha veio esta montagem */
  campanhaSlug?: string | null;
}) {
  const [combinacao, setCombinacao] = useState<Combinacao | null>(
    () => combinacoes.find((c) => c.nome === inicial) ?? null
  );
  const [data, setData] = useState("");
  const [segmento, setSegmento] = useState<string | null>(null);
  const [codigo, setCodigo] = useState<string | null>(null);

  const gravar = trpc.campanhas.gravarMontagem.useMutation();
  const marcarClique = trpc.campanhas.marcarCliqueWhatsapp.useMutation();

  const selecionados = combinacao?.partes ?? [];

  /* área ausente no cadastro não pode virar bloco de largura zero */
  const pesos = useMemo(
    () => blocos.map((b) => b.areaM2 ?? 100),
    [blocos]
  );

  /* a cota mede o trecho contíguo dos blocos escolhidos */
  const indices = blocos
    .map((b, i) => (selecionados.includes(b.codigo) ? i : -1))
    .filter((i) => i >= 0);
  const primeiro = indices.length > 0 ? Math.min(...indices) : 0;
  const ultimo = indices.length > 0 ? Math.max(...indices) : blocos.length - 1;

  const antes = pesos.slice(0, primeiro).reduce((s, p) => s + p, 0);
  const medido = pesos.slice(primeiro, ultimo + 1).reduce((s, p) => s + p, 0);
  const depois = pesos.slice(ultimo + 1).reduce((s, p) => s + p, 0);

  function linhasDoResumo(codigoCurto?: string) {
    return [
      "Olá! Montei um Tino no site:",
      ...(combinacao
        ? [`Combinação ${combinacao.nome} — ${combinacao.areaM2} m²`]
        : []),
      ...(data ? [`Data: ${data.split("-").reverse().join("/")}`] : []),
      ...(segmento ? [`Produção de ${segmento.toLowerCase()}`] : []),
      ...(codigoCurto ? [`Código: ${codigoCurto}`] : []),
    ];
  }

  const resumo = linhasDoResumo(codigo ?? undefined).join("\n");

  /*
   * Toda montagem grava — mesmo incompleta, mesmo se o visitante não
   * pular para o WhatsApp. O código curto é o que costura a visita ao
   * atendimento, e sobrevive ao pulo para o wa.me.
   */
  async function montar() {
    const { codigoCurto } = await gravar.mutateAsync({
      combinacao: combinacao?.nome,
      dataDesejada: data || undefined,
      segmento: segmento ?? undefined,
      campanhaSlug: campanhaSlug ?? undefined,
    });
    setCodigo(codigoCurto);

    if (numeroWhatsapp) {
      marcarClique.mutate({ codigoCurto });
      window.open(
        `https://wa.me/${numeroWhatsapp}?text=${encodeURIComponent(
          linhasDoResumo(codigoCurto).join("\n")
        )}`,
        "_blank"
      );
    }
  }

  return (
    <div className="flex flex-col gap-12">
      {/* A combinação */}
      <section className="flex flex-col gap-4">
        <Anotacao>A combinação</Anotacao>
        <div className="flex flex-wrap gap-2">
          {combinacoes.map((c) => {
            const ativa = combinacao?.nome === c.nome;
            return (
              <button
                key={c.nome}
                type="button"
                aria-pressed={ativa}
                onClick={() => setCombinacao(ativa ? null : c)}
                className={`flex min-h-11 items-baseline gap-2.5 border px-4 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-creme ${
                  ativa
                    ? "border-creme bg-creme text-fundo"
                    : "border-fio text-papel hover:border-papel/40"
                }`}
              >
                <span className="font-mono text-base">{c.nome}</span>
                <span
                  className={`font-mono text-xs tabular-nums ${ativa ? "text-fundo/70" : "text-concreto"}`}
                >
                  {c.areaM2} m²
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* A faixa medida */}
      <section className="flex flex-col gap-3">
        <div className="flex items-end gap-1">
          {antes > 0 && (
            <div style={{ flexGrow: antes, flexBasis: 0 }} aria-hidden="true" />
          )}
          <div
            style={{ flexGrow: medido, flexBasis: 0 }}
            className="min-w-0 transition-all duration-700 ease-out motion-reduce:transition-none"
          >
            <Cota>{combinacao ? `${combinacao.areaM2} m²` : "o complexo"}</Cota>
          </div>
          {depois > 0 && (
            <div style={{ flexGrow: depois, flexBasis: 0 }} aria-hidden="true" />
          )}
        </div>

        <div className="flex items-stretch gap-1">
          {blocos.map((b, i) => {
            const aceso = selecionados.includes(b.codigo);
            /* a rua muda entre um bloco e o outro: o desenho registra */
            const trocaDeRua =
              i > 0 && blocos[i - 1].endereco !== b.endereco;
            return (
              <div
                key={b.codigo}
                /* base zero: com base automática o texto de dentro define a
                   largura e a proporção mente — a faixa promete que a
                   largura é a área */
                style={{ flexGrow: pesos[i], flexBasis: 0 }}
                className={`flex min-h-20 min-w-0 flex-col justify-between overflow-hidden border p-2 transition-colors duration-500 motion-reduce:transition-none sm:min-h-28 sm:p-4 ${
                  trocaDeRua ? "ml-6 sm:ml-10" : ""
                } ${
                  aceso
                    ? "border-papel bg-papel text-fundo"
                    : "border-fio bg-grafite text-concreto"
                }`}
              >
                <span className="font-mono text-lg leading-none sm:text-2xl">
                  {b.codigo}
                </span>
                {/* no celular o bloco estreito não comporta a legenda; a
                    área de cada espaço está na ficha dele */}
                <span className="hidden font-mono text-[0.625rem] tracking-[0.12em] uppercase tabular-nums sm:block">
                  {b.areaM2 ? `${b.areaM2} m²` : "—"}
                </span>
              </div>
            );
          })}
        </div>

        {/*
         * O rótulo da rua se ancora na borda externa do seu grupo: o
         * primeiro pela esquerda, o último pela direita. No celular ele
         * sai — endereço de cadastro é longo demais para caber em dois
         * trechos, e o intervalo entre os blocos já diz que a entrada é
         * outra. Os endereços inteiros estão no rodapé.
         */}
        <div className="hidden gap-1 sm:flex">
          {agruparPorEndereco(blocos, pesos).map((grupo, i, todos) => (
            <span
              key={grupo.endereco ?? i}
              style={{ flexGrow: grupo.peso, flexBasis: 0 }}
              className={`min-w-0 truncate font-mono text-[0.625rem] tracking-[0.14em] text-concreto uppercase ${
                i > 0 ? "ml-6 sm:ml-10" : ""
              } ${i === todos.length - 1 && todos.length > 1 ? "text-right" : ""}`}
            >
              {grupo.endereco ?? "—"}
            </span>
          ))}
        </div>
      </section>

      {/* Quando */}
      <section className="flex flex-col gap-4">
        <Anotacao>Quando, se já souber</Anotacao>
        <input
          type="date"
          value={data}
          onChange={(evento) => setData(evento.target.value)}
          aria-label="Data desejada"
          className="min-h-11 w-full max-w-xs border border-fio bg-transparent px-4 font-mono text-sm text-papel focus-visible:border-papel/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-creme"
        />
      </section>

      {/* Produção */}
      <section className="flex flex-col gap-4">
        <Anotacao>Tipo de produção</Anotacao>
        <div className="flex flex-wrap gap-2">
          {SEGMENTOS.map((s) => {
            const ativo = segmento === s;
            return (
              <button
                key={s}
                type="button"
                aria-pressed={ativo}
                onClick={() => setSegmento(ativo ? null : s)}
                className={`min-h-11 border px-4 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-creme ${
                  ativo
                    ? "border-papel bg-papel text-fundo"
                    : "border-fio text-papel hover:border-papel/40"
                }`}
              >
                {s}
              </button>
            );
          })}
        </div>
      </section>

      {/* A saída */}
      <section className="flex flex-col gap-4 border-t border-fio pt-10">
        <button
          type="button"
          onClick={montar}
          disabled={gravar.isPending}
          className="inline-flex min-h-12 w-full items-center justify-center bg-creme px-7 font-condensed text-sm font-semibold tracking-[0.14em] text-fundo uppercase transition-colors hover:bg-papel focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-creme disabled:opacity-60 sm:w-fit"
        >
          {gravar.isPending
            ? "Montando…"
            : numeroWhatsapp
              ? "Chamar no WhatsApp"
              : "Montar"}
        </button>

        {gravar.isError && (
          <p className="text-sm text-papel">
            A montagem não foi registrada. Tente de novo, ou chame no{" "}
            <a
              href={INSTAGRAM}
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-4"
            >
              Instagram
            </a>
            .
          </p>
        )}

        {/* sem número configurado, o código é a saída: ele costura a
            visita ao atendimento */}
        {codigo && !numeroWhatsapp && (
          <p className="max-w-xl text-sm text-concreto">
            Seu código é{" "}
            <span className="font-mono text-base text-papel">{codigo}</span> —
            mande ele no WhatsApp do Tino que a conversa já começa com tudo
            anotado.
          </p>
        )}

        <p className="font-mono text-xs leading-relaxed whitespace-pre-line text-concreto">
          {resumo}
        </p>
      </section>
    </div>
  );
}

function agruparPorEndereco(blocos: BlocoEstudio[], pesos: number[]) {
  const grupos: { endereco: string | null; peso: number }[] = [];
  blocos.forEach((b, i) => {
    const ultimo = grupos.at(-1);
    if (ultimo && ultimo.endereco === b.endereco) ultimo.peso += pesos[i];
    else grupos.push({ endereco: b.endereco, peso: pesos[i] });
  });
  return grupos;
}
