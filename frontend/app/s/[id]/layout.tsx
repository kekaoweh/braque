import type { Metadata } from "next";
import { headers } from "next/headers";

// Link previews (iMessage, Slack, WhatsApp…) read these tags from the server-rendered page, so they
// come from here rather than the client page. Inside docker compose the API is the "backend" service.
const BACKEND = process.env.PICASSO_BACKEND_URL ?? "http://127.0.0.1:8000";

type Shared = { title: string; studio: string; duration: number | null };

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("x-forwarded-host") ?? h.get("host")}`;
  let video: Shared | null = null;
  try {
    const res = await fetch(`${BACKEND}/api/share/${encodeURIComponent(id)}`, { cache: "no-store" });
    if (res.ok) video = (await res.json()) as Shared;
  } catch {}
  if (!video) return { title: "Braque", robots: { index: false } };
  const title = `${video.title || "Untitled"} · Braque`;
  const description = `A video by ${video.studio || "a Braque studio"}, made with Braque.`;
  const url = `${origin}/s/${id}`;
  return {
    title,
    description,
    robots: { index: false }, // shared privately: don't list in search engines
    openGraph: {
      type: "video.other",
      siteName: "Braque",
      title,
      description,
      url,
      videos: [{ url: `${origin}/api/share/${id}/video`, type: "video/mp4" }],
    },
    twitter: { card: "summary", title, description },
  };
}

export default function SharedLayout({ children }: { children: React.ReactNode }) {
  return children;
}
