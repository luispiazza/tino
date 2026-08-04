/*
 * Portal do Produtor — acesso por token opaco, sem login.
 * Resumo financeiro persistente (barra fixa no rodapé) e
 * "Fechar Comanda" com confirmação: ação irreversível.
 */
export default async function PortalProdutor({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return (
    <main className="p-6">
      <h1 className="text-xl font-semibold">Portal do Produtor</h1>
      <p className="mt-2 font-mono text-sm text-[--muted]">{token}</p>
    </main>
  );
}
