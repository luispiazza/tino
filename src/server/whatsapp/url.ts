/*
 * Duas perguntas parecidas com respostas diferentes — e confundir as duas
 * foi o que fez o atendimento sumir sem erro nenhum aparecer.
 */

/** O host que está de fato servindo este pedido. */
function hostDoPedido(req: Request): string {
  const host =
    req.headers.get("x-forwarded-host") ??
    req.headers.get("host") ??
    new URL(req.url).host;
  const protocolo =
    req.headers.get("x-forwarded-proto") ??
    (host.startsWith("localhost") || host.startsWith("127.0.0.1")
      ? "http"
      : "https");
  return `${protocolo}://${host}`;
}

/**
 * Endereço do webhook para colar no App Dashboard da Meta.
 *
 * Sai SEMPRE do host real, nunca de variável: é o deploy que precisa
 * receber a entrega. Um domínio público configurado errado — ou apontando
 * para outro deploy — faz a Meta entregar em outro lugar, e o sintoma é
 * histórico vazio sem um único erro em lugar nenhum.
 */
export function urlDoWebhook(req: Request): string {
  return `${hostDoPedido(req)}/api/whatsapp/webhook`;
}

/**
 * Base dos links que a IA manda ao cliente (portais da reserva).
 *
 * Aqui o domínio público ganha quando existe, porque é o endereço que o
 * cliente vê. Mas sem ele o link cai no host do pedido em vez de num
 * domínio chutado: link que abre num endereço feio é constrangimento,
 * link que dá 404 na mão do cliente é outra coisa.
 */
export function baseParaLinks(req: Request): string {
  const publico = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  return publico ? publico.replace(/\/$/, "") : hostDoPedido(req);
}
