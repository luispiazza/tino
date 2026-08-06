"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";

const brl = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });

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

export function OcupacaoClient() {
  const hoje = new Date();
  const [ano, setAno] = useState(hoje.getFullYear());
  const [mes, setMes] = useState(hoje.getMonth() + 1);

  const prefixo = `${ano}-${String(mes).padStart(2, "0")}`;
  const ultimoDia = new Date(ano, mes, 0).getDate();
  const ocupacao = trpc.reservas.ocupacao.useQuery({
    inicio: `${prefixo}-01`,
    fim: `${prefixo}-${ultimoDia}`,
  });

  const dados = ocupacao.data;
  const maiorTaxa = Math.max(0.01, ...(dados?.estudios ?? []).map((e) => e.taxa));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">Ocupação</h1>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            aria-label="Mês anterior"
            onClick={() =>
              mes === 1 ? (setAno(ano - 1), setMes(12)) : setMes(mes - 1)
            }
          >
            ←
          </Button>
          <span className="min-w-36 text-center text-sm font-medium">
            <span className="capitalize">{MESES[mes - 1]}</span> de {ano}
          </span>
          <Button
            variant="outline"
            size="sm"
            aria-label="Próximo mês"
            onClick={() =>
              mes === 12 ? (setAno(ano + 1), setMes(1)) : setMes(mes + 1)
            }
          >
            →
          </Button>
        </div>
      </div>

      {dados && (
        <p className="text-sm text-muted-foreground">
          {dados.diasComShooting} de {dados.totalDias} dias do mês com alguma
          produção.
        </p>
      )}

      <div className="flex flex-col divide-y rounded-lg border">
        {(dados?.estudios ?? []).map((e) => (
          <div key={e.id} className="flex items-center gap-4 px-4 py-3">
            <span className="w-8 font-mono font-medium">{e.codigo}</span>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="truncate text-muted-foreground">
                  {e.nome}
                  {e.ehComplementar && " · complementar"}
                </span>
                <span className="tabular-nums">
                  {e.dias} {e.dias === 1 ? "dia" : "dias"} ·{" "}
                  {Math.round(e.taxa * 100)}%
                </span>
              </div>
              {/* barra relativa ao estúdio que mais rodou no mês */}
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${(e.taxa / maiorTaxa) * 100}%` }}
                />
              </div>
            </div>
            <span className="w-24 text-right text-sm tabular-nums">
              {brl(e.receitaCents)}
            </span>
          </div>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        A receita é rateada entre os estúdios da reserva — A+B divide o total
        em dois. Serve para comparar espaços, não como demonstrativo contábil.
      </p>
    </div>
  );
}
