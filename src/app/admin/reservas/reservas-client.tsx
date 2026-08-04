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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { CalendarioMes } from "./calendario-mes";

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
};

const dataBr = (iso: string) => iso.split("-").reverse().join("/");
const horaCurta = (h: string) => h.slice(0, 5);

export function ReservasClient() {
  const utils = trpc.useUtils();
  const reservas = trpc.reservas.listar.useQuery();
  const estudios = trpc.estudios.listar.useQuery();
  const clientes = trpc.clientes.listar.useQuery();
  const [aberto, setAberto] = useState(false);
  const [form, setForm] = useState(formVazio);

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
    criar.mutate({ ...consulta, clienteId });
  }

  const mudanca = {
    onSuccess: () => utils.reservas.listar.invalidate(),
    onError: (e: { message: string }) => toast.error(e.message),
  };
  const confirmar = trpc.reservas.confirmar.useMutation(mudanca);
  const cancelar = trpc.reservas.cancelar.useMutation(mudanca);

  const porId = new Map((estudios.data ?? []).map((e) => [e.id, e]));
  const codigoEstudio = (id: number) => porId.get(id)?.codigo ?? "?";
  const conflitos = disponibilidade.data?.conflitos ?? [];
  const codigosEmConflito = [...new Set(conflitos.map((c) => c.codigo))];
  const criando = criar.isPending || criarCliente.isPending;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">Reservas</h1>
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

              {formCompleto && disponibilidade.data && (
                <p
                  role="status"
                  className={
                    disponibilidade.data.disponivel
                      ? "text-sm text-[--ok]"
                      : "text-sm text-[--attention]"
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
      </div>

      <Tabs defaultValue="mes">
        <TabsList>
          <TabsTrigger value="mes">Mês</TabsTrigger>
          <TabsTrigger value="lista">Lista</TabsTrigger>
        </TabsList>

        <TabsContent value="mes" className="mt-3">
          <CalendarioMes
            reservas={reservas.data ?? []}
            codigoEstudio={codigoEstudio}
          />
        </TabsContent>

        <TabsContent value="lista" className="mt-3">
          {reservas.data?.length === 0 ? (
            <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
              Nenhuma reserva ainda. A primeira agenda nasce aqui.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Horário</TableHead>
                    <TableHead>Estúdios</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(reservas.data ?? []).map((r) => (
                    <TableRow key={r.id}>
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
                      <TableCell>
                        {r.status === "confirmada" && (
                          <Badge className="bg-[--ok]/15 text-[--ok]">
                            confirmada
                          </Badge>
                        )}
                        {r.status === "pendente" && (
                          <Badge className="bg-[--attention]/15 text-[--attention]">
                            pendente
                          </Badge>
                        )}
                        {r.status === "cancelada" && (
                          <Badge
                            variant="outline"
                            className="text-muted-foreground"
                          >
                            cancelada
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {r.status === "pendente" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={confirmar.isPending}
                              onClick={() => confirmar.mutate({ id: r.id })}
                            >
                              Confirmar
                            </Button>
                          )}
                          {r.status !== "cancelada" && (
                            /* cancelar fora do alcance imediato (lição D1) */
                            <DropdownMenu>
                              <DropdownMenuTrigger
                                render={<Button variant="ghost" size="sm" />}
                              >
                                ⋯
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  variant="destructive"
                                  onClick={() => cancelar.mutate({ id: r.id })}
                                >
                                  Cancelar reserva
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
