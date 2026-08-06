"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { BarrasHorizontais } from "@/components/viz/barras";
import { TiraDoMes } from "@/components/viz/tira-do-mes";

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
        <section className="rounded-xl border bg-card p-5">
          <p className="mb-1 font-mono text-3xl leading-none tabular-nums">
            {dados.diasComShooting}
            <span className="text-muted-foreground">/{dados.totalDias}</span>
          </p>
          <p className="mb-4 text-sm text-muted-foreground">
            dias com produção no mês
          </p>
          <TiraDoMes
            dias={dados.dias}
            totalEstudios={dados.estudios.length}
          />
        </section>
      )}

      <section className="rounded-xl border bg-card p-5">
        <h2 className="mb-4 text-sm font-medium">Dias por estúdio</h2>
        <BarrasHorizontais
          itens={[...(dados?.estudios ?? [])]
            .sort((a, b) => b.dias - a.dias)
            .map((e, i) => ({
              rotulo: e.codigo,
              sub: `${Math.round(e.taxa * 100)}%`,
              valor: e.dias,
              destaque: i === 0 && e.dias > 0,
            }))}
          formatarValor={(v) => `${v} ${v === 1 ? "dia" : "dias"}`}
        />
      </section>

      <section className="rounded-xl border bg-card p-5">
        <h2 className="mb-4 text-sm font-medium">Receita atribuída</h2>
        <BarrasHorizontais
          itens={[...(dados?.estudios ?? [])]
            .sort((a, b) => b.receitaCents - a.receitaCents)
            .map((e, i) => ({
              rotulo: e.codigo,
              valor: e.receitaCents,
              destaque: i === 0 && e.receitaCents > 0,
            }))}
          formatarValor={brl}
        />
      </section>

      <p className="text-xs text-muted-foreground">
        A receita é rateada entre os estúdios da reserva — A+B divide o total
        em dois. Serve para comparar espaços, não como demonstrativo contábil.
      </p>
    </div>
  );
}
