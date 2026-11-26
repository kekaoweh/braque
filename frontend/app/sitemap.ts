import type { MetadataRoute } from "next";

const SITE = process.env.PICASSO_PUBLIC_URL ?? "https://braquestudio.com";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE}/`, changeFrequency: "monthly", priority: 1 },
    { url: `${SITE}/login`, changeFrequency: "yearly", priority: 0.5 },
  ];
}
