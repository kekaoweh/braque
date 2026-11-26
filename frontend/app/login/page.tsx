"use client";

import { ArrowLeft, ArrowRight, Check, Copy, ExternalLink, Eye, EyeOff, KeyRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, ReactNode, useEffect, useRef, useState } from "react";
import { StudyPlate } from "@/components/artwork";
import { Wordmark } from "@/components/logo";
import { Button, ErrorNote, Segmented, StepNumber } from "@/components/ui";
import { Access, api } from "@/lib/api";
import { cleanCode, cleanKey as clean } from "@/lib/keys";

const COMMAND = "claude setup-token";

/**
 * How you get in:
 * - "signin" / "signup": email and password. The default; customers' videos run on the studio key.
 * - "key": your own Anthropic API key (you pay Anthropic directly, no studio limit).
 * - "admin": the site admin's Claude account (claude setup-token), plus the admin code on a server.
 */
type View = "signin" | "signup" | "key" | "admin";

export default function LoginPage() {
  const router = useRouter();
  const [view, setView] = useState<View>("signin");
  const [access, setAccess] = useState<Access>({
    invite_required: false, claude_account_restricted: false, owner_code_enabled: false,
    studio_credit: false, studio_monthly_limit: 0,
  });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const [name, setName] = useState("");
  const [invite, setInvite] = useState("");
  const [adminCode, setAdminCode] = useState("");
  const adminField = useRef<HTMLInputElement>(null);
  const [show, setShow] = useState(false);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // An invite link (/login?invite=CODE) opens Create account with the code already applied.
  const [invited, setInvited] = useState(false);
  useEffect(() => {
    api.me().then(() => router.replace("/")).catch(() => {});
    api.access().then(setAccess).catch(() => {});
    const code = new URLSearchParams(window.location.search).get("invite");
    if (code) {
      setInvite(cleanCode(code));
      setInvited(true);
      setView("signup");
    }
  }, [router]);

  const go = (next: View) => {
    setView(next);
    setError(null);
  };

  const cleaned = clean(token);
  // A pasted key picks its own route: a Claude-account token is the admin's, an API key anyone's.
  const pastedKind = cleaned.startsWith("sk-ant-oat") ? "admin" : cleaned.startsWith("sk-ant-api") ? "key" : null;
  useEffect(() => {
    if (pastedKind && (view === "key" || view === "admin")) setView(pastedKind);
  }, [pastedKind]); // eslint-disable-line react-hooks/exhaustive-deps
  const askAdminCode = view === "admin" && access.claude_account_restricted && access.owner_code_enabled;
  const askInvite = access.invite_required && (view === "signup" || view === "key");

  const copy = async () => {
    await navigator.clipboard.writeText(COMMAND);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (askAdminCode && !cleanCode(adminCode)) {
      setError("Enter the admin code in step 3. It's PICASSO_OWNER_CODE in deploy/.env on your Mac.");
      adminField.current?.focus();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (view === "signin") await api.signin(email, password);
      else if (view === "signup") {
        await api.signup({ email, password, name: name.trim(), invite: cleanCode(invite) });
        // New customers land on the Studio, which walks them through connecting a key if they need one.
        router.replace("/?welcome");
        return;
      } else await api.login(cleaned, name.trim(), askInvite ? cleanCode(invite) : "", askAdminCode ? cleanCode(adminCode) : "");
      router.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
      setBusy(false);
    }
  };

  const ready = view === "signin" || view === "signup" ? !!email.trim() && !!password : !!cleaned;
  const tokenInput = (
    <div className="relative mt-2">
      <input
        type={show ? "text" : "password"}
        value={token}
        onChange={(e) => setToken(e.target.value)}
        // Read the clipboard ourselves: a single-line input drops line breaks, which would glue a
        // wrapped key's border characters into the middle of it.
        onPaste={(e) => {
          const text = e.clipboardData.getData("text");
          if (!text) return;
          e.preventDefault();
          setToken(clean(text));
        }}
        placeholder={view === "key" ? "sk-ant-api03-…" : "sk-ant-oat01-…"}
        aria-label={view === "key" ? "API key" : "Claude token"}
        autoComplete="off"
        spellCheck={false}
        autoFocus
        className="field h-10 w-full pr-10 pl-3.5 font-mono text-[13px]"
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute top-1/2 right-1.5 -translate-y-1/2 rounded-[7px] p-1.5 text-faint hover:bg-hover hover:text-fg"
        aria-label={show ? "Hide key" : "Show key"}
      >
        {show ? <EyeOff className="size-3.5" strokeWidth={1.5} /> : <Eye className="size-3.5" strokeWidth={1.5} />}
      </button>
    </div>
  );
  const inviteInput = (
    <input
      value={invite}
      onChange={(e) => setInvite(e.target.value)}
      placeholder="The code you were given"
      autoComplete="off"
      aria-label="Invite code"
      className="field mt-2 h-10 w-full px-3.5 text-[14px]"
    />
  );
  const nameInput = (
    <input
      value={name}
      onChange={(e) => setName(e.target.value)}
      placeholder="e.g. Teddy's studio"
      maxLength={80}
      aria-label="Studio name"
      className="field mt-2 h-10 w-full px-3.5 text-[14px]"
    />
  );

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
            {view === "signin" || view === "signup" ? (
              <>
                <Segmented<View>
                  value={view}
                  onChange={go}
                  options={[["signin", "Sign in"], ["signup", "Create account"]]}
                  className="mb-5 w-full [&>button]:flex-1 [&>button]:justify-center"
                />
                <div className="space-y-3.5">
                  <Field label="Email">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      autoComplete="email"
                      autoFocus
                      className="field mt-1.5 h-10 w-full px-3.5 text-[14px]"
                    />
                  </Field>
                  <Field label="Password" note={view === "signup" ? "at least 8 characters" : undefined}>
                    <div className="relative mt-1.5">
                      <input
                        type={show ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete={view === "signup" ? "new-password" : "current-password"}
                        aria-label="Password"
                        className="field h-10 w-full pr-10 pl-3.5 text-[14px]"
                      />
                      <button
                        type="button"
                        onClick={() => setShow((s) => !s)}
                        className="absolute top-1/2 right-1.5 -translate-y-1/2 rounded-[7px] p-1.5 text-faint hover:bg-hover hover:text-fg"
                        aria-label={show ? "Hide password" : "Show password"}
                      >
                        {show ? <EyeOff className="size-3.5" strokeWidth={1.5} /> : <Eye className="size-3.5" strokeWidth={1.5} />}
                      </button>
                    </div>
                  </Field>
                  {view === "signup" && (
                    <>
                      {access.invite_required && (invited ? (
                        <p className="flex items-center gap-2 rounded-control bg-sage-soft px-3.5 py-2 text-[13px] text-sage">
                          <Check className="size-3.5" strokeWidth={2} />
                          Invite applied
                          <button type="button" onClick={() => setInvited(false)} className="ml-auto text-[12px] text-muted underline-offset-4 hover:underline">
                            Change
                          </button>
                        </p>
                      ) : <Field label="Invite code">{inviteInput}</Field>)}
                      <Field label="Name your studio" note="optional">{nameInput}</Field>
                      <p className="rounded-control bg-bg px-3.5 py-2.5 text-[12.5px] leading-relaxed text-muted">
                        {access.studio_credit
                          ? `Includes $${access.studio_monthly_limit} of video credit every month, so there's nothing to set up. You can add your own Anthropic API key later for unlimited use.`
                          : "Next, you'll connect an Anthropic API key (about two minutes); Anthropic bills you directly for what you make."}
                      </p>
                    </>
                  )}
                </div>
              </>
            ) : (
              <>
                <button type="button" onClick={() => go("signin")} className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-fg">
                  <ArrowLeft className="size-3.5" strokeWidth={1.75} />
                  Email sign-in
                </button>
                <p className="text-[15px] font-semibold tracking-[-0.01em]">
                  {view === "key" ? "Sign in with an Anthropic API key" : "Site admin"}
                </p>
                <p className="mt-1 mb-5 text-[13px] leading-relaxed text-faint">
                  {view === "key"
                    ? "Your videos run on your own key, billed by Anthropic for what you use, with no monthly limit."
                    : "For the person who runs this site: sign in with your Claude account."}
                </p>
                <ol className="space-y-6">
                  {view === "key" ? (
                    <Step n={1} title="Get an API key">
                      <a
                        href="https://console.anthropic.com/settings/keys"
                        target="_blank"
                        rel="noreferrer"
                        className="field mt-2 flex items-center gap-2.5 bg-bg px-3.5 py-2.5 text-[13.5px] shadow-none"
                      >
                        <KeyRound className="size-4 shrink-0 text-faint" strokeWidth={1.75} />
                        <span className="flex-1">console.anthropic.com → API keys → <b className="font-medium">Create key</b></span>
                        <ExternalLink className="size-3.5 shrink-0 text-faint" strokeWidth={1.75} />
                      </a>
                      <p className="mt-2 text-[12.5px] leading-relaxed text-faint">
                        New accounts need a few dollars of credit under Billing. A short video usually costs well under a dollar.
                      </p>
                    </Step>
                  ) : (
                    <Step n={1} title="In the Terminal app, run">
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
                        Approve in the browser that opens; if it shows a code, paste that back into Terminal. Terminal then
                        prints your token. No Claude Code yet? <code className="font-mono">npm i -g @anthropic-ai/claude-code</code>
                      </p>
                    </Step>
                  )}

                  <Step n={2} title={view === "key" ? "Paste the key" : "Paste the token"}>
                    {tokenInput}
                    {cleaned.length > 8 && !pastedKind && (
                      <p className="mt-2 text-[12.5px] leading-relaxed text-faint">
                        Anthropic keys start with <code className="font-mono">sk-ant-api</code> (API key) or{" "}
                        <code className="font-mono">sk-ant-oat</code> (Claude account). You can still try it.
                      </p>
                    )}
                  </Step>

                  {askAdminCode && (
                    <Step n={3} title="Admin code">
                      <input
                        ref={adminField}
                        value={adminCode}
                        onChange={(e) => setAdminCode(e.target.value)}
                        placeholder="PICASSO_OWNER_CODE from deploy/.env"
                        spellCheck={false}
                        autoComplete="off"
                        aria-label="Admin code"
                        className="field mt-2 h-10 w-full px-3.5 font-mono text-[13px]"
                      />
                    </Step>
                  )}
                  {askInvite && <Step n={3} title="Invite code" note="first sign-in only">{inviteInput}</Step>}
                  <Step n={askInvite || askAdminCode ? 4 : 3} title="Name your studio" note="optional">{nameInput}</Step>
                </ol>
              </>
            )}

            {error && <ErrorNote className="mt-5">{error}</ErrorNote>}

            <Button type="submit" variant="primary" size="lg" className="mt-6 w-full" loading={busy} disabled={!ready}>
              {busy
                ? view === "signin" ? "Signing in" : view === "signup" ? "Creating your studio" : "Checking with Claude"
                : view === "signup" ? "Create account" : view === "signin" ? "Sign in" : "Enter the studio"}
              {!busy && <ArrowRight className="size-4" strokeWidth={1.5} />}
            </Button>
          </form>

          <p className="mt-5 px-1 text-center text-[12.5px] leading-relaxed text-faint">
            {view === "signin" || view === "signup" ? (
              <>
                Have an Anthropic API key?{" "}
                <button type="button" onClick={() => go("key")} className="text-muted underline underline-offset-4 hover:text-fg">Use it instead</button>
                {" · "}
                <button type="button" onClick={() => go("admin")} className="text-muted underline underline-offset-4 hover:text-fg">Site admin</button>
              </>
            ) : view === "key" ? (
              <button type="button" onClick={() => { setToken(""); go("admin"); }} className="text-muted underline underline-offset-4 hover:text-fg">Site admin? Sign in with your Claude account</button>
            ) : (
              <button type="button" onClick={() => { setToken(""); go("key"); }} className="text-muted underline underline-offset-4 hover:text-fg">Not the admin? Use an Anthropic API key</button>
            )}
          </p>
          <p className="mt-2 px-1 text-center text-[12px] leading-relaxed text-faint">
            Passwords are hashed and keys encrypted; a key is only used to run your own editor.
          </p>
        </div>
      </section>
    </main>
  );
}

function Field({ label, note, children }: { label: string; note?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-[13.5px] font-medium">
        {label}
        {note && <span className="ml-2 font-normal text-faint">{note}</span>}
      </span>
      {children}
    </label>
  );
}

function Step({ n, title, note, children }: { n: number; title: string; note?: string; children: ReactNode }) {
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
