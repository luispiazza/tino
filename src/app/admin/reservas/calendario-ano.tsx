"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/*
 * D3, visão ano — ocupação e sazonalidade. Cada dia é uma célula cuja
 * intensidade (creme da marca) é a fração de estúdios ocupados; conversa
 * com o placar do Domínio 8 quando ele existir.
 */

type ReservaDoAno = {
  id: number;
  status: "pendente" | "confirmada" | "cancelada";
  dataInicio: string;
  dataFim: string;
  estudioIds: number[];
};

const MESES_CURTOS = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
];

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;

export function CalendarioAno({
  reservas,
  totalEstudios,
}: {
  reservas: ReservaDoAno[];
  totalEstudios: number;
}) {
  const hoje = new Date();
  const [ano, setAno] = useState(hoje.getFullYear());

  /* estúdios distintos ocupados por dia, no ano visível */
  const ocupacao = new Map<string, Set<number>>();
  for (const r of reservas) {
    if (r.status === "cancelada") continue;
    const fim = new Date(r.dataFim + "T00:00");
    for (
      let d = new Date(r.dataInicio + "T00:00");
      d <= fim;
      d.setDate(d.getDate() + 1)
    ) {
      if (d.getFullYear() !== ano) continue;
      const chave = iso(d);
      const set = ocupacao.get(chave) ?? new Set<number>();
      for (const id of r.estudioIds) set.add(id);
      ocupacao.set(chave, set);
    }
  }

  const diasOcupados = ocupacao.size;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium tabular-nums">
          {ano}
          <span className="ml-2 text-muted-foreground">
            {diasOcupados > 0
              ? `${diasOcupados} ${diasOcupados === 1 ? "dia" : "dias"} com reserva`
              : "sem reservas no ano"}
          </span>
        </h2>
        <div className="flex gap-1">
          <Button
            variant="outline"
            size="sm"
            aria-label="Ano anterior"
            onClick={() => setAno(ano - 1)}
          >
            ←
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAno(hoje.getFullYear())}
          >
            hoje
          </Button>
          <Button
            variant="outline"
            size="sm"
            aria-label="Próximo ano"
            onClick={() => setAno(ano + 1)}
          >
            →
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {MESES_CURTOS.map((nome, mes) => {
          const primeiro = new Date(ano, mes, 1);
          const totalDias = new Date(ano, mes + 1, 0).getDate();
          return (
            <div key={nome} className="rounded-lg border p-2">
              <div className="mb-1.5 text-xs font-medium text-muted-foreground">
                {nome}
              </div>
              <div className="grid grid-cols-7 gap-0.5">
                {Array.from({ length: primeiro.getDay() }, (_, i) => (
                  <div key={`v${i}`} />
                ))}
                {Array.from({ length: totalDias }, (_, i) => {
                  const d = new Date(ano, mes, i + 1);
                  const chave = iso(d);
                  const ocupados = ocupacao.get(chave)?.size ?? 0;
                  const fracao =
                    totalEstudios > 0 ? ocupados / totalEstudios : 0;
                  const ehHoje = chave === iso(hoje);
                  return (
                    <div
                      key={chave}
                      title={
                        ocupados > 0
                          ? `${chave.split("-").reverse().join("/")}: ${ocupados} de ${totalEstudios} estúdios`
                          : undefined
                      }
                      className={cn(
                        "aspect-square rounded-[2px]",
                        ehHoje && "ring-1 ring-primary"
                      )}
                      style={{
                        backgroundColor:
                          ocupados > 0
                            ? `color-mix(in oklch, var(--primary) ${Math.round(
                                25 + fracao * 75
                              )}%, transparent)`
                            : "color-mix(in oklch, var(--muted) 60%, transparent)",
                      }}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
