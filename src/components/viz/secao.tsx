import { cn } from "@/lib/utils";

/*
 * As peças de layout do admin, num lugar só — para as telas de trabalho
 * (tabela e formulário) terem a mesma cara do painel sem cada uma
 * reinventar espaçamento e borda.
 */

export function Cabecalho({
  titulo,
  resumo,
  children,
}: {
  titulo: string;
  resumo?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{titulo}</h1>
        {resumo && (
          <p className="mt-0.5 text-sm text-muted-foreground">{resumo}</p>
        )}
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  );
}

export function Secao({
  titulo,
  acao,
  className,
  children,
}: {
  titulo?: string;
  acao?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("rounded-xl border bg-card p-5", className)}>
      {(titulo || acao) && (
        <div className="mb-4 flex items-baseline justify-between gap-3">
          {titulo && <h2 className="text-sm font-medium">{titulo}</h2>}
          {acao}
        </div>
      )}
      {children}
    </section>
  );
}

/*
 * O número que resume. Mono, porque é dado — e com o rótulo em cima,
 * pequeno: quem varre o painel lê o número primeiro.
 */
export function Numero({
  rotulo,
  valor,
  detalhe,
  cor,
  tamanho = "md",
}: {
  rotulo: string;
  valor: string;
  detalhe?: string;
  cor?: string;
  tamanho?: "md" | "lg";
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] tracking-wide text-muted-foreground uppercase">
        {rotulo}
      </span>
      <span
        className={cn(
          /* nunca quebrar entre o R$ e o número: no celular a coluna é
             estreita e "R$" sozinho numa linha lê como outro dado */
          "font-mono whitespace-nowrap tabular-nums",
          tamanho === "lg" ? "text-3xl leading-none" : "text-lg sm:text-xl"
        )}
        style={cor ? { color: cor } : undefined}
      >
        {valor}
      </span>
      {detalhe && (
        <span className="text-xs text-muted-foreground">{detalhe}</span>
      )}
    </div>
  );
}

/* Estado vazio: convite para agir, nunca só "sem dados". */
export function Vazio({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
      {children}
    </p>
  );
}
