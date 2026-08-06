"use client";

import { useState } from "react";
import Image from "next/image";

/*
 * A planta é o argumento de venda que nenhum concorrente mostra: quem
 * contrata estúdio quer saber onde fica o camarim, se a rampa dá
 * acesso, qual o pé-direito. O desenho técnico é preto sobre branco —
 * invertido, ele se integra ao escuro sem virar mancha luminosa.
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
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <span className="text-xs tracking-widest text-muted-foreground uppercase">
          Planta
        </span>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setVendo("baixa")}
            className={`rounded-full px-2.5 py-0.5 text-xs transition-colors ${
              vendo === "baixa"
                ? "bg-foreground/10 text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            baixa
          </button>
          {eletrica && (
            <button
              type="button"
              onClick={() => setVendo("eletrica")}
              className={`rounded-full px-2.5 py-0.5 text-xs transition-colors ${
                vendo === "eletrica"
                  ? "bg-foreground/10 text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              elétrica
            </button>
          )}
        </div>
        <a
          href={src}
          target="_blank"
          rel="noreferrer"
          className="ml-auto text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          abrir
        </a>
      </div>
      <a href={src} target="_blank" rel="noreferrer" className="block">
        <Image
          src={src}
          alt={`Planta ${vendo} do Estúdio ${estudio}`}
          width={1919}
          height={805}
          sizes="(min-width: 1024px) 900px, 100vw"
          className="w-full rounded-lg border bg-background/50 invert-[0.92] hue-rotate-180"
        />
      </a>
    </div>
  );
}
