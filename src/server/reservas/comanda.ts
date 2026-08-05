import { diasDaReserva } from "./valores";

/*
 * A comanda — o fechamento do dia de shooting.
 *
 * A diária vendida é de 12h; passou disso, é hora extra (o buffer nunca
 * bloqueia venda, ele custa). A tolerância de 30 minutos vem da v1 e
 * existe para não cobrar do cliente que está guardando equipamento.
 *
 * São Paulo não tem horário de verão desde 2019, então o deslocamento
 * fixo -03:00 é seguro para converter a hora contratada em instante.
 */
export const TOLERANCIA_MINUTOS = 30;

export function instanteDoFim(dataFim: string, horaFim: string): Date {
  return new Date(`${dataFim}T${horaFim}-03:00`);
}

/*
 * Passada a tolerância, cada hora começada é cobrada — 19:45 é uma hora,
 * 20:30 são duas. Antes da tolerância, nada.
 */
export function horasExtras(
  dataFim: string,
  horaFim: string,
  checkOutEm: Date | null
): number {
  if (!checkOutEm) return 0;
  const minutos =
    (checkOutEm.getTime() - instanteDoFim(dataFim, horaFim).getTime()) / 60000;
  if (minutos <= TOLERANCIA_MINUTOS) return 0;
  return Math.ceil(minutos / 60);
}

export interface Comanda {
  dias: number;
  diariasCents: number | null;
  horasExtras: number;
  horaExtraCents: number | null;
  extrasCents: number;
  descontoCents: number;
  totalCents: number | null;
  /* houve hora extra e ninguém definiu o preço — a tela precisa dizer */
  horaExtraSemPreco: boolean;
}

export function montarComanda(
  reserva: {
    dataInicio: string;
    dataFim: string;
    horaFim: string;
    valorDiariaCents: number | null;
    valorHoraExtraCents: number | null;
    descontoCents: number;
    checkOutEm: Date | null;
  },
  extrasCents = 0
): Comanda {
  const dias = diasDaReserva(reserva.dataInicio, reserva.dataFim);
  const horas = horasExtras(reserva.dataFim, reserva.horaFim, reserva.checkOutEm);
  const diariasCents =
    reserva.valorDiariaCents === null ? null : reserva.valorDiariaCents * dias;
  const horaExtraCents =
    horas > 0 && reserva.valorHoraExtraCents !== null
      ? reserva.valorHoraExtraCents * horas
      : horas > 0
        ? null
        : 0;

  const total =
    diariasCents === null
      ? null
      : diariasCents + (horaExtraCents ?? 0) + extrasCents - reserva.descontoCents;

  return {
    dias,
    diariasCents,
    horasExtras: horas,
    horaExtraCents,
    extrasCents,
    descontoCents: reserva.descontoCents,
    totalCents: total,
    horaExtraSemPreco: horas > 0 && reserva.valorHoraExtraCents === null,
  };
}
