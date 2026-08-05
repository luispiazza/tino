"use client";

import { toast } from "sonner";
import { trpc } from "@/lib/trpc/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { CaixaClient } from "./caixa-client";
import { DespesasClient } from "./despesas-client";
import { ObrigacoesClient } from "./obrigacoes-client";

const brl = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataBr = (iso: string | null) =>
  iso ? iso.split("-").reverse().join("/") : "—";

const ROTULO: Record<string, string> = {
  aguardando_po: "aguardando PO",
  po_recebido: "PO recebido",
  emitida: "emitida",
  paga: "paga",
  nf_emitida: "NF emitida",
  conciliada: "conciliada",
  cancelada: "cancelada",
};

/* o passo seguinte de cada estado, como ação legível */
const AVANCO: Record<string, { para: string; rotulo: string } | undefined> = {
  aguardando_po: { para: "po_recebido", rotulo: "PO recebido" },
  po_recebido: { para: "emitida", rotulo: "Marcar emitida" },
  emitida: { para: "paga", rotulo: "Registrar pagamento" },
  paga: { para: "nf_emitida", rotulo: "NF emitida" },
  nf_emitida: { para: "conciliada", rotulo: "Conciliar" },
};

function BadgeEstado({ estado }: { estado: string }) {
  if (estado === "paga" || estado === "nf_emitida" || estado === "conciliada")
    return <Badge className="bg-[--ok]/15 text-[--ok]">{ROTULO[estado]}</Badge>;
  if (estado === "cancelada")
    return (
      <Badge variant="outline" className="text-muted-foreground">
        cancelada
      </Badge>
    );
  return (
    <Badge className="bg-[--attention]/15 text-[--attention]">
      {ROTULO[estado]}
    </Badge>
  );
}

export function FinanceiroClient() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold tracking-tight">Financeiro</h1>
      <Tabs defaultValue="obrigacoes">
        <TabsList>
          <TabsTrigger value="obrigacoes">Obrigações</TabsTrigger>
          <TabsTrigger value="caixa">Caixa</TabsTrigger>
          <TabsTrigger value="cobrancas">Cobranças</TabsTrigger>
          <TabsTrigger value="despesas">Despesas</TabsTrigger>
        </TabsList>
        <TabsContent value="obrigacoes" className="mt-3">
          <ObrigacoesClient />
        </TabsContent>
        <TabsContent value="caixa" className="mt-3">
          <CaixaClient />
        </TabsContent>
        <TabsContent value="cobrancas" className="mt-3">
          <CobrancasClient />
        </TabsContent>
        <TabsContent value="despesas" className="mt-3">
          <DespesasClient />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CobrancasClient() {
  const utils = trpc.useUtils();
  const lista = trpc.financeiro.listarCobrancas.useQuery();
  const avancar = trpc.financeiro.avancarCobranca.useMutation({
    onSuccess: () => {
      utils.financeiro.listarCobrancas.invalidate();
      utils.financeiro.agendaDeObrigacoes.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const abertas = (lista.data ?? []).filter(
    (c) => !["paga", "nf_emitida", "conciliada", "cancelada"].includes(c.estado)
  );
  const aReceberCents = abertas.reduce((soma, c) => soma + c.valorCents, 0);

  return (
    <div className="flex flex-col gap-4">
      {abertas.length > 0 && (
        <p className="text-sm text-muted-foreground">
          a receber:{" "}
          <span className="font-medium text-foreground tabular-nums">
            {brl(aReceberCents)}
          </span>
        </p>
      )}

      {lista.data?.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          Nenhuma cobrança ainda. Gere a primeira pelo painel da reserva.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reserva</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Serviço</TableHead>
                <TableHead>Previsão</TableHead>
                <TableHead>Pagamento</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {(lista.data ?? []).map((c) => {
                const proximo = AVANCO[c.estado];
                return (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono font-medium">
                      {c.reservaCodigo ?? "—"}
                    </TableCell>
                    <TableCell>{c.clienteNome ?? "—"}</TableCell>
                    <TableCell className="text-right whitespace-nowrap tabular-nums">
                      {brl(c.valorCents)}
                      {c.parcelas > 1 && (
                        <span className="text-muted-foreground">
                          {" "}
                          ({c.parcelas}x)
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {dataBr(c.dataServico)}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {dataBr(c.previsaoRecebimento)}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {dataBr(c.dataPagamento)}
                    </TableCell>
                    <TableCell>
                      <BadgeEstado estado={c.estado} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {proximo && (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={avancar.isPending}
                            onClick={() =>
                              avancar.mutate({
                                id: c.id,
                                para: proximo.para as never,
                              })
                            }
                          >
                            {proximo.rotulo}
                          </Button>
                        )}
                        {["aguardando_po", "po_recebido", "emitida"].includes(
                          c.estado
                        ) && (
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              render={<Button variant="ghost" size="sm" />}
                            >
                              ⋯
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                variant="destructive"
                                onClick={() =>
                                  avancar.mutate({
                                    id: c.id,
                                    para: "cancelada",
                                  })
                                }
                              >
                                Cancelar cobrança
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
