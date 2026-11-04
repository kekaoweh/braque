"use client";

import clsx from "clsx";
import { Download, MoreHorizontal, PanelRightClose, PanelRightOpen, Trash2 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { AgentPanel } from "@/components/agent-panel";
import { useApp } from "@/components/app-context";
import { AssetGrid } from "@/components/asset-grid";
import { AspectPicker, LengthPicker, StylePicker } from "@/components/pickers";
import { StatusPill } from "@/components/status";
import { TimelineStrip } from "@/components/timeline-strip";
import { Button, Menu, MenuItem, plate, SectionTitle, Spinner, useMediaQuery } from "@/components/ui";
import { api, Aspect, FootageSource, formatDuration, media, Project, Run, timeAgo } from "@/lib/api";

export default function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { styles, patchProjectSummary, refreshProjects, plateOf } = useApp();
  const [project, setProject] = useState<Project | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);
  const [tab, setTab] = useState<"timeline" | "script">("timeline");
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const scroller = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const [p, r] = await Promise.all([api.project(id), api.runs(id)]);
      setProject(p);
      setRuns(r);
      setSelectedRunId(r.find((x) => x.has_video)?.id ?? null);
    } catch {
      setNotFound(true);
    }
  }, [id]);

  useEffect(() => {
    setProject(null);
    load();
  }, [load]);

  // Edits are merged into one pending patch so a quick title-then-brief edit saves both.
  const pending = useRef<Partial<Project>>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flush = useCallback(async (keepalive = false) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const patch = pending.current;
    pending.current = {};
    if (Object.keys(patch).length) await api.updateProject(id, patch, keepalive);
  }, [id]);

  useEffect(() => {
    const onUnload = () => { flush(true); };
    window.addEventListener("beforeunload", onUnload);
    return () => {
      window.removeEventListener("beforeunload", onUnload);
      flush(true);
    };
  }, [flush]);

  const change = (patch: Partial<Project>, immediate = false) => {
    setProject((p) => (p ? { ...p, ...patch } : p));
    if ("name" in patch || "emoji" in patch) patchProjectSummary(id, patch);
    pending.current = { ...pending.current, ...patch };
    if (immediate) flush();
    else {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => flush(), 500);
    }
  };

  const onRunFinished = useCallback(async () => {
    await load();
    refreshProjects();
  }, [load, refreshProjects]);

  const onRunsChange = (next: Run[]) => {
    setRuns(next);
    patchProjectSummary(id, { latest_status: next[0]?.status ?? null });
  };

  const remove = async () => {
    if (!project || !window.confirm(`Remove “${project.name || "Untitled"}” and all its materials?`)) return;
    await api.deleteProject(id);
    await refreshProjects();
    router.push("/");
  };

  if (notFound)
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-muted">
        <span className="text-[18px] font-medium">This work isn&apos;t in the collection.</span>
        <Link href="/" className="text-fg underline underline-offset-4">Back to the studio</Link>
      </div>
    );
  if (!project)
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner />
      </div>
    );

  const selectedRun = runs.find((r) => r.id === selectedRunId && r.has_video);
  const selectedIndex = selectedRun ? runs.length - runs.indexOf(selectedRun) : 0;
  const portrait = project.aspect === "9:16" || project.aspect === "4:5";
  const credits = creditsFor(project);
  const sections = [
    { id: "brief", label: "Brief" },
    ...(selectedRun ? [{ id: "preview", label: "Preview" }] : []),
    ...(project.timeline || project.script ? [{ id: "timeline", label: "Timeline" }] : []),
    { id: "footage", label: "Footage", count: project.assets.length },
    ...(credits.length ? [{ id: "credits", label: "Credits", count: credits.length }] : []),
  ];
  const begun = new Date(project.created_at).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
  const panel = (
    <AgentPanel
      projectId={project.id}
      runs={runs}
      assets={project.assets}
      hasTimeline={!!project.timeline}
      hasBrief={!!project.prompt.trim()}
      selectedRunId={selectedRunId}
      onSelectRun={setSelectedRunId}
      onRunsChange={onRunsChange}
      onRunFinished={onRunFinished}
      beforeStart={flush}
    />
  );

  return (
    <div className="flex h-full">
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <div className="flex h-12 shrink-0 items-center gap-3 border-b border-line px-5">
          <div className="flex min-w-0 items-baseline gap-2 text-[13px]">
            <Link href="/" className="text-muted hover:text-fg">Studio</Link>
            <span className="text-faint">/</span>
            <span className="label !text-fg">{plate(plateOf(project.id))}</span>
          </div>
          <div className="ml-auto flex items-center gap-1">
            {runs[0] && <span className="mr-2"><StatusPill status={runs[0].status} /></span>}
            {selectedRun && (
              <a href={media.video(selectedRun.id, true)}>
                <Button size="sm" variant="ghost" icon={<Download className="size-3.5" strokeWidth={1.5} />}>Download</Button>
              </a>
            )}
            <Menu
              align="right"
              width="w-48"
              trigger={({ toggle }) => (
                <Button size="sm" variant="ghost" onClick={toggle} aria-label="More">
                  <MoreHorizontal className="size-4" strokeWidth={1.5} />
                </Button>
              )}
            >
              {() => (
                <MenuItem icon={<Trash2 className="size-3.5" strokeWidth={1.5} />} danger onClick={remove}>
                  Remove this work
                </MenuItem>
              )}
            </Menu>
            {isDesktop && (
              <Button size="sm" variant="ghost" onClick={() => setPanelOpen((o) => !o)} aria-label="Toggle studio log">
                {panelOpen ? <PanelRightClose className="size-4" strokeWidth={1.5} /> : <PanelRightOpen className="size-4" strokeWidth={1.5} />}
              </Button>
            )}
          </div>
        </div>

        {/* The entry */}
        <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto scroll-smooth">
          <SectionBar sections={sections} scroller={scroller} />
          <div className="mx-auto max-w-[780px] px-6 pt-10 pb-32 sm:px-12">
            <div className="label">{plate(plateOf(project.id))} · Begun {begun}</div>
            <textarea
              value={project.name}
              onChange={(e) => change({ name: e.target.value.replace(/\n/g, "") })}
              onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
              rows={1}
              placeholder="Untitled"
              aria-label="Title"
              className="mt-3 block w-full resize-none bg-transparent text-[34px] leading-[1.08] font-semibold tracking-[-0.035em] outline-none placeholder:text-faint sm:text-[44px]"
            />

            {/* Spec band */}
            <div className="mt-7 grid grid-cols-2 gap-y-5 border-y border-line py-4 sm:grid-cols-3">
              <LengthPicker label="Running time" value={project.target_seconds} onChange={(v) => change({ target_seconds: v }, true)} />
              <AspectPicker label="Format" value={project.aspect} onChange={(v: Aspect) => change({ aspect: v }, true)} />
              <div className="flex items-end gap-3">
                <StylePicker label="Style" styles={styles} value={project.style_id} onChange={(v) => change({ style_id: v }, true)} />
                <Link href="/styles" className="pb-0.5 text-[11.5px] text-faint hover:text-muted">edit styles</Link>
              </div>
            </div>

            <section id="brief" className="mt-12 scroll-mt-16">
              <SectionTitle n={1}>Brief</SectionTitle>
              <textarea
                value={project.prompt}
                onChange={(e) => change({ prompt: e.target.value })}
                placeholder="What is the piece about? Who is it for? How should it feel? Name the moments it must have, the chapters, how it ends…"
                className="block min-h-28 w-full resize-none bg-transparent text-[16.5px] leading-[1.7] outline-none placeholder:text-faint"
              />
            </section>

            {selectedRun && (
              <section id="preview" className="mt-12 scroll-mt-16">
                <SectionTitle n={2}>Preview</SectionTitle>
                <figure className={clsx(portrait && "mx-auto max-w-[380px]")}>
                  <div className="rounded-[10px] border border-line bg-paper p-3 shadow-e4">
                    <video
                      key={selectedRun.id}
                      src={`${media.video(selectedRun.id)}#t=0.6`}
                      preload="metadata"
                      controls
                      playsInline
                      className="block max-h-[70vh] w-full bg-film"
                    />
                  </div>
                  <figcaption className="mt-3 flex items-baseline justify-between gap-4">
                    <span className="text-[14.5px] font-medium">Version {selectedIndex}</span>
                    <span className="label">{formatDuration(selectedRun.duration)} · {project.aspect} · {timeAgo(selectedRun.created_at)}</span>
                  </figcaption>
                </figure>
              </section>
            )}

            {(project.timeline || project.script) && (
              <section id="timeline" className="mt-12 scroll-mt-16">
                <SectionTitle
                  n={selectedRun ? 3 : 2}
                  action={
                    <div className="flex gap-4">
                      {(["timeline", "script"] as const).map((t) => (
                        <button
                          key={t}
                          onClick={() => setTab(t)}
                          className={clsx(
                            "font-mono text-[10.5px] tracking-[0.14em] uppercase transition-colors",
                            tab === t ? "text-fg underline decoration-accent decoration-1 underline-offset-[6px]" : "text-faint hover:text-muted",
                          )}
                        >
                          {t === "timeline" ? "Timeline" : "Script"}
                        </button>
                      ))}
                    </div>
                  }
                >
                  Timeline
                </SectionTitle>
                {tab === "timeline" ? (
                  project.timeline ? (
                    <TimelineStrip timeline={project.timeline} assets={project.assets} />
                  ) : (
                    <p className="text-[14px] text-faint">No cut yet.</p>
                  )
                ) : project.script ? (
                  <div className="prose-doc text-[15.5px]">
                    <ReactMarkdown>{project.script}</ReactMarkdown>
                  </div>
                ) : (
                  <p className="text-[14px] text-faint">No script yet.</p>
                )}
              </section>
            )}

            <section id="footage" className="mt-12 scroll-mt-16">
              <SectionTitle n={(selectedRun ? 3 : 2) + (project.timeline || project.script ? 1 : 0)}>Footage</SectionTitle>
              <p className="-mt-1 mb-2 text-[13.5px] leading-relaxed text-muted">
                The editor finds footage on its own in licensed libraries, so everything it uses is cleared for
                publishing. Add your own clips only if you want them in the cut. Tag a piece as{" "}
                <span className="font-mono text-[10.5px] tracking-[0.12em] text-accent">REFERENCE</span> to show a look or pace to match.
              </p>
              <SourceLine />
              <AssetGrid projectId={project.id} assets={project.assets} onChange={(assets) => setProject({ ...project, assets })} />
            </section>

            {credits.length > 0 && (
              <section id="credits" className="mt-12 scroll-mt-16">
                <SectionTitle n={(selectedRun ? 4 : 3) + (project.timeline || project.script ? 1 : 0)} action={<CopyCredits credits={credits} />}>
                  Credits
                </SectionTitle>
                <ul className="space-y-1.5 text-[13px] leading-relaxed text-muted">
                  {credits.map((a) => (
                    <li key={a.id}>
                      <a href={a.source_url || undefined} target="_blank" rel="noreferrer" className="text-fg underline-offset-2 hover:underline">{a.name}</a>
                      {a.credit && <> by {a.credit}</>} · {a.source} · <span className="text-faint">{a.license}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        </div>

        {/* Studio log below the entry on small screens */}
        {!isDesktop && <div className="h-[45vh] shrink-0 border-t border-line">{panel}</div>}
      </div>

      {isDesktop && panelOpen && <div className="w-[384px] shrink-0 border-l border-line">{panel}</div>}
    </div>
  );
}

/** Which footage libraries the editor can search; libraries that need a key say so. */
function SourceLine() {
  const [list, setList] = useState<FootageSource[] | null>(null);
  useEffect(() => {
    api.sources().then(setList).catch(() => setList([]));
  }, []);
  if (!list?.length) return <div className="mb-5" />;
  return (
    <div className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-1">
      <span className="label">Libraries</span>
      {list.map((s) => (
        <span
          key={s.name}
          title={s.enabled ? `Searching ${s.name}` : `Add ${s.needs_key} to backend/.env to search ${s.name}`}
          className={clsx("inline-flex items-center gap-1.5 text-[12.5px]", s.enabled ? "text-muted" : "text-faint line-through decoration-line-strong")}
        >
          <span className={clsx("size-[5px] rounded-full", s.enabled ? "bg-sage" : "bg-line-strong")} />
          {s.name}
        </span>
      ))}
    </div>
  );
}

/**
 * Library footage that needs crediting: the clips (and music) the current cut actually uses,
 * one line per source. Before there is a cut, every collected piece is listed.
 */
function creditsFor(project: Project) {
  const used = project.timeline
    ? new Set([...project.timeline.clips.map((c) => c.asset_id), project.timeline.music?.asset_id])
    : null;
  const seen = new Set<string>();
  return project.assets.filter((a) => {
    if (a.source === "upload" || (used && !used.has(a.id))) return false;
    const key = a.source_url || a.id;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function CopyCredits({ credits }: { credits: Project["assets"] }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    const lines = credits
      .map((a) => `${a.name}${a.credit ? ` by ${a.credit}` : ""}, ${a.source}, ${a.license}${a.source_url ? ` (${a.source_url})` : ""}`);
    await navigator.clipboard.writeText(["Footage credits", ...lines].join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button onClick={copy} className="font-mono text-[10.5px] tracking-[0.14em] text-faint uppercase hover:text-fg">
      {copied ? "Copied" : "Copy credits"}
    </button>
  );
}

type SectionLink = { id: string; label: string; count?: number };

/** Sticky jump bar for the editor's sections; the one in view is highlighted as you scroll. */
function SectionBar({ sections, scroller }: { sections: SectionLink[]; scroller: React.RefObject<HTMLDivElement | null> }) {
  const [active, setActive] = useState(sections[0]?.id);
  const key = sections.map((x) => x.id).join(",");

  useEffect(() => {
    const root = scroller.current;
    if (!root) return;
    const onScroll = () => {
      const top = root.getBoundingClientRect().top + 90;
      let current = sections[0]?.id;
      for (const sec of sections) {
        const el = root.querySelector<HTMLElement>(`#${sec.id}`);
        if (el && el.getBoundingClientRect().top <= top) current = sec.id;
      }
      if (root.scrollTop + root.clientHeight >= root.scrollHeight - 4) current = sections[sections.length - 1]?.id;
      setActive(current);
    };
    onScroll();
    root.addEventListener("scroll", onScroll, { passive: true });
    return () => root.removeEventListener("scroll", onScroll);
  }, [key, scroller]); // eslint-disable-line react-hooks/exhaustive-deps

  const bar = useRef<HTMLDivElement>(null);
  const jump = (id: string) => {
    const root = scroller.current;
    const el = root?.querySelector<HTMLElement>(`#${id}`);
    if (!root || !el) return;
    // Position relative to the scroller (not offsetParent), leaving room for this sticky bar.
    const top = el.getBoundingClientRect().top - root.getBoundingClientRect().top + root.scrollTop;
    root.scrollTo({ top: top - (bar.current?.offsetHeight ?? 44) - 20, behavior: "smooth" });
  };

  return (
    <div ref={bar} className="glass sticky top-0 z-20 border-b border-line">
      <nav className="mx-auto flex max-w-[780px] gap-1 overflow-x-auto px-4 py-1.5 sm:px-10" aria-label="Sections">
        {sections.map((sec) => (
          <button
            key={sec.id}
            onClick={() => jump(sec.id)}
            className={clsx(
              "flex shrink-0 items-center gap-1.5 rounded-[6px] px-2.5 py-1 text-[13px] transition-all",
              active === sec.id ? "bg-paper font-medium text-fg shadow-e1" : "text-muted hover:bg-hover hover:text-fg",
            )}
          >
            {sec.label}
            {sec.count ? <span className="font-mono text-[10px] text-faint">{sec.count}</span> : null}
          </button>
        ))}
      </nav>
    </div>
  );
}
