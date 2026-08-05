"use client";

import Link from "next/link";
import { trpc } from "@/lib/trpc/client";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const brl = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataBr = (iso: string) => iso.split("-").reverse().join("/");

/*
 * Domínio 8: a Home deixa de ser menu e vira painel de vigilância.
 * Bloco 1 "Precisa de você" · Bloco 2 "Hoje e amanhã" · Bloco 3 "O mês".
 * Tendência entra quando houver meses de história para comparar.
 */
export function PainelClient() {
  const obrigacoes = trpc.financeiro.agendaDeObrigacoes.useQuery();
  const reservas = trpc.reservas.listar.useQuery();
  const agenda = trpc.reservas.agendaDoDia.useQuery();
  const estudios = trpc.estudios.listar.useQuery();

  const porId = new Map((estudios.data ?? []).map((e) => [e.id, e.codigo]));
  const codigo = (id: number) => porId.get(id) ?? String(id);

  const atrasadas = (obrigacoes.data?.itens ?? []).filter((i) => i.atrasada);
  const naoEnviadas = (reservas.data ?? []).filter(
    (r) => r.status !== "cancelada" && !r.whatsappEnviadoEm
  );
  const pendentes = (reservas.data ?? []).filter(
    (r) => r.status === "pendente"
  );
  const precisaDeVoce = atrasadas.length + naoEnviadas.length;

  const mesAtual = (obrigacoes.data?.hoje ?? "").slice(0, 7);
  const aReceber = (obrigacoes.data?.itens ?? [])
    .filter((i) => i.tipo === "receber")
    .reduce((s, i) => s + (i.valorCents ?? 0), 0);
  const aPagar = (obrigacoes.data?.itens ?? [])
    .filter((i) => i.tipo === "pagar")
    .reduce((s, i) => s + (i.valorCents ?? 0), 0);
  const diasOcupadosNoMes = new Set(
    (reservas.data ?? [])
      .filter(
        (r) => r.status !== "cancelada" && r.dataInicio.startsWith(mesAtual)
      )
      .map((r) => r.dataInicio)
  ).size;

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {/* Bloco 1 — Precisa de você */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Precisa de você
            {precisaDeVoce > 0 && (
              <Badge className="ml-2 bg-[--attention]/15 text-[--attention]">
                {precisaDeVoce}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          {obrigacoes.data && reservas.data && precisaDeVoce === 0 && (
            <p className="text-muted-foreground">Tudo em dia.</p>
          )}
          {atrasadas.slice(0, 3).map((i) => (
            <Link
              key={`${i.tipo}-${i.id}`}
              href="/admin/financeiro"
              className="flex items-baseline justify-between gap-2 hover:underline"
            >
              <span className="truncate">
                <span className="text-[--overdue]">atrasada</span> · {i.descricao}
              </span>
              <span className="shrink-0 tabular-nums text-muted-foreground">
                {dataBr(i.data)}
              </span>
            </Link>
          ))}
          {naoEnviadas.slice(0, 3).map((r) => (
            <Link
              key={r.id}
              href="/admin/reservas"
              className="flex items-baseline justify-between gap-2 hover:underline"
            >
              <span className="truncate">
                <span className="font-mono">{r.codigo}</span> não enviada ao
                cliente
              </span>
              <span className="shrink-0 tabular-nums text-muted-foreground">
                {dataBr(r.dataInicio)}
              </span>
            </Link>
          ))}
        </CardContent>
      </Card>

      {/* Bloco 2 — Hoje e amanhã */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Hoje e amanhã</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          {agenda.data && agenda.data.hoje.length === 0 && (
            <p className="text-muted-foreground">Sem shooting hoje.</p>
          )}
          {(agenda.data?.hoje ?? []).map((r) => (
            <div key={r.id} className="flex items-center gap-2">
              <span className="font-mono tabular-nums text-muted-foreground">
                {r.horaInicio.slice(0, 5)}
              </span>
              <span className="font-mono font-medium">
                {r.estudioIds.map(codigo).join("+")}
              </span>
              <span className="truncate text-muted-foreground">
                {r.clienteNome ?? r.codigo}
              </span>
            </div>
          ))}
          <p className="mt-1 text-xs text-muted-foreground">
            {agenda.data
              ? agenda.data.amanha.length > 0
                ? `Amanhã: shooting em ${[
                    ...new Set(
                      agenda.data.amanha.flatMap((r) =>
                        r.estudioIds.map(codigo)
                      )
                    ),
                  ].join(", ")} — virada hoje.`
                : "Amanhã livre."
              : ""}
          </p>
        </CardContent>
      </Card>

      {/* Bloco 3 — O mês */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">O mês</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          <div className="flex items-baseline justify-between">
            <span className="text-muted-foreground">a receber</span>
            <span className="tabular-nums text-[--ok]">{brl(aReceber)}</span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-muted-foreground">a pagar</span>
            <span className="tabular-nums">{brl(aPagar)}</span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-muted-foreground">dias com shooting</span>
            <span className="tabular-nums">{diasOcupadosNoMes}</span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-muted-foreground">reservas pendentes</span>
            <span className="tabular-nums">{pendentes.length}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
