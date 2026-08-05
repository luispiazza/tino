import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { db } from "@/server/db";
import { buscarReservaPorToken } from "@/server/reservas/portal";
import {
  brl,
  CabecalhoPortal,
  FichaReserva,
  LinkInvalido,
  StatusReserva,
} from "../../ficha";

export const dynamic = "force-dynamic";

/*
 * Portal da Reserva — a confirmação que o cliente recebe por WhatsApp.
 * O código identifica; o token na URL autentica. Valores aparecem aqui
 * (matriz: cliente vê só o próprio).
 */
export default async function PortalReserva({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const reserva = await buscarReservaPorToken(db, token, "reserva");
  if (!reserva) return <LinkInvalido />;

  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col gap-6 p-6 pt-10">
      <CabecalhoPortal titulo="Sua reserva" />
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="font-mono">{reserva.codigo}</CardTitle>
            <StatusReserva status={reserva.status} />
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <FichaReserva reserva={reserva} />
          {reserva.valorTotalCents !== null && (
            <>
              <Separator />
              <dl className="grid grid-cols-[1fr_max-content] gap-y-1.5 text-sm tabular-nums">
                <dt className="text-muted-foreground">
                  {reserva.dias} {reserva.dias === 1 ? "diária" : "diárias"}
                </dt>
                <dd className="text-right">
                  {brl(reserva.comanda.diariasCents ?? 0)}
                </dd>
                {reserva.comanda.horasExtras > 0 && (
                  <>
                    <dt className="text-muted-foreground">
                      {reserva.comanda.horasExtras}h extra
                    </dt>
                    <dd className="text-right">
                      {reserva.comanda.horaExtraCents !== null
                        ? brl(reserva.comanda.horaExtraCents)
                        : "a combinar"}
                    </dd>
                  </>
                )}
                {reserva.descontoCents > 0 && (
                  <>
                    <dt className="text-muted-foreground">Desconto</dt>
                    <dd className="text-right">
                      −{brl(reserva.descontoCents)}
                    </dd>
                  </>
                )}
                <dt className="font-medium">Total</dt>
                <dd className="text-right font-medium">
                  {brl(reserva.valorTotalCents)}
                </dd>
              </dl>
            </>
          )}
        </CardContent>
      </Card>
      <p className="text-center text-xs text-muted-foreground">
        Dúvidas ou ajustes: responda a mensagem em que recebeu este link.
      </p>
    </main>
  );
}
