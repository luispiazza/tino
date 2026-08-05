"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";

const brl = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/*
 * Os extras chegam em ondas durante o dia. Cada pedido empilha na
 * comanda; o preço é o do catálogo, resolvido no servidor.
 */
export function ExtrasClient({ token }: { token: string }) {
  const router = useRouter();
  const utils = trpc.useUtils();
  const catalogo = trpc.portais.catalogoExtras.useQuery({ token });
  const [carrinho, setCarrinho] = useState<Record<number, number>>({});

  const pedir = trpc.portais.pedirExtras.useMutation({
    onSuccess: () => {
      setCarrinho({});
      /* o estoque mudou para todo mundo, e a comanda também */
      utils.portais.catalogoExtras.invalidate();
      router.refresh();
      toast.success("Pedido enviado ao estúdio");
    },
    onError: (e) => toast.error(e.message),
  });

  const itens = catalogo.data ?? [];
  const escolhidos = Object.entries(carrinho).filter(([, q]) => q > 0);
  const total = escolhidos.reduce((s, [id, q]) => {
    const item = itens.find((i) => i.id === Number(id));
    return s + (item?.precoCents ?? 0) * q;
  }, 0);

  if (catalogo.data && itens.length === 0) return null;

  return (
    <div className="flex flex-col gap-3 rounded-lg border p-4">
      <h2 className="text-sm font-medium">Precisa de mais alguma coisa?</h2>
      <div className="flex flex-col divide-y">
        {itens.map((i) => {
          const qtd = carrinho[i.id] ?? 0;
          const esgotado = i.disponivel !== null && i.disponivel <= 0;
          const noLimite = i.disponivel !== null && qtd >= i.disponivel;
          return (
            <div key={i.id} className="flex items-center gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{i.nome}</p>
                <p className="text-xs text-muted-foreground">
                  {brl(i.precoCents)} · {i.unidade}
                  {esgotado && " · indisponível nesta data"}
                  {!esgotado &&
                    i.disponivel !== null &&
                    ` · ${i.disponivel} disponíveis`}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  aria-label={`Menos ${i.nome}`}
                  disabled={qtd === 0}
                  onClick={() =>
                    setCarrinho({ ...carrinho, [i.id]: Math.max(0, qtd - 1) })
                  }
                >
                  −
                </Button>
                <span className="w-6 text-center text-sm tabular-nums">
                  {qtd}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label={`Mais ${i.nome}`}
                  disabled={esgotado || noLimite}
                  onClick={() => setCarrinho({ ...carrinho, [i.id]: qtd + 1 })}
                >
                  +
                </Button>
              </div>
            </div>
          );
        })}
      </div>
      {escolhidos.length > 0 && (
        <Button
          size="lg"
          className="min-h-12"
          disabled={pedir.isPending}
          onClick={() =>
            pedir.mutate({
              token,
              itens: escolhidos.map(([id, qtd]) => ({
                itemId: Number(id),
                qtd,
              })),
            })
          }
        >
          {pedir.isPending ? "Enviando…" : `Pedir · ${brl(total)}`}
        </Button>
      )}
    </div>
  );
}
