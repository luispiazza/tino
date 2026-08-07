import { asc, eq } from "drizzle-orm";
import type { DB } from "../db";
import {
  combinacoes,
  estudioDependencias,
  estudios,
  itens,
} from "../db/schema";

/*
 * Problema 2 da v1, de frente: `knowledgeBase` era texto digitado à mão
 * enquanto ficha técnica, preço e regra já existiam estruturados. Reajuste
 * no cadastro não chegava à IA, e nenhum erro aparecia.
 *
 * Aqui a base é MONTADA do cadastro a cada conversa. O campo de texto livre
 * da tela sobrevive só para o que não é estruturado — tom de voz, política
 * comercial, FAQ.
 *
 * O que fica de fora é tão importante quanto o que entra: custo de
 * fornecedor não aparece, porque a IA fala com cliente.
 */
export async function montarConhecimento(db: DB): Promise<string> {
  const [lista, combos, dependencias, catalogo] = await Promise.all([
    db.select().from(estudios).orderBy(asc(estudios.codigo)),
    db.select().from(combinacoes).orderBy(asc(combinacoes.nome)),
    db.select().from(estudioDependencias),
    db
      .select({
        nome: itens.nome,
        unidade: itens.unidade,
        precoCents: itens.precoCents,
      })
      .from(itens)
      .where(eq(itens.ativo, true))
      .orderBy(asc(itens.nome)),
  ]);

  const brl = (cents: number) =>
    (cents / 100).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });

  const porId = new Map(lista.map((e) => [e.id, e.codigo]));
  const partes: string[] = [];

  partes.push("## Estúdios (ficha técnica do cadastro)");
  for (const e of lista) {
    const linhas = [`### ${e.codigo} — ${e.nome}`];
    if (e.areaM2) linhas.push(`Área: ${e.areaM2} m²`);
    if (e.endereco) linhas.push(`Endereço: ${e.endereco}`);
    if (e.ehComplementar) {
      const bases = dependencias
        .filter((d) => d.estudioId === e.id)
        .map((d) => porId.get(d.dependeDeId))
        .filter(Boolean);
      linhas.push(
        `Complementar: nunca é vendido sozinho, só junto de ${bases.join(" ou ") || "um estúdio base"}.`
      );
    }
    if (e.visaoGeral) linhas.push(e.visaoGeral);
    for (const s of e.specs ?? []) linhas.push(`- ${s.rotulo}: ${s.valor}`);
    for (const c of e.caracteristicas ?? []) linhas.push(`- ${c}`);
    if (e.fichaTecnica) linhas.push(e.fichaTecnica);
    partes.push(linhas.join("\n"));
  }

  if (combos.length > 0) {
    partes.push(
      "## Combinações vendáveis\n" +
        combos
          .map(
            (c) =>
              `- ${c.nome}${c.areaM2 ? ` — ${c.areaM2} m²` : ""}${c.destaque ? " (destaque)" : ""}`
          )
          .join("\n")
    );
  }

  if (catalogo.length > 0) {
    partes.push(
      "## Rental — preço de tabela dos extras\n" +
        catalogo
          .map((i) => `- ${i.nome}: ${brl(i.precoCents)} por ${i.unidade}`)
          .join("\n") +
        "\n\nEstes são os únicos valores que você pode informar. O valor da " +
        "diária de estúdio é negociado caso a caso e não está aqui — se " +
        "perguntarem, escale para um humano."
    );
  }

  return partes.join("\n\n");
}
