"use client";

import { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/client";
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

/*
 * Campanhas — lista com preview do que está gravado em cada landing:
 * à esquerda o hero como o visitante vê, à direita o cartão de link
 * como o WhatsApp renderiza a partir das OG tags. O que estiver
 * faltando aparece dito, não em branco.
 */
const formVazio = {
  slug: "",
  nome: "",
  canal: "",
  heroTitulo: "",
  heroSubtitulo: "",
  ogTitulo: "",
  ogDescricao: "",
};

export default function CampanhasAdmin() {
  const utils = trpc.useUtils();
  const { data: campanhas, isLoading } = trpc.campanhas.listar.useQuery();
  const [aberto, setAberto] = useState(false);
  const [form, setForm] = useState(formVazio);
  const criar = trpc.campanhas.criar.useMutation({
    onSuccess: (c) => {
      utils.campanhas.listar.invalidate();
      setAberto(false);
      setForm(formVazio);
      toast.success(`Campanha no ar em /c/${c.slug}`);
    },
    onError: (e) => toast.error(e.message),
  });
  const atualizar = trpc.campanhas.atualizar.useMutation({
    onSuccess: () => utils.campanhas.listar.invalidate(),
    onError: (e) => toast.error(e.message),
  });

  return (
    <main className="mx-auto max-w-4xl p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Campanhas</h1>
        <Dialog open={aberto} onOpenChange={setAberto}>
          <DialogTrigger render={<Button />}>Nova campanha</DialogTrigger>
          <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Nova campanha</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="cslug">Slug (/c/…)</Label>
                  <Input
                    id="cslug"
                    placeholder="moda-verao"
                    value={form.slug}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        slug: e.target.value
                          .toLowerCase()
                          .replace(/[^a-z0-9-]/g, "-"),
                      })
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="cnome">Nome interno</Label>
                  <Input
                    id="cnome"
                    value={form.nome}
                    onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="ccanal">Canal</Label>
                <Input
                  id="ccanal"
                  placeholder="instagram, google, indicação…"
                  value={form.canal}
                  onChange={(e) => setForm({ ...form, canal: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="cht">Título do hero</Label>
                <Input
                  id="cht"
                  maxLength={120}
                  value={form.heroTitulo}
                  onChange={(e) =>
                    setForm({ ...form, heroTitulo: e.target.value })
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="chs">Subtítulo do hero</Label>
                <Input
                  id="chs"
                  maxLength={200}
                  value={form.heroSubtitulo}
                  onChange={(e) =>
                    setForm({ ...form, heroSubtitulo: e.target.value })
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="cot">Título OG (cartão do WhatsApp)</Label>
                <Input
                  id="cot"
                  maxLength={90}
                  value={form.ogTitulo}
                  onChange={(e) =>
                    setForm({ ...form, ogTitulo: e.target.value })
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="cod">Descrição OG</Label>
                <Input
                  id="cod"
                  maxLength={200}
                  value={form.ogDescricao}
                  onChange={(e) =>
                    setForm({ ...form, ogDescricao: e.target.value })
                  }
                />
              </div>
              <p className="text-xs text-[--muted]">
                Vídeo do hero e imagem OG entram por URL depois — o S3 chega
                junto com o upload.
              </p>
              <Button
                disabled={
                  form.slug.length < 3 || !form.nome.trim() || criar.isPending
                }
                onClick={() =>
                  criar.mutate({
                    slug: form.slug,
                    nome: form.nome.trim(),
                    canal: form.canal.trim() || null,
                    heroTitulo: form.heroTitulo.trim() || null,
                    heroSubtitulo: form.heroSubtitulo.trim() || null,
                    ogTitulo: form.ogTitulo.trim() || null,
                    ogDescricao: form.ogDescricao.trim() || null,
                  })
                }
              >
                Criar campanha
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading && <p className="mt-4 text-[--muted]">Carregando…</p>}
      {campanhas?.length === 0 && (
        <p className="mt-4 text-[--muted]">Nenhuma campanha cadastrada.</p>
      )}

      <div className="mt-6 grid gap-6">
        {campanhas?.map((c) => (
          <article
            key={c.id}
            className="rounded-xl border border-[--border] p-4"
          >
            <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h2 className="font-semibold">{c.nome}</h2>
              <span className="font-mono text-xs text-[--muted]">
                /c/{c.slug}
              </span>
              {c.canal && (
                <span className="text-xs text-[--muted]">{c.canal}</span>
              )}
              {c.segmento && (
                <span className="text-xs text-[--muted]">{c.segmento}</span>
              )}
              {!c.ativa && (
                <span className="text-xs text-[--attention]">pausada</span>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto"
                disabled={atualizar.isPending}
                onClick={() => atualizar.mutate({ id: c.id, ativa: !c.ativa })}
              >
                {c.ativa ? "Pausar" : "Reativar"}
              </Button>
            </header>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <section>
                <h3 className="text-xs text-[--muted]">Hero da página</h3>
                <div className="mt-2 flex aspect-video flex-col justify-end rounded-lg border border-[--border] bg-black/40 p-4">
                  <p className="text-lg font-semibold">
                    {c.heroTitulo ?? "— sem título"}
                  </p>
                  <p className="mt-1 text-sm text-[--muted]">
                    {c.heroSubtitulo ?? "— sem subtítulo"}
                  </p>
                </div>
                <p className="mt-1 text-xs text-[--muted]">
                  {c.heroVideoUrl ? "vídeo de fundo: ok" : "vídeo de fundo: faltando"}
                </p>
              </section>

              <section>
                <h3 className="text-xs text-[--muted]">
                  Preview do link (WhatsApp)
                </h3>
                <div className="mt-2 overflow-hidden rounded-lg border border-[--border]">
                  {c.ogImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={c.ogImageUrl}
                      alt=""
                      className="aspect-[1200/630] w-full object-cover"
                    />
                  ) : (
                    <div className="flex aspect-[1200/630] items-center justify-center bg-black/40 text-xs text-[--muted]">
                      imagem OG faltando
                    </div>
                  )}
                  <div className="p-3">
                    <p className="text-sm font-semibold">
                      {c.ogTitulo ?? "— sem título OG"}
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-[--muted]">
                      {c.ogDescricao ?? "— sem descrição OG"}
                    </p>
                    <p className="mt-1 text-xs text-[--muted]">
                      tinoestudio.com.br
                    </p>
                  </div>
                </div>
              </section>
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}
