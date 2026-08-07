"use client";

import { trpc } from "@/lib/trpc/client";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const brl = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataBr = (iso: string) => iso.split("-").reverse().join("/");

/*
 * O painel de vigilância: uma lista só, por data. Vermelho = atrasada,
 * seta pra dentro = a receber, pra fora = a pagar. Sem gráfico — a
 * pergunta é "o que vence e quando", e lista responde melhor.
 */
export function ObrigacoesClient() {
  const agenda = trpc.financeiro.agendaDeObrigacoes.useQuery();
  const itens = agenda.data?.itens ?? [];

  if (agenda.data && itens.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        Nada agendado. Cobranças com previsão e despesas com vencimento
        aparecem aqui, na ordem em que vencem.
      </p>
    );
  }

  return (
    <div className="flex flex-col divide-y rounded-lg border">
      {itens.map((i) => (
        <div
          key={`${i.tipo}-${i.id}`}
          className="flex items-center gap-3 px-4 py-2.5 text-sm"
        >
          <span
            className={cn(
              "w-20 shrink-0 tabular-nums",
              i.atrasada ? "font-medium text-overdue" : "text-muted-foreground"
            )}
          >
            {dataBr(i.data)}
          </span>
          <span
            className={cn(
              "shrink-0 font-mono text-xs",
              i.tipo === "receber" ? "text-ok" : "text-muted-foreground"
            )}
          >
            {i.tipo === "receber" ? "→ receber" : "← pagar"}
          </span>
          <span className="min-w-0 flex-1 truncate">{i.descricao}</span>
          {i.atrasada && (
            <Badge className="bg-overdue/15 text-overdue">
              atrasada
            </Badge>
          )}
          <span className="shrink-0 text-right tabular-nums">
            {i.valorCents !== null ? (
              brl(i.valorCents)
            ) : (
              <span className="text-muted-foreground">sem valor</span>
            )}
          </span>
        </div>
      ))}
    </div>
  );
}
