"use client";

import { ArrowRight, Check, Copy, Eye, EyeOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { StudyPlate } from "@/components/artwork";
import { Wordmark } from "@/components/logo";
import { Button, ErrorNote, StepNumber } from "@/components/ui";
import { api } from "@/lib/api";

const COMMAND = "claude setup-token";

export default function LoginPage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [name, setName] = useState("");
  const [invite, setInvite] = useState("");
  const [access, setAccess] = useState({ invite_required: false, claude_account_restricted: false });
  const [show, setShow] = useState(false);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.me().then(() => router.replace("/")).catch(() => {});
    api.access().then(setAccess).catch(() => {});
  }, [router]);

  const copy = async () => {
    await navigator.clipboard.writeText(COMMAND);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.login(token.trim(), name.trim(), invite.trim());
      router.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
      setBusy(false);
    }
  };

  const looksValid = /^sk-ant-(oat|api)/.test(token.trim());

  return (
    <main className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      {/* The plate */}
      <section className="studio-glow relative hidden flex-col justify-between border-r border-line bg-soft px-14 py-10 lg:flex">
        <Wordmark />
        <figure className="mx-auto w-full max-w-[440px]">
          <div className="relative">
            <div className="absolute -inset-x-3 inset-y-2 rotate-[3.5deg] rounded-card border border-line bg-bg shadow-e2" aria-hidden />
            <div className="absolute -inset-x-1 -inset-y-1 -rotate-[2deg] rounded-card border border-line bg-paper shadow-e2" aria-hidden />
            <div className="relative rounded-card border border-line bg-paper p-2 shadow-e4">
              <StudyPlate className="w-full" />
            </div>
          </div>
          <figcaption className="mt-6 text-center">
            <span className="block text-[13.5px] font-medium">Study for a moving picture</span>
            <span className="label">Charcoal and sienna on gesso, 2026</span>
          </figcaption>
        </figure>
        <blockquote className="max-w-[420px]">
          <p className="text-[19px] leading-[1.4] font-medium tracking-[-0.015em] text-muted">
            “The senses deform, the mind forms.”
          </p>
          <footer className="label mt-2">Georges Braque</footer>
        </blockquote>
      </section>

      {/* The door */}
      <section className="flex flex-col justify-center px-6 py-14 sm:px-14">
        <div className="mx-auto w-full max-w-[420px]">
          <div className="mb-10 lg:hidden">
            <Wordmark />
          </div>
          <p className="label">A studio for moving pictures</p>
          <h1 className="mt-2.5 text-[34px] leading-[1.08] font-semibold tracking-[-0.035em] sm:text-[40px]">
            Describe the film.<br />
            <span className="text-muted">We&apos;ll make it.</span>
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-muted">
            Describe it in a sentence or a page. Braque researches the subject, finds licensed footage, writes the piece and cuts it, frame by frame.
          </p>

          <form onSubmit={submit} className="card mt-9 p-6 shadow-e3">
            <p className="mb-5 text-[15px] font-semibold tracking-[-0.01em]">Sign in with your Claude account</p>
            <ol className="space-y-6">
              <Step n={1} title="In your terminal, run">
                <div className="field mt-2 flex items-center gap-3 bg-bg py-1.5 pr-1.5 pl-3.5 shadow-none">
                  <code className="flex-1 font-mono text-[13px] select-all">{COMMAND}</code>
                  <button
                    type="button"
                    onClick={copy}
                    className="rounded-[7px] p-1.5 text-faint transition-colors hover:bg-hover hover:text-fg"
                    aria-label="Copy command"
                  >
                    {copied ? <Check className="size-3.5 text-sage" strokeWidth={1.5} /> : <Copy className="size-3.5" strokeWidth={1.5} />}
                  </button>
                </div>
                <p className="mt-2 text-[12.5px] leading-relaxed text-faint">
                  It opens Claude in your browser, then prints a long-lived token.
                </p>
              </Step>

              <Step n={2} title="Paste the token">
                <div className="relative mt-2">
                  <input
                    type={show ? "text" : "password"}
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder="sk-ant-oat01-…"
                    autoComplete="off"
                    spellCheck={false}
                    autoFocus
                    className="field h-10 w-full pr-10 pl-3.5 font-mono text-[13px]"
                  />
                  <button
                    type="button"
                    onClick={() => setShow((s) => !s)}
                    className="absolute top-1/2 right-1.5 -translate-y-1/2 rounded-[7px] p-1.5 text-faint hover:bg-hover hover:text-fg"
                    aria-label={show ? "Hide token" : "Show token"}
                  >
                    {show ? <EyeOff className="size-3.5" strokeWidth={1.5} /> : <Eye className="size-3.5" strokeWidth={1.5} />}
                  </button>
                </div>
                {access.claude_account_restricted && (
                  <p className="mt-2 text-[12.5px] leading-relaxed text-faint">
                    Claude-account sign-in is for the studio&apos;s owner. Everyone else: paste an Anthropic API key
                    (<code className="font-mono">sk-ant-api…</code>) from{" "}
                    <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer" className="text-muted underline underline-offset-2 hover:text-fg">console.anthropic.com</a>.
                  </p>
                )}
              </Step>

              {access.invite_required && (
                <Step n={3} title="Invite code" note="first sign-in only">
                  <input
                    value={invite}
                    onChange={(e) => setInvite(e.target.value)}
                    placeholder="The code you were given"
                    autoComplete="off"
                    className="field mt-2 h-10 w-full px-3.5 text-[14px]"
                  />
                </Step>
              )}

              <Step n={access.invite_required ? 4 : 3} title="Name your studio" note="optional">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Teddy's studio"
                  maxLength={80}
                  className="field mt-2 h-10 w-full px-3.5 text-[14px]"
                />
              </Step>
            </ol>

            {error && (
              <ErrorNote className="mt-6">{error}</ErrorNote>
            )}

            <Button type="submit" variant="primary" size="lg" className="mt-7 w-full" loading={busy} disabled={!looksValid}>
              {busy ? "Checking with Claude" : "Enter the studio"}
              {!busy && <ArrowRight className="size-4" strokeWidth={1.5} />}
            </Button>
          </form>

          <p className="mt-6 px-1 text-[12px] leading-relaxed text-faint">
            Your token is encrypted at rest and only used to run your own editor. No Claude Code yet?{" "}
            <code className="font-mono">npm i -g @anthropic-ai/claude-code</code>. An Anthropic API key (
            <code className="font-mono">sk-ant-api…</code>) works here too.
          </p>
        </div>
      </section>
    </main>
  );
}

function Step({ n, title, note, children }: { n: number; title: string; note?: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <StepNumber n={n} />
      <div className="min-w-0 flex-1">
        <div className="text-[14px] leading-6 font-medium">
          {title}
          {note && <span className="ml-2 font-normal text-faint">{note}</span>}
        </div>
        {children}
      </div>
    </li>
  );
}
