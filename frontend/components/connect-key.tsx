"use client";

import { ExternalLink, KeyRound, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button, ErrorNote, IconButton, StepNumber } from "@/components/ui";
import { api, User } from "@/lib/api";
import { cleanKey, keyKind } from "@/lib/keys";

const CONSOLE = "https://console.anthropic.com";

/**
 * "Connect your Anthropic API key": the one thing a customer has to do before their first video
 * (when the studio doesn't provide credit). Four short steps, one paste, verified with Claude.
 */
export function ConnectKeyDialog({
  open,
  onClose,
  onConnected,
}: {
  open: boolean;
  onClose: () => void;
  onConnected: (user: User) => void;
}) {
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const field = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setKey("");
    setError(null);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const cleaned = cleanKey(key);
  const kind = keyKind(cleaned);

  const connect = async () => {
    if (!cleaned || busy) return;
    setBusy(true);
    setError(null);
    try {
      onConnected(await api.setKey(cleaned));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't connect that key");
      setBusy(false);
      return;
    }
    setBusy(false);
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-fg/20 p-4 pt-[8vh] backdrop-blur-[2px]" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-label="Connect your Anthropic API key"
        className="fade-up w-full max-w-[520px] overflow-hidden rounded-sheet border border-line bg-paper shadow-e4"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 px-6 pt-6">
          <div>
            <div className="mb-3 flex size-10 items-center justify-center rounded-full bg-accent-soft text-accent">
              <KeyRound className="size-5" strokeWidth={1.75} />
            </div>
            <h2 className="text-[19px] font-semibold tracking-[-0.02em]">One step before your first video</h2>
            <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted">
              Braque&apos;s editor runs on Claude. Connect an Anthropic API key and Anthropic bills you directly for
              what you make. A short video usually costs well under $1. It takes about two minutes.
            </p>
          </div>
          <IconButton onClick={onClose} aria-label="Close" className="-mt-1 -mr-2 shrink-0">
            <X className="size-4" strokeWidth={1.75} />
          </IconButton>
        </div>

        <ol className="space-y-4 px-6 pt-5">
          <Step n={1} title="Open the Anthropic Console" href={CONSOLE} link="console.anthropic.com">
            Sign up or log in. It&apos;s separate from a Claude.ai subscription.
          </Step>
          <Step n={2} title="Add some credit" href={`${CONSOLE}/settings/billing`} link="Billing">
            Buy credits; $5 is plenty to start. You can set a monthly limit there too.
          </Step>
          <Step n={3} title="Create a key" href={`${CONSOLE}/settings/keys`} link="API keys">
            Click <b className="font-medium text-fg">Create key</b>, name it &ldquo;Braque&rdquo;, and copy it. It&apos;s shown only once.
          </Step>
          <li className="flex gap-3">
            <StepNumber n={4} />
            <div className="min-w-0 flex-1">
              <div className="text-[14px] leading-6 font-medium">Paste it here</div>
              <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); connect(); }}>
                <input
                  ref={field}
                  type="password"
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  onPaste={(e) => {
                    const text = e.clipboardData.getData("text");
                    if (!text) return;
                    e.preventDefault();
                    setKey(cleanKey(text));
                  }}
                  placeholder="sk-ant-api03-…"
                  aria-label="Your API key"
                  autoComplete="off"
                  spellCheck={false}
                  autoFocus
                  className="field h-10 min-w-0 flex-1 px-3.5 font-mono text-[13px]"
                />
                <Button type="submit" variant="primary" className="h-10" loading={busy} disabled={!cleaned}>
                  {busy ? "Checking" : "Connect"}
                </Button>
              </form>
              {kind === "claude" && (
                <p className="mt-2 text-[12.5px] leading-relaxed text-brick">
                  That&apos;s a Claude-account token, not an API key. Create an API key in step 3; it starts with{" "}
                  <code className="font-mono">sk-ant-api</code>.
                </p>
              )}
              {error && <ErrorNote className="mt-2.5">{error}</ErrorNote>}
            </div>
          </li>
        </ol>

        <div className="mt-6 flex items-center justify-between border-t border-line bg-bg/60 px-6 py-3.5">
          <p className="text-[12px] text-faint">Your key is encrypted and only runs your own videos.</p>
          <Button size="sm" variant="ghost" onClick={onClose}>Not now</Button>
        </div>
      </div>
    </div>
  );
}

function Step({ n, title, href, link, children }: { n: number; title: string; href: string; link: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <StepNumber n={n} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <span className="text-[14px] leading-6 font-medium">{title}</span>
          <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[13px] text-accent underline-offset-4 hover:underline">
            {link}
            <ExternalLink className="size-3" strokeWidth={2} />
          </a>
        </div>
        <p className="mt-0.5 text-[12.5px] leading-relaxed text-faint">{children}</p>
      </div>
    </li>
  );
}
