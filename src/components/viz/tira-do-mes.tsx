"use client";

import { VIZ, tomPorFracao } from "./tokens";

/*
 * A assinatura do painel: uma folha de contato do mês. Cada quadro é um
 * dia; a intensidade do creme diz quantos estúdios rodaram. É como o
 * negócio enxerga o mês — e é vernáculo de fotografia, não decoração.
 */
export function TiraDoMes({
  dias,
  totalEstudios,
  hoje,
}: {
  dias: { data: string; estudios: number }[];
  totalEstudios: number;
  hoje?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-[2px]" role="img" aria-label={`Ocupação diária: ${dias.filter((d) => d.estudios > 0).length} de ${dias.length} dias com produção`}>
        {dias.map((d) => {
          const fracao = totalEstudios > 0 ? d.estudios / totalEstudios : 0;
          const ehHoje = d.data === hoje;
          return (
            <div
              key={d.data}
              title={`${d.data.slice(8)}/${d.data.slice(5, 7)} · ${
                d.estudios === 0
                  ? "livre"
                  : `${d.estudios} ${d.estudios === 1 ? "estúdio" : "estúdios"}`
              }`}
              className="group relative h-7 flex-1 rounded-[1px] transition-opacity hover:opacity-80"
              style={{
                backgroundColor: tomPorFracao(fracao),
                outline: ehHoje ? `1px solid ${VIZ.ramp[0]}` : undefined,
                outlineOffset: ehHoje ? "2px" : undefined,
              }}
            />
          );
        })}
      </div>
      <div className="flex justify-between font-mono text-[10px] text-muted-foreground">
        <span>{dias[0]?.data.slice(8)}</span>
        <span>{dias[dias.length - 1]?.data.slice(8)}</span>
      </div>
    </div>
  );
}
