"use client";

import { trpc } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";

const brl = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });

/*
 * Domínio 9 — o funil por origem. O slug é a origem primária: quem
 * chega por /c/algo já entra medido, sem UTM. "Orgânico / direto" é
 * quem montou pela home. A reserva só entra na conta quando alguém
 * informou o código da montagem na criação — atribuição declarada,
 * nunca adivinhada.
 */
export function ResultadosClient() {
  const resultados = trpc.campanhas.resultados.useQuery();
  const linhas = resultados.data ?? [];
  const maiorMontagens = Math.max(1, ...linhas.map((l) => l.montagens));

  if (resultados.data && linhas.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        Ninguém montou um Tino ainda. Cada montagem na vitrine aparece aqui,
        com a origem de onde veio.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="border-b text-muted-foreground">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Origem</th>
              <th className="px-3 py-2 text-right font-medium">Montagens</th>
              <th className="px-3 py-2 text-right font-medium">Conversas</th>
              <th className="px-3 py-2 text-right font-medium">Reservas</th>
              <th className="px-4 py-2 text-right font-medium">Receita</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {linhas.map((l) => (
              <tr key={l.campanhaId ?? "organico"}>
                <td className="px-4 py-2.5">
                  <div className="flex flex-col">
                    <span>{l.nome}</span>
                    <span className="text-xs text-muted-foreground">
                      {l.slug ? `/c/${l.slug}` : "vitrine"}
                      {l.canal && ` · ${l.canal}`}
                    </span>
                  </div>
                  {/* barra relativa à origem que mais trouxe montagens */}
                  <div className="mt-1.5 h-1 w-32 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{
                        width: `${(l.montagens / maiorMontagens) * 100}%`,
                      }}
                    />
                  </div>
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums">
                  {l.montagens}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums">
                  {l.conversas}
                </td>
                <td
                  className={cn(
                    "px-3 py-2.5 text-right tabular-nums",
                    l.reservas > 0 && "text-ok"
                  )}
                >
                  {l.reservas}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {l.receitaCents > 0 ? brl(l.receitaCents) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        A reserva entra na conta quando o código da montagem (M-XXXX) é
        informado ao criar a reserva. Sem código, a origem fica desconhecida —
        o sistema não chuta.
      </p>
    </div>
  );
}
