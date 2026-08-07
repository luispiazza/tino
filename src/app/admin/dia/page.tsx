"use client";

import { trpc } from "@/lib/trpc/client";
import { Badge } from "@/components/ui/badge";
import { Cabecalho, Vazio } from "@/components/viz/secao";
import { Pagina } from "../pagina";

/*
 * A tela do dia — a mesma para funcionário, sócio ou parceiro.
 * Em cima, a agenda: shootings de hoje (lidos de reservas, a fonte
 * única) e o aviso de amanhã, que decide a virada. Embaixo, a timeline
 * de tarefas — o gerador chega na Fase 4; a estrutura já está aqui.
 * Sem valores nem tokens: é a visão do papel funcionário.
 */
export default function TelaDoDia() {
  const agenda = trpc.reservas.agendaDoDia.useQuery();
  const estudios = trpc.estudios.listar.useQuery();
  const { data: tarefas, isLoading } = trpc.escala.timelineDoDia.useQuery({});

  /*
   * Marcar como feita precisa recarregar a lista: sem isso o Michael
   * toca em "Feito", nada muda na tela e ele toca de novo.
   */
  const utils = trpc.useUtils();
  const concluir = trpc.escala.concluirTarefa.useMutation({
    onSuccess: () => utils.escala.timelineDoDia.invalidate(),
  });

  const porId = new Map((estudios.data ?? []).map((e) => [e.id, e.codigo]));
  const codigo = (id: number) => porId.get(id) ?? String(id);
  const hoje = agenda.data?.hoje ?? [];
  const amanha = agenda.data?.amanha ?? [];
  const pendentes = (tarefas ?? []).filter((t) => t.estado === "pendente").length;

  const dataHoje = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "long",
    day: "2-digit",
    month: "long",
  }).format(new Date());

  return (
    <Pagina>
      <Cabecalho
        titulo="Hoje"
        resumo={
          <span className="first-letter:uppercase">
            {dataHoje}
            {hoje.length > 0 &&
              ` · ${hoje.length} ${hoje.length === 1 ? "shooting" : "shootings"}`}
          </span>
        }
      />

      {/* Shootings de hoje */}
      <section className="flex flex-col gap-2">
        {agenda.isLoading && (
          <p className="text-sm text-muted-foreground">Carregando agenda…</p>
        )}
        {agenda.data && hoje.length === 0 && (
          <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
            Sem shooting hoje.
          </p>
        )}
        {hoje.map((r) => (
          <div
            key={r.id}
            className="flex min-h-14 items-center gap-4 rounded-lg border p-3"
          >
            <span className="w-24 shrink-0 font-mono text-sm tabular-nums">
              {r.horaInicio.slice(0, 5)}–{r.horaFim.slice(0, 5)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate">
                <span className="font-mono font-medium">
                  {r.estudioIds.map(codigo).join("+")}
                </span>
                <span className="ml-2 text-muted-foreground">
                  {r.clienteNome ?? r.codigo}
                </span>
              </p>
            </div>
            {r.status === "pendente" && (
              <Badge className="bg-attention/15 text-attention">
                pendente
              </Badge>
            )}
          </div>
        ))}

        {/* Amanhã decide a virada: com shooting, o estúdio dorme pronto */}
        {agenda.data && (
          <p className="mt-1 text-sm text-muted-foreground">
            {amanha.length > 0 ? (
              <>
                Amanhã tem shooting (
                <span className="font-mono">
                  {[
                    ...new Set(
                      amanha.flatMap((r) => r.estudioIds.map(codigo))
                    ),
                  ].join(", ")}
                </span>
                ) — o estúdio precisa dormir pronto.
              </>
            ) : (
              "Amanhã não tem shooting."
            )}
          </p>
        )}
      </section>

      {/* Timeline de tarefas — o gerador determinístico chega na Fase 4 */}
      <div className="mt-4 flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-medium">Tarefas do dia</h2>
        {pendentes > 0 && (
          <span className="font-mono text-sm tabular-nums text-muted-foreground">
            {pendentes} {pendentes === 1 ? "pendente" : "pendentes"}
          </span>
        )}
      </div>
      {isLoading && (
        <p className="mt-2 text-sm text-muted-foreground">Carregando…</p>
      )}
      {tarefas?.length === 0 && <Vazio>Nada gerado para hoje.</Vazio>}
      <ol className="mt-3 border-l">
        {tarefas?.map((t) => (
          <li key={t.id} className="relative mb-2 pl-6">
            <span className="absolute top-5 -left-[5px] h-2.5 w-2.5 rounded-full bg-border" />
            <div className="flex min-h-14 items-center gap-4 rounded-lg border p-3">
              <span className="w-14 shrink-0 font-mono text-sm text-muted-foreground">
                {t.horaPrevista?.slice(0, 5) ?? "—"}
              </span>
              <div className="min-w-0 flex-1">
                <p
                  className={
                    t.estado === "feita" ? "line-through opacity-60" : ""
                  }
                >
                  {t.titulo}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t.estudioId ? `Estúdio ${codigo(t.estudioId)}` : "Geral"}
                  {t.ehArrasto && (
                    <span className="ml-2 text-attention">
                      pendente desde {t.dataOriginal}
                    </span>
                  )}
                </p>
              </div>
              {t.estado === "pendente" && (
                /* alvo largo e resposta imediata: a mão que toca isso às
                   06:00 costuma estar ocupada, e tocar duas vezes por
                   falta de retorno é o erro que a tela precisa evitar */
                <button
                  onClick={() => concluir.mutate({ tarefaId: t.id })}
                  disabled={concluir.isPending}
                  className="min-h-11 shrink-0 rounded-lg border px-5 text-sm font-medium transition-colors hover:bg-accent disabled:opacity-50"
                >
                  {concluir.isPending && concluir.variables?.tarefaId === t.id
                    ? "…"
                    : "Feito"}
                </button>
              )}
            </div>
          </li>
        ))}
      </ol>
    </Pagina>
  );
}
