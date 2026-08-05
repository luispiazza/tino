"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";

const horaBr = (d: Date) =>
  new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);

/*
 * Chegada e saída registradas pelo produtor, no celular, dentro do
 * estúdio. Alvo grande: é o fim do dia, mãos ocupadas. A saída é o que
 * fecha a hora extra, então o botão diz o que acontece.
 */
export function ComandaClient({
  token,
  checkInEm,
  checkOutEm,
}: {
  token: string;
  checkInEm: Date | null;
  checkOutEm: Date | null;
}) {
  const router = useRouter();
  const aoRegistrar = {
    onSuccess: () => router.refresh(),
    onError: (e: { message: string }) => toast.error(e.message),
  };
  const entrada = trpc.portais.registrarCheckIn.useMutation(aoRegistrar);
  const saida = trpc.portais.registrarCheckOut.useMutation(aoRegistrar);

  if (checkInEm && checkOutEm) {
    return (
      <div className="flex flex-col gap-1 rounded-lg border p-4 text-sm">
        <span className="text-muted-foreground">
          Chegada {horaBr(checkInEm)} · saída {horaBr(checkOutEm)}
        </span>
        <span className="text-muted-foreground">
          Qualquer ajuste, fale com o estúdio.
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {checkInEm ? (
        <>
          <p className="text-sm text-muted-foreground">
            Chegada registrada às {horaBr(checkInEm)}.
          </p>
          <Button
            size="lg"
            className="min-h-14"
            disabled={saida.isPending}
            onClick={() => saida.mutate({ token })}
          >
            {saida.isPending ? "Registrando…" : "Registrar saída"}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            A saída fecha o dia e conta a hora extra, se houver.
          </p>
        </>
      ) : (
        <>
          <Button
            size="lg"
            className="min-h-14"
            disabled={entrada.isPending}
            onClick={() => entrada.mutate({ token })}
          >
            {entrada.isPending ? "Registrando…" : "Registrar chegada"}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Marque quando a equipe entrar no estúdio.
          </p>
        </>
      )}
    </div>
  );
}
