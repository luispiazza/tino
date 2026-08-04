import { TRPCError } from "@trpc/server";

export function diasDaReserva(dataInicio: string, dataFim: string): number {
  const um_dia = 24 * 60 * 60 * 1000;
  return (
    Math.round(
      (new Date(dataFim + "T00:00Z").getTime() -
        new Date(dataInicio + "T00:00Z").getTime()) /
        um_dia
    ) + 1
  );
}

/*
 * A trava do desconto (Fase 1, problema 7 do Domínio 1): o total nunca
 * fica negativo, e desconto sem diária definida não existe.
 */
export function validarValores(
  valorDiariaCents: number | null,
  descontoCents: number,
  dias: number
): void {
  if (descontoCents === 0) return;
  const bruto = (valorDiariaCents ?? 0) * dias;
  if (descontoCents > bruto) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        valorDiariaCents === null
          ? "Defina o valor da diária antes do desconto"
          : "Desconto maior que o valor da reserva",
    });
  }
}

export function totalCents(
  valorDiariaCents: number | null,
  descontoCents: number,
  dias: number
): number | null {
  if (valorDiariaCents === null) return null;
  return valorDiariaCents * dias - descontoCents;
}
