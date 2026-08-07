"use client";

import Link from "next/link";
import { trpc } from "@/lib/trpc/client";
import { TiraDoMes } from "@/components/viz/tira-do-mes";
import { BarrasHorizontais } from "@/components/viz/barras";
import { LinhaSaldo } from "@/components/viz/linha-saldo";
import { VIZ } from "@/components/viz/tokens";
import { Cabecalho, Numero } from "@/components/viz/secao";
import { cn } from "@/lib/utils";

const brl = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
const dataBr = (iso: string) => iso.split("-").reverse().join("/");
const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

/*
 * Domínio 8 — a home dos sócios é painel de vigilância, não menu.
 *
 * A leitura tem uma ordem: o mês inteiro numa tira (o negócio é vender
 * dia de estúdio), depois os números que resumem, depois o que precisa
 * de decisão hoje. Números em mono — a ficha técnica é o ativo do Tino,
 * e a cara do painel acompanha.
 */
export function PainelClient() {
  const obrigacoes = trpc.financeiro.agendaDeObrigacoes.useQuery();
  const reservas = trpc.reservas.listar.useQuery();
  const agenda = trpc.reservas.agendaDoDia.useQuery();
  const estudios = trpc.estudios.listar.useQuery();
  const caixa = trpc.financeiro.fluxoDeCaixa.useQuery({ meses: 3 });

  const hoje = obrigacoes.data?.hoje ?? "";
  const mesAtual = hoje.slice(0, 7);
  const [ano, mes] = mesAtual ? mesAtual.split("-").map(Number) : [0, 0];
  const ultimoDia = ano ? new Date(ano, mes, 0).getDate() : 30;
  const ocupacao = trpc.reservas.ocupacao.useQuery(
    { inicio: `${mesAtual}-01`, fim: `${mesAtual}-${ultimoDia}` },
    { enabled: Boolean(mesAtual) }
  );

  const porId = new Map((estudios.data ?? []).map((e) => [e.id, e.codigo]));
  const codigo = (id: number) => porId.get(id) ?? String(id);

  const atrasadas = (obrigacoes.data?.itens ?? []).filter((i) => i.atrasada);
  const naoEnviadas = (reservas.data ?? []).filter(
    (r) => r.status !== "cancelada" && !r.whatsappEnviadoEm
  );
  const pendentes = (reservas.data ?? []).filter((r) => r.status === "pendente");
  const precisaDeVoce = atrasadas.length + naoEnviadas.length + pendentes.length;

  /* mesma definição do Financeiro: total em aberto, atrasado incluído —
   * a palavra tem que somar o mesmo valor nas duas telas */
  const soma = (tipo: "receber" | "pagar", apenasAtrasadas = false) =>
    (obrigacoes.data?.itens ?? [])
      .filter((i) => i.tipo === tipo && (!apenasAtrasadas || i.atrasada))
      .reduce((s, i) => s + (i.valorCents ?? 0), 0);
  const aReceber = soma("receber");
  const aPagar = soma("pagar");
  const pagarAtrasado = soma("pagar", true);

  const dias = ocupacao.data?.dias ?? [];
  const diasVendidos = dias.filter((d) => d.estudios > 0).length;
  const taxaMes = dias.length > 0 ? diasVendidos / dias.length : 0;

  return (
    <div className="flex flex-col gap-5">
      <Cabecalho
        titulo="Painel"
        resumo={
          precisaDeVoce > 0
            ? `${precisaDeVoce} ${precisaDeVoce === 1 ? "item pede" : "itens pedem"} decisão hoje`
            : "Nada pedindo decisão hoje"
        }
      />

      {/* A tira do mês — a folha de contato do negócio */}
      <section className="rounded-xl border bg-card p-5">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] tracking-[0.2em] text-muted-foreground uppercase">
              <span className="capitalize">{MESES[mes - 1] ?? ""}</span> {ano || ""}
            </p>
            <p className="mt-1 font-mono text-4xl leading-none tabular-nums sm:text-5xl">
              {diasVendidos}
              <span className="text-muted-foreground">/{dias.length || "—"}</span>
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              dias com produção · {Math.round(taxaMes * 100)}% do mês
            </p>
          </div>
          {/* grade em vez de fila: no celular três números lado a lado
              espremem o valor até ele quebrar em duas linhas */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:flex sm:gap-6">
            <Numero
              rotulo="a receber"
              valor={brl(aReceber)}
              /* verde só quando há o que receber — zero em verde mente */
              cor={aReceber > 0 ? VIZ.status.ok : undefined}
            />
            <Numero
              rotulo="a pagar"
              valor={brl(aPagar)}
              detalhe={
                pagarAtrasado > 0 ? `${brl(pagarAtrasado)} atrasado` : undefined
              }
            />
            {caixa.data?.configurado && (
              <Numero
                rotulo="em caixa"
                valor={brl(caixa.data.saldoHoje)}
                cor={
                  caixa.data.saldoHoje < 0 ? VIZ.status.atraso : undefined
                }
              />
            )}
          </div>
        </div>
        {dias.length > 0 && (
          <TiraDoMes
            dias={dias}
            totalEstudios={(estudios.data ?? []).length}
            hoje={hoje}
          />
        )}
      </section>

      {/* xl e não lg: a sidebar come 15rem, então em 1024 duas colunas
          deixariam os gráficos com ~380px e o dado ilegível */}
      <div className="grid gap-5 xl:grid-cols-2">
        {/* Precisa de você — a coluna de decisão */}
        <section className="rounded-xl border bg-card p-5">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-sm font-medium">Precisa de você</h2>
            {precisaDeVoce > 0 && (
              <span className="font-mono text-sm tabular-nums text-[--attention]">
                {precisaDeVoce}
              </span>
            )}
          </div>
          <div className="flex flex-col divide-y text-sm">
            {obrigacoes.data && reservas.data && precisaDeVoce === 0 && (
              <p className="py-2 text-muted-foreground">Tudo em dia.</p>
            )}
            {atrasadas.slice(0, 3).map((i) => (
              <Item
                key={`${i.tipo}-${i.id}`}
                href="/admin/financeiro"
                marca={VIZ.status.atraso}
                titulo={i.descricao}
                detalhe={`vencia ${dataBr(i.data)}`}
              />
            ))}
            {pendentes.slice(0, 3).map((r) => (
              <Item
                key={`p-${r.id}`}
                href="/admin/reservas"
                marca={VIZ.status.atencao}
                titulo={`${r.codigo} aguarda confirmação`}
                detalhe={dataBr(r.dataInicio)}
              />
            ))}
            {naoEnviadas.slice(0, 3).map((r) => (
              <Item
                key={`e-${r.id}`}
                href="/admin/reservas"
                marca={VIZ.ramp[2]}
                titulo={`${r.codigo} não foi enviada ao cliente`}
                detalhe={dataBr(r.dataInicio)}
              />
            ))}
          </div>
        </section>

        {/* Ocupação por estúdio */}
        <section className="rounded-xl border bg-card p-5">
          <h2 className="mb-3 text-sm font-medium">Ocupação por estúdio</h2>
          {(ocupacao.data?.estudios ?? []).length > 0 ? (
            <BarrasHorizontais
              itens={[...(ocupacao.data?.estudios ?? [])]
                .sort((a, b) => b.dias - a.dias)
                .map((e, i) => ({
                  rotulo: e.codigo,
                  sub: `${Math.round(e.taxa * 100)}%`,
                  valor: e.dias,
                  destaque: i === 0 && e.dias > 0,
                }))}
              formatarValor={(v) => `${v} ${v === 1 ? "dia" : "dias"}`}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              Sem estúdios cadastrados.
            </p>
          )}
        </section>

        {/* Hoje e amanhã */}
        <section className="rounded-xl border bg-card p-5">
          <h2 className="mb-3 text-sm font-medium">Hoje e amanhã</h2>
          <div className="flex flex-col gap-2 text-sm">
            {agenda.data && agenda.data.hoje.length === 0 && (
              <p className="text-muted-foreground">Sem shooting hoje.</p>
            )}
            {(agenda.data?.hoje ?? []).map((r) => (
              <div key={r.id} className="flex items-center gap-3">
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
            <p className="mt-1 border-t pt-2 text-xs text-muted-foreground">
              {agenda.data
                ? agenda.data.amanha.length > 0
                  ? `Amanhã tem shooting em ${[
                      ...new Set(
                        agenda.data.amanha.flatMap((r) =>
                          r.estudioIds.map(codigo)
                        )
                      ),
                    ].join(", ")} — a virada é hoje.`
                  : "Amanhã livre."
                : ""}
            </p>
          </div>
        </section>

        {/* Caixa projetado */}
        <section className="rounded-xl border bg-card p-5">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-sm font-medium">Caixa projetado</h2>
            <Link
              href="/admin/financeiro"
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              financeiro →
            </Link>
          </div>
          {caixa.data?.configurado ? (
            <LinhaSaldo
              pontos={[
                {
                  rotulo: "hoje",
                  valor: caixa.data.saldoHoje,
                },
                ...caixa.data.projecao.map((m) => ({
                  rotulo: `${m.mes.slice(5)}/${m.mes.slice(2, 4)}`,
                  valor: m.saldoFinal,
                })),
              ]}
              formatarValor={brl}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              Informe o saldo da virada no Financeiro → Caixa para o caixa
              deixar de partir do zero.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}

function Item({
  href,
  marca,
  titulo,
  detalhe,
}: {
  href: string;
  marca: string;
  titulo: string;
  detalhe: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 py-2 transition-colors hover:text-foreground",
        "text-foreground/90"
      )}
    >
      <span
        className="h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: marca }}
      />
      <span className="min-w-0 flex-1 truncate">{titulo}</span>
      <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
        {detalhe}
      </span>
    </Link>
  );
}
