import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import { TRPCProvider } from "@/lib/trpc/provider";
import "./globals.css";
import { cn } from "@/lib/utils";

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
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
      className={cn(plexSans.variable, plexMono.variable, "dark font-sans")}
    >
      <body>
        <TRPCProvider>{children}</TRPCProvider>
      </body>
    </html>
  );
}
