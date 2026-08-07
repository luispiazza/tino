/*
 * O que a vitrine precisa e o cadastro ainda não tem.
 *
 * Regra da casa: o banco é o CMS. Tudo aqui é fallback — assim que o
 * sócio preenche `fotoUrl` e `plantaBaixaUrl` no admin, o cadastro ganha
 * e este arquivo encolhe. Nenhum texto de venda mora aqui: só caminho de
 * arquivo e número já publicado no PRODUCT.md.
 */

export const INSTAGRAM = "https://www.instagram.com/tino.estudios";

export const ENDERECOS = [
  "Rua Camilo, 789 — entrada dos estúdios A, B e C",
  "Rua Marco Aurélio, 268 — entrada da Casa Monstro",
];

/* Acervo do estúdio. Espaço sem foto aparece sem imagem, nunca com
 * placeholder genérico. */
export const FOTOS: Record<string, string> = {
  A: "/fotos/estudio-a.jpg",
  B: "/fotos/estudio-b.jpg",
  C: "/fotos/estudio-c.jpg",
  E: "/fotos/estudio-e.jpg",
};

export const PLANTAS: Record<string, { baixa: string; eletrica?: string }> = {
  A: { baixa: "/plantas/baixa-a.png", eletrica: "/plantas/eletrica-a.png" },
  C: { baixa: "/plantas/baixa-c.png", eletrica: "/plantas/eletrica-c.png" },
  E: { baixa: "/plantas/baixa-e.png", eletrica: "/plantas/eletrica-e.png" },
};

/*
 * As três combinações que mais rodam (PRODUCT.md §Contexto de operação,
 * confirmado em 29/07). Fallback enquanto a tabela `combinacoes` está
 * vazia — a vitrine apresenta combinação, não estúdio solto.
 */
export type Combinacao = {
  nome: string;
  partes: string[];
  areaM2: number;
};

export const COMBINACOES_PADRAO: Combinacao[] = [
  { nome: "A+B", partes: ["A", "B"], areaM2: 360 },
  { nome: "A+B+C", partes: ["A", "B", "C"], areaM2: 444 },
  { nome: "E+C", partes: ["E", "C"], areaM2: 144 },
];

export const SEGMENTOS = [
  "Moda",
  "Publicidade",
  "Vídeo",
  "Gastronômico",
  "Workshop",
];
