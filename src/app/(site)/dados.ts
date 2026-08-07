import { asc } from "drizzle-orm";
import { db } from "@/server/db";
import { estudioDependencias, estudios } from "@/server/db/schema";

/*
 * A leitura da vitrine. Uma consulta só, usada pela home, pela página de
 * campanha e pelo combinador — a campanha troca o hero, não o conteúdo.
 */

export type EstudioVitrine = typeof estudios.$inferSelect & {
  /* de quem o complementar depende: B de A; C de A e de E */
  bases: { codigo: string; nome: string }[];
};

export async function carregarEstudios(): Promise<EstudioVitrine[]> {
  const lista = await db.select().from(estudios).orderBy(asc(estudios.codigo));
  const dependencias = await db.select().from(estudioDependencias);
  const porId = new Map(lista.map((e) => [e.id, e]));

  return lista.map((e) => ({
    ...e,
    bases: dependencias
      .filter((d) => d.estudioId === e.id)
      .flatMap((d) => {
        const base = porId.get(d.dependeDeId);
        return base ? [{ codigo: base.codigo, nome: base.nome }] : [];
      }),
  }));
}
