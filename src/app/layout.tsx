import type { Metadata, Viewport } from "next";
import {
  IBM_Plex_Sans,
  IBM_Plex_Sans_Condensed,
  IBM_Plex_Mono,
} from "next/font/google";
import { TRPCProvider } from "@/lib/trpc/provider";
import "./globals.css";
import { cn } from "@/lib/utils";

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
});

/*
 * A marca é IBM Plex inteira (PRODUCT §Voz). O par de display não vem de
 * outra família, vem da largura: condensada em caixa alta para título,
 * normal para corpo, mono para todo número — é como um desenho técnico
 * se organiza, com uma grotesca só em três modos.
 */
const plexCondensed = IBM_Plex_Sans_Condensed({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-condensed",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "Tino Estúdio",
  description:
    "Complexo de estúdios de foto e vídeo em São Paulo. Mais de 500m², quatro espaços que se combinam.",
};

/* Webview-ready: o admin roda no celular hoje e vira app encapsulado depois */
export const viewport: Viewport = {
  themeColor: "#141414",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="pt-BR"
      className={cn(
        plexSans.variable,
        plexCondensed.variable,
        plexMono.variable,
        "dark font-sans"
      )}
    >
      <body>
        <TRPCProvider>{children}</TRPCProvider>
      </body>
    </html>
  );
}
