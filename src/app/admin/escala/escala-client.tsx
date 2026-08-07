"use client";

import { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/client";
import { Badge } from "@/components/ui/badge";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatarHoras } from "@/server/escala/jornada";
import { Cabecalho, Numero, Secao } from "@/components/viz/secao";
import { cn } from "@/lib/utils";

const DIAS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
const brl = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const paraCents = (reais: string) =>
  reais.trim() === "" ? null : Math.round(Number(reais.replace(",", ".")) * 100);

const turnoVazio = {
  horaInicio: "06:00",
  horaFim: "14:00",
  pessoaId: "",
  custo: "",
  observacao: "",
};

export function EscalaClient() {
  const utils = trpc.useUtils();
  const hoje = new Date();
  const [ancora, setAncora] = useState(() => {
    const d = new Date(hoje);
    d.setDate(hoje.getDate() - hoje.getDay());
    return d;
  });

  const dias = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(ancora);
    d.setDate(ancora.getDate() + i);
    return d;
  });
  const inicio = iso(dias[0]);
  const fim = iso(dias[6]);

  const semana = trpc.escala.escalaDaSemana.useQuery({ inicio, fim });
  const pessoas = trpc.pessoas.listar.useQuery();
  const custo = trpc.escala.custoDeCobertura.useQuery({ inicio, fim });

  const invalidar = () => {
    utils.escala.escalaDaSemana.invalidate();
    utils.escala.custoDeCobertura.invalidate();
  };
  const aoMudar = {
    onSuccess: invalidar,
    onError: (e: { message: string }) => toast.error(e.message),
  };
  const criar = trpc.escala.criarTurno.useMutation({
    ...aoMudar,
    onSuccess: () => {
      invalidar();
      setDiaAberto(null);
      setForm(turnoVazio);
    },
  });
  const atualizar = trpc.escala.atualizarTurno.useMutation(aoMudar);
  const bater = trpc.escala.baterPonto.useMutation(aoMudar);

  const [diaAberto, setDiaAberto] = useState<string | null>(null);
  const [form, setForm] = useState(turnoVazio);

  const navegar = (n: number) => {
    const d = new Date(ancora);
    d.setDate(ancora.getDate() + n);
    setAncora(d);
  };

  return (
    <div className="flex flex-col gap-4">
      <Cabecalho
        titulo="Escala"
        resumo={(() => {
          const t = semana.data?.turnos ?? [];
          const descobertos = t.filter((x) => x.descoberto).length;
          if (!semana.data) return "";
          if (t.length === 0) return "nenhum turno nesta semana";
          return [
            `${t.length} ${t.length === 1 ? "turno" : "turnos"}`,
            descobertos > 0 && `${descobertos} sem ocupante`,
          ]
            .filter(Boolean)
            .join(" · ");
        })()}
      >
        <div className="flex gap-1">
          <Button variant="outline" size="sm" aria-label="Semana anterior" onClick={() => navegar(-7)}>
            ←
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const d = new Date(hoje);
              d.setDate(hoje.getDate() - hoje.getDay());
              setAncora(d);
            }}
          >
            hoje
          </Button>
          <Button variant="outline" size="sm" aria-label="Próxima semana" onClick={() => navegar(7)}>
            →
          </Button>
        </div>
      </Cabecalho>

      {custo.data && custo.data.totalCents > 0 && (
        <Secao className="py-4">
          <Numero
            rotulo="custo de cobertura na semana"
            valor={brl(custo.data.totalCents)}
            detalhe={`${custo.data.turnosComCusto.length} ${
              custo.data.turnosComCusto.length === 1 ? "turno" : "turnos"
            } custaram a mais que a jornada normal`}
          />
        </Secao>
      )}

      <div className="flex flex-col gap-2">
        {dias.map((d, i) => {
          const data = iso(d);
          const doDia = (semana.data?.turnos ?? []).filter((t) => t.data === data);
          const folgasDoDia = (semana.data?.folgas ?? []).filter(
            (f) => f.data === data
          );
          const ehHoje = data === iso(hoje);
          return (
            <div
              key={data}
              className={cn(
                "rounded-lg border p-3",
                ehHoje && "border-primary/40 bg-primary/[0.03]"
              )}
            >
              <div className="flex items-center justify-between">
                <span className={cn("text-sm", ehHoje && "font-medium")}>
                  {DIAS[i]} {d.getDate()}/{d.getMonth() + 1}
                </span>
                <Dialog
                  open={diaAberto === data}
                  onOpenChange={(v) => setDiaAberto(v ? data : null)}
                >
                  <DialogTrigger
                    render={<Button variant="ghost" size="sm" />}
                  >
                    + turno
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-sm">
                    <DialogHeader>
                      <DialogTitle>
                        Turno de {d.getDate()}/{d.getMonth() + 1}
                      </DialogTitle>
                    </DialogHeader>
                    <div className="flex flex-col gap-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="grid gap-2">
                          <Label htmlFor="ti">Das</Label>
                          <Input
                            id="ti"
                            type="time"
                            value={form.horaInicio}
                            onChange={(e) =>
                              setForm({ ...form, horaInicio: e.target.value })
                            }
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="tf">Às</Label>
                          <Input
                            id="tf"
                            type="time"
                            value={form.horaFim}
                            onChange={(e) =>
                              setForm({ ...form, horaFim: e.target.value })
                            }
                          />
                        </div>
                      </div>
                      <div className="grid gap-2">
                        <Label>Quem cobre</Label>
                        <Select
                          value={form.pessoaId}
                          onValueChange={(v: string | null) =>
                            setForm({ ...form, pessoaId: v ?? "" })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="ainda sem ocupante" />
                          </SelectTrigger>
                          <SelectContent>
                            {(pessoas.data ?? []).map((p) => (
                              <SelectItem key={p.id} value={String(p.id)}>
                                {p.nome}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="tc">Custo de cobertura (R$)</Label>
                        <Input
                          id="tc"
                          type="number"
                          min={0}
                          step="0.01"
                          placeholder="só se custar a mais"
                          value={form.custo}
                          onChange={(e) =>
                            setForm({ ...form, custo: e.target.value })
                          }
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="to">Observação</Label>
                        <Input
                          id="to"
                          placeholder="hora extra, parceiro, sócio…"
                          value={form.observacao}
                          onChange={(e) =>
                            setForm({ ...form, observacao: e.target.value })
                          }
                        />
                      </div>
                      <Button
                        disabled={criar.isPending}
                        onClick={() =>
                          criar.mutate({
                            data,
                            horaInicio: form.horaInicio,
                            horaFim: form.horaFim,
                            pessoaId: form.pessoaId
                              ? Number(form.pessoaId)
                              : null,
                            custoCoberturaCents: paraCents(form.custo),
                            observacao: form.observacao.trim() || null,
                          })
                        }
                      >
                        Criar turno
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              {doDia.length === 0 && folgasDoDia.length === 0 && (
                <p className="mt-1 text-xs text-muted-foreground">sem turno</p>
              )}

              {doDia.map((t) => (
                <div
                  key={t.id}
                  className="mt-2 flex flex-wrap items-center gap-2 text-sm"
                >
                  <span className="font-mono tabular-nums">
                    {t.horaInicio.slice(0, 5)}–{t.horaFim.slice(0, 5)}
                  </span>
                  {t.descoberto ? (
                    <>
                      <Badge className="bg-[--attention]/15 text-[--attention]">
                        descoberto
                      </Badge>
                      {/* quem cobre se decide no dia — dá para preencher aqui */}
                      <Select
                        value=""
                        onValueChange={(v: string | null) =>
                          v &&
                          atualizar.mutate({ id: t.id, pessoaId: Number(v) })
                        }
                      >
                        <SelectTrigger className="h-8 w-40 text-xs">
                          <SelectValue placeholder="quem cobre?" />
                        </SelectTrigger>
                        <SelectContent>
                          {(pessoas.data ?? []).map((p) => (
                            <SelectItem key={p.id} value={String(p.id)}>
                              {p.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="underline-offset-4 hover:underline"
                      title="Liberar a vaga"
                      onClick={() =>
                        atualizar.mutate({ id: t.id, pessoaId: null })
                      }
                    >
                      {t.pessoaNome}
                    </button>
                  )}
                  {t.custoCoberturaCents !== null && (
                    <span className="text-muted-foreground tabular-nums">
                      {brl(t.custoCoberturaCents)}
                      {t.observacao && ` · ${t.observacao}`}
                    </span>
                  )}
                  {t.jornada.diferencaMin !== null &&
                    t.jornada.diferencaMin !== 0 && (
                      <Badge
                        className={cn(
                          t.jornada.diferencaMin > 0
                            ? "bg-[--attention]/15 text-[--attention]"
                            : "bg-[--overdue]/15 text-[--overdue]"
                        )}
                      >
                        {formatarHoras(t.jornada.diferencaMin)}
                      </Badge>
                    )}
                  {!t.descoberto && (
                    <div className="ml-auto flex gap-1">
                      {!t.ponto?.entrada && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={bater.isPending}
                          onClick={() =>
                            bater.mutate({
                              turnoId: t.id,
                              entrada: t.horaInicio.slice(0, 5),
                            })
                          }
                        >
                          entrada
                        </Button>
                      )}
                      {t.ponto?.entrada && !t.ponto?.saida && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={bater.isPending}
                          onClick={() => {
                            const agora = new Intl.DateTimeFormat("pt-BR", {
                              timeZone: "America/Sao_Paulo",
                              hour: "2-digit",
                              minute: "2-digit",
                            }).format(new Date());
                            bater.mutate({ turnoId: t.id, saida: agora });
                          }}
                        >
                          saída
                        </Button>
                      )}
                      {t.ponto?.entrada && t.ponto?.saida && (
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {t.ponto.entrada.slice(0, 5)}–
                          {t.ponto.saida.slice(0, 5)}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {folgasDoDia.map((f) => (
                <p key={f.id} className="mt-2 text-xs text-muted-foreground">
                  folga: {f.pessoaNome}
                </p>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
