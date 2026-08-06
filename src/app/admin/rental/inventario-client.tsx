"use client";

import { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const dataBr = (iso: string) => iso.split("-").reverse().join("/");

/*
 * A contagem acontece em pé, no meio do serviço: campo grande, sem
 * confirmação, salvando a cada item. Sem multa — o que a contagem
 * responde é o que repor, não quem culpar.
 */
/*
 * Campo controlado, sincronizado com o servidor: se outra pessoa contar
 * o mesmo item, o número aparece aqui sem recarregar — e o React não
 * reclama de default mudando em campo não-controlado.
 */
function LinhaContagem({
  item,
  salvando,
  aoContar,
}: {
  item: {
    id: number;
    nomeItem: string;
    qtdEsperada: number;
    qtdContada: number | null;
  };
  salvando: boolean;
  aoContar: (qtd: number) => void;
}) {
  const [valor, setValor] = useState(
    item.qtdContada === null ? "" : String(item.qtdContada)
  );
  const [editando, setEditando] = useState(false);
  /* enquanto o campo não está em edição, o servidor manda */
  const doServidor = item.qtdContada === null ? "" : String(item.qtdContada);
  const exibido = editando ? valor : doServidor;
  const diferenca =
    item.qtdContada === null ? null : item.qtdContada - item.qtdEsperada;

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm">{item.nomeItem}</p>
        <p className="text-xs text-muted-foreground">
          esperado: {item.qtdEsperada}
        </p>
      </div>
      {diferenca !== null && diferenca !== 0 && (
        <Badge
          className={cn(
            diferenca < 0
              ? "bg-[--overdue]/15 text-[--overdue]"
              : "bg-[--ok]/15 text-[--ok]"
          )}
        >
          {diferenca > 0 ? `+${diferenca}` : diferenca}
        </Badge>
      )}
      <Input
        type="number"
        min={0}
        inputMode="numeric"
        disabled={salvando}
        aria-label={`Contagem de ${item.nomeItem}`}
        className="h-11 w-20 text-center text-base"
        value={exibido}
        onFocus={() => {
          setValor(doServidor);
          setEditando(true);
        }}
        onChange={(e) => setValor(e.target.value)}
        onBlur={() => {
          setEditando(false);
          if (valor === "" || Number(valor) === item.qtdContada) return;
          aoContar(Number(valor));
        }}
      />
    </div>
  );
}

export function InventarioClient() {
  const utils = trpc.useUtils();
  const aberto = trpc.rental.inventarioAberto.useQuery();
  const historico = trpc.rental.historicoInventarios.useQuery();

  const invalidar = () => {
    utils.rental.inventarioAberto.invalidate();
    utils.rental.historicoInventarios.invalidate();
  };
  const abrir = trpc.rental.abrirInventario.useMutation({
    onSuccess: invalidar,
    onError: (e) => toast.error(e.message),
  });
  const contar = trpc.rental.contar.useMutation({
    onSuccess: () => utils.rental.inventarioAberto.invalidate(),
    onError: (e) => toast.error(e.message),
  });
  const fechar = trpc.rental.fecharInventario.useMutation({
    onSuccess: (r) => {
      invalidar();
      toast.success(
        r.faltantes.length === 0
          ? "Contagem fechada — nada faltando"
          : `Contagem fechada — falta ${r.faltantes
              .map((f) => `${f.falta} ${f.item.toLowerCase()}`)
              .join(", ")}`
      );
    },
    onError: (e) => toast.error(e.message),
  });

  const inv = aberto.data;
  const faltamContar = inv?.itens.filter((i) => i.qtdContada === null).length ?? 0;

  return (
    <div className="flex flex-col gap-6">
      {!inv ? (
        <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed p-8">
          <p className="text-sm text-muted-foreground">
            Nenhuma contagem aberta. A contagem é semanal e não gera multa —
            serve para saber o que repor.
          </p>
          <Button onClick={() => abrir.mutate({})} disabled={abrir.isPending}>
            {abrir.isPending ? "Abrindo…" : "Abrir contagem"}
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-medium">
              Contagem de {dataBr(inv.data)}
              <span className="ml-2 text-muted-foreground">
                {faltamContar > 0
                  ? `${faltamContar} item(ns) por contar`
                  : "tudo contado"}
              </span>
            </h2>
            <Button
              size="sm"
              variant={faltamContar > 0 ? "outline" : "default"}
              disabled={fechar.isPending}
              onClick={() => fechar.mutate({ id: inv.id })}
            >
              Fechar contagem
            </Button>
          </div>

          <div className="flex flex-col divide-y rounded-lg border">
            {inv.itens.map((i) => (
              <LinhaContagem
                key={i.id}
                item={i}
                salvando={contar.isPending}
                aoContar={(qtdContada) =>
                  contar.mutate({ inventarioItemId: i.id, qtdContada })
                }
              />
            ))}
          </div>
        </div>
      )}

      {(historico.data ?? []).length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-muted-foreground">
            Contagens anteriores
          </h2>
          <div className="flex flex-col divide-y rounded-lg border text-sm">
            {(historico.data ?? []).map((h) => (
              <div key={h.id} className="flex items-center gap-3 px-4 py-2.5">
                <span className="tabular-nums">{dataBr(h.data)}</span>
                <span className="text-muted-foreground">
                  {h.contados}/{h.total} itens
                </span>
                <span className="ml-auto">
                  {h.faltando > 0 ? (
                    <span className="text-[--overdue]">
                      {h.faltando} faltando
                    </span>
                  ) : (
                    <span className="text-[--ok]">completo</span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
