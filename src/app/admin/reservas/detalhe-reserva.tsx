"use client";

import { toast } from "sonner";
import { trpc } from "@/lib/trpc/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";

/*
 * Painel de detalhe (D1): ações agrupadas por intenção — Comunicação,
 * Portais, Gerenciar. A ação principal é ENVIAR; os links dos portais
 * vão dentro da mensagem, e abrir cada portal vira conferência. O envio
 * sai pelo WhatsApp do sócio (wa.me) e o sistema registra o quando.
 */

const dataBr = (iso: string) => iso.split("-").reverse().join("/");
const horaCurtaBr = (d: Date) =>
  new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
const horaCurta = (h: string) => h.slice(0, 5);
const brl = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const ROTULO_COBRANCA: Record<string, string> = {
  aguardando_po: "aguardando PO",
  po_recebido: "PO recebido",
  emitida: "emitida",
  paga: "paga",
  nf_emitida: "NF emitida",
  conciliada: "conciliada",
};

function telefoneParaWa(telefone: string): string | null {
  const digitos = telefone.replace(/\D/g, "");
  if (digitos.length === 10 || digitos.length === 11) return `55${digitos}`;
  if (digitos.startsWith("55") && digitos.length >= 12) return digitos;
  return digitos.length >= 8 ? digitos : null;
}

export function DetalheReserva({
  reservaId,
  aoFechar,
  codigoEstudio,
}: {
  reservaId: number | null;
  aoFechar: () => void;
  codigoEstudio: (id: number) => string;
}) {
  const utils = trpc.useUtils();
  const detalhe = trpc.reservas.obter.useQuery(
    { id: reservaId ?? 0 },
    { enabled: reservaId !== null }
  );

  const aoMudar = {
    onSuccess: () => {
      utils.reservas.listar.invalidate();
      utils.reservas.obter.invalidate();
    },
    onError: (e: { message: string }) => toast.error(e.message),
  };
  const confirmar = trpc.reservas.confirmar.useMutation(aoMudar);
  const cancelar = trpc.reservas.cancelar.useMutation(aoMudar);
  const marcarEnviado = trpc.reservas.marcarWhatsappEnviado.useMutation(aoMudar);
  const criarCobranca = trpc.financeiro.criarCobranca.useMutation({
    ...aoMudar,
    onSuccess: () => {
      aoMudar.onSuccess();
      utils.financeiro.listarCobrancas.invalidate();
      toast.success("Cobrança gerada");
    },
  });

  const r = detalhe.data;

  function enviarWhatsApp() {
    if (!r?.clienteTelefone) return;
    const numero = telefoneParaWa(r.clienteTelefone);
    if (!numero) {
      toast.error("Telefone do cliente não parece válido");
      return;
    }
    const origem = window.location.origin;
    const statusRotulo =
      r.status === "confirmada" ? "confirmada" : "aguardando confirmação";
    const linhas = [
      `Olá${r.clienteNome ? `, ${r.clienteNome}` : ""}! Sua reserva no Tino Estúdio:`,
      "",
      `${r.codigo} — ${statusRotulo}`,
      `${dataBr(r.dataInicio)}${r.dataFim !== r.dataInicio ? ` a ${dataBr(r.dataFim)}` : ""} · ${horaCurta(r.horaInicio)} às ${horaCurta(r.horaFim)}`,
      `Estúdio${r.estudioIds.length > 1 ? "s" : ""}: ${r.estudioIds.map(codigoEstudio).join("+")}`,
      ...(r.valorTotalCents !== null ? [`Total: ${brl(r.valorTotalCents)}`] : []),
      "",
      "Acompanhe sua reserva:",
      `${origem}/portal/reserva/${r.tokenPortalReserva}`,
      "",
      "Portal do produtor (operação do dia):",
      `${origem}/portal/produtor/${r.tokenPortalProdutor}`,
    ];
    window.open(
      `https://wa.me/${numero}?text=${encodeURIComponent(linhas.join("\n"))}`,
      "_blank"
    );
    marcarEnviado.mutate({ id: r.id });
  }

  return (
    <Dialog open={reservaId !== null} onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-md">
        {r && (
          <>
            <DialogHeader>
              <div className="flex items-center justify-between gap-3">
                <DialogTitle className="font-mono">{r.codigo}</DialogTitle>
                {r.status === "confirmada" && (
                  <Badge className="bg-[--ok]/15 text-[--ok]">confirmada</Badge>
                )}
                {r.status === "pendente" && (
                  <Badge className="bg-[--attention]/15 text-[--attention]">
                    pendente
                  </Badge>
                )}
                {r.status === "cancelada" && (
                  <Badge variant="outline" className="text-muted-foreground">
                    cancelada
                  </Badge>
                )}
              </div>
            </DialogHeader>

            <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2 text-sm">
              {r.clienteNome && (
                <>
                  <dt className="text-muted-foreground">Cliente</dt>
                  <dd>
                    {r.clienteNome}
                    {r.clienteTelefone && (
                      <span className="text-muted-foreground">
                        {" "}
                        · {r.clienteTelefone}
                      </span>
                    )}
                  </dd>
                </>
              )}
              <dt className="text-muted-foreground">Data</dt>
              <dd className="tabular-nums">
                {dataBr(r.dataInicio)}
                {r.dataFim !== r.dataInicio && ` a ${dataBr(r.dataFim)}`}
              </dd>
              <dt className="text-muted-foreground">Horário</dt>
              <dd className="tabular-nums">
                {horaCurta(r.horaInicio)} às {horaCurta(r.horaFim)}
              </dd>
              <dt className="text-muted-foreground">Estúdios</dt>
              <dd className="font-mono">
                {r.estudioIds.map(codigoEstudio).join("+")}
              </dd>
              {(r.checkInEm || r.checkOutEm) && (
                <>
                  <dt className="text-muted-foreground">No estúdio</dt>
                  <dd className="tabular-nums">
                    {r.checkInEm ? horaCurtaBr(r.checkInEm) : "—"}
                    {" → "}
                    {r.checkOutEm ? horaCurtaBr(r.checkOutEm) : "em andamento"}
                    {r.comanda.horasExtras > 0 && (
                      <span className="text-[--attention]">
                        {" "}
                        · {r.comanda.horasExtras}h extra
                      </span>
                    )}
                  </dd>
                </>
              )}
              <dt className="text-muted-foreground">Total</dt>
              <dd className="tabular-nums">
                {r.valorTotalCents !== null ? (
                  <>
                    {brl(r.valorTotalCents)}
                    {r.descontoCents > 0 && (
                      <span className="text-muted-foreground">
                        {" "}
                        (com {brl(r.descontoCents)} de desconto)
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-muted-foreground">a negociar</span>
                )}
              </dd>
            </dl>

            <Separator />

            {/* Comunicação — a ação principal, com estado visível */}
            <div className="flex flex-col gap-2">
              <Button
                onClick={enviarWhatsApp}
                disabled={!r.clienteTelefone || marcarEnviado.isPending}
              >
                {r.whatsappEnviadoEm
                  ? "Reenviar por WhatsApp"
                  : "Enviar por WhatsApp"}
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                {!r.clienteTelefone
                  ? "Cadastre o WhatsApp do cliente para enviar"
                  : r.whatsappEnviadoEm
                    ? `Enviada em ${new Date(r.whatsappEnviadoEm).toLocaleString(
                        "pt-BR",
                        { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }
                      )} · a mensagem leva os links dos dois portais`
                    : "A mensagem leva os links dos dois portais"}
              </p>
            </div>

            <Separator />

            {/* Portais — conferência; o cliente recebe pelos links da mensagem */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                nativeButton={false}
                render={
                  <a
                    href={`/portal/reserva/${r.tokenPortalReserva}`}
                    target="_blank"
                    rel="noreferrer"
                  />
                }
              >
                Ver portal da reserva
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                nativeButton={false}
                render={
                  <a
                    href={`/portal/produtor/${r.tokenPortalProdutor}`}
                    target="_blank"
                    rel="noreferrer"
                  />
                }
              >
                Ver portal do produtor
              </Button>
            </div>

            <Separator />

            {/* Cobrança — faturar tudo no fechamento; a esteira vive no Financeiro */}
            <div className="flex flex-col gap-2">
              {r.cobrancas.filter((c) => c.estado !== "cancelada").length >
              0 ? (
                r.cobrancas
                  .filter((c) => c.estado !== "cancelada")
                  .map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-muted-foreground">
                        Cobrança de{" "}
                        <span className="text-foreground tabular-nums">
                          {brl(c.valorCents)}
                        </span>
                        {c.previsaoRecebimento &&
                          ` · previsão ${c.previsaoRecebimento
                            .split("-")
                            .reverse()
                            .join("/")}`}
                      </span>
                      <Badge
                        className={
                          ["paga", "nf_emitida", "conciliada"].includes(
                            c.estado
                          )
                            ? "bg-[--ok]/15 text-[--ok]"
                            : "bg-[--attention]/15 text-[--attention]"
                        }
                      >
                        {ROTULO_COBRANCA[c.estado] ?? c.estado}
                      </Badge>
                    </div>
                  ))
              ) : (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Sem cobrança gerada
                  </span>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={
                      r.valorTotalCents === null || criarCobranca.isPending
                    }
                    onClick={() => criarCobranca.mutate({ reservaId: r.id })}
                  >
                    Gerar cobrança
                  </Button>
                </div>
              )}
              {r.valorTotalCents === null &&
                r.cobrancas.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Defina o valor da diária para gerar a cobrança.
                  </p>
                )}
            </div>

            {/* Gerenciar — cancelar longe da ação principal (lição D1) */}
            {r.status !== "cancelada" && (
              <>
                <Separator />
                <div className="flex items-center justify-between">
                  {r.status === "pendente" ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={confirmar.isPending}
                      onClick={() => confirmar.mutate({ id: r.id })}
                    >
                      Confirmar reserva
                    </Button>
                  ) : (
                    <span />
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    disabled={cancelar.isPending}
                    onClick={() => {
                      cancelar.mutate({ id: r.id });
                      aoFechar();
                    }}
                  >
                    Cancelar reserva
                  </Button>
                </div>
              </>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
