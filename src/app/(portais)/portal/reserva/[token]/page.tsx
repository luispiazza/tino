/*
 * Portal da Reserva — acesso por token opaco, sem login.
 * O código da reserva (T_DDMMYYYYX) identifica; o token autentica.
 * Token revogável, com expiração após o fechamento da comanda.
 */
export default async function PortalReserva({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return (
    <main className="p-6">
      <h1 className="text-xl font-semibold">Portal da Reserva</h1>
      <p className="mt-2 font-mono text-sm text-[--muted]">{token}</p>
    </main>
  );
}
