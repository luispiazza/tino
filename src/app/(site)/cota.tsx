import { cn } from "@/lib/utils";

/*
 * A cota — o divisor da vitrine.
 *
 * É a linha de medida da planta baixa do estúdio: dois ticks, o fio
 * tracejado e o valor no meio. Serve de separador de seção *e* carrega
 * informação, porque o que o produtor compra é medida: área, pé-direito,
 * amperagem. Nada de fio decorativo — se não há número para anotar, não
 * há cota.
 */
export function Cota({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn("flex w-full items-center gap-3 sm:gap-4", className)}
      aria-hidden="true"
    >
      <Tick />
      <Fio />
      <span className="shrink-0 font-mono text-[0.6875rem] tracking-[0.18em] text-concreto uppercase tabular-nums">
        {children}
      </span>
      <Fio />
      <Tick />
    </div>
  );
}

/* o traço vertical que fecha a medida nas duas pontas */
function Tick() {
  return <span className="h-2.5 w-px shrink-0 bg-concreto/70" />;
}

function Fio() {
  return <span className="h-px min-w-4 flex-1 border-t border-dashed border-fio" />;
}

/*
 * A anotação de seção: no desenho técnico o rótulo é pequeno, em caixa
 * alta e espaçado — nunca compete com a medida.
 */
export function Anotacao({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h2
      className={cn(
        "font-mono text-[0.6875rem] tracking-[0.22em] text-concreto uppercase",
        className
      )}
    >
      {children}
    </h2>
  );
}
