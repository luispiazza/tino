/*
 * Os parâmetros de cor dos gráficos, num lugar só.
 *
 * Uma hue: o creme da marca em rampa ordinal — o dado do estúdio é
 * magnitude (quanto rodou, quanto entrou), não identidade. Paleta
 * categórica colorida enterraria justamente o que importa.
 *
 * Validado contra a superfície do card (#171717) pelo validador da
 * skill dataviz: rampa monotônica, degraus visíveis, ponta clara em
 * 3.55:1 — acima do piso de 2:1 para rampa ordinal.
 */
export const VIZ = {
  surface: "#171717",
  /* rampa ordinal do creme, do mais claro ao mais escuro */
  ramp: ["#e7dfd0", "#beb7a8", "#989183", "#756e60"],
  /* trilho e grade: recessivos, nunca competem com o dado */
  track: "#262626",
  grid: "#2e2e2e",
  ink: "#fafafa",
  inkMuted: "#a1a1a1",
  /* status é reservado para estado — nunca vira "série 4" */
  status: {
    ok: "#53be70",
    atencao: "#f2a618",
    atraso: "#de3b3d",
  },
} as const;

/** Intensidade do creme por fração (0–1) — mais é mais claro. */
export function tomPorFracao(fracao: number): string {
  if (fracao <= 0) return VIZ.track;
  if (fracao >= 0.75) return VIZ.ramp[0];
  if (fracao >= 0.5) return VIZ.ramp[1];
  if (fracao >= 0.25) return VIZ.ramp[2];
  return VIZ.ramp[3];
}
