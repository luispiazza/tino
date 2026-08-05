"use client";

import { useEffect, useState } from "react";
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

const brl = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataBr = (iso: string | null) =>
  iso ? iso.split("-").reverse().join("/") : "—";
const paraCents = (reais: string) =>
  reais.trim() === "" ? null : Math.round(Number(reais.replace(",", ".")) * 100);

const CATEGORIAS = [
  "imovel",
  "utilidades",
  "pessoas",
  "servicos",
  "manutencao",
  "operacao",
  "fornecedor",
  "impostos",
  "seguros",
  "marketing",
  "financeiro",
  "distribuicao",
  "financiamento",
] as const;

const MESES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

export function DespesasClient() {
  const utils = trpc.useUtils();
  const hoje = new Date();
  const [ano, setAno] = useState(hoje.getFullYear());
  const [mes, setMes] = useState(hoje.getMonth() + 1);
  const periodo = { ano, mes };

  const lancamentos = trpc.financeiro.listarLancamentos.useQuery(periodo);
  const recorrentes = trpc.financeiro.listarRecorrentes.useQuery();

  const invalidar = () => {
    utils.financeiro.listarLancamentos.invalidate();
    utils.financeiro.listarRecorrentes.invalidate();
    utils.financeiro.agendaDeObrigacoes.invalidate();
  };
  const aoMudar = {
    onSuccess: invalidar,
    onError: (e: { message: string }) => toast.error(e.message),
  };

  const materializar = trpc.financeiro.materializarMes.useMutation({
    onSuccess: (r) => {
      if (r.criados > 0) {
        invalidar();
        toast.success(
          `${r.criados} ${r.criados === 1 ? "conta prevista" : "contas previstas"} do mês`
        );
      }
    },
  });
  /* materializa o mês visível uma vez — idempotente no servidor */
  const chaveMes = `${ano}-${mes}`;
  useEffect(() => {
    materializar.mutate({ ano, mes });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chaveMes]);

  const confirmar = trpc.financeiro.confirmarLancamento.useMutation(aoMudar);
  const pagar = trpc.financeiro.pagarLancamento.useMutation(aoMudar);
  const criarLancamento = trpc.financeiro.criarLancamento.useMutation({
    ...aoMudar,
    onSuccess: () => {
      invalidar();
      setNovaAberta(false);
      setNova(novaVazia);
    },
  });
  const criarRecorrente = trpc.financeiro.criarRecorrente.useMutation({
    ...aoMudar,
    onSuccess: () => {
      invalidar();
      setRecorrenteAberta(false);
      setRecorrente(recorrenteVazia);
    },
  });

  const novaVazia = {
    descricao: "",
    categoria: "operacao",
    valor: "",
    dataVencimento: "",
  };
  const recorrenteVazia = {
    descricao: "",
    categoria: "utilidades",
    valor: "",
    dia: "",
  };
  const [novaAberta, setNovaAberta] = useState(false);
  const [nova, setNova] = useState(novaVazia);
  const [recorrenteAberta, setRecorrenteAberta] = useState(false);
  const [recorrente, setRecorrente] = useState(recorrenteVazia);
  const [confirmandoId, setConfirmandoId] = useState<number | null>(null);
  const [valorConfirmacao, setValorConfirmacao] = useState("");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            aria-label="Mês anterior"
            onClick={() =>
              mes === 1 ? (setAno(ano - 1), setMes(12)) : setMes(mes - 1)
            }
          >
            ←
          </Button>
          <span className="min-w-36 text-center text-sm font-medium">
            <span className="capitalize">{MESES[mes - 1]}</span> de {ano}
          </span>
          <Button
            variant="outline"
            size="sm"
            aria-label="Próximo mês"
            onClick={() =>
              mes === 12 ? (setAno(ano + 1), setMes(1)) : setMes(mes + 1)
            }
          >
            →
          </Button>
        </div>
        <div className="flex gap-2">
          <Dialog open={recorrenteAberta} onOpenChange={setRecorrenteAberta}>
            <DialogTrigger render={<Button variant="outline" size="sm" />}>
              Nova recorrente
            </DialogTrigger>
            <DialogContent className="sm:max-w-sm">
              <DialogHeader>
                <DialogTitle>Conta recorrente</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="rdesc">Descrição</Label>
                  <Input
                    id="rdesc"
                    placeholder="Aluguel, luz, Simples…"
                    value={recorrente.descricao}
                    onChange={(e) =>
                      setRecorrente({ ...recorrente, descricao: e.target.value })
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-2">
                    <Label>Categoria</Label>
                    <Select
                      value={recorrente.categoria}
                      onValueChange={(v: string | null) =>
                        v && setRecorrente({ ...recorrente, categoria: v })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIAS.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="rdia">Dia do vencimento</Label>
                    <Input
                      id="rdia"
                      type="number"
                      min={1}
                      max={31}
                      placeholder="variável"
                      value={recorrente.dia}
                      onChange={(e) =>
                        setRecorrente({ ...recorrente, dia: e.target.value })
                      }
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="rvalor">Valor esperado (R$)</Label>
                  <Input
                    id="rvalor"
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="vazio = chega a conta, lança o valor"
                    value={recorrente.valor}
                    onChange={(e) =>
                      setRecorrente({ ...recorrente, valor: e.target.value })
                    }
                  />
                </div>
                <Button
                  disabled={
                    !recorrente.descricao.trim() || criarRecorrente.isPending
                  }
                  onClick={() =>
                    criarRecorrente.mutate({
                      descricao: recorrente.descricao.trim(),
                      categoria: recorrente.categoria as never,
                      natureza: recorrente.valor
                        ? "data_e_valor_conhecidos"
                        : "valor_desconhecido",
                      valorEsperadoCents: paraCents(recorrente.valor),
                      diaVencimento: recorrente.dia
                        ? Number(recorrente.dia)
                        : null,
                    })
                  }
                >
                  Criar recorrente
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={novaAberta} onOpenChange={setNovaAberta}>
            <DialogTrigger render={<Button size="sm" />}>
              Nova despesa
            </DialogTrigger>
            <DialogContent className="sm:max-w-sm">
              <DialogHeader>
                <DialogTitle>Despesa avulsa</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="ndesc">Descrição</Label>
                  <Input
                    id="ndesc"
                    value={nova.descricao}
                    onChange={(e) =>
                      setNova({ ...nova, descricao: e.target.value })
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-2">
                    <Label>Categoria</Label>
                    <Select
                      value={nova.categoria}
                      onValueChange={(v: string | null) =>
                        v && setNova({ ...nova, categoria: v })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIAS.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="nvenc">Vencimento</Label>
                    <Input
                      id="nvenc"
                      type="date"
                      value={nova.dataVencimento}
                      onChange={(e) =>
                        setNova({ ...nova, dataVencimento: e.target.value })
                      }
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="nvalor">Valor (R$)</Label>
                  <Input
                    id="nvalor"
                    type="number"
                    min={0}
                    step="0.01"
                    value={nova.valor}
                    onChange={(e) => setNova({ ...nova, valor: e.target.value })}
                  />
                </div>
                <Button
                  disabled={!nova.descricao.trim() || criarLancamento.isPending}
                  onClick={() =>
                    criarLancamento.mutate({
                      descricao: nova.descricao.trim(),
                      sentido: "saida",
                      categoria: nova.categoria as never,
                      natureza: "data_e_valor_conhecidos",
                      valorCents: paraCents(nova.valor),
                      dataVencimento: nova.dataVencimento || null,
                    })
                  }
                >
                  Lançar
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {lancamentos.data?.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          Nenhum lançamento no mês. Cadastre as recorrentes — aluguel, luz,
          Simples — e cada mês nasce previsto sozinho.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Descrição</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {(lancamentos.data ?? []).map((l) => (
                <TableRow key={l.id}>
                  <TableCell>
                    {l.descricao}
                    {l.recorrenteId && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        recorrente
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {l.categoria}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {dataBr(l.dataVencimento)}
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap tabular-nums">
                    {l.valorCents !== null ? (
                      brl(l.valorCents)
                    ) : (
                      <span className="text-muted-foreground">
                        aguardando conta
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {l.estado === "pago" ? (
                      <Badge className="bg-[--ok]/15 text-[--ok]">
                        pago {dataBr(l.dataPagamento)}
                      </Badge>
                    ) : l.estado === "confirmado" ? (
                      <Badge className="bg-[--attention]/15 text-[--attention]">
                        confirmado
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">
                        previsto
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {l.estado === "previsto" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setConfirmandoId(l.id);
                          setValorConfirmacao(
                            l.valorCents !== null
                              ? String(l.valorCents / 100)
                              : ""
                          );
                        }}
                      >
                        Confirmar
                      </Button>
                    )}
                    {l.estado === "confirmado" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={pagar.isPending}
                        onClick={() => pagar.mutate({ id: l.id })}
                      >
                        Pagar
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* confirmar = a conta chegou; o valor real entra aqui */}
      <Dialog
        open={confirmandoId !== null}
        onOpenChange={(v) => !v && setConfirmandoId(null)}
      >
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>Confirmar valor</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="grid gap-2">
              <Label htmlFor="vconf">Valor da conta (R$)</Label>
              <Input
                id="vconf"
                type="number"
                min={0}
                step="0.01"
                value={valorConfirmacao}
                onChange={(e) => setValorConfirmacao(e.target.value)}
              />
            </div>
            <Button
              disabled={!valorConfirmacao || confirmar.isPending}
              onClick={() => {
                const cents = paraCents(valorConfirmacao);
                if (confirmandoId && cents) {
                  confirmar.mutate(
                    { id: confirmandoId, valorCents: cents },
                    { onSuccess: () => setConfirmandoId(null) }
                  );
                }
              }}
            >
              Confirmar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {(recorrentes.data ?? []).length > 0 && (
        <p className="text-xs text-muted-foreground">
          Recorrentes ativas:{" "}
          {(recorrentes.data ?? [])
            .filter((r) => r.ativo)
            .map((r) => r.descricao)
            .join(" · ")}
        </p>
      )}
    </div>
  );
}
