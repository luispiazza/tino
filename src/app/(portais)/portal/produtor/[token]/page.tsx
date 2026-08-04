import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
 * Portal do Produtor — o lado operacional do job. Check-in/check-out,
 * extras e fechamento de comanda entram nas próximas fases; o resumo
 * financeiro é barra fixa no rodapé (decisão de 29/07), com a
 * composição do total sempre à vista.
 */
export default async function PortalProdutor({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const reserva = await buscarReservaPorToken(db, token, "produtor");
  if (!reserva) return <LinkInvalido />;

  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col gap-6 p-6 pt-10 pb-24">
      <CabecalhoPortal titulo="Portal do produtor" />
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="font-mono">{reserva.codigo}</CardTitle>
            <StatusReserva status={reserva.status} />
          </div>
        </CardHeader>
        <CardContent>
          <FichaReserva reserva={reserva} />
        </CardContent>
      </Card>
      <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
        Check-in, extras e fechamento de comanda vão aparecer aqui no dia do
        shooting.
      </p>

      {reserva.valorTotalCents !== null && (
        <div className="fixed inset-x-0 bottom-0 border-t bg-card/95 backdrop-blur">
          <div className="mx-auto flex max-w-md items-baseline justify-between px-6 py-3 text-sm">
            <span className="text-muted-foreground">
              {reserva.dias} {reserva.dias === 1 ? "diária" : "diárias"}
              {reserva.descontoCents > 0 &&
                ` − ${brl(reserva.descontoCents)} de desconto`}
            </span>
            <span className="font-medium tabular-nums">
              {brl(reserva.valorTotalCents)}
            </span>
          </div>
        </div>
      )}
    </main>
  );
}
