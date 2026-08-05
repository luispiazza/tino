import { TRPCError } from "@trpc/server";

/*
 * A esteira de estados da cobrança (D2 do Domínio 1):
 * aguardando PO → PO recebido → emitida → paga → NF emitida → conciliada.
 * Cancelar só antes do dinheiro entrar — paga em diante é história.
 */
export type EstadoCobranca =
  | "aguardando_po"
  | "po_recebido"
  | "emitida"
  | "paga"
  | "nf_emitida"
  | "conciliada"
  | "cancelada";

const PROXIMO: Record<EstadoCobranca, EstadoCobranca | null> = {
  aguardando_po: "po_recebido",
  po_recebido: "emitida",
  emitida: "paga",
  paga: "nf_emitida",
  nf_emitida: "conciliada",
  conciliada: null,
  cancelada: null,
};

const CANCELAVEIS: EstadoCobranca[] = [
  "aguardando_po",
  "po_recebido",
  "emitida",
];

export function validarTransicao(
  de: EstadoCobranca,
  para: EstadoCobranca
): void {
  const permitido =
    para === "cancelada" ? CANCELAVEIS.includes(de) : PROXIMO[de] === para;
  if (!permitido) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Cobrança ${rotulo(de)} não pode virar ${rotulo(para)}`,
    });
  }
}

export function proximoEstado(de: EstadoCobranca): EstadoCobranca | null {
  return PROXIMO[de];
}

export function rotulo(estado: EstadoCobranca): string {
  const rotulos: Record<EstadoCobranca, string> = {
    aguardando_po: "aguardando PO",
    po_recebido: "PO recebido",
    emitida: "emitida",
    paga: "paga",
    nf_emitida: "NF emitida",
    conciliada: "conciliada",
    cancelada: "cancelada",
  };
  return rotulos[estado];
}

export function somarDias(dataISO: string, dias: number): string {
  const d = new Date(dataISO + "T00:00Z");
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}
