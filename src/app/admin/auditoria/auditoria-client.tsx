"use client";

import { trpc } from "@/lib/trpc/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const ROTULOS: Record<string, string> = {
  criar: "criou",
  atualizar: "atualizou",
  confirmar: "confirmou",
  cancelar: "cancelou",
  atualizar_valores: "mudou valores de",
  enviar_whatsapp: "enviou WhatsApp de",
  avancar: "avançou",
};

export function AuditoriaClient() {
  const lista = trpc.auditoria.listar.useQuery();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Auditoria</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {lista.data && lista.data.length > 0
            ? `${lista.data.length} ${lista.data.length === 1 ? "registro" : "registros"} · mais recentes primeiro`
            : "toda alteração de cadastro, valor e estado fica registrada aqui"}
        </p>
      </div>
      {lista.data?.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          Nenhum registro ainda. Toda alteração passa a ficar registrada aqui.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Quando</TableHead>
                <TableHead>Quem</TableHead>
                <TableHead>O quê</TableHead>
                <TableHead>Detalhe</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(lista.data ?? []).map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="whitespace-nowrap tabular-nums text-muted-foreground">
                    {new Date(a.criadoEm).toLocaleString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </TableCell>
                  <TableCell>{a.usuarioNome}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {ROTULOS[a.acao] ?? a.acao} {a.entidade}
                    {a.entidadeId !== null && (
                      <span className="text-muted-foreground">
                        {" "}
                        #{a.entidadeId}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="max-w-md truncate font-mono text-xs text-muted-foreground">
                    {a.detalhe ? JSON.stringify(a.detalhe) : "—"}
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
