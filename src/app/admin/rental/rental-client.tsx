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
import { InventarioClient } from "./inventario-client";

const brl = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const paraCents = (reais: string) =>
  reais.trim() === "" ? null : Math.round(Number(reais.replace(",", ".")) * 100);

const formVazio = {
  nome: "",
  unidade: "unidade",
  preco: "",
  custoFornecedor: "",
  qtdTotal: "",
  multa: "",
  qtdEsperada: "",
};

export function RentalClient() {
  const catalogo = trpc.rental.catalogo.useQuery();
  const itens = catalogo.data ?? [];
  const naContagem = itens.filter((i) => i.qtdEsperada !== null).length;
  const resumo = catalogo.data
    ? itens.length === 0
      ? "catálogo vazio"
      : [
          `${itens.length} ${itens.length === 1 ? "item" : "itens"}`,
          naContagem > 0 && `${naContagem} na contagem`,
        ]
          .filter(Boolean)
          .join(" · ")
    : "";

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Rental</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">{resumo}</p>
      </div>
      <Tabs defaultValue="catalogo">
        <TabsList>
          <TabsTrigger value="catalogo">Catálogo</TabsTrigger>
          <TabsTrigger value="inventario">Contagem</TabsTrigger>
        </TabsList>
        <TabsContent value="catalogo" className="mt-3">
          <CatalogoClient />
        </TabsContent>
        <TabsContent value="inventario" className="mt-3">
          <InventarioClient />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CatalogoClient() {
  const utils = trpc.useUtils();
  const catalogo = trpc.rental.catalogo.useQuery();
  const [aberto, setAberto] = useState(false);
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [form, setForm] = useState(formVazio);

  const aoSalvar = {
    onSuccess: () => {
      utils.rental.catalogo.invalidate();
      setAberto(false);
      toast.success(editandoId ? "Item atualizado" : "Item cadastrado");
    },
    onError: (e: { message: string }) => toast.error(e.message),
  };
  const criar = trpc.rental.criarItem.useMutation(aoSalvar);
  const atualizar = trpc.rental.atualizarItem.useMutation(aoSalvar);

  function salvar() {
    const dados = {
      nome: form.nome.trim(),
      unidade: form.unidade.trim() || "unidade",
      precoCents: paraCents(form.preco) ?? 0,
      custoFornecedorCentsDia: paraCents(form.custoFornecedor),
      qtdTotal: form.qtdTotal === "" ? null : Number(form.qtdTotal),
      multaPorUnidadeCents: paraCents(form.multa),
      qtdEsperada: form.qtdEsperada === "" ? null : Number(form.qtdEsperada),
    };
    if (editandoId) atualizar.mutate({ id: editandoId, ...dados });
    else criar.mutate(dados);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-end">
        <Dialog open={aberto} onOpenChange={setAberto}>
          <DialogTrigger
            render={
              <Button
                onClick={() => {
                  setEditandoId(null);
                  setForm(formVazio);
                }}
              />
            }
          >
            Cadastrar item
          </DialogTrigger>
          <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>
                {editandoId ? "Editar item" : "Cadastrar item"}
              </DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-[1fr_7rem] gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="inome">Item</Label>
                  <Input
                    id="inome"
                    placeholder="Arara, pranchão, café…"
                    value={form.nome}
                    onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="iunidade">Unidade</Label>
                  <Input
                    id="iunidade"
                    value={form.unidade}
                    onChange={(e) =>
                      setForm({ ...form, unidade: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="ipreco">Preço ao cliente (R$)</Label>
                  <Input
                    id="ipreco"
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.preco}
                    onChange={(e) => setForm({ ...form, preco: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="icusto">Custo do fornecedor / dia</Label>
                  <Input
                    id="icusto"
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="se for de terceiro"
                    value={form.custoFornecedor}
                    onChange={(e) =>
                      setForm({ ...form, custoFornecedor: e.target.value })
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="iqtd">Quantidade</Label>
                  <Input
                    id="iqtd"
                    type="number"
                    min={0}
                    placeholder="vazio = consumível"
                    value={form.qtdTotal}
                    onChange={(e) =>
                      setForm({ ...form, qtdTotal: e.target.value })
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="imulta">Multa por unidade (R$)</Label>
                  <Input
                    id="imulta"
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.multa}
                    onChange={(e) => setForm({ ...form, multa: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="iesperada">Esperado na contagem</Label>
                  <Input
                    id="iesperada"
                    type="number"
                    min={0}
                    placeholder="vazio = fora da contagem"
                    value={form.qtdEsperada}
                    onChange={(e) =>
                      setForm({ ...form, qtdEsperada: e.target.value })
                    }
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Quantidade vazia marca consumível (café, detergente): não trava
                pedido. &quot;Esperado na contagem&quot; coloca o item no
                inventário semanal — é onde entram prato, talher e cabide.
              </p>
              <Button
                onClick={salvar}
                disabled={
                  !form.nome.trim() || criar.isPending || atualizar.isPending
                }
              >
                {editandoId ? "Salvar" : "Cadastrar"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {catalogo.data?.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          Catálogo vazio. Araras, pranchões, kit cozinha — o que o produtor
          pede pelo portal sai daqui, com o preço que você definir.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead className="text-right">Preço</TableHead>
                <TableHead className="text-right">Custo/dia</TableHead>
                <TableHead className="text-right">Estoque</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {(catalogo.data ?? []).map((i) => (
                <TableRow key={i.id}>
                  <TableCell>
                    <span className="font-medium">{i.nome}</span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {i.unidade}
                    </span>
                    {!i.ativo && (
                      <Badge variant="outline" className="ml-2">
                        inativo
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {brl(i.precoCents)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {i.custoFornecedorCentsDia
                      ? brl(i.custoFornecedorCentsDia)
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {i.qtdTotal ?? (
                      <span className="text-muted-foreground">consumível</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditandoId(i.id);
                        setForm({
                          nome: i.nome,
                          unidade: i.unidade,
                          preco: String(i.precoCents / 100),
                          custoFornecedor: i.custoFornecedorCentsDia
                            ? String(i.custoFornecedorCentsDia / 100)
                            : "",
                          qtdTotal: i.qtdTotal === null ? "" : String(i.qtdTotal),
                          multa: i.multaPorUnidadeCents
                            ? String(i.multaPorUnidadeCents / 100)
                            : "",
                          qtdEsperada:
                            i.qtdEsperada === null ? "" : String(i.qtdEsperada),
                        });
                        setAberto(true);
                      }}
                    >
                      Editar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
