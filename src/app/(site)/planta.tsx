"use client";

import { useState } from "react";
import Image from "next/image";

/*
 * A planta é o argumento que nenhum concorrente publica: quem contrata
 * estúdio quer saber onde fica o camarim, se a rampa dá acesso, qual o
 * pé-direito. O desenho técnico é preto sobre branco — invertido, ele se
 * integra ao escuro em vez de virar uma mancha luminosa no meio da página.
 */
export function Planta({
  estudio,
  baixa,
  eletrica,
}: {
  estudio: string;
  baixa: string;
  eletrica?: string;
}) {
  const [vendo, setVendo] = useState<"baixa" | "eletrica">("baixa");
  const src = vendo === "eletrica" && eletrica ? eletrica : baixa;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-4">
        <span className="font-mono text-[0.6875rem] tracking-[0.22em] text-concreto uppercase">
          Planta
        </span>
        <div className="flex gap-1">
          <Aba ativa={vendo === "baixa"} onClick={() => setVendo("baixa")}>
            baixa
          </Aba>
          {eletrica && (
            <Aba
              ativa={vendo === "eletrica"}
              onClick={() => setVendo("eletrica")}
            >
              elétrica
            </Aba>
          )}
        </div>
        <a
          href={src}
          target="_blank"
          rel="noreferrer"
          className="ml-auto font-mono text-[0.6875rem] tracking-[0.16em] text-concreto uppercase transition-colors hover:text-papel focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-creme"
        >
          Abrir ↗
        </a>
      </div>

      <a
        href={src}
        target="_blank"
        rel="noreferrer"
        className="block border border-fio focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-creme"
      >
        <Image
          src={src}
          alt={`Planta ${vendo} do estúdio ${estudio}`}
          width={1919}
          height={805}
          sizes="(min-width: 1024px) 1000px, 100vw"
          className="w-full invert-[0.92] hue-rotate-180"
        />
      </a>
    </div>
  );
}

function Aba({
  ativa,
  onClick,
  children,
}: {
  ativa: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativa}
      className={`min-h-8 px-2.5 font-mono text-[0.6875rem] tracking-[0.16em] uppercase transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-creme ${
        ativa
          ? "bg-papel/10 text-papel"
          : "text-concreto hover:text-papel"
      }`}
    >
      {children}
    </button>
  );
}
