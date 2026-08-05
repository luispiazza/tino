import { Vitrine } from "./vitrine";

/* dinâmico: o builder do Railway não alcança o Postgres interno,
 * então pré-render de build quebraria o deploy — SSR por request */
export const dynamic = "force-dynamic";

/*
 * Vitrine pública — Domínio 6.
 * A unidade de apresentação é a combinação (A+B, A+B+C, E+C), não o estúdio.
 * SSR é requisito: o SEO orgânico depende da ficha técnica no HTML.
 */
export default function Home() {
  return <Vitrine campanha={null} />;
}
