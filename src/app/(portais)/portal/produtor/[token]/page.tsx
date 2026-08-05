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
import { ComandaClient } from "./comanda-client";
import { ExtrasClient } from "./extras-client";

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
      <ComandaClient
        token={token}
        checkInEm={reserva.checkInEm}
        checkOutEm={reserva.checkOutEm}
      />

      {reserva.comanda.horasExtras > 0 && (
        <p className="rounded-lg border border-dashed p-4 text-sm text-[--attention]">
          {reserva.comanda.horasExtras}h de hora extra além das{" "}
          {reserva.horaFim.slice(0, 5)}
          {reserva.comanda.horaExtraCents !== null &&
            ` · ${brl(reserva.comanda.horaExtraCents)}`}
          {reserva.comanda.horaExtraSemPreco && " · valor a combinar"}
        </p>
      )}

      {reserva.extras.length > 0 && (
        <div className="flex flex-col gap-2 rounded-lg border p-4">
          <h2 className="text-sm font-medium">Já pedido</h2>
          <ul className="flex flex-col gap-1 text-sm">
            {reserva.extras.map((e, i) => (
              <li key={i} className="flex justify-between gap-3">
                <span className="text-muted-foreground">
                  {e.qtd}× {e.nomeItem}
                </span>
                <span className="tabular-nums">{brl(e.qtd * e.precoCents)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {reserva.status !== "cancelada" && <ExtrasClient token={token} />}

      {reserva.valorTotalCents !== null && (
        <div className="fixed inset-x-0 bottom-0 border-t bg-card/95 backdrop-blur">
          <div className="mx-auto flex max-w-md items-baseline justify-between px-6 py-3 text-sm">
            <span className="text-muted-foreground">
              {reserva.dias} {reserva.dias === 1 ? "diária" : "diárias"}
              {reserva.comanda.horasExtras > 0 &&
                ` + ${reserva.comanda.horasExtras}h extra`}
              {reserva.comanda.extrasCents > 0 &&
                ` + ${brl(reserva.comanda.extrasCents)} em extras`}
              {reserva.descontoCents > 0 &&
                ` − ${brl(reserva.descontoCents)}`}
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
