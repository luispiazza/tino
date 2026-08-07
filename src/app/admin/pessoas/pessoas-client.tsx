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
import { Cabecalho } from "@/components/viz/secao";

const NATUREZAS: { valor: string; rotulo: string }[] = [
  { valor: "funcionario", rotulo: "Funcionário" },
  { valor: "socio_executor", rotulo: "Sócio executor" },
  { valor: "parceiro_pontual", rotulo: "Parceiro pontual" },
  { valor: "fornecedor_recorrente", rotulo: "Fornecedor recorrente" },
];
const rotuloNatureza = (v: string) =>
  NATUREZAS.find((n) => n.valor === v)?.rotulo ?? v;

const formVazio = {
  nome: "",
  natureza: "funcionario",
  telefone: "",
  email: "",
};

export function PessoasClient() {
  const utils = trpc.useUtils();
  const lista = trpc.pessoas.listar.useQuery();
  const [aberto, setAberto] = useState(false);
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [form, setForm] = useState(formVazio);

  const aoSalvar = {
    onSuccess: () => {
      utils.pessoas.listar.invalidate();
      setAberto(false);
      toast.success(editandoId ? "Cadastro atualizado" : "Pessoa cadastrada");
    },
    onError: (e: { message: string }) => toast.error(e.message),
  };
  const criar = trpc.pessoas.criar.useMutation(aoSalvar);
  const atualizar = trpc.pessoas.atualizar.useMutation(aoSalvar);

  function salvar() {
    const dados = {
      nome: form.nome.trim(),
      natureza: form.natureza as never,
      telefone: form.telefone.trim() || null,
      email: form.email.trim() || null,
    };
    if (editandoId) atualizar.mutate({ id: editandoId, ...dados });
    else criar.mutate(dados);
  }

  return (
    <div className="flex flex-col gap-4">
      <Cabecalho
        titulo="Pessoas"
        resumo={
          lista.data
            ? lista.data.length === 0
              ? "ninguém cadastrado"
              : `${lista.data.filter((p) => p.ativo).length} ${
                  lista.data.filter((p) => p.ativo).length === 1
                    ? "pessoa ativa"
                    : "pessoas ativas"
                }`
            : undefined
        }
      >
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
            Cadastrar pessoa
          </DialogTrigger>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>
                {editandoId ? "Editar cadastro" : "Cadastrar pessoa"}
              </DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-3">
              <div className="grid gap-2">
                <Label htmlFor="pnome">Nome</Label>
                <Input
                  id="pnome"
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label>Natureza</Label>
                <Select
                  value={form.natureza}
                  onValueChange={(v: string | null) =>
                    v && setForm({ ...form, natureza: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {NATUREZAS.map((n) => (
                      <SelectItem key={n.valor} value={n.valor}>
                        {n.rotulo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="ptel">WhatsApp</Label>
                  <Input
                    id="ptel"
                    value={form.telefone}
                    onChange={(e) =>
                      setForm({ ...form, telefone: e.target.value })
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="pemail">E-mail</Label>
                  <Input
                    id="pemail"
                    type="email"
                    value={form.email}
                    onChange={(e) =>
                      setForm({ ...form, email: e.target.value })
                    }
                  />
                </div>
              </div>
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
      </Cabecalho>

      {lista.data?.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          Ninguém cadastrado. Funcionário, sócio executor, parceiro e
          fornecedor vivem todos aqui — o que muda é o que cada um enxerga.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Natureza</TableHead>
                <TableHead>Contato</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {(lista.data ?? []).map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.nome}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {rotuloNatureza(p.natureza)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {p.telefone ?? p.email ?? "—"}
                  </TableCell>
                  <TableCell>
                    {p.ativo ? (
                      <Badge className="bg-[--ok]/15 text-[--ok]">ativo</Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">
                        inativo
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditandoId(p.id);
                        setForm({
                          nome: p.nome,
                          natureza: p.natureza,
                          telefone: p.telefone ?? "",
                          email: p.email ?? "",
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
