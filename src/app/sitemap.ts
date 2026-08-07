import type { MetadataRoute } from "next";
import { db } from "@/server/db";
import { estudios } from "@/server/db/schema";

export const dynamic = "force-dynamic";

const BASE =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://tinoestudio.com.br";

/*
 * O SEO orgânico é o canal que o planejamento quer destravar, e as
 * páginas de estúdio são o conteúdo que ninguém mais tem (ficha
 * técnica, planta, elétrica). Elas precisam estar no mapa.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const lista = await db.select().from(estudios);
  return [
    { url: BASE, changeFrequency: "weekly", priority: 1 },
    /* o combinador é a página de conversão da vitrine */
    { url: `${BASE}/monte`, changeFrequency: "monthly", priority: 0.9 },
    ...lista.map((e) => ({
      url: `${BASE}/estudio/${e.codigo.toLowerCase()}`,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
  ];
}
