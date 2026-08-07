/*
 * O mesmo telefone chega de três jeitos: a Meta manda E.164 sem o "+"
 * (5511999350085), o cadastro de clientes guarda o que a pessoa digitou
 * ("(11) 99935-0085") e o de pessoas às vezes veio sem o nono dígito.
 *
 * A chave de comparação é DDD + os últimos 8 dígitos: sobrevive ao país,
 * à formatação e ao nono dígito. Sem isso, o cliente que já está no
 * cadastro chega como desconhecido e cai em handoff à toa.
 */
export function chaveTelefone(bruto: string | null | undefined): string | null {
  if (!bruto) return null;
  let digitos = bruto.replace(/\D/g, "");

  /* código do país: só some quando o que sobra tem tamanho de número local */
  if (digitos.startsWith("55") && (digitos.length === 12 || digitos.length === 13)) {
    digitos = digitos.slice(2);
  }
  /* 10 = fixo com DDD, 11 = celular com o nono dígito */
  if (digitos.length < 10 || digitos.length > 11) return null;

  return digitos.slice(0, 2) + digitos.slice(-8);
}

/** Formato de exibição: (11) 99935-0085. Devolve o original se não reconhecer. */
export function formatarTelefone(bruto: string): string {
  let d = bruto.replace(/\D/g, "");
  if (d.startsWith("55") && (d.length === 12 || d.length === 13)) d = d.slice(2);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return bruto;
}

/** Para enviar: a Meta exige E.164 sem "+", com o 55 na frente. */
export function paraEnvio(bruto: string): string {
  const d = bruto.replace(/\D/g, "");
  if (d.startsWith("55") && (d.length === 12 || d.length === 13)) return d;
  return `55${d}`;
}
