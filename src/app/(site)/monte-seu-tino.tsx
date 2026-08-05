"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/*
 * O configurador que qualifica o contato — e a instrumentação da
 * Fase 1: TODA montagem grava com origem (slug da campanha), e o
 * código curto sobrevive ao pulo para o wa.me. O número do WhatsApp
 * vem de NEXT_PUBLIC_WHATSAPP_NUMERO; sem ele, o visitante recebe o
 * código e o convite para mandar mensagem.
 */

const SEGMENTOS = ["Foto", "Vídeo", "Evento", "Gastronômico"];

export function MonteSeuTino({
  combinacoes,
  campanhaSlug,
}: {
  combinacoes: string[];
  campanhaSlug: string | null;
}) {
  const [combinacao, setCombinacao] = useState<string | null>(null);
  const [segmento, setSegmento] = useState<string | null>(null);
  const [data, setData] = useState("");
  const [codigo, setCodigo] = useState<string | null>(null);

  const gravar = trpc.campanhas.gravarMontagem.useMutation();
  const marcarClique = trpc.campanhas.marcarCliqueWhatsapp.useMutation();

  const numero = process.env.NEXT_PUBLIC_WHATSAPP_NUMERO;

  async function montar() {
    const { codigoCurto } = await gravar.mutateAsync({
      combinacao: combinacao ?? undefined,
      dataDesejada: data || undefined,
      segmento: segmento ?? undefined,
      campanhaSlug: campanhaSlug ?? undefined,
    });
    setCodigo(codigoCurto);

    const linhas = [
      "Olá! Montei um Tino no site:",
      ...(combinacao ? [`Combinação ${combinacao}`] : []),
      ...(data ? [`Data: ${data.split("-").reverse().join("/")}`] : []),
      ...(segmento ? [`Produção de ${segmento.toLowerCase()}`] : []),
      `Código: ${codigoCurto}`,
    ];
    if (numero) {
      marcarClique.mutate({ codigoCurto });
      window.open(
        `https://wa.me/${numero}?text=${encodeURIComponent(linhas.join("\n"))}`,
        "_blank"
      );
    }
  }

  return (
    <div className="flex flex-col gap-5 rounded-2xl border p-6">
      <div className="grid gap-2">
        <Label>Combinação</Label>
        <div className="flex flex-wrap gap-2">
          {combinacoes.map((c) => (
            <Button
              key={c}
              type="button"
              variant={combinacao === c ? "secondary" : "outline"}
              onClick={() => setCombinacao(combinacao === c ? null : c)}
              className="font-mono"
            >
              {c}
            </Button>
          ))}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="mst-data">Quando (se já souber)</Label>
          <Input
            id="mst-data"
            type="date"
            value={data}
            onChange={(e) => setData(e.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label>Produção</Label>
          <div className="flex flex-wrap gap-2">
            {SEGMENTOS.map((s) => (
              <Button
                key={s}
                type="button"
                size="sm"
                variant={segmento === s ? "secondary" : "outline"}
                onClick={() => setSegmento(segmento === s ? null : s)}
              >
                {s}
              </Button>
            ))}
          </div>
        </div>
      </div>

      <Button
        size="lg"
        disabled={gravar.isPending || codigo !== null}
        onClick={montar}
      >
        {gravar.isPending
          ? "Montando…"
          : codigo
            ? `Montado — código ${codigo}`
            : "Chamar no WhatsApp"}
      </Button>
      {codigo && !numero && (
        <p className="text-sm text-muted-foreground">
          Seu código é <span className="font-mono font-medium">{codigo}</span> —
          mande ele no WhatsApp do Tino que a conversa já começa com tudo
          anotado.
        </p>
      )}
    </div>
  );
}
