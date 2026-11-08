import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { APPEARANCE_SCRIPT } from "@/lib/appearance-script";
import "./globals.css";

const sans = Geist({ subsets: ["latin"], variable: "--font-geist" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

export const metadata: Metadata = {
  title: "Picasso — a studio for moving pictures",
  description: "Describe a film, bring your materials. Picasso studies them, writes the piece and cuts it.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    // The appearance script sets data-theme / data-motion before hydration, hence the warning opt-out.
    <html lang="en" className={`${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: APPEARANCE_SCRIPT }} />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
