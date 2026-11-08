"use client";

import clsx from "clsx";
import { Check, LogOut, Monitor, Moon, ShieldOff, Sun } from "lucide-react";
import { ReactNode, useEffect, useState } from "react";
import { useApp } from "@/components/app-context";
import { AspectPicker, LengthPicker, StylePicker } from "@/components/pickers";
import { Badge, Button, ErrorNote, PageHeader, SectionHeader, Segmented, Switch, useDebouncedCallback } from "@/components/ui";
import { setMotion, setTheme, Theme, useAppearance } from "@/lib/appearance";
import { api, FootageSource, Settings } from "@/lib/api";

const LANGUAGES = ["English", "Spanish", "French", "German", "Portuguese", "Italian", "Dutch", "Japanese", "Korean", "Chinese", "Hindi", "Arabic"];

const SECTIONS = [
  ["appearance", "Appearance"],
  ["defaults", "New videos"],
  ["editor", "The editor"],
  ["video", "The finished video"],
  ["account", "Account"],
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
    if (!window.confirm("Sign out everywhere and delete your stored Claude token? Your videos stay.")) return;
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
          description="How Picasso looks, where new videos start, and how the editor works on them."
          actions={<SaveState state={state} />}
        />

        <div className="mt-10 grid gap-8 lg:grid-cols-[180px_1fr]">
          <nav className="hidden lg:block" aria-label="Settings sections">
            <ul className="sticky top-0 space-y-0.5">
              {SECTIONS.map(([id, label]) => (
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
              <Row label="Connected to Claude" hint={user.token_kind === "oauth" ? "With a Claude account token (claude setup-token)." : "With an Anthropic API key."}>
                <span className="font-mono text-[12.5px] text-muted">{user.token_hint}</span>
              </Row>
              <Row label="Workspace ID" hint="Identifies this workspace, e.g. for a server's Claude-account allowlist.">
                <span className="font-mono text-[12.5px] text-muted select-all">{user.id}</span>
              </Row>
              <div className="flex flex-wrap gap-2 pt-4">
                <Button onClick={signOut} icon={<LogOut className="size-3.5" strokeWidth={1.75} />}>Sign out</Button>
                <Button variant="danger" onClick={forget} icon={<ShieldOff className="size-3.5" strokeWidth={1.75} />}>Disconnect Claude</Button>
              </div>
            </Card>
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
