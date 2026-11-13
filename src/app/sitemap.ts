import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
  return ["", "/services", "/contacts", "/privacy", "/credits"].map((p) => ({ url: base + p, changeFrequency: "monthly", priority: p === "" ? 1 : 0.5 }));
}
