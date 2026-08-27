import type { MetadataRoute } from "next";

/*
 * PWA — o admin é instalável desde já; o app de celular futuro é um
 * invólucro Capacitor sobre a mesma URL. Ícones PNG reais (192/512)
 * entram quando a identidade estiver fechada.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Tino Estúdio",
    short_name: "Tino",
    start_url: "/admin",
    display: "standalone",
    background_color: "#0a0a0a",
    theme_color: "#0a0a0a",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
  };
}
