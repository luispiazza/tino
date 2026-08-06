/*
 * Domínio 2 — a jornada esperada vem da VAGA, não da pessoa. Sem isso
 * o ponto da v1 registrava entrada e saída sem ter contra o que
 * comparar, e hora extra virava conversa.
 *
 * Turno que atravessa a meia-noite (a virada) conta certo: fim menor
 * que início significa dia seguinte.
 */

export function minutosEntre(horaInicio: string, horaFim: string): number {
  const [hi, mi] = horaInicio.split(":").map(Number);
  const [hf, mf] = horaFim.split(":").map(Number);
  const inicio = hi * 60 + mi;
  let fim = hf * 60 + mf;
  if (fim < inicio) fim += 24 * 60;
  return fim - inicio;
}

export interface Jornada {
  esperadoMin: number;
  trabalhadoMin: number | null;
  /* positivo = hora extra; negativo = saiu antes */
  diferencaMin: number | null;
}

export function compararJornada(
  turno: { horaInicio: string; horaFim: string },
  ponto: { entrada: string | null; saida: string | null } | null
): Jornada {
  const esperadoMin = minutosEntre(turno.horaInicio, turno.horaFim);
  if (!ponto?.entrada || !ponto?.saida) {
    return { esperadoMin, trabalhadoMin: null, diferencaMin: null };
  }
  const trabalhadoMin = minutosEntre(ponto.entrada, ponto.saida);
  return {
    esperadoMin,
    trabalhadoMin,
    diferencaMin: trabalhadoMin - esperadoMin,
  };
}

export function formatarHoras(minutos: number): string {
  const sinal = minutos < 0 ? "−" : "";
  const abs = Math.abs(minutos);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return m === 0 ? `${sinal}${h}h` : `${sinal}${h}h${String(m).padStart(2, "0")}`;
}
