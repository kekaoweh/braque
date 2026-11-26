import type { MetadataRoute } from "next";

const SITE = process.env.PICASSO_PUBLIC_URL ?? "https://braquestudio.com";

// Search engines may list the homepage and sign-in; the studio, people's work and private share
// links stay out of results.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: ["/", "/login"], disallow: ["/studio", "/projects", "/styles", "/settings", "/s/", "/api/"] },
    sitemap: `${SITE}/sitemap.xml`,
  };
}
