"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Banknote,
  BookUser,
  CalendarDays,
  ClipboardList,
  Gauge,
  Users,
  ListChecks,
  Megaphone,
  MessageCircle,
  PackageOpen,
  ScrollText,
  Sun,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Papel } from "@/server/context";

/*
 * Front único, acesso por papel: a navegação mostra as áreas do papel,
 * mas quem barra de verdade são os middlewares do tRPC.
 *
 * Treze destinos em fila não têm hierarquia — viram uma tira que rola.
 * Agrupados em cinco, o mapa cabe na cabeça: o que é de hoje, o que é
 * de agenda, o que é de dinheiro, o que vende e o que é cadastro.
 *
 * O ícone só existe aqui. É ele que permite o rail estreito e ajuda a
 * varrer a lista; fora da navegação, ícone é decoração e não entra.
 */

type Area = {
  href: string;
  rotulo: string;
  icone: LucideIcon;
  papeis: Papel[];
};

type Grupo = { nome: string; areas: Area[] };

/*
 * O que vai para a barra do polegar, por papel. Explícito e curto de
 * propósito: barra inferior com seis destinos deixa de ser atalho. O
 * resto continua a um toque, no menu completo.
 */
const POLEGAR: Record<Papel, string[]> = {
  socio: ["/admin", "/admin/dia", "/admin/reservas", "/admin/financeiro"],
  funcionario: ["/admin/dia", "/admin/escala", "/admin/rental"],
  fornecedor: [],
};

export const grupos: Grupo[] = [
  {
    nome: "Hoje",
    areas: [
      {
        /* só sócio: /admin manda funcionário para /admin/dia, então
           oferecer o Painel a ele seria um destino que rebate */
        href: "/admin",
        rotulo: "Painel",
        icone: Gauge,
        papeis: ["socio"],
      },
      {
        href: "/admin/dia",
        rotulo: "Dia",
        icone: Sun,
        papeis: ["socio", "funcionario"],
      },
    ],
  },
  {
    nome: "Agenda",
    areas: [
      {
        href: "/admin/reservas",
        rotulo: "Reservas",
        icone: CalendarDays,
        papeis: ["socio"],
      },
      {
        href: "/admin/escala",
        rotulo: "Escala",
        icone: ClipboardList,
        papeis: ["socio", "funcionario"],
      },
      {
        href: "/admin/rotina",
        rotulo: "Rotina",
        icone: ListChecks,
        papeis: ["socio"],
      },
    ],
  },
  {
    nome: "Dinheiro",
    areas: [
      {
        href: "/admin/financeiro",
        rotulo: "Financeiro",
        icone: Banknote,
        papeis: ["socio"],
      },
      {
        href: "/admin/rental",
        rotulo: "Rental",
        icone: PackageOpen,
        papeis: ["socio", "funcionario"],
      },
      {
        href: "/admin/relatorios",
        rotulo: "Ocupação",
        icone: Activity,
        papeis: ["socio"],
      },
    ],
  },
  {
    nome: "Venda",
    areas: [
      {
        href: "/admin/campanhas",
        rotulo: "Campanhas",
        icone: Megaphone,
        papeis: ["socio"],
      },
      {
        href: "/admin/whatsapp",
        rotulo: "WhatsApp",
        icone: MessageCircle,
        papeis: ["socio"],
      },
    ],
  },
  {
    nome: "Cadastro",
    areas: [
      {
        href: "/admin/estudios",
        rotulo: "Estúdios",
        icone: BookUser,
        papeis: ["socio"],
      },
      {
        href: "/admin/pessoas",
        rotulo: "Pessoas",
        icone: Users,
        papeis: ["socio"],
      },
      {
        href: "/admin/auditoria",
        rotulo: "Auditoria",
        icone: ScrollText,
        papeis: ["socio"],
      },
    ],
  },
];

/* /admin casa exato; o resto casa por prefixo, para subrota acender o pai */
function estaAtiva(href: string, pathname: string) {
  return href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
}

function areasDoPapel(papel: Papel) {
  return grupos
    .map((g) => ({ ...g, areas: g.areas.filter((a) => a.papeis.includes(papel)) }))
    .filter((g) => g.areas.length > 0);
}

/*
 * A sidebar do desktop. Só aparece onde há largura sobrando — as telas
 * pesadas daqui (calendário, tabelas do financeiro) precisam dela.
 */
export function SidebarAdmin({ papel }: { papel: Papel }) {
  const pathname = usePathname();
  const visiveis = areasDoPapel(papel);

  return (
    /* apertado de propósito: treze destinos e cinco rótulos precisam
       caber sem rolagem numa tela de notebook */
    <nav aria-label="Áreas do sistema" className="flex flex-col gap-4">
      {visiveis.map((grupo) => (
        <div key={grupo.nome} className="flex flex-col gap-0.5">
          <h2 className="px-3 pb-0.5 text-[10px] tracking-[0.18em] text-muted-foreground uppercase">
            {grupo.nome}
          </h2>
          {grupo.areas.map((a) => {
            const ativa = estaAtiva(a.href, pathname);
            const Icone = a.icone;
            return (
              <Link
                key={a.href}
                href={a.href}
                aria-current={ativa ? "page" : undefined}
                className={cn(
                  "flex min-h-8 items-center gap-2.5 rounded-md px-3 text-sm transition-colors",
                  ativa
                    ? "bg-accent font-medium text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                )}
              >
                <Icone aria-hidden className="size-4 shrink-0" />
                {a.rotulo}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

/*
 * A barra do polegar. O Michael abre isso às 06:00, no celular, muitas
 * vezes com as mãos ocupadas: alvo grande, poucos destinos, e nada de
 * gaveta hambúrguer, que custaria dois toques para chegar em qualquer
 * lugar. O que não cabe aqui vive no menu completo do topo.
 */
export function BarraDoPolegar({ papel }: { papel: Papel }) {
  const pathname = usePathname();
  const todas = grupos.flatMap((g) => g.areas);
  const destinos = POLEGAR[papel].flatMap((href) => {
    const area = todas.find((a) => a.href === href);
    return area && area.papeis.includes(papel) ? [area] : [];
  });

  if (destinos.length === 0) return null;

  return (
    <nav
      aria-label="Atalhos"
      className="fixed inset-x-0 bottom-0 z-40 flex border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      {destinos.map((a) => {
        const ativa = estaAtiva(a.href, pathname);
        const Icone = a.icone;
        return (
          <Link
            key={a.href}
            href={a.href}
            aria-current={ativa ? "page" : undefined}
            className={cn(
              "flex min-h-14 flex-1 flex-col items-center justify-center gap-1 text-[11px] transition-colors",
              ativa ? "text-foreground" : "text-muted-foreground"
            )}
          >
            <Icone aria-hidden className="size-5" />
            {a.rotulo}
          </Link>
        );
      })}
    </nav>
  );
}

/*
 * O mapa inteiro no celular, para os destinos que não cabem no polegar.
 * Detalhes nativo em vez de menu controlado: abre, fecha e é acessível
 * sem estado nenhum.
 */
export function MenuCompleto({ papel }: { papel: Papel }) {
  const pathname = usePathname();
  const visiveis = areasDoPapel(papel);

  return (
    <details className="group relative lg:hidden">
      <summary className="flex min-h-11 min-w-11 cursor-pointer list-none items-center justify-center rounded-md text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden">
        <span className="sr-only">Todas as áreas</span>
        <span aria-hidden className="flex flex-col gap-[3px]">
          <span className="block h-px w-4 bg-current" />
          <span className="block h-px w-4 bg-current" />
          <span className="block h-px w-4 bg-current" />
        </span>
      </summary>
      {/* treze destinos não cabem numa tela de celular: o menu rola */}
      <div className="absolute right-0 z-50 mt-2 flex max-h-[70svh] w-56 flex-col gap-4 overflow-y-auto rounded-lg border bg-popover p-3 shadow-lg">
        {visiveis.map((grupo) => (
          <div key={grupo.nome} className="flex flex-col gap-0.5">
            <h2 className="px-2 pb-1 text-[10px] tracking-[0.18em] text-muted-foreground uppercase">
              {grupo.nome}
            </h2>
            {grupo.areas.map((a) => {
              const ativa = estaAtiva(a.href, pathname);
              const Icone = a.icone;
              return (
                <Link
                  key={a.href}
                  href={a.href}
                  aria-current={ativa ? "page" : undefined}
                  className={cn(
                    "flex min-h-11 items-center gap-2.5 rounded-md px-2 text-sm",
                    ativa
                      ? "bg-accent font-medium text-accent-foreground"
                      : "text-muted-foreground"
                  )}
                >
                  <Icone aria-hidden className="size-4 shrink-0" />
                  {a.rotulo}
                </Link>
              );
            })}
          </div>
        ))}
      </div>
    </details>
  );
}
