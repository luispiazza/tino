import { cn } from "@/lib/utils";

/*
 * O container das telas do admin.
 *
 * Uma largura só para todas: antes cada tela escolhia a sua (2xl, 4xl,
 * 5xl) e o conteúdo pulava de lugar ao navegar. No celular isso não muda
 * nada — `max-w` só passa a valer quando sobra tela.
 */
export function Pagina({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <main
      className={cn(
        "mx-auto flex w-full max-w-6xl flex-col gap-5 p-4 sm:p-6",
        className
      )}
    >
      {children}
    </main>
  );
}
