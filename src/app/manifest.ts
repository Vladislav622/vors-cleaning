import type { MetadataRoute } from "next";
import { loadSettings } from "@/lib/server/settings";

export const dynamic = "force-dynamic";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  let name = "Ворс";
  try {
    name = (await loadSettings()).company.name;
  } catch {}
  return {
    name: `${name} — химчистка мебели`,
    short_name: name,
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#eef1ef",
    theme_color: "#eef1ef",
    lang: "ru",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
