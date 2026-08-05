import { Vitrine } from "./vitrine";

export const revalidate = 60;

/*
 * Vitrine pública — Domínio 6.
 * A unidade de apresentação é a combinação (A+B, A+B+C, E+C), não o estúdio.
 * SSR é requisito: o SEO orgânico depende da ficha técnica no HTML.
 */
export default function Home() {
  return <Vitrine campanha={null} />;
}
