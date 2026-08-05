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

const MODOS = [
  { valor: "ambos", rotulo: "todo dia" },
  { valor: "shooting", rotulo: "dia de shooting" },
  { valor: "livre", rotulo: "dia livre" },
];
const rotuloModo = (v: string) => MODOS.find((m) => m.valor === v)?.rotulo ?? v;
const rotuloFrequencia = (d: number) =>
  d === 1
    ? "diária"
    : d === 7
      ? "semanal"
      : d === 15
        ? "quinzenal"
        : d === 30
          ? "mensal"
          : `a cada ${d} dias`;

const formVazio = {
  titulo: "",
  frequenciaDias: "1",
  modoShooting: "ambos",
  requerEstudioVago: false,
};

export function RotinaClient() {
  const utils = trpc.useUtils();
  const lista = trpc.escala.listarTemplates.useQuery();
  const [aberto, setAberto] = useState(false);
  const [form, setForm] = useState(formVazio);

  const criar = trpc.escala.criarTemplate.useMutation({
    onSuccess: () => {
      utils.escala.listarTemplates.invalidate();
      setAberto(false);
      setForm(formVazio);
      toast.success("Regra criada — entra na próxima geração do dia");
    },
    onError: (e) => toast.error(e.message),
  });
  const atualizar = trpc.escala.atualizarTemplate.useMutation({
    onSuccess: () => utils.escala.listarTemplates.invalidate(),
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">Rotina</h1>
        <Dialog open={aberto} onOpenChange={setAberto}>
          <DialogTrigger render={<Button />}>Nova regra</DialogTrigger>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Regra de rotina</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-3">
              <div className="grid gap-2">
                <Label htmlFor="rtitulo">Tarefa</Label>
                <Input
                  id="rtitulo"
                  placeholder="Limpar banheiros, lavar janelas…"
                  value={form.titulo}
                  onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label>Frequência</Label>
                  <Select
                    value={form.frequenciaDias}
                    onValueChange={(v: string | null) =>
                      v && setForm({ ...form, frequenciaDias: v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">diária</SelectItem>
                      <SelectItem value="7">semanal</SelectItem>
                      <SelectItem value="15">quinzenal</SelectItem>
                      <SelectItem value="30">mensal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Quando</Label>
                  <Select
                    value={form.modoShooting}
                    onValueChange={(v: string | null) =>
                      v && setForm({ ...form, modoShooting: v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MODOS.map((m) => (
                        <SelectItem key={m.valor} value={m.valor}>
                          {m.rotulo}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={form.requerEstudioVago ? "secondary" : "outline"}
                  onClick={() =>
                    setForm({
                      ...form,
                      requerEstudioVago: !form.requerEstudioVago,
                    })
                  }
                >
                  {form.requerEstudioVago
                    ? "✓ só com estúdio vago"
                    : "só com estúdio vago?"}
                </Button>
              </div>
              <Button
                disabled={!form.titulo.trim() || criar.isPending}
                onClick={() =>
                  criar.mutate({
                    titulo: form.titulo.trim(),
                    frequenciaDias: Number(form.frequenciaDias),
                    modoShooting: form.modoShooting as never,
                    requerEstudioVago: form.requerEstudioVago,
                    prioridade: 0,
                  })
                }
              >
                Criar regra
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {lista.data?.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          Nenhuma regra ainda. &quot;Limpar banheiros todo dia&quot;,
          &quot;lavar janelas toda semana em dia livre&quot; — o gerador monta
          o dia sozinho a partir daqui. A virada já é automática.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tarefa</TableHead>
                <TableHead>Frequência</TableHead>
                <TableHead>Quando</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {(lista.data ?? []).map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">
                    {t.titulo}
                    {t.requerEstudioVago && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        só com estúdio vago
                      </span>
                    )}
                  </TableCell>
                  <TableCell>{rotuloFrequencia(t.frequenciaDias)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {rotuloModo(t.modoShooting)}
                  </TableCell>
                  <TableCell>
                    {t.ativo ? (
                      <Badge className="bg-[--ok]/15 text-[--ok]">ativa</Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">
                        pausada
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={atualizar.isPending}
                      onClick={() =>
                        atualizar.mutate({ id: t.id, ativo: !t.ativo })
                      }
                    >
                      {t.ativo ? "Pausar" : "Reativar"}
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
