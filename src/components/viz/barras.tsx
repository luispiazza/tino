"use client";

import { cn } from "@/lib/utils";
import { VIZ } from "./tokens";

/*
 * Barras horizontais para comparar magnitude entre poucos itens — a
 * forma certa quando o rótulo é longo (nome de estúdio) e o número
 * pequeno. Uma hue: quem compara ocupação não precisa de identidade
 * por cor, precisa ver quem rodou mais.
 *
 * Rótulo direto em cada barra (nunca legenda separada para uma série).
 */
export function BarrasHorizontais({
  itens,
  formatarValor,
  larguraRotulo = "w-8",
}: {
  itens: { rotulo: string; sub?: string; valor: number; destaque?: boolean }[];
  formatarValor: (v: number) => string;
  /* código de estúdio cabe em w-8; nome de categoria precisa de mais */
  larguraRotulo?: string;
}) {
  const maior = Math.max(1, ...itens.map((i) => i.valor));

  return (
    <div className="flex flex-col gap-2.5">
      {itens.map((i) => (
        <div key={i.rotulo} className="flex items-center gap-3">
          <span
            className={cn(
              "shrink-0 truncate font-mono text-sm",
              larguraRotulo
            )}
            title={i.rotulo}
          >
            {i.rotulo}
          </span>
          <div className="relative h-6 min-w-0 flex-1">
            {/* trilho recessivo, para a barra vazia ainda ter chão */}
            <div
              className="absolute inset-0 rounded-[3px]"
              style={{ backgroundColor: VIZ.track }}
            />
            <div
              className="absolute inset-y-0 left-0 rounded-[3px] transition-[width] duration-500"
              style={{
                width: `${(i.valor / maior) * 100}%`,
                backgroundColor: i.destaque ? VIZ.ramp[0] : VIZ.ramp[1],
              }}
            />
          </div>
          {/* valor e proporção ficam FORA da barra: texto sobre creme
              claro não tem contraste que preste */}
          <span className="w-24 shrink-0 text-right font-mono text-sm tabular-nums">
            {formatarValor(i.valor)}
            {i.sub && (
              <span className="ml-1.5 text-xs text-muted-foreground">
                {i.sub}
              </span>
            )}
          </span>
        </div>
      ))}
    </div>
  );
}
