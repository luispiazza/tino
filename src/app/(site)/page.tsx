/*
 * Vitrine pública — Domínio 6.
 * A unidade de apresentação é a combinação (A+B, A+B+C, E+C), não o estúdio.
 * Complementar (B, C) não aparece na prateleira: aparece dentro do principal.
 * SSR aqui é requisito: o SEO orgânico depende da ficha técnica no HTML.
 */
export default function Home() {
  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="text-2xl font-semibold">Tino Estúdio</h1>
      <p className="mt-2 text-[--muted]">
        Mais de 500m² em São Paulo. Quatro espaços que se combinam.
      </p>
    </main>
  );
}
