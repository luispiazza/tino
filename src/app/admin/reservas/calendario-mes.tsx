"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/*
 * D3, visão padrão: mês. O chip responde "esse dia está livre?" mostrando
 * O ESTÚDIO de cada reserva — a informação que faltava na v1 para o
 * calendário servir de defesa contra reserva duplicada. Multi-dia aparece
 * em todos os dias do período.
 */

type ReservaDoMes = {
  id: number;
  codigo: string;
  status: "pendente" | "confirmada" | "cancelada";
  dataInicio: string;
  dataFim: string;
  horaInicio: string;
  horaFim: string;
  estudioIds: number[];
  clienteNome: string | null;
};

const MESES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];
const DIAS_SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;

export function CalendarioMes({
  reservas,
  codigoEstudio,
}: {
  reservas: ReservaDoMes[];
  codigoEstudio: (id: number) => string;
}) {
  const hoje = new Date();
  const [ancora, setAncora] = useState(
    () => new Date(hoje.getFullYear(), hoje.getMonth(), 1)
  );

  const primeiroDia = new Date(ancora.getFullYear(), ancora.getMonth(), 1);
  const inicioGrade = new Date(primeiroDia);
  inicioGrade.setDate(1 - primeiroDia.getDay());

  /* 6 semanas cobrem qualquer mês */
  const dias = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(inicioGrade);
    d.setDate(inicioGrade.getDate() + i);
    return d;
  });

  const ativas = reservas.filter((r) => r.status !== "cancelada");
  const doDia = (d: Date) => {
    const data = iso(d);
    return ativas.filter((r) => r.dataInicio <= data && r.dataFim >= data);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium">
          <span className="capitalize">{MESES[ancora.getMonth()]}</span> de{" "}
          {ancora.getFullYear()}
        </h2>
        <div className="flex gap-1">
          <Button
            variant="outline"
            size="sm"
            aria-label="Mês anterior"
            onClick={() =>
              setAncora(new Date(ancora.getFullYear(), ancora.getMonth() - 1, 1))
            }
          >
            ←
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setAncora(new Date(hoje.getFullYear(), hoje.getMonth(), 1))
            }
          >
            hoje
          </Button>
          <Button
            variant="outline"
            size="sm"
            aria-label="Próximo mês"
            onClick={() =>
              setAncora(new Date(ancora.getFullYear(), ancora.getMonth() + 1, 1))
            }
          >
            →
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <div className="min-w-[640px]">
          <div className="grid grid-cols-7 border-b bg-muted/30 text-center text-xs text-muted-foreground">
            {DIAS_SEMANA.map((d) => (
              <div key={d} className="py-1.5">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {dias.map((d) => {
              const foraDoMes = d.getMonth() !== ancora.getMonth();
              const ehHoje = iso(d) === iso(hoje);
              return (
                <div
                  key={iso(d)}
                  className={cn(
                    "min-h-20 border-t border-l p-1 first:border-l-0 [&:nth-child(7n+1)]:border-l-0",
                    foraDoMes && "bg-muted/20"
                  )}
                >
                  <span
                    className={cn(
                      "text-xs tabular-nums",
                      foraDoMes && "text-muted-foreground/50",
                      ehHoje &&
                        "font-semibold text-primary"
                    )}
                  >
                    {d.getDate()}
                  </span>
                  <div className="mt-0.5 flex flex-col gap-0.5">
                    {doDia(d).map((r) => (
                      <div
                        key={r.id}
                        title={`${r.codigo} · ${r.horaInicio.slice(0, 5)}–${r.horaFim.slice(0, 5)}${r.clienteNome ? ` · ${r.clienteNome}` : ""}`}
                        className={cn(
                          "truncate rounded px-1 py-0.5 text-[11px] leading-tight",
                          r.status === "confirmada"
                            ? "bg-ok/15 text-ok"
                            : "bg-attention/15 text-attention"
                        )}
                      >
                        <span className="font-mono font-medium">
                          {r.estudioIds.map(codigoEstudio).join("+")}
                        </span>
                        {r.clienteNome && ` ${r.clienteNome}`}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
