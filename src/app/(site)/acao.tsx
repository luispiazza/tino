import Link from "next/link";
import { cn } from "@/lib/utils";

/*
 * A ação da vitrine. Canto reto — desenho técnico não arredonda — e
 * altura mínima de 44px, que é o alvo de toque do produtor lendo no set.
 * O creme é a única cor de ação da marca: se aparecer duas vezes na
 * mesma dobra, deixou de ser sinal.
 */
export function Acao({
  href,
  children,
  variante = "creme",
  className,
}: {
  href: string;
  children: React.ReactNode;
  variante?: "creme" | "fio";
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex min-h-11 items-center justify-center px-7 font-condensed text-sm font-semibold tracking-[0.14em] uppercase transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-creme",
        variante === "creme"
          ? "bg-creme text-fundo hover:bg-papel"
          : "border border-fio text-papel hover:border-papel/40 hover:bg-papel/5",
        className
      )}
    >
      {children}
    </Link>
  );
}
