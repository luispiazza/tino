"use client";

import { useState } from "react";
import { VIZ } from "./tokens";

/*
 * Saldo ao longo do tempo — uma série, então nada de legenda: o título
 * já nomeia. Área sob a linha em creme translúcido; a linha do zero é
 * a única referência que importa (abaixo dela, falta dinheiro).
 *
 * Hover com crosshair e tooltip: gráfico em tela é interativo por
 * padrão, não por enfeite.
 */
export function LinhaSaldo({
  pontos,
  formatarValor,
  altura = 160,
}: {
  pontos: { rotulo: string; valor: number }[];
  formatarValor: (v: number) => string;
  altura?: number;
}) {
  const [ativo, setAtivo] = useState<number | null>(null);
  if (pontos.length < 2) return null;

  const L = 8, R = 8, T = 12, B = 20;
  const W = 600;
  const H = altura;
  const valores = pontos.map((p) => p.valor);
  const max = Math.max(...valores, 0);
  const min = Math.min(...valores, 0);
  const span = max - min || 1;

  const x = (i: number) => L + (i / (pontos.length - 1)) * (W - L - R);
  const y = (v: number) => T + (1 - (v - min) / span) * (H - T - B);

  const linha = pontos.map((p, i) => `${x(i)},${y(p.valor)}`).join(" ");
  const area = `${x(0)},${y(min)} ${linha} ${x(pontos.length - 1)},${y(min)}`;
  const yZero = y(0);

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ height: altura }}
        onMouseLeave={() => setAtivo(null)}
      >
        <defs>
          <linearGradient id="preenchimento-saldo" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={VIZ.ramp[0]} stopOpacity="0.22" />
            <stop offset="100%" stopColor={VIZ.ramp[0]} stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* a linha do zero: abaixo dela o caixa está negativo */}
        {min < 0 && (
          <line
            x1={L}
            x2={W - R}
            y1={yZero}
            y2={yZero}
            stroke={VIZ.status.atraso}
            strokeWidth="1"
            strokeDasharray="3 3"
            opacity="0.7"
          />
        )}

        <polygon points={area} fill="url(#preenchimento-saldo)" />
        <polyline
          points={linha}
          fill="none"
          stroke={VIZ.ramp[0]}
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {pontos.map((p, i) => (
          <g key={p.rotulo}>
            {ativo === i && (
              <line
                x1={x(i)}
                x2={x(i)}
                y1={T}
                y2={H - B}
                stroke={VIZ.grid}
                strokeWidth="1"
              />
            )}
            <circle
              cx={x(i)}
              cy={y(p.valor)}
              r={ativo === i ? 5 : 3.5}
              fill={VIZ.ramp[0]}
              stroke={VIZ.surface}
              strokeWidth="2"
            />
            {/* alvo de hover maior que a marca */}
            <rect
              x={x(i) - (W - L - R) / (pontos.length - 1) / 2}
              y={0}
              width={(W - L - R) / (pontos.length - 1)}
              height={H}
              fill="transparent"
              onMouseEnter={() => setAtivo(i)}
            />
            <text
              x={x(i)}
              y={H - 6}
              textAnchor="middle"
              className="fill-muted-foreground"
              style={{ fontSize: 10 }}
            >
              {p.rotulo}
            </text>
          </g>
        ))}
      </svg>

      {ativo !== null && (
        <div
          className="pointer-events-none absolute top-0 rounded-md border bg-popover px-2 py-1 text-xs shadow-md"
          style={{
            left: `${(x(ativo) / W) * 100}%`,
            transform: "translateX(-50%)",
          }}
        >
          <span className="text-muted-foreground">{pontos[ativo].rotulo}</span>{" "}
          <span className="font-mono tabular-nums">
            {formatarValor(pontos[ativo].valor)}
          </span>
        </div>
      )}
    </div>
  );
}
