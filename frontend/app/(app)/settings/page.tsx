"use client";

import clsx from "clsx";
import { Check, KeyRound, LogOut, Monitor, Moon, ShieldOff, Sun } from "lucide-react";
import { ReactNode, useEffect, useState } from "react";
import { useApp } from "@/components/app-context";
import { AspectPicker, LengthPicker, StylePicker } from "@/components/pickers";
import { Badge, Button, ErrorNote, PageHeader, SectionHeader, Segmented, Switch, useDebouncedCallback } from "@/components/ui";
import { setMotion, setTheme, Theme, useAppearance } from "@/lib/appearance";
import { AdminUser, api, FootageSource, Settings } from "@/lib/api";

const LANGUAGES = ["English", "Spanish", "French", "German", "Portuguese", "Italian", "Dutch", "Japanese", "Korean", "Chinese", "Hindi", "Arabic"];

const SECTIONS = [
  ["appearance", "Appearance"],
  ["defaults", "New videos"],
  ["editor", "The editor"],
  ["video", "The finished video"],
  ["account", "Account"],
  ["admin", "Site admin"],
] as const;

export default function SettingsPage() {
  const { settings, updateSettings, styles, user, setUser } = useApp();
  const appearance = useAppearance();
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [libraries, setLibraries] = useState<FootageSource[]>([]);
  const [language, setLanguage] = useState(settings.language);
  const [name, setName] = useState(user.name);

  useEffect(() => {
    api.sources().then(setLibraries).catch(() => setLibraries([]));
  }, []);

  const save = async (patch: Partial<Settings>) => {
    setState("saving");
    try {
      await updateSettings(patch);
      setState("saved");
    } catch {
      setState("error");
    }
  };
  const saveLanguage = useDebouncedCallback((v: string) => v.trim() && save({ language: v.trim() }), 600);
  const saveName = useDebouncedCallback(async (v: string) => {
    if (!v.trim() || v.trim() === user.name) return;
    setState("saving");
    try {
      setUser(await api.updateMe(v.trim()));
      setState("saved");
    } catch {
      setState("error");
    }
  }, 600);

  const toggleLibrary = (lib: string, on: boolean) =>
    save({ libraries_off: on ? settings.libraries_off.filter((n) => n !== lib) : [...settings.libraries_off, lib] });

  const signOut = async () => {
    await api.logout();
    window.location.href = "/login";
  };
  const forget = async () => {
    const what = user.method === "email" ? "Sign out on every device and remove your saved API key, if any?" : "Sign out everywhere and delete your stored key? Your videos stay.";
    if (!window.confirm(what)) return;
    await api.forget();
    window.location.href = "/login";
  };

  const usable = libraries.filter((l) => l.enabled);
  const allOff = usable.length > 0 && usable.every((l) => settings.libraries_off.includes(l.name));

  return (
    <div className="studio-glow h-full overflow-y-auto">
      <div className="mx-auto max-w-[1000px] px-5 pt-10 pb-24 sm:px-10 sm:pt-16">
        <PageHeader
          eyebrow="Settings"
          title="Make the studio yours"
          description="How Braque looks, where new videos start, and how the editor works on them."
          actions={<SaveState state={state} />}
        />

        <div className="mt-10 grid gap-8 lg:grid-cols-[180px_1fr]">
          <nav className="hidden lg:block" aria-label="Settings sections">
            <ul className="sticky top-0 space-y-0.5">
              {SECTIONS.filter(([id]) => id !== "admin" || user.is_admin).map(([id, label]) => (
                <li key={id}>
                  <a href={`#${id}`} className="block rounded-control px-2.5 py-1.5 text-[13.5px] text-muted transition-colors hover:bg-hover hover:text-fg">
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="min-w-0 space-y-5">
            <Card id="appearance" title="Appearance" description="Saved on this device.">
              <Row label="Theme" hint="System follows your computer's light or dark setting.">
                <Segmented<Theme>
                  value={appearance.theme}
                  onChange={setTheme}
                  options={[
                    ["light", <><Sun className="size-3.5" strokeWidth={1.75} />Light</>],
                    ["dark", <><Moon className="size-3.5" strokeWidth={1.75} />Dark</>],
                    ["system", <><Monitor className="size-3.5" strokeWidth={1.75} />System</>],
                  ]}
                />
              </Row>
              <Row label="Motion" hint="Tilting cards and small animations.">
                <Segmented value={appearance.motion} onChange={setMotion} options={[["full", "Full"], ["reduced", "Reduced"]]} />
              </Row>
            </Card>

            <Card id="defaults" title="New videos" description="Where every new video starts. Each video can still be changed on its own.">
              <Row label="Running time">
                <LengthPicker value={settings.default_seconds} onChange={(v) => save({ default_seconds: v })} />
              </Row>
              <Row label="Format">
                <AspectPicker value={settings.default_aspect} onChange={(v) => save({ default_aspect: v })} />
              </Row>
              <Row label="Style">
                <StylePicker styles={styles} value={settings.default_style_id} onChange={(v) => save({ default_style_id: v })} />
              </Row>
            </Card>

            <Card id="editor" title="The editor" description="The Claude agent that researches, finds footage and cuts. It runs on your own Claude account.">
              <Row label="Model" hint={settings.model === "claude-opus-5-5" ? "Best taste and judgment. Uses more of your plan." : "Quicker and lighter on your plan; still a capable editor."}>
                <Segmented
                  value={settings.model}
                  onChange={(v) => save({ model: v })}
                  options={[["claude-opus-5-5", "Opus 5.5"], ["claude-sonnet-5-5", "Sonnet 5.5"]]}
                />
              </Row>
              <Row
                label="Thoroughness"
                hint={{
                  high: "Searches widely and reviews footage closely. Slowest, best results.",
                  medium: "A good balance for most videos.",
                  low: "Fast drafts. Fewer searches and quicker decisions.",
                }[settings.effort]}
              >
                <Segmented
                  value={settings.effort}
                  onChange={(v) => save({ effort: v })}
                  options={[["low", "Quick"], ["medium", "Balanced"], ["high", "Thorough"]]}
                />
              </Row>
              <Row label="Web research" hint="Look up facts, names and places before writing.">
                <Switch label="Web research" checked={settings.web_research} onChange={(v) => save({ web_research: v })} />
              </Row>
              <div className="py-4">
                <div className="text-[14px] font-medium">Footage libraries</div>
                <p className="mt-0.5 text-[13px] leading-relaxed text-faint">Where the editor may look for licensed clips, stills and music.</p>
                <ul className="mt-3 divide-y divide-line rounded-card border border-line bg-bg/60">
                  {libraries.map((lib) => {
                    const on = lib.enabled && !settings.libraries_off.includes(lib.name);
                    return (
                      <li key={lib.name} className="flex items-center gap-3 px-4 py-2.5">
                        <span className="min-w-0 flex-1">
                          <span className="block text-[13.5px]">{lib.name}</span>
                          <span className="block text-[12px] text-faint">{lib.kinds.map(kindLabel).join(", ")}</span>
                        </span>
                        {lib.enabled ? (
                          <Switch label={lib.name} checked={on} onChange={(v) => toggleLibrary(lib.name, v)} />
                        ) : (
                          <span title={`Add ${lib.needs_key} to the server's .env to enable`}><Badge>Needs an API key</Badge></span>
                        )}
                      </li>
                    );
                  })}
                </ul>
                {allOff && <ErrorNote className="mt-3">Every library is off, so the editor can only use footage you upload.</ErrorNote>}
              </div>
            </Card>

            <Card id="video" title="The finished video" description="Preferences the editor follows in every cut, on top of the style.">
              <Row label="On-screen words" hint="Captions and title cards.">
                <Segmented
                  value={settings.on_screen_text}
                  onChange={(v) => save({ on_screen_text: v })}
                  options={[["style", "As the style says"], ["minimal", "Fewer"], ["none", "None"]]}
                />
              </Row>
              <Row label="Music" hint="A licensed music bed when you haven't added your own.">
                <Segmented value={settings.music} onChange={(v) => save({ music: v })} options={[["auto", "Add music"], ["none", "No music"]]} />
              </Row>
              <Row label="Credits card" hint="End with a short card naming the footage libraries.">
                <Switch label="Credits card" checked={settings.credits_card} onChange={(v) => save({ credits_card: v })} />
              </Row>
              <Row label="Language" hint="For captions, titles and credits.">
                <input
                  value={language}
                  list="picasso-languages"
                  onChange={(e) => { setLanguage(e.target.value); saveLanguage(e.target.value); }}
                  aria-label="Language"
                  className="field h-9 w-full px-3 text-[13.5px] sm:w-52"
                />
                <datalist id="picasso-languages">
                  {LANGUAGES.map((l) => <option key={l} value={l} />)}
                </datalist>
              </Row>
            </Card>

            <Card id="account" title="Account">
              <Row label="Studio name" hint="Shown in the greeting and the sidebar.">
                <input
                  value={name}
                  onChange={(e) => { setName(e.target.value); saveName(e.target.value); }}
                  maxLength={80}
                  aria-label="Studio name"
                  className="field h-9 w-full px-3 text-[13.5px] sm:w-52"
                />
              </Row>
              <Row
                label="Signed in with"
                hint={user.method === "email" ? "Email and password." : user.method === "claude" ? "A Claude account (site admin)." : "An Anthropic API key."}
              >
                <span className="text-[13px] text-muted">
                  {user.email ?? <span className="font-mono text-[12.5px]">{user.token_hint}</span>}
                </span>
              </Row>
              <VideoCredit />
              {user.method === "email" && <PasswordRow />}
              {!user.is_admin && <DeleteAccountRow />}
              <div className="flex flex-wrap gap-2 py-4">
                <Button onClick={signOut} icon={<LogOut className="size-3.5" strokeWidth={1.75} />}>Sign out</Button>
                <Button variant="danger" onClick={forget} icon={<ShieldOff className="size-3.5" strokeWidth={1.75} />}>
                  {user.method === "email" ? "Sign out everywhere" : "Disconnect and sign out everywhere"}
                </Button>
              </div>
            </Card>

            {user.is_admin && <AdminCard />}
          </div>
        </div>
      </div>
    </div>
  );
}

const kindLabel = (k: string) => ({ video: "Video", image: "Stills", audio: "Music" })[k] ?? k;

function Card({ id, title, description, children }: { id: string; title: string; description?: string; children: ReactNode }) {
  return (
    <section id={id} className="card scroll-mt-6 px-5 pt-5 pb-1 sm:px-6 sm:pt-6">
      <SectionHeader title={title} description={description} className="mb-1" />
      <div className="divide-y divide-line">{children}</div>
    </section>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-8">
      <div className="min-w-0">
        <div className="text-[14px] font-medium">{label}</div>
        {hint && <p className="mt-0.5 text-[13px] leading-relaxed text-faint">{hint}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function SaveState({ state }: { state: "idle" | "saving" | "saved" | "error" }) {
  if (state === "idle") return null;
  return (
    <span className={clsx("inline-flex items-center gap-1.5 text-[13px]", state === "error" ? "text-brick" : "text-faint")} role="status">
      {state === "saved" && <Check className="size-3.5 text-sage" strokeWidth={2} />}
      {state === "saving" ? "Saving…" : state === "saved" ? "Saved" : "Couldn't save. Try again."}
    </span>
  );
}

/**
 * Who pays for this person's videos: their own API key, or the studio's monthly credit (with a
 * meter). Connecting or replacing a key goes through the shared "Connect your API key" guide.
 */
function VideoCredit() {
  const { user, setUser, account, refreshAccount, connectKey } = useApp();
  useEffect(() => { refreshAccount(); }, [refreshAccount]);

  const remove = async () => {
    if (!window.confirm("Remove your API key? You won't be able to make new videos until you connect one again" + (account.studio_credit ? ", apart from the studio's monthly credit." : "."))) return;
    setUser(await api.removeKey());
    await refreshAccount();
  };

  const own = account.payer === "own";
  const pct = account.studio_limit ? Math.min(100, (account.studio_spent / account.studio_limit) * 100) : 0;
  const resets = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toLocaleDateString(undefined, { month: "long", day: "numeric" });

  return (
    <div className="py-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-8">
        <div className="min-w-0">
          <div className="text-[14px] font-medium">Video credit</div>
          <p className="mt-0.5 text-[13px] leading-relaxed text-faint">
            {own
              ? user.token_kind === "oauth" ? "Your videos run on your Claude plan." : "Your videos run on your own Anthropic API key, billed to you by Anthropic."
              : account.studio_credit
                ? `Your videos run on the studio's credit: $${account.studio_limit} a month, renewing ${resets}.`
                : "Connect an Anthropic API key to start making videos."}
          </p>
        </div>
        {own && user.email ? (
          <div className="flex shrink-0 items-center gap-1">
            <span className="mr-1 font-mono text-[12.5px] text-muted">{user.token_hint}</span>
            <Button size="sm" variant="ghost" onClick={() => connectKey()}>Replace</Button>
            <Button size="sm" variant="ghost" onClick={remove}>Remove</Button>
          </div>
        ) : !own ? (
          <Button size="sm" variant={account.studio_credit ? "secondary" : "primary"} className="shrink-0" onClick={() => connectKey()}
            icon={<KeyRound className="size-3.5" strokeWidth={1.75} />}>
            {account.studio_credit ? "Use your own key" : "Connect your key"}
          </Button>
        ) : null}
      </div>
      {!own && account.studio_credit && (
        <div className="mt-3">
          <div className="h-1.5 overflow-hidden rounded-full bg-active">
            <div className={clsx("h-full rounded-full", pct >= 100 ? "bg-brick" : "bg-accent")} style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-1.5 text-[12px] text-faint tabular-nums">
            ${account.studio_spent.toFixed(2)} of ${account.studio_limit.toFixed(2)} used this month
          </p>
        </div>
      )}
    </div>
  );
}

function PasswordRow() {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const save = async () => {
    setState("busy");
    setError(null);
    try {
      await api.changePassword(current, next);
      setState("done");
      setOpen(false);
      setCurrent("");
      setNext("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't change it");
      setState("idle");
    }
  };
  return (
    <div className="py-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-[14px] font-medium">Password</div>
          {state === "done" && <p className="mt-0.5 text-[13px] text-sage">Changed.</p>}
        </div>
        {!open && <Button size="sm" onClick={() => { setOpen(true); setState("idle"); }}>Change password</Button>}
      </div>
      {open && (
        <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto_auto]">
          <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} placeholder="Current password" autoComplete="current-password" aria-label="Current password" className="field h-9 px-3 text-[13.5px]" />
          <input type="password" value={next} onChange={(e) => setNext(e.target.value)} placeholder="New (8+ characters)" autoComplete="new-password" aria-label="New password" className="field h-9 px-3 text-[13.5px]" />
          <Button size="sm" className="h-9" variant="primary" onClick={save} loading={state === "busy"} disabled={!current || next.length < 8}>Save</Button>
          <Button size="sm" className="h-9" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          {error && <ErrorNote className="sm:col-span-4">{error}</ErrorNote>}
        </div>
      )}
    </div>
  );
}

/** The site admin's view: everyone with a studio here, how they pay, and studio credit used. */
function AdminCard() {
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [invite, setInvite] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    api.adminUsers().then(setUsers).catch(() => setUsers([]));
    api.adminInvite().then((r) => setInvite(r.code)).catch(() => setInvite(""));
  }, []);
  const [reset, setReset] = useState<{ name: string; email: string; password: string } | null>(null);
  const resetPassword = async (u: AdminUser) => {
    if (!window.confirm(`Reset the password for ${u.email}? They'll be signed out everywhere and need the new one.`)) return;
    const r = await api.adminResetPassword(u.id);
    setReset({ name: u.name, email: u.email!, password: r.password });
  };
  const link = invite ? `${window.location.origin}/login?invite=${encodeURIComponent(invite)}` : `${window.location.origin}/login`;
  const copyLink = async () => {
    await navigator.clipboard.writeText(link).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  const total = (users ?? []).reduce((sum, u) => sum + u.studio_spent, 0);
  return (
    <Card id="admin" title="Site admin" description="Everyone with a studio on this site. Only you can see this.">
      <div className="py-4">
        <div className="text-[14px] font-medium">Invite link</div>
        <p className="mt-0.5 text-[13px] leading-relaxed text-faint">
          {invite ? "Send this to customers: it opens sign-up with the invite code already applied." : "Sign-up is open to anyone, so this is just the sign-in page."}
        </p>
        <div className="field mt-2.5 flex items-center gap-2 bg-bg py-1 pr-1 pl-3 shadow-none">
          <span className="min-w-0 flex-1 truncate font-mono text-[12.5px] text-muted">{invite === null ? "…" : link}</span>
          <Button size="sm" onClick={copyLink} icon={copied ? <Check className="size-3.5 text-sage" strokeWidth={2} /> : undefined}>
            {copied ? "Copied" : "Copy link"}
          </Button>
        </div>
      </div>
      <div className="py-4">
        {!users ? (
          <p className="text-[13px] text-faint">Loading…</p>
        ) : (
          <>
            <div className="overflow-x-auto rounded-card border border-line">
              <table className="w-full text-left text-[13px]">
                <thead className="bg-bg text-[12px] text-faint">
                  <tr>
                    <th className="px-3.5 py-2 font-medium">Studio</th>
                    <th className="px-3.5 py-2 font-medium">Pays with</th>
                    <th className="px-3.5 py-2 text-right font-medium">Videos</th>
                    <th className="px-3.5 py-2 text-right font-medium">Studio credit this month</th>
                    <th className="px-3.5 py-2" aria-label="Actions" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td className="px-3.5 py-2.5">
                        <div className="font-medium">{u.name}</div>
                        <div className="text-[12px] text-faint">{u.email ?? (u.method === "claude" ? "Claude account" : "API key")}</div>
                      </td>
                      <td className="px-3.5 py-2.5 text-muted">{u.pays}</td>
                      <td className="px-3.5 py-2.5 text-right tabular-nums">{u.videos}</td>
                      <td className="px-3.5 py-2.5 text-right tabular-nums">${u.studio_spent.toFixed(2)}</td>
                      <td className="px-2 py-2.5 text-right">
                        {u.email && (
                          <Button size="sm" variant="ghost" onClick={() => resetPassword(u)}>Reset password</Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {reset && (
              <div className="mt-3 rounded-control border border-sage/30 bg-sage-soft px-3.5 py-3 text-[13px]">
                <p>
                  New password for <b className="font-medium">{reset.email}</b>:{" "}
                  <code className="rounded bg-paper px-1.5 py-0.5 font-mono text-[13px] select-all">{reset.password}</code>
                </p>
                <p className="mt-1 text-[12.5px] text-muted">
                  Send it to them privately. They can change it in Settings → Account after signing in.{" "}
                  <button className="underline underline-offset-2" onClick={() => setReset(null)}>Done</button>
                </p>
              </div>
            )}
            <p className="mt-2.5 text-[12.5px] text-faint">
              Studio credit used by everyone this month: <span className="tabular-nums">${total.toFixed(2)}</span>. The key and
              the monthly limit per person are PICASSO_STUDIO_API_KEY and PICASSO_STUDIO_MONTHLY_LIMIT_USD on the server.
            </p>
          </>
        )}
      </div>
    </Card>
  );
}

/** Delete the account and everything in it (asks for the password on email accounts). */
function DeleteAccountRow() {
  const { user } = useApp();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const remove = async () => {
    if (!window.confirm("Delete your account? All your videos, uploads and styles are removed for good. This can't be undone.")) return;
    setBusy(true);
    setError(null);
    try {
      await api.deleteAccount(password);
      window.location.href = "/login";
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't delete the account");
      setBusy(false);
    }
  };
  return (
    <div className="py-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-[14px] font-medium">Delete account</div>
          <p className="mt-0.5 text-[13px] text-faint">Removes your studio, videos, uploads and saved key for good.</p>
        </div>
        {!open && <Button size="sm" variant="danger" onClick={() => setOpen(true)}>Delete account</Button>}
      </div>
      {open && (
        <div className="mt-3 flex flex-wrap gap-2">
          {user.email && (
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Your password"
              autoComplete="current-password" aria-label="Password to confirm" className="field h-9 min-w-0 flex-1 px-3 text-[13.5px]" />
          )}
          <Button size="sm" className="h-9 bg-brick text-white hover:bg-brick/90" onClick={remove} loading={busy} disabled={!!user.email && !password}>
            Delete everything
          </Button>
          <Button size="sm" className="h-9" variant="ghost" onClick={() => { setOpen(false); setError(null); }}>Cancel</Button>
          {error && <ErrorNote className="w-full">{error}</ErrorNote>}
        </div>
      )}
    </div>
  );
}
