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
import { Textarea } from "@/components/ui/textarea";

type Estudio = {
  id: number;
  codigo: string;
  nome: string;
  endereco: string | null;
  areaM2: number | null;
  ehComplementar: boolean;
  fichaTecnica: string | null;
  dependeDeIds: number[];
};

const formVazio = {
  codigo: "",
  nome: "",
  endereco: "",
  areaM2: "",
  ehComplementar: false,
  fichaTecnica: "",
  dependeDeIds: [] as number[],
};

export function EstudiosClient() {
  const utils = trpc.useUtils();
  const lista = trpc.estudios.listar.useQuery();
  const [aberto, setAberto] = useState(false);
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [form, setForm] = useState(formVazio);

  const aoSalvar = {
    onSuccess: () => {
      utils.estudios.listar.invalidate();
      setAberto(false);
      toast.success(editandoId ? "Estúdio atualizado" : "Estúdio cadastrado");
    },
    onError: (e: { message: string }) => toast.error(e.message),
  };
  const criar = trpc.estudios.criar.useMutation(aoSalvar);
  const atualizar = trpc.estudios.atualizar.useMutation(aoSalvar);

  function abrirNovo() {
    setEditandoId(null);
    setForm(formVazio);
    setAberto(true);
  }

  function abrirEdicao(e: Estudio) {
    setEditandoId(e.id);
    setForm({
      codigo: e.codigo,
      nome: e.nome,
      endereco: e.endereco ?? "",
      areaM2: e.areaM2?.toString() ?? "",
      ehComplementar: e.ehComplementar,
      fichaTecnica: e.fichaTecnica ?? "",
      dependeDeIds: e.dependeDeIds,
    });
    setAberto(true);
  }

  function salvar() {
    const dados = {
      codigo: form.codigo.trim().toUpperCase(),
      nome: form.nome.trim(),
      endereco: form.endereco.trim() || null,
      areaM2: form.areaM2 ? Number(form.areaM2) : null,
      ehComplementar: form.ehComplementar,
      fichaTecnica: form.fichaTecnica.trim() || null,
      dependeDeIds: form.ehComplementar ? form.dependeDeIds : [],
    };
    if (editandoId) atualizar.mutate({ id: editandoId, ...dados });
    else criar.mutate(dados);
  }

  const porId = new Map((lista.data ?? []).map((e) => [e.id, e]));
  const possiveisBases = (lista.data ?? []).filter(
    (e) => !e.ehComplementar && e.id !== editandoId
  );
  const salvando = criar.isPending || atualizar.isPending;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Estúdios</h1>
          {lista.data && lista.data.length > 0 && (
            <p className="mt-0.5 text-sm text-muted-foreground tabular-nums">
              {lista.data.filter((e) => !e.ehComplementar).length} principais ·{" "}
              {lista.data.filter((e) => e.ehComplementar).length} complementares
              {(() => {
                const semFicha = lista.data.filter((e) => !e.fichaTecnica).length;
                return semFicha > 0 ? ` · ${semFicha} sem ficha técnica` : "";
              })()}
            </p>
          )}
        </div>
        <Dialog open={aberto} onOpenChange={setAberto}>
          <DialogTrigger render={<Button onClick={abrirNovo} />}>
            Cadastrar estúdio
          </DialogTrigger>
          <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editandoId ? `Editar ${form.codigo}` : "Cadastrar estúdio"}
              </DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-[6rem_1fr] gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="codigo">Código</Label>
                  <Input
                    id="codigo"
                    value={form.codigo}
                    maxLength={8}
                    disabled={editandoId !== null}
                    onChange={(e) =>
                      setForm({ ...form, codigo: e.target.value })
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="nome">Nome</Label>
                  <Input
                    id="nome"
                    value={form.nome}
                    onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-[1fr_8rem] gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="endereco">Endereço</Label>
                  <Input
                    id="endereco"
                    value={form.endereco}
                    onChange={(e) =>
                      setForm({ ...form, endereco: e.target.value })
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="area">Área (m²)</Label>
                  <Input
                    id="area"
                    type="number"
                    min={1}
                    value={form.areaM2}
                    onChange={(e) =>
                      setForm({ ...form, areaM2: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Tipo</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={form.ehComplementar ? "outline" : "secondary"}
                    onClick={() => setForm({ ...form, ehComplementar: false })}
                  >
                    Principal
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={form.ehComplementar ? "secondary" : "outline"}
                    onClick={() => setForm({ ...form, ehComplementar: true })}
                  >
                    Complementar
                  </Button>
                </div>
                {form.ehComplementar && (
                  <p className="text-xs text-muted-foreground">
                    Complementar só é reservado junto de um estúdio de que
                    depende.
                  </p>
                )}
              </div>
              {form.ehComplementar && (
                <div className="grid gap-2">
                  <Label>Depende de</Label>
                  <div className="flex flex-wrap gap-2">
                    {possiveisBases.length === 0 && (
                      <p className="text-sm text-muted-foreground">
                        Cadastre antes um estúdio principal.
                      </p>
                    )}
                    {possiveisBases.map((e) => {
                      const marcado = form.dependeDeIds.includes(e.id);
                      return (
                        <Button
                          key={e.id}
                          type="button"
                          size="sm"
                          variant={marcado ? "secondary" : "outline"}
                          onClick={() =>
                            setForm({
                              ...form,
                              dependeDeIds: marcado
                                ? form.dependeDeIds.filter((i) => i !== e.id)
                                : [...form.dependeDeIds, e.id],
                            })
                          }
                        >
                          {e.codigo}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              )}
              <div className="grid gap-2">
                <Label htmlFor="ficha">Ficha técnica</Label>
                <Textarea
                  id="ficha"
                  rows={5}
                  placeholder="Ciclorama, pé direito, elétrica, cozinha, banheiros…"
                  value={form.fichaTecnica}
                  onChange={(e) =>
                    setForm({ ...form, fichaTecnica: e.target.value })
                  }
                />
              </div>
              <Button
                onClick={salvar}
                disabled={salvando || !form.codigo.trim() || !form.nome.trim()}
              >
                {salvando
                  ? "Salvando…"
                  : editandoId
                    ? "Salvar alterações"
                    : "Cadastrar"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {lista.data?.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          Nenhum estúdio ainda. Cadastre o primeiro para a agenda e a vitrine
          existirem.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead className="text-right">Área</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {(lista.data ?? []).map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-mono font-medium">
                    {e.codigo}
                  </TableCell>
                  <TableCell>{e.nome}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {e.areaM2 ? `${e.areaM2} m²` : "—"}
                  </TableCell>
                  <TableCell>
                    {e.ehComplementar ? (
                      <Badge variant="outline">
                        junto de{" "}
                        {e.dependeDeIds
                          .map((id) => porId.get(id)?.codigo ?? "?")
                          .join(" ou ")}
                      </Badge>
                    ) : (
                      <Badge variant="secondary">principal</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => abrirEdicao(e)}
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
