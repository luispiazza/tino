"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

const MOTIVO: Record<string, string> = {
  pedido_explicito: "pediu um humano",
  confianca_baixa: "IA sem certeza",
  sentimento_negativo: "cliente irritado",
  fechar_reserva: "quer fechar reserva",
  valor: "perguntou valor",
  reclamacao: "reclamação",
  fora_de_escopo: "fora do escopo",
};

const PAPEL: Record<string, string> = {
  cliente: "cliente",
  fornecedor: "fornecedor",
  funcionario: "equipe",
  socio: "sócio",
  desconhecido: "não cadastrado",
};

const quando = (d: Date | string | null) =>
  d
    ? new Date(d).toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

export function WhatsappClient() {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.whatsapp.config.useQuery();

  const salvar = trpc.whatsapp.salvarConfig.useMutation({
    onSuccess: () => {
      utils.whatsapp.config.invalidate();
      toast.success("Salvo");
    },
    onError: (e) => toast.error(e.message),
  });

  if (isLoading || !data) {
    return <p className="text-muted-foreground">Carregando…</p>;
  }

  const { config, credenciais, webhookUrl } = data;

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">WhatsApp</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            atendimento por IA no número comercial
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <span className={config.iaAtiva ? "" : "text-muted-foreground"}>
            {config.iaAtiva ? "IA respondendo" : "IA desligada"}
          </span>
          <Switch
            checked={config.iaAtiva}
            disabled={salvar.isPending}
            onCheckedChange={(iaAtiva) => salvar.mutate({ iaAtiva })}
          />
        </label>
      </header>

      {!config.iaAtiva && (
        <p className="rounded-lg border border-[--border] px-3 py-2 text-sm text-muted-foreground">
          Desligada, a IA não responde. As mensagens continuam chegando e
          ficando gravadas no histórico.
        </p>
      )}

      <Tabs defaultValue="conexao">
        <TabsList>
          <TabsTrigger value="conexao">Conexão</TabsTrigger>
          <TabsTrigger value="horario">Horário</TabsTrigger>
          <TabsTrigger value="ia">IA</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="conexao">
          <Conexao
            credenciais={credenciais}
            webhookUrl={webhookUrl}
            telefoneAviso={config.telefoneAviso}
            retomadaHoras={config.retomadaHoras}
          />
        </TabsContent>

        <TabsContent value="horario">
          <Horario
            limitarHorario={config.limitarHorario}
            horaInicio={config.horaInicio}
            horaFim={config.horaFim}
            mensagemForaHorario={config.mensagemForaHorario}
          />
        </TabsContent>

        <TabsContent value="ia">
          <ComportamentoIA
            saudacao={config.saudacao}
            systemPrompt={config.systemPrompt}
            politica={config.politica}
          />
        </TabsContent>

        <TabsContent value="historico">
          <Historico />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Secao({
  titulo,
  descricao,
  children,
}: {
  titulo: string;
  descricao: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-4 rounded-xl border border-[--border] p-4">
      <h2 className="font-semibold">{titulo}</h2>
      <p className="mt-0.5 mb-4 text-sm text-muted-foreground">{descricao}</p>
      {children}
    </section>
  );
}

/* ---------------------------------------------------------------- Conexão */

function LinhaCredencial({
  rotulo,
  valor,
  presente,
  variavel,
}: {
  rotulo: string;
  valor?: string | null;
  presente: boolean;
  variavel: string;
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-[--border] py-2 last:border-0">
      <div>
        <p className="text-sm">{rotulo}</p>
        <p className="font-mono text-xs text-muted-foreground">{variavel}</p>
      </div>
      {presente ? (
        <span className="font-mono text-xs">
          {valor ?? "configurado"}
        </span>
      ) : (
        <span className="text-xs text-[--attention]">faltando</span>
      )}
    </div>
  );
}

function Conexao({
  credenciais,
  webhookUrl,
  telefoneAviso,
  retomadaHoras,
}: {
  credenciais: {
    accessToken: boolean;
    phoneNumberId: string | null;
    wabaId: string | null;
    verifyToken: boolean;
    anthropic: boolean;
  };
  webhookUrl: string;
  telefoneAviso: string | null;
  retomadaHoras: number;
}) {
  const utils = trpc.useUtils();
  const [aviso, setAviso] = useState(telefoneAviso ?? "");
  const [horas, setHoras] = useState(String(retomadaHoras));

  const verificar = trpc.whatsapp.verificarStatus.useMutation({
    onSuccess: (s) =>
      s.conectado
        ? toast.success(
            `Conectado como ${s.nomeVerificado ?? "—"} (${s.numero ?? "—"})`
          )
        : toast.error(s.erro ?? "Não conectado"),
    onError: (e) => toast.error(e.message),
  });

  const salvar = trpc.whatsapp.salvarConfig.useMutation({
    onSuccess: () => {
      utils.whatsapp.config.invalidate();
      toast.success("Salvo");
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <>
      <Secao
        titulo="Credenciais da Meta Cloud API"
        descricao="As credenciais vivem nas variáveis do serviço no Railway, não no banco. Esta tela diz se cada uma chegou; o valor nunca sai do servidor."
      >
        <div className="flex flex-col">
          <LinhaCredencial
            rotulo="Access Token"
            presente={credenciais.accessToken}
            variavel="WHATSAPP_ACCESS_TOKEN"
          />
          <LinhaCredencial
            rotulo="Phone Number ID"
            valor={credenciais.phoneNumberId}
            presente={Boolean(credenciais.phoneNumberId)}
            variavel="WHATSAPP_PHONE_NUMBER_ID"
          />
          <LinhaCredencial
            rotulo="WhatsApp Business Account ID"
            valor={credenciais.wabaId}
            presente={Boolean(credenciais.wabaId)}
            variavel="WHATSAPP_WABA_ID"
          />
          <LinhaCredencial
            rotulo="Verify Token"
            presente={credenciais.verifyToken}
            variavel="WHATSAPP_VERIFY_TOKEN"
          />
          <LinhaCredencial
            rotulo="Chave da Anthropic (o agente)"
            presente={credenciais.anthropic}
            variavel="ANTHROPIC_API_KEY"
          />
        </div>
        <Button
          variant="outline"
          className="mt-4"
          disabled={verificar.isPending}
          onClick={() => verificar.mutate()}
        >
          {verificar.isPending ? "Verificando…" : "Verificar status"}
        </Button>
      </Secao>

      <Secao
        titulo="Aviso de atendimento humano"
        descricao="Quando a IA escala, ela pausa a conversa e avisa este número. A pausa tem prazo: vencido, a IA volta a responder sozinha."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="aviso">Número que recebe o aviso</Label>
            <Input
              id="aviso"
              inputMode="numeric"
              placeholder="11999350085"
              value={aviso}
              onChange={(e) => setAviso(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Só números, com DDD.
            </p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="retomada">Horas até a IA voltar</Label>
            <Input
              id="retomada"
              inputMode="numeric"
              value={horas}
              onChange={(e) => setHoras(e.target.value.replace(/\D/g, ""))}
            />
            <p className="text-xs text-muted-foreground">
              Vale para handoff e para conversa que você assumiu daqui.
            </p>
          </div>
        </div>
        <Button
          className="mt-4"
          disabled={salvar.isPending}
          onClick={() =>
            salvar.mutate({
              telefoneAviso: aviso.trim() || null,
              retomadaHoras: Math.min(Math.max(Number(horas) || 24, 1), 720),
            })
          }
        >
          Salvar
        </Button>
      </Secao>

      <Secao
        titulo="Webhook no Meta"
        descricao="No App Dashboard → WhatsApp → Configuration, cole esta URL, use o mesmo Verify Token do serviço e inscreva o campo “messages”."
      >
        <div className="flex flex-wrap items-center gap-2">
          <code className="min-w-0 flex-1 overflow-x-auto rounded-lg border border-[--border] px-3 py-2 font-mono text-xs whitespace-nowrap">
            {webhookUrl}
          </code>
          <Button
            variant="outline"
            onClick={() => {
              navigator.clipboard.writeText(webhookUrl);
              toast.success("URL copiada");
            }}
          >
            Copiar
          </Button>
        </div>
      </Secao>
    </>
  );
}

/* ---------------------------------------------------------------- Horário */

function Horario({
  limitarHorario,
  horaInicio,
  horaFim,
  mensagemForaHorario,
}: {
  limitarHorario: boolean;
  horaInicio: string | null;
  horaFim: string | null;
  mensagemForaHorario: string | null;
}) {
  const utils = trpc.useUtils();
  const [limitar, setLimitar] = useState(limitarHorario);
  const [inicio, setInicio] = useState(horaInicio?.slice(0, 5) ?? "09:00");
  const [fim, setFim] = useState(horaFim?.slice(0, 5) ?? "18:00");
  const [texto, setTexto] = useState(mensagemForaHorario ?? "");

  const salvar = trpc.whatsapp.salvarConfig.useMutation({
    onSuccess: () => {
      utils.whatsapp.config.invalidate();
      toast.success("Salvo");
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Secao
      titulo="Horário de atendimento"
      descricao="Fora do horário, a IA responde a mensagem abaixo e para. Sem limite, ela atende 24 horas — o horário segue o fuso de São Paulo."
    >
      <label className="flex items-center gap-3">
        <Switch checked={limitar} onCheckedChange={setLimitar} />
        <span className="text-sm">Limitar horário de atendimento</span>
      </label>

      {limitar && (
        <div className="mt-4 grid max-w-xs gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="hi">Abre</Label>
            <Input
              id="hi"
              type="time"
              value={inicio}
              onChange={(e) => setInicio(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="hf">Fecha</Label>
            <Input
              id="hf"
              type="time"
              value={fim}
              onChange={(e) => setFim(e.target.value)}
            />
          </div>
        </div>
      )}

      <div className="mt-4 grid gap-2">
        <Label htmlFor="fora">Mensagem fora do horário</Label>
        <Textarea
          id="fora"
          rows={3}
          placeholder="Recebemos sua mensagem fora do horário de atendimento. Respondemos assim que abrirmos."
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
        />
      </div>

      <Button
        className="mt-4"
        disabled={salvar.isPending}
        onClick={() =>
          salvar.mutate({
            limitarHorario: limitar,
            horaInicio: limitar ? inicio : null,
            horaFim: limitar ? fim : null,
            mensagemForaHorario: texto.trim() || null,
          })
        }
      >
        Salvar horário
      </Button>
    </Secao>
  );
}

/* --------------------------------------------------------------------- IA */

function ComportamentoIA({
  saudacao,
  systemPrompt,
  politica,
}: {
  saudacao: string | null;
  systemPrompt: string | null;
  politica: string | null;
}) {
  const utils = trpc.useUtils();
  const [oi, setOi] = useState(saudacao ?? "");
  const [prompt, setPrompt] = useState(systemPrompt ?? "");
  const [texto, setTexto] = useState(politica ?? "");
  const [verBase, setVerBase] = useState(false);

  const conhecimento = trpc.whatsapp.conhecimento.useQuery(undefined, {
    enabled: verBase,
  });

  const salvar = trpc.whatsapp.salvarConfig.useMutation({
    onSuccess: () => {
      utils.whatsapp.config.invalidate();
      toast.success("Salvo");
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <>
      <Secao
        titulo="Comportamento da IA"
        descricao="Os guardrails — nunca confirmar reserva, nunca negociar preço, nunca revelar dado de outro contato — são fixos no código e não dependem destes campos."
      >
        <div className="grid gap-2">
          <Label htmlFor="saudacao">Mensagem de saudação</Label>
          <Textarea
            id="saudacao"
            rows={2}
            value={oi}
            onChange={(e) => setOi(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Enviada só na primeira mensagem de cada contato novo.
          </p>
        </div>

        <div className="mt-4 grid gap-2">
          <Label htmlFor="prompt">Quem a IA é</Label>
          <Textarea
            id="prompt"
            rows={4}
            className="font-mono text-xs"
            placeholder="Você atende o WhatsApp do Tino Estúdio…"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Só a apresentação. Em branco, vale o texto padrão.
          </p>
        </div>

        <div className="mt-4 grid gap-2">
          <Label htmlFor="politica">Política comercial, tom e FAQ</Label>
          <Textarea
            id="politica"
            rows={6}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Só o que não é cadastro. Ficha técnica, área, planta, combinações
            e preço de rental a IA lê direto das tabelas, sempre atualizados —
            não copie nada disso para cá.
          </p>
        </div>

        <Button
          className="mt-4"
          disabled={salvar.isPending}
          onClick={() =>
            salvar.mutate({
              saudacao: oi.trim() || null,
              systemPrompt: prompt.trim() || null,
              politica: texto.trim() || null,
            })
          }
        >
          Salvar configuração da IA
        </Button>
      </Secao>

      <Secao
        titulo="O que a IA sabe do cadastro"
        descricao="Montado do banco a cada conversa. Se algo aqui estiver errado, o conserto é no cadastro do estúdio ou do rental."
      >
        <Button variant="outline" onClick={() => setVerBase(!verBase)}>
          {verBase ? "Esconder" : "Mostrar"}
        </Button>
        {verBase && (
          <pre className="mt-4 max-h-96 overflow-auto rounded-lg border border-[--border] p-3 font-mono text-xs whitespace-pre-wrap">
            {conhecimento.isLoading
              ? "Carregando…"
              : conhecimento.data || "Cadastro vazio."}
          </pre>
        )}
      </Secao>
    </>
  );
}

/* -------------------------------------------------------------- Histórico */

function Historico() {
  const utils = trpc.useUtils();
  const [contatoId, setContatoId] = useState<number | null>(null);
  const [resposta, setResposta] = useState("");

  const conversas = trpc.whatsapp.conversas.useQuery(undefined, {
    refetchInterval: 30_000,
  });
  const mensagens = trpc.whatsapp.mensagens.useQuery(
    { contatoId: contatoId ?? 0 },
    { enabled: contatoId !== null, refetchInterval: 15_000 }
  );

  /* conversa apagada ou fora da lista não deixa o painel preso num id morto */
  useEffect(() => {
    if (contatoId === null || !conversas.data) return;
    if (!conversas.data.some((c) => c.id === contatoId)) setContatoId(null);
  }, [contatoId, conversas.data]);

  const responder = trpc.whatsapp.responder.useMutation({
    onSuccess: ({ erro }) => {
      setResposta("");
      utils.whatsapp.mensagens.invalidate();
      utils.whatsapp.conversas.invalidate();
      if (erro) toast.error(`Não saiu: ${erro}`);
      else toast.success("Enviada. A IA pausou nesta conversa.");
    },
    onError: (e) => toast.error(e.message),
  });

  const retomar = trpc.whatsapp.retomarIa.useMutation({
    onSuccess: () => {
      utils.whatsapp.conversas.invalidate();
      toast.success("A IA voltou a responder esta conversa");
    },
    onError: (e) => toast.error(e.message),
  });

  const atual = conversas.data?.find((c) => c.id === contatoId) ?? null;

  return (
    <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,18rem)_1fr]">
      <div className="rounded-xl border border-[--border]">
        <div className="border-b border-[--border] p-3">
          <h2 className="font-semibold">Conversas</h2>
          <p className="text-xs text-muted-foreground">
            Abra uma para ler e responder.
          </p>
        </div>
        {conversas.isLoading && (
          <p className="p-3 text-sm text-muted-foreground">Carregando…</p>
        )}
        {conversas.data?.length === 0 && (
          <p className="p-3 text-sm text-muted-foreground">
            Nenhuma conversa ainda.
          </p>
        )}
        <ul className="max-h-[32rem] overflow-y-auto">
          {conversas.data?.map((c) => (
            <li key={c.id}>
              <button
                onClick={() => setContatoId(c.id)}
                className={`w-full border-b border-[--border] p-3 text-left last:border-0 hover:bg-accent/50 ${
                  c.id === contatoId ? "bg-accent" : ""
                }`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-sm font-medium">
                    {c.nome ?? c.telefone}
                  </span>
                  <span className="shrink-0 font-mono text-xs text-muted-foreground">
                    {quando(c.ultimaMensagemEm)}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {c.ultima?.texto ?? "—"}
                </p>
                {c.handoff && (
                  <Badge className="mt-1.5 bg-[--attention]/15 text-[--attention]">
                    {MOTIVO[c.handoff.motivo] ?? c.handoff.motivo}
                  </Badge>
                )}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-xl border border-[--border]">
        {!atual ? (
          <p className="p-6 text-sm text-muted-foreground">
            Selecione uma conversa à esquerda.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[--border] p-3">
              <div>
                <h2 className="font-semibold">{atual.nome ?? atual.telefone}</h2>
                <p className="font-mono text-xs text-muted-foreground">
                  {atual.telefone} · {PAPEL[atual.papel] ?? atual.papel}
                </p>
              </div>
              {atual.iaPausada ? (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={retomar.isPending}
                  onClick={() => retomar.mutate({ contatoId: atual.id })}
                >
                  Devolver para a IA
                </Button>
              ) : (
                <span className="text-xs text-muted-foreground">
                  IA respondendo
                </span>
              )}
            </div>

            {atual.handoff && (
              <div className="border-b border-[--border] p-3">
                <p className="text-xs text-[--attention]">
                  Escalou: {MOTIVO[atual.handoff.motivo] ?? atual.handoff.motivo}
                </p>
                <p className="mt-1 text-sm">{atual.handoff.resumo}</p>
              </div>
            )}

            <div className="flex max-h-[26rem] flex-col gap-2 overflow-y-auto p-3">
              {mensagens.data?.map((m) => (
                <div
                  key={m.id}
                  className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                    m.autor === "contato"
                      ? "self-start bg-muted"
                      : "self-end bg-primary/10"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{m.texto}</p>
                  <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                    {m.autor === "contato"
                      ? "cliente"
                      : m.autor === "ia"
                        ? "IA"
                        : "você"}{" "}
                    · {quando(m.criadaEm)}
                    {m.erro ? ` · não saiu: ${m.erro}` : ""}
                  </p>
                </div>
              ))}
            </div>

            <div className="flex items-end gap-2 border-t border-[--border] p-3">
              <Textarea
                rows={2}
                placeholder="Responder como você — a IA pausa nesta conversa."
                value={resposta}
                onChange={(e) => setResposta(e.target.value)}
              />
              <Button
                disabled={!resposta.trim() || responder.isPending}
                onClick={() =>
                  responder.mutate({
                    contatoId: atual.id,
                    texto: resposta.trim(),
                  })
                }
              >
                Enviar
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
