import { ArrowRight, Clapperboard, Film, KeyRound, Library, MessageSquareText, Palette, Search, Share2, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ReactNode } from "react";
import { StudyPlate } from "@/components/artwork";
import { AuthActions } from "@/components/landing/auth-actions";
import { Wordmark } from "@/components/logo";

// The public homepage: what Braque is, how it works, who made it. Rendered on the server so search
// engines and link previews can read it; the studio itself lives at /studio.

const SITE = process.env.PICASSO_PUBLIC_URL ?? "https://braquestudio.com";
const FOUNDER = { name: "Keka Oweh", url: "https://github.com/kekaoweh" };
const DESCRIPTION =
  "Braque is an AI video studio. Describe a film in a sentence or a page; Braque researches the subject, " +
  "finds licensed footage, writes the script and cuts the video for you.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: "Braque — describe the film, we'll make it",
  description: DESCRIPTION,
  authors: [FOUNDER],
  creator: FOUNDER.name,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "Braque",
    url: "/",
    title: "Braque — describe the film, we'll make it",
    description: DESCRIPTION,
  },
  twitter: { card: "summary", title: "Braque — describe the film, we'll make it", description: DESCRIPTION },
};

// Structured data: lets search engines answer "what is Braque" and "who made it" directly.
const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE}/#org`,
      name: "Braque",
      url: SITE,
      founder: { "@type": "Person", name: FOUNDER.name, url: FOUNDER.url },
    },
    {
      "@type": "SoftwareApplication",
      name: "Braque",
      url: SITE,
      applicationCategory: "MultimediaApplication",
      operatingSystem: "Web",
      description: DESCRIPTION,
      creator: { "@type": "Person", name: FOUNDER.name, url: FOUNDER.url },
      publisher: { "@id": `${SITE}/#org` },
    },
  ],
};

const STEPS: [string, string][] = [
  ["Describe it", "A sentence or a page: the subject, who it's for, how it should feel. Pick a length, a format and a style."],
  ["Braque researches", "It checks facts, names and places on the web, then plans the beats of the piece and the image each one needs."],
  ["It finds the footage", "It searches licensed libraries, studies the clips frame by frame and keeps only the shots that belong together."],
  ["It writes and cuts", "A script, a timeline, on-screen words, motion and music, rendered into a finished video you can download or share."],
];

const FEATURES: [ReactNode, string, string][] = [
  [<Library key="l" />, "Licensed footage, found for you", "Pixabay, Wikimedia Commons, NASA and the Internet Archive. No uploads needed, and every clip is credited."],
  [<Search key="s" />, "Research before it writes", "Braque looks things up so names, dates and places are right before a single word goes on screen."],
  [<Palette key="p" />, "Styles that set the look", "Documentary, cinematic, kinetic and more, or compose your own: pacing, captions, transitions and color grade."],
  [<MessageSquareText key="m" />, "Revise in plain words", "“Let the opening breathe, end on the wide shot.” Every revision becomes a new version you can compare."],
  [<Share2 key="h" />, "Share with a link", "Send clients a private link to watch and download a finished video. No account needed on their side."],
  [<KeyRound key="k" />, "Runs on Claude, on your key", "The editor is built on Anthropic's Claude. Your key is encrypted and only ever runs your own videos."],
];

const FAQ: [string, string][] = [
  ["What do I need to start?", "During early access you need an invite link, plus an Anthropic API key from console.anthropic.com so the editor can work. Braque walks you through connecting it in about two minutes."],
  ["What does it cost?", "Braque's AI runs on your Anthropic account, which bills you directly for what you use. A short video usually costs well under a dollar."],
  ["Where does the footage come from?", "From libraries whose licenses allow reuse: Pixabay, Wikimedia Commons, NASA and the Internet Archive. Each video keeps a list of the clips it used and their credits."],
  ["Can I use my own footage?", "Yes. Uploads are optional: add clips, photos or music and Braque cuts them in, or tag a clip as a reference to show the look you want."],
  ["Who can see my videos?", "Only you, until you create a share link for a version. You can turn a link off at any time."],
];

const link =
  "inline-flex h-11 items-center justify-center gap-2 rounded-control px-5 text-[14.5px] font-medium transition-[box-shadow,background,color]";
const primary = `${link} bg-[linear-gradient(180deg,color-mix(in_srgb,var(--fg)_86%,white)_0%,var(--fg)_100%)] text-bg shadow-e2 hover:shadow-e3`;
const secondary = `${link} border border-line-strong bg-paper text-fg shadow-e1 hover:shadow-e2`;

export default function Home() {
  return (
    <div className="min-h-dvh bg-bg">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />

      <header className="glass sticky top-0 z-30 border-b border-line">
        <div className="mx-auto flex h-16 max-w-[1120px] items-center justify-between gap-6 px-5 sm:px-8">
          <Link href="/" aria-label="Braque home"><Wordmark /></Link>
          <nav className="hidden items-center gap-1 text-[13.5px] text-muted md:flex" aria-label="Page">
            {[["#how", "How it works"], ["#features", "Features"], ["#about", "About"], ["#faq", "FAQ"]].map(([href, label]) => (
              <a key={href} href={href} className="rounded-control px-3 py-1.5 transition-colors hover:bg-hover hover:text-fg">{label}</a>
            ))}
          </nav>
          <AuthActions />
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="studio-glow">
          <div className="mx-auto grid max-w-[1120px] items-center gap-14 px-5 pt-16 pb-20 sm:px-8 lg:grid-cols-[1.1fr_1fr] lg:pt-24 lg:pb-28">
            <div>
              <p className="label">An AI studio for moving pictures</p>
              <h1 className="mt-3 text-[44px] leading-[1.02] font-semibold tracking-[-0.045em] sm:text-[64px]">
                Describe the film.<br />
                <span className="text-accent">We&apos;ll make it.</span>
              </h1>
              <p className="mt-6 max-w-[540px] text-[17px] leading-relaxed text-muted">
                Braque researches your subject, finds licensed footage, writes the script and cuts the video:
                a finished film from a sentence or a page.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/login?signup" className={primary}>Get started <ArrowRight className="size-4" strokeWidth={1.75} /></Link>
                <a href="#how" className={secondary}>See how it works</a>
              </div>
              <p className="mt-4 text-[13px] text-faint">Early access: invite only.</p>
            </div>
            <figure className="relative mx-auto w-full max-w-[300px] sm:max-w-[420px]" aria-hidden>
              <div className="absolute -inset-x-3 inset-y-2 rotate-[3.5deg] rounded-card border border-line bg-bg shadow-e2" />
              <div className="absolute -inset-x-1 -inset-y-1 -rotate-[2deg] rounded-card border border-line bg-paper shadow-e2" />
              <div className="relative rounded-card border border-line bg-paper p-2 shadow-e4">
                <StudyPlate className="w-full" />
              </div>
            </figure>
          </div>
        </section>

        {/* How it works */}
        <Section id="how" eyebrow="How it works" title="From an idea to a finished cut">
          <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map(([title, body], i) => (
              <li key={title} className="card p-5">
                <span className="flex size-8 items-center justify-center rounded-full border border-line-strong bg-bg text-[13px] font-semibold text-muted">
                  {i + 1}
                </span>
                <h3 className="mt-4 text-[16px] font-semibold tracking-[-0.01em]">{title}</h3>
                <p className="mt-1.5 text-[14px] leading-relaxed text-muted">{body}</p>
              </li>
            ))}
          </ol>
        </Section>

        {/* Features */}
        <Section id="features" eyebrow="Features" title="An editor that does the whole job" soft>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(([icon, title, body]) => (
              <div key={title} className="card p-5">
                <span className="flex size-9 items-center justify-center rounded-[10px] bg-accent-soft text-accent [&>svg]:size-[18px] [&>svg]:stroke-[1.75]">
                  {icon}
                </span>
                <h3 className="mt-4 text-[15.5px] font-semibold tracking-[-0.01em]">{title}</h3>
                <p className="mt-1.5 text-[14px] leading-relaxed text-muted">{body}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* About */}
        <Section id="about" eyebrow="About" title="About Braque">
          <div className="grid gap-10 lg:grid-cols-[1.3fr_1fr]">
            <div className="space-y-4 text-[16px] leading-relaxed text-muted">
              <p>
                Braque is an independent studio created by{" "}
                <a href={FOUNDER.url} target="_blank" rel="noreferrer" className="font-medium text-fg underline-offset-4 hover:underline">
                  {FOUNDER.name}
                </a>
                . It started from a simple idea: making a good video shouldn&apos;t require a timeline, a stock-footage
                subscription and a weekend. You should be able to say what you want and get a film back.
              </p>
              <p>
                Under the hood, Braque is an agent built on Anthropic&apos;s Claude. It works the way an editor would:
                it reads your brief, does its research, looks at real footage before choosing it, writes, cuts, and
                explains its choices so you can direct the next version.
              </p>
            </div>
            <aside className="card p-6">
              <div className="flex items-center gap-2 text-[13px] font-medium text-faint">
                <Sparkles className="size-4" strokeWidth={1.75} /> Why “Braque”
              </div>
              <p className="mt-3 text-[15px] leading-relaxed">
                Named for <span className="font-medium">Georges Braque</span>, who invented Cubism alongside Picasso:
                seeing a subject from many angles at once, then assembling it into one picture. That&apos;s what an
                editor does with footage, and why our mark is a cubist eye.
              </p>
              <p className="mt-4 text-[14px] text-muted italic">“The senses deform, the mind forms.” — Georges Braque</p>
            </aside>
          </div>
        </Section>

        {/* FAQ */}
        <Section id="faq" eyebrow="FAQ" title="Questions" soft>
          <div className="mx-auto max-w-[760px] divide-y divide-line rounded-card border border-line bg-paper shadow-e1">
            {FAQ.map(([q, a]) => (
              <details key={q} className="group px-5 py-4 [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[15px] font-medium">
                  {q}
                  <span className="text-faint transition-transform group-open:rotate-45" aria-hidden>+</span>
                </summary>
                <p className="mt-2.5 text-[14.5px] leading-relaxed text-muted">{a}</p>
              </details>
            ))}
          </div>
        </Section>

        {/* Call to action */}
        <section className="mx-auto max-w-[1120px] px-5 py-20 sm:px-8">
          <div className="card flex flex-col items-start gap-6 p-8 shadow-e3 sm:p-10 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex items-center gap-2 text-accent"><Clapperboard className="size-5" strokeWidth={1.75} /><Film className="size-5" strokeWidth={1.75} /></div>
              <h2 className="mt-3 text-[26px] leading-tight font-semibold tracking-[-0.03em]">Make your first film</h2>
              <p className="mt-2 max-w-[520px] text-[15px] leading-relaxed text-muted">
                Braque is in early access. If you have an invite link, it takes you straight to sign-up.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/login?signup" className={primary}>Create an account</Link>
              <Link href="/login" className={secondary}>Sign in</Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-[1120px] flex-col gap-3 px-5 py-8 text-[13px] text-faint sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <span>© {new Date().getFullYear()} Braque. Created by {FOUNDER.name}.</span>
          <nav className="flex gap-4" aria-label="Footer">
            <a href="#about" className="hover:text-muted">About</a>
            <a href="#faq" className="hover:text-muted">FAQ</a>
            <Link href="/login" className="hover:text-muted">Sign in</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

function Section({ id, eyebrow, title, soft, children }: { id: string; eyebrow: string; title: string; soft?: boolean; children: ReactNode }) {
  return (
    <section id={id} className={soft ? "scroll-mt-16 border-y border-line bg-soft/50" : "scroll-mt-16"}>
      <div className="mx-auto max-w-[1120px] px-5 py-20 sm:px-8">
        <p className="label">{eyebrow}</p>
        <h2 className="mt-2 mb-10 text-[32px] leading-tight font-semibold tracking-[-0.035em] sm:text-[38px]">{title}</h2>
        {children}
      </div>
    </section>
  );
}
