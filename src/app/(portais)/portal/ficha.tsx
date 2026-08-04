import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import type { ReservaDoPortal } from "@/server/reservas/portal";

/*
 * Peças compartilhadas dos dois portais. Tela de cliente: o código
 * identifica a conversa, a ficha responde as perguntas do dia do
 * shooting sem precisar ligar.
 */

export const dataBr = (iso: string) => iso.split("-").reverse().join("/");
export const horaCurta = (h: string) => h.slice(0, 5);
export const brl = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function CabecalhoPortal({ titulo }: { titulo: string }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <Image
        src="/logo.png"
        alt="Tino Estúdio"
        width={944}
        height={411}
        priority
        className="h-8 w-auto"
      />
      <p className="text-sm text-muted-foreground">{titulo}</p>
    </div>
  );
}

export function StatusReserva({
  status,
}: {
  status: ReservaDoPortal["status"];
}) {
  if (status === "confirmada")
    return <Badge className="bg-[--ok]/15 text-[--ok]">confirmada</Badge>;
  if (status === "cancelada")
    return (
      <Badge variant="outline" className="text-muted-foreground">
        cancelada
      </Badge>
    );
  return (
    <Badge className="bg-[--attention]/15 text-[--attention]">
      aguardando confirmação
    </Badge>
  );
}

export function FichaReserva({ reserva }: { reserva: ReservaDoPortal }) {
  return (
    <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-3 text-sm">
      {reserva.clienteNome && (
        <>
          <dt className="text-muted-foreground">Cliente</dt>
          <dd>{reserva.clienteNome}</dd>
        </>
      )}
      <dt className="text-muted-foreground">Data</dt>
      <dd className="tabular-nums">
        {dataBr(reserva.dataInicio)}
        {reserva.dataFim !== reserva.dataInicio &&
          ` a ${dataBr(reserva.dataFim)}`}
        {reserva.dias > 1 && ` · ${reserva.dias} diárias`}
      </dd>
      <dt className="text-muted-foreground">Horário</dt>
      <dd className="tabular-nums">
        {horaCurta(reserva.horaInicio)} às {horaCurta(reserva.horaFim)}
      </dd>
      <dt className="text-muted-foreground">
        {reserva.estudios.length === 1 ? "Estúdio" : "Estúdios"}
      </dt>
      <dd>
        {reserva.estudios.map((e) => (
          <div key={e.codigo}>
            <span className="font-mono font-medium">{e.codigo}</span> —{" "}
            {e.nome}
          </div>
        ))}
      </dd>
    </dl>
  );
}

export function LinkInvalido() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 p-6">
      <CabecalhoPortal titulo="" />
      <div className="max-w-sm text-center">
        <h1 className="text-lg font-semibold">Este link não abre mais</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          O endereço está incompleto ou o acesso venceu. Peça um novo link ao
          Tino Estúdio pelo WhatsApp em que você recebeu este.
        </p>
      </div>
    </main>
  );
}
