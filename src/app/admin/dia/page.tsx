"use client";

import { trpc } from "@/lib/trpc/client";

/*
 * A timeline do dia — a mesma tela para funcionário, sócio ou parceiro.
 * Ordem cronológica, tarefa presa ao estúdio, "feito" com alvo ≥ 44px
 * (celular às 06:00, mãos ocupadas). Quem faz se decide na hora.
 */
export default function TimelineDoDia() {
  const { data: tarefas, isLoading } = trpc.escala.timelineDoDia.useQuery({});
  const concluir = trpc.escala.concluirTarefa.useMutation();

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="text-xl font-semibold">Hoje</h1>

      {isLoading && <p className="mt-4 text-[--muted]">Carregando…</p>}
      {tarefas?.length === 0 && (
        <p className="mt-4 text-[--muted]">Nada gerado para hoje.</p>
      )}

      <ol className="mt-6 border-l border-[--border]">
        {tarefas?.map((t) => (
          <li key={t.id} className="relative mb-2 pl-6">
            <span className="absolute -left-[5px] top-5 h-2.5 w-2.5 rounded-full bg-[--border]" />
            <div className="flex min-h-14 items-center gap-4 rounded-lg border border-[--border] p-3">
              <span className="w-14 shrink-0 font-mono text-sm text-[--muted]">
                {t.horaPrevista?.slice(0, 5) ?? "—"}
              </span>
              <div className="min-w-0 flex-1">
                <p className={t.estado === "feita" ? "line-through opacity-60" : ""}>
                  {t.titulo}
                </p>
                <p className="text-xs text-[--muted]">
                  {t.estudioId ? `Estúdio ${t.estudioId}` : "Geral"}
                  {t.ehArrasto && (
                    <span className="ml-2 text-[--attention]">
                      pendente desde {t.dataOriginal}
                    </span>
                  )}
                </p>
              </div>
              {t.estado === "pendente" && (
                <button
                  onClick={() => concluir.mutate({ tarefaId: t.id })}
                  className="min-h-11 min-w-11 shrink-0 rounded-lg border border-[--border] px-4 text-sm"
                >
                  Feito
                </button>
              )}
            </div>
          </li>
        ))}
      </ol>
    </main>
  );
}
