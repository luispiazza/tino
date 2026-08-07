"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { Papel } from "@/server/context";

/*
 * Front único, acesso por papel: a navegação mostra as áreas do papel,
 * mas quem barra de verdade são os middlewares do tRPC.
 */
const areas: { href: string; rotulo: string; papeis: Papel[] }[] = [
  { href: "/admin", rotulo: "Painel", papeis: ["socio", "funcionario"] },
  { href: "/admin/dia", rotulo: "Dia", papeis: ["socio", "funcionario"] },
  { href: "/admin/reservas", rotulo: "Reservas", papeis: ["socio"] },
  { href: "/admin/financeiro", rotulo: "Financeiro", papeis: ["socio"] },
  { href: "/admin/rotina", rotulo: "Rotina", papeis: ["socio"] },
  { href: "/admin/escala", rotulo: "Escala", papeis: ["socio", "funcionario"] },
  { href: "/admin/rental", rotulo: "Rental", papeis: ["socio", "funcionario"] },
  { href: "/admin/relatorios", rotulo: "Ocupação", papeis: ["socio"] },
  { href: "/admin/estudios", rotulo: "Estúdios", papeis: ["socio"] },
  { href: "/admin/pessoas", rotulo: "Pessoas", papeis: ["socio"] },
  { href: "/admin/campanhas", rotulo: "Campanhas", papeis: ["socio"] },
  { href: "/admin/whatsapp", rotulo: "WhatsApp", papeis: ["socio"] },
  { href: "/admin/auditoria", rotulo: "Auditoria", papeis: ["socio"] },
];

export function NavAdmin({ papel }: { papel: Papel }) {
  const pathname = usePathname();
  return (
    <nav className="flex items-center gap-1 overflow-x-auto">
      {areas
        .filter((a) => a.papeis.includes(papel))
        .map((a) => {
          const ativa =
            a.href === "/admin"
              ? pathname === "/admin"
              : pathname.startsWith(a.href);
          return (
            <Link
              key={a.href}
              href={a.href}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm whitespace-nowrap",
                ativa
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {a.rotulo}
            </Link>
          );
        })}
    </nav>
  );
}
