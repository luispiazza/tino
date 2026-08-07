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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Cabecalho, Vazio } from "@/components/viz/secao";
import { CalendarioAno } from "./calendario-ano";
import { CalendarioMes } from "./calendario-mes";
import { CalendarioSemana } from "./calendario-semana";
import { DetalheReserva } from "./detalhe-reserva";

/* A diária padrão da casa: 12h, 07:00–19:00. Fora disso é escolha. */
const formVazio = {
  dataInicio: "",
  dataFim: "",
  horaInicio: "07:00",
  horaFim: "19:00",
  estudioIds: [] as number[],
  clienteId: null as number | null,
  novoCliente: false,
  novoClienteNome: "",
  novoClienteTelefone: "",
  valorDiaria: "",
  valorHoraExtra: "",
  desconto: "",
  codigoMontagem: "",
};

/* o filtro da lista: o que o sócio pergunta ao abrir a tela */
const PERIODOS = [
  { valor: "todos", rotulo: "Todos" },
  { valor: "hoje", rotulo: "Hoje" },
  { valor: "semana", rotulo: "Esta semana" },
  { valor: "mes", rotulo: "Este mês" },
] as const;
type Periodo = (typeof PERIODOS)[number]["valor"];

/* hoje em São Paulo, no formato do banco — o servidor pode estar em UTC */
function hojeIso() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
  }).format(new Date());
}

/*
 * Cor é informação, nunca decoração (PRODUCT §Princípios): verde é em
 * dia, âmbar pede ação, vermelho saiu da agenda. A legenda existe para
 * a cor não ser a única portadora do significado.
 */
const STATUS = {
  confirmada: {
    rotulo: "Confirmada",
    badge: "bg-ok/15 text-ok",
    ponto: "bg-ok",
  },
  pendente: {
    rotulo: "Pendente",
    badge: "bg-attention/15 text-attention",
    ponto: "bg-attention",
  },
  cancelada: {
    rotulo: "Cancelada",
    badge: "bg-overdue/15 text-overdue",
    ponto: "bg-overdue",
  },
} as const;

function Legenda() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      <span>Status:</span>
      {Object.entries(STATUS).map(([chave, s]) => (
        <span key={chave} className="flex items-center gap-1.5">
          <span aria-hidden className={`size-2 rounded-full ${s.ponto}`} />
          {s.rotulo}
        </span>
      ))}
    </div>
  );
}

const dataBr = (iso: string) => iso.split("-").reverse().join("/");
const horaCurta = (h: string) => h.slice(0, 5);
const brl = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const paraCents = (reais: string) =>
  reais.trim() === "" ? null : Math.round(Number(reais.replace(",", ".")) * 100);
const diasEntre = (inicio: string, fim: string) =>
  Math.round(
    (new Date(fim + "T00:00Z").getTime() -
      new Date(inicio + "T00:00Z").getTime()) /
      86400000
  ) + 1;

export function ReservasClient() {
  const utils = trpc.useUtils();
  const reservas = trpc.reservas.listar.useQuery();
  const estudios = trpc.estudios.listar.useQuery();
  const clientes = trpc.clientes.listar.useQuery();
  const [aberto, setAberto] = useState(false);
  const [detalheId, setDetalheId] = useState<number | null>(null);
  const [form, setForm] = useState(formVazio);
  const [periodo, setPeriodo] = useState<Periodo>("todos");

  const formCompleto =
    form.dataInicio !== "" &&
    form.estudioIds.length > 0 &&
    form.horaInicio < form.horaFim;

  const consulta = {
    dataInicio: form.dataInicio,
    dataFim: form.dataFim || form.dataInicio,
    horaInicio: form.horaInicio,
    horaFim: form.horaFim,
    estudioIds: form.estudioIds,
  };
  /* a mesma procedure pública que a vitrine e o WhatsApp vão usar */
  const disponibilidade = trpc.reservas.disponibilidade.useQuery(consulta, {
    enabled: formCompleto,
  });

  const criarCliente = trpc.clientes.criar.useMutation();
  const criar = trpc.reservas.criar.useMutation({
    onSuccess: (r) => {
      utils.reservas.listar.invalidate();
      utils.clientes.listar.invalidate();
      setAberto(false);
      setForm(formVazio);
      toast.success(`Reserva ${r.codigo} criada`);
    },
    onError: (e) => toast.error(e.message),
  });

  async function criarReserva() {
    let clienteId = form.clienteId;
    if (form.novoCliente && form.novoClienteNome.trim()) {
      const cliente = await criarCliente.mutateAsync({
        nome: form.novoClienteNome.trim(),
        telefone: form.novoClienteTelefone.trim() || null,
      });
      clienteId = cliente.id;
    }
    criar.mutate({
      ...consulta,
      clienteId,
      valorDiariaCents: paraCents(form.valorDiaria),
      valorHoraExtraCents: paraCents(form.valorHoraExtra),
      descontoCents: paraCents(form.desconto) ?? 0,
      codigoMontagem: form.codigoMontagem.trim().toUpperCase() || undefined,
    });
  }

  const diasEscolhidos = form.dataInicio
    ? diasEntre(form.dataInicio, form.dataFim || form.dataInicio)
    : 0;
  const diariaCents = paraCents(form.valorDiaria);
  const totalPrevisto =
    diariaCents !== null && diasEscolhidos > 0
      ? diariaCents * diasEscolhidos - (paraCents(form.desconto) ?? 0)
      : null;

  const porId = new Map((estudios.data ?? []).map((e) => [e.id, e]));
  const codigoEstudio = (id: number) => porId.get(id)?.codigo ?? "?";
  const conflitos = disponibilidade.data?.conflitos ?? [];
  const codigosEmConflito = [...new Set(conflitos.map((c) => c.codigo))];
  const criando = criar.isPending || criarCliente.isPending;

  /* o resumo que interessa ao abrir a tela: o que está em pé e o que
   * ainda depende de alguém */
  const ativas = (reservas.data ?? []).filter((r) => r.status !== "cancelada");
  const aguardando = ativas.filter((r) => r.status === "pendente").length;
  const semEnvio = ativas.filter((r) => !r.whatsappEnviadoEm).length;
  /*
   * A reserva ocupa um intervalo: ela entra no período se houver
   * qualquer sobreposição, não só se começar dentro dele — senão uma
   * diária de três dias some do filtro no segundo dia.
   */
  const visiveis = (() => {
    const lista = reservas.data ?? [];
    if (periodo === "todos") return lista;
    const hoje = hojeIso();
    let inicio = hoje;
    let fim = hoje;
    if (periodo === "semana") {
      const d = new Date(`${hoje}T12:00:00Z`);
      const diaSemana = (d.getUTCDay() + 6) % 7; /* segunda = 0 */
      const seg = new Date(d);
      seg.setUTCDate(d.getUTCDate() - diaSemana);
      const dom = new Date(seg);
      dom.setUTCDate(seg.getUTCDate() + 6);
      inicio = seg.toISOString().slice(0, 10);
      fim = dom.toISOString().slice(0, 10);
    } else if (periodo === "mes") {
      inicio = `${hoje.slice(0, 7)}-01`;
      const [a, m] = hoje.split("-").map(Number);
      fim = `${hoje.slice(0, 7)}-${String(new Date(a, m, 0).getDate()).padStart(2, "0")}`;
    }
    return lista.filter((r) => r.dataInicio <= fim && r.dataFim >= inicio);
  })();

  const resumo = reservas.data
    ? [
        `${ativas.length} ${ativas.length === 1 ? "reserva" : "reservas"}`,
        aguardando > 0 && `${aguardando} aguardando confirmação`,
        semEnvio > 0 && `${semEnvio} sem envio`,
      ]
        .filter(Boolean)
        .join(" · ")
    : undefined;

  return (
    <div className="flex flex-col gap-4">
      <Cabecalho titulo="Reservas" resumo={resumo}>
        <Dialog open={aberto} onOpenChange={setAberto}>
          <DialogTrigger render={<Button />}>Nova reserva</DialogTrigger>
          <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Nova reserva</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-4">
              <div className="grid gap-2">
                <Label>Cliente</Label>
                {form.novoCliente ? (
                  <div className="flex flex-col gap-2">
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        placeholder="Nome"
                        value={form.novoClienteNome}
                        onChange={(e) =>
                          setForm({ ...form, novoClienteNome: e.target.value })
                        }
                      />
                      <Input
                        placeholder="WhatsApp"
                        value={form.novoClienteTelefone}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            novoClienteTelefone: e.target.value,
                          })
                        }
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="self-start"
                      onClick={() => setForm({ ...form, novoCliente: false })}
                    >
                      Escolher cliente existente
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Select
                      value={form.clienteId ? String(form.clienteId) : ""}
                      onValueChange={(v: string | null) =>
                        setForm({ ...form, clienteId: v ? Number(v) : null })
                      }
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Sem cliente por enquanto" />
                      </SelectTrigger>
                      <SelectContent>
                        {(clientes.data ?? []).map((c) => (
                          <SelectItem key={c.id} value={String(c.id)}>
                            {c.nome}
                            {c.empresa ? ` · ${c.empresa}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setForm({ ...form, novoCliente: true })}
                    >
                      Novo
                    </Button>
                  </div>
                )}
              </div>

              <div className="grid gap-2">
                <Label>Estúdios</Label>
                <div className="flex flex-wrap gap-2">
                  {(estudios.data ?? []).map((e) => {
                    const marcado = form.estudioIds.includes(e.id);
                    return (
                      <Button
                        key={e.id}
                        type="button"
                        size="sm"
                        variant={marcado ? "secondary" : "outline"}
                        onClick={() =>
                          setForm({
                            ...form,
                            estudioIds: marcado
                              ? form.estudioIds.filter((i) => i !== e.id)
                              : [...form.estudioIds, e.id],
                          })
                        }
                      >
                        {e.codigo}
                      </Button>
                    );
                  })}
                </div>
                {estudios.data?.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    Cadastre os estúdios antes de reservar.
                  </p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="dataInicio">Início</Label>
                  <Input
                    id="dataInicio"
                    type="date"
                    value={form.dataInicio}
                    onChange={(e) =>
                      setForm({ ...form, dataInicio: e.target.value })
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="dataFim">Fim (se mais de um dia)</Label>
                  <Input
                    id="dataFim"
                    type="date"
                    min={form.dataInicio}
                    value={form.dataFim}
                    onChange={(e) =>
                      setForm({ ...form, dataFim: e.target.value })
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="horaInicio">Das</Label>
                  <Input
                    id="horaInicio"
                    type="time"
                    value={form.horaInicio}
                    onChange={(e) =>
                      setForm({ ...form, horaInicio: e.target.value })
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="horaFim">Às</Label>
                  <Input
                    id="horaFim"
                    type="time"
                    value={form.horaFim}
                    onChange={(e) =>
                      setForm({ ...form, horaFim: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="valorDiaria">Diária (R$)</Label>
                  <Input
                    id="valorDiaria"
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="a negociar"
                    value={form.valorDiaria}
                    onChange={(e) =>
                      setForm({ ...form, valorDiaria: e.target.value })
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="valorHoraExtra">Hora extra (R$)</Label>
                  <Input
                    id="valorHoraExtra"
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.valorHoraExtra}
                    onChange={(e) =>
                      setForm({ ...form, valorHoraExtra: e.target.value })
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="desconto">Desconto (R$)</Label>
                  <Input
                    id="desconto"
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.desconto}
                    onChange={(e) =>
                      setForm({ ...form, desconto: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="codigoMontagem">
                  Código do site (se o cliente trouxe)
                </Label>
                <Input
                  id="codigoMontagem"
                  placeholder="M-7KPQ"
                  maxLength={8}
                  className="font-mono"
                  value={form.codigoMontagem}
                  onChange={(e) =>
                    setForm({ ...form, codigoMontagem: e.target.value })
                  }
                />
              </div>

              {totalPrevisto !== null && (
                <p className="text-sm text-muted-foreground">
                  {diasEscolhidos}{" "}
                  {diasEscolhidos === 1 ? "diária" : "diárias"} ·{" "}
                  <span
                    className={
                      totalPrevisto < 0 ? "text-destructive" : "text-foreground"
                    }
                  >
                    total {brl(totalPrevisto)}
                  </span>
                </p>
              )}

              {formCompleto && disponibilidade.data && (
                <p
                  role="status"
                  className={
                    disponibilidade.data.disponivel
                      ? "text-sm text-ok"
                      : "text-sm text-attention"
                  }
                >
                  {disponibilidade.data.disponivel
                    ? "Período livre nos estúdios escolhidos."
                    : `Conflita com ${codigosEmConflito.join(", ")}.`}
                </p>
              )}

              <Button
                onClick={criarReserva}
                disabled={
                  !formCompleto ||
                  criando ||
                  disponibilidade.data?.disponivel === false
                }
              >
                {criando ? "Criando…" : "Criar reserva"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </Cabecalho>

      {/*
       * O calendário mostra quando; a lista mostra o quê. Antes eram
       * abas irmãs, então ver a agenda do mês e conferir o valor de uma
       * reserva exigia trocar de aba e voltar. A lista passa a viver
       * embaixo de qualquer visualização.
       */}
      <Tabs defaultValue="mes">
        <TabsList>
          <TabsTrigger value="semana">Semana</TabsTrigger>
          <TabsTrigger value="mes">Mês</TabsTrigger>
          <TabsTrigger value="ano">Ano</TabsTrigger>
        </TabsList>

        <TabsContent value="semana" className="mt-3">
          <CalendarioSemana
            reservas={reservas.data ?? []}
            codigoEstudio={codigoEstudio}
          />
        </TabsContent>

        <TabsContent value="mes" className="mt-3">
          <CalendarioMes
            reservas={reservas.data ?? []}
            codigoEstudio={codigoEstudio}
          />
        </TabsContent>

        <TabsContent value="ano" className="mt-3">
          <CalendarioAno
            reservas={reservas.data ?? []}
            totalEstudios={(estudios.data ?? []).length}
          />
        </TabsContent>
      </Tabs>

      <Legenda />

      {/* A lista, sempre visível */}
      <div className="flex flex-col gap-3 border-t pt-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {PERIODOS.map((p) => (
              <button
                key={p.valor}
                type="button"
                aria-pressed={periodo === p.valor}
                onClick={() => setPeriodo(p.valor)}
                className={`min-h-9 rounded-md px-3 text-sm transition-colors ${
                  periodo === p.valor
                    ? "bg-accent font-medium text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                }`}
              >
                {p.rotulo}
              </button>
            ))}
          </div>
          <span className="font-mono text-sm text-muted-foreground tabular-nums">
            {visiveis.length}{" "}
            {visiveis.length === 1 ? "reserva" : "reservas"}
          </span>
        </div>

        <div>
          {visiveis.length === 0 ? (
            <Vazio>
              {reservas.data?.length === 0
                ? "Nenhuma reserva ainda. A primeira agenda nasce aqui."
                : "Nenhuma reserva neste período."}
            </Vazio>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Código</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Horário</TableHead>
                    <TableHead>Estúdios</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Envio</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visiveis.map((r) => (
                    <TableRow
                      key={r.id}
                      /* cancelada continua na lista, mas recua: é
                         histórico, não agenda */
                      className={`cursor-pointer ${
                        r.status === "cancelada" ? "opacity-55" : ""
                      }`}
                      onClick={() => setDetalheId(r.id)}
                    >
                      <TableCell className="font-mono font-medium">
                        {r.codigo}
                      </TableCell>
                      <TableCell>
                        {r.clienteNome ?? (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap tabular-nums">
                        {dataBr(r.dataInicio)}
                        {r.dataFim !== r.dataInicio &&
                          ` – ${dataBr(r.dataFim)}`}
                      </TableCell>
                      <TableCell className="whitespace-nowrap tabular-nums">
                        {horaCurta(r.horaInicio)}–{horaCurta(r.horaFim)}
                      </TableCell>
                      <TableCell className="font-mono">
                        {r.estudioIds.map(codigoEstudio).join("+")}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap tabular-nums">
                        {r.valorTotalCents !== null ? (
                          brl(r.valorTotalCents)
                        ) : (
                          <span className="text-muted-foreground">
                            a negociar
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {(() => {
                          const s = STATUS[r.status as keyof typeof STATUS];
                          return s ? (
                            <Badge className={s.badge}>{s.rotulo}</Badge>
                          ) : null;
                        })()}
                      </TableCell>
                      <TableCell>
                        {r.whatsappEnviadoEm ? (
                          <Badge className="bg-ok/15 text-ok">
                            enviada{" "}
                            {new Date(r.whatsappEnviadoEm).toLocaleDateString(
                              "pt-BR",
                              { day: "2-digit", month: "2-digit" }
                            )}
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="text-muted-foreground"
                          >
                            não enviada
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>

      <DetalheReserva
        reservaId={detalheId}
        aoFechar={() => setDetalheId(null)}
        codigoEstudio={codigoEstudio}
      />
    </div>
  );
}
