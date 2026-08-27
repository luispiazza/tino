import type { Viewport } from "next";

/*
 * A casca da vitrine. O tema próprio vive aqui e não vaza para o admin
 * nem para os portais: a vitrine persuade, os portais operam.
 */

/* O fundo daqui é o --fundo da vitrine, não o do tema interno: a barra do
 * navegador acompanha, senão o topo do celular fica um tom fora. */
export const viewport: Viewport = {
  themeColor: "#0b0b0c",
};

export default function LayoutVitrine({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="vitrine min-h-svh">{children}</div>;
}
