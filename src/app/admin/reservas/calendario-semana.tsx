"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/*
 * D3, visão semana — operação: o que acontece nos próximos dias, com
 * estúdio e horário visíveis. (A virada entra aqui quando o Domínio 2
 * ligar a rotina à agenda.)
 */

type ReservaDaSemana = {
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

const DIAS_SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;

export function CalendarioSemana({
  reservas,
  codigoEstudio,
}: {
  reservas: ReservaDaSemana[];
  codigoEstudio: (id: number) => string;
}) {
  const hoje = new Date();
  const [ancora, setAncora] = useState(() => {
    const d = new Date(hoje);
    d.setDate(hoje.getDate() - hoje.getDay());
    return d;
  });

  const dias = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(ancora);
    d.setDate(ancora.getDate() + i);
    return d;
  });

  const ativas = reservas.filter((r) => r.status !== "cancelada");
  const doDia = (d: Date) => {
    const data = iso(d);
    return ativas
      .filter((r) => r.dataInicio <= data && r.dataFim >= data)
      .sort((a, b) => a.horaInicio.localeCompare(b.horaInicio));
  };

  const navegar = (dias: number) => {
    const d = new Date(ancora);
    d.setDate(ancora.getDate() + dias);
    setAncora(d);
  };

  const fimSemana = dias[6];
  const rotulo = `${dias[0].getDate()}/${dias[0].getMonth() + 1} – ${fimSemana.getDate()}/${fimSemana.getMonth() + 1}`;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium tabular-nums">{rotulo}</h2>
        <div className="flex gap-1">
          <Button
            variant="outline"
            size="sm"
            aria-label="Semana anterior"
            onClick={() => navegar(-7)}
          >
            ←
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const d = new Date(hoje);
              d.setDate(hoje.getDate() - hoje.getDay());
              setAncora(d);
            }}
          >
            hoje
          </Button>
          <Button
            variant="outline"
            size="sm"
            aria-label="Próxima semana"
            onClick={() => navegar(7)}
          >
            →
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <div className="grid min-w-[700px] grid-cols-7">
          {dias.map((d, i) => {
            const ehHoje = iso(d) === iso(hoje);
            const reservasDia = doDia(d);
            return (
              <div
                key={iso(d)}
                className={cn(
                  "flex min-h-40 flex-col border-l first:border-l-0",
                  ehHoje && "bg-primary/[0.03]"
                )}
              >
                <div
                  className={cn(
                    "border-b px-2 py-1.5 text-xs",
                    ehHoje
                      ? "font-semibold text-primary"
                      : "text-muted-foreground"
                  )}
                >
                  {DIAS_SEMANA[i]}{" "}
                  <span className="tabular-nums">{d.getDate()}</span>
                </div>
                <div className="flex flex-col gap-1 p-1.5">
                  {reservasDia.length === 0 && (
                    <span className="px-0.5 text-[11px] text-muted-foreground/50">
                      livre
                    </span>
                  )}
                  {reservasDia.map((r) => (
                    <div
                      key={r.id}
                      title={r.codigo}
                      className={cn(
                        "rounded px-1.5 py-1 text-[11px] leading-tight",
                        r.status === "confirmada"
                          ? "bg-[--ok]/15 text-[--ok]"
                          : "bg-[--attention]/15 text-[--attention]"
                      )}
                    >
                      <div className="font-mono font-medium">
                        {r.estudioIds.map(codigoEstudio).join("+")}{" "}
                        <span className="font-normal tabular-nums">
                          {r.horaInicio.slice(0, 5)}–{r.horaFim.slice(0, 5)}
                        </span>
                      </div>
                      {r.clienteNome && (
                        <div className="truncate">{r.clienteNome}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
