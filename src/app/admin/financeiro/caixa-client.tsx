"use client";

import { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const brl = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataBr = (iso: string) => iso.split("-").reverse().join("/");
const paraCents = (reais: string) =>
  Math.round(Number(reais.replace(",", ".")) * 100);
const MESES = [
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
const rotuloMes = (iso: string) => {
  const [ano, mes] = iso.split("-");
  return `${MESES[Number(mes) - 1]}/${ano.slice(2)}`;
};

/*
 * O caixa: quanto tem hoje e o que vem pela frente. Sem o saldo da
 * virada informado, a tela não finge — pede o número antes de mostrar
 * qualquer saldo.
 */
export function CaixaClient() {
  const utils = trpc.useUtils();
  const caixa = trpc.financeiro.fluxoDeCaixa.useQuery({ meses: 3 });
  const [aberto, setAberto] = useState(false);
  const [saldo, setSaldo] = useState("");
  const [data, setData] = useState("");

  const definir = trpc.financeiro.definirSaldoInicial.useMutation({
    onSuccess: () => {
      utils.financeiro.fluxoDeCaixa.invalidate();
      utils.financeiro.obterConfig.invalidate();
      setAberto(false);
      toast.success("Saldo da virada registrado");
    },
    onError: (e) => toast.error(e.message),
  });

  const d = caixa.data;

  const dialogo = (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger
        render={
          <Button
            variant={d?.configurado ? "outline" : "default"}
            size="sm"
            onClick={() => {
              setSaldo(
                d?.configurado ? String((d.saldoInicial ?? 0) / 100) : ""
              );
              setData(d?.dataVirada ?? d?.hoje ?? "");
            }}
          />
        }
      >
        {d?.configurado ? "Corrigir saldo da virada" : "Informar saldo em conta"}
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Saldo em conta na virada</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            O que havia em conta no dia em que o sistema passou a valer. Sem
            ele o caixa parte do zero e mostra um saldo que não existe.
          </p>
          <div className="grid gap-2">
            <Label htmlFor="cdata">Data da virada</Label>
            <Input
              id="cdata"
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="csaldo">Saldo (R$)</Label>
            <Input
              id="csaldo"
              type="number"
              step="0.01"
              value={saldo}
              onChange={(e) => setSaldo(e.target.value)}
            />
          </div>
          <Button
            disabled={!data || saldo === "" || definir.isPending}
            onClick={() =>
              definir.mutate({
                dataVirada: data,
                saldoInicialCents: paraCents(saldo),
              })
            }
          >
            Salvar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );

  if (d && !d.configurado) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed p-8 text-center">
        <p className="max-w-md text-sm text-muted-foreground">
          O caixa começa quando você informar quanto havia em conta no dia da
          virada. É o único número que o sistema não tem como deduzir.
        </p>
        {dialogo}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">em conta hoje</p>
          <p
            className={cn(
              "text-3xl font-semibold tabular-nums",
              (d?.saldoHoje ?? 0) < 0 && "text-overdue"
            )}
          >
            {d ? brl(d.saldoHoje) : "—"}
          </p>
          {d?.dataVirada && (
            <p className="mt-1 text-xs text-muted-foreground">
              saldo de {dataBr(d.dataVirada)} ({brl(d.saldoInicial)}) +{" "}
              {brl(d.recebido)} recebidos − {brl(d.pago)} pagos
            </p>
          )}
        </div>
        {dialogo}
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/30 text-muted-foreground">
            <tr>
              <th className="px-4 py-2 text-left font-medium">mês</th>
              <th className="px-4 py-2 text-right font-medium">entra</th>
              <th className="px-4 py-2 text-right font-medium">sai</th>
              <th className="px-4 py-2 text-right font-medium">saldo no fim</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {(d?.projecao ?? []).map((m) => (
              <tr key={m.mes}>
                <td className="px-4 py-2">
                  {rotuloMes(m.mes)}
                  {m.semValor > 0 && (
                    <span className="ml-2 text-xs text-attention">
                      {m.semValor} conta{m.semValor > 1 ? "s" : ""} sem valor
                    </span>
                  )}
                </td>
                <td className="px-4 py-2 text-right tabular-nums text-ok">
                  {m.entradas > 0 ? brl(m.entradas) : "—"}
                </td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {m.saidas > 0 ? brl(m.saidas) : "—"}
                </td>
                <td
                  className={cn(
                    "px-4 py-2 text-right font-medium tabular-nums",
                    m.saldoFinal < 0 && "text-overdue"
                  )}
                >
                  {brl(m.saldoFinal)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        Projeção pelo que já está agendado: cobranças com previsão de
        recebimento e contas com vencimento. Conta sem valor entra como zero —
        o mês fica otimista até a conta chegar.
      </p>
    </div>
  );
}
