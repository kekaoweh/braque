"use client";

import clsx from "clsx";
import { Check, ChevronRight, Copy, Download, MoreHorizontal, PanelRightClose, PanelRightOpen, Trash2 } from "lucide-react";
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
import { Badge, Button, IconButton, Menu, MenuItem, SectionHeader, Segmented, Spinner, useMediaQuery } from "@/components/ui";
import { api, Aspect, FootageSource, formatDuration, media, Project, Run, timeAgo } from "@/lib/api";

export default function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { styles, patchProjectSummary, refreshProjects } = useApp();
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
        <span className="text-[16px] font-medium text-fg">This video doesn&apos;t exist or was removed.</span>
        <Link href="/" className="text-fg underline underline-offset-4">Back to the Studio</Link>
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
        <div className="flex h-14 shrink-0 items-center gap-3 border-b border-line px-4 sm:px-5">
          <nav className="flex min-w-0 items-center gap-1.5 text-[13.5px]" aria-label="Breadcrumb">
            <Link href="/" className="shrink-0 text-muted transition-colors hover:text-fg">Studio</Link>
            <ChevronRight className="size-3.5 shrink-0 text-faint" strokeWidth={1.75} />
            <span className="truncate font-medium">{project.name || "Untitled"}</span>
          </nav>
          <div className="ml-auto flex shrink-0 items-center gap-1.5">
            {runs[0] && !(isDesktop && panelOpen) && <StatusPill status={runs[0].status} className="mr-1 hidden sm:inline-flex" />}
            {selectedRun && (
              <a href={media.video(selectedRun.id, true)} className="hidden sm:block">
                <Button size="sm" icon={<Download className="size-3.5" strokeWidth={1.75} />}>Download</Button>
              </a>
            )}
            <Menu
              align="right"
              width="w-52"
              trigger={({ toggle }) => (
                <IconButton onClick={toggle} aria-label="More">
                  <MoreHorizontal className="size-4" strokeWidth={1.75} />
                </IconButton>
              )}
            >
              {() => (
                <>
                  {selectedRun && (
                    <a href={media.video(selectedRun.id, true)} className="sm:hidden">
                      <MenuItem icon={<Download className="size-3.5" strokeWidth={1.75} />} onClick={() => {}}>Download video</MenuItem>
                    </a>
                  )}
                  <MenuItem icon={<Trash2 className="size-3.5" strokeWidth={1.75} />} danger onClick={remove}>
                    Remove this work
                  </MenuItem>
                </>
              )}
            </Menu>
            {isDesktop && (
              <IconButton onClick={() => setPanelOpen((o) => !o)} aria-label={panelOpen ? "Hide activity" : "Show activity"} title={panelOpen ? "Hide activity" : "Show activity"}>
                {panelOpen ? <PanelRightClose className="size-4" strokeWidth={1.75} /> : <PanelRightOpen className="size-4" strokeWidth={1.75} />}
              </IconButton>
            )}
          </div>
        </div>

        <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto scroll-smooth">
          <SectionBar sections={sections} scroller={scroller} />
          <div className="mx-auto max-w-[800px] space-y-5 px-4 pt-8 pb-28 sm:px-8">
            {/* Title and settings */}
            <div className="px-1 pb-3">
              <textarea
                value={project.name}
                onChange={(e) => change({ name: e.target.value.replace(/\n/g, "") })}
                onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
                rows={1}
                placeholder="Untitled"
                aria-label="Title"
                className="block w-full resize-none bg-transparent text-[30px] leading-[1.1] font-semibold tracking-[-0.035em] outline-none placeholder:text-faint sm:text-[38px]"
              />
              <div className="label mt-1.5">Started {begun}</div>
              <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <LengthPicker label="Running time" value={project.target_seconds} onChange={(v) => change({ target_seconds: v }, true)} />
                <AspectPicker label="Format" value={project.aspect} onChange={(v: Aspect) => change({ aspect: v }, true)} />
                <StylePicker label="Style" styles={styles} value={project.style_id} onChange={(v) => change({ style_id: v }, true)} />
              </div>
            </div>

            <section id="brief" className="card scroll-mt-20 p-5 sm:p-6">
              <SectionHeader title="Brief" description="What the video is about. The editor reads this first." />
              <textarea
                value={project.prompt}
                onChange={(e) => change({ prompt: e.target.value })}
                placeholder="What is the piece about? Who is it for? How should it feel? Name the moments it must have, the chapters, how it ends…"
                className="field block min-h-32 w-full resize-none px-4 py-3 text-[15.5px] leading-[1.7]"
              />
            </section>

            {selectedRun && (
              <section id="preview" className="card scroll-mt-20 p-5 sm:p-6">
                <SectionHeader
                  title={`Version ${selectedIndex}`}
                  description={`${formatDuration(selectedRun.duration)} · ${project.aspect} · Made ${timeAgo(selectedRun.created_at)}`}
                />
                <div className={clsx("overflow-hidden rounded-[10px] bg-film shadow-e3", portrait && "mx-auto max-w-[360px]")}>
                  <video
                    key={selectedRun.id}
                    src={`${media.video(selectedRun.id)}#t=0.6`}
                    preload="metadata"
                    controls
                    playsInline
                    className="block max-h-[70vh] w-full bg-film"
                  />
                </div>
              </section>
            )}

            {(project.timeline || project.script) && (
              <section id="timeline" className="card scroll-mt-20 p-5 sm:p-6">
                <SectionHeader
                  title={tab === "timeline" ? "Timeline" : "Script"}
                  action={<Segmented value={tab} onChange={setTab} options={[["timeline", "Timeline"], ["script", "Script"]]} />}
                />
                {tab === "timeline" ? (
                  project.timeline ? (
                    <TimelineStrip timeline={project.timeline} assets={project.assets} />
                  ) : (
                    <p className="text-[14px] text-faint">No cut yet.</p>
                  )
                ) : project.script ? (
                  <div className="prose-doc text-[15px]">
                    <ReactMarkdown>{project.script}</ReactMarkdown>
                  </div>
                ) : (
                  <p className="text-[14px] text-faint">No script yet.</p>
                )}
              </section>
            )}

            <section id="footage" className="card scroll-mt-20 p-5 sm:p-6">
              <SectionHeader
                title="Footage"
                count={project.assets.length}
                description="The editor finds licensed footage on its own. Add your own only if you want it in the cut, or tag it Reference to show a look to match."
              />
              <SourceLine />
              <AssetGrid projectId={project.id} assets={project.assets} onChange={(assets) => setProject({ ...project, assets })} />
            </section>

            {credits.length > 0 && (
              <section id="credits" className="card scroll-mt-20 p-5 sm:p-6">
                <SectionHeader title="Credits" count={credits.length} description="Footage used in this cut, with its license." action={<CopyCredits credits={credits} />} />
                <ul className="divide-y divide-line text-[13.5px]">
                  {credits.map((a) => (
                    <li key={a.id} className="flex items-baseline justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
                      <span className="min-w-0 truncate">
                        <a href={a.source_url || undefined} target="_blank" rel="noreferrer" className="font-medium underline-offset-2 hover:underline">{a.name}</a>
                        {a.credit && <span className="text-muted"> by {a.credit}</span>}
                      </span>
                      <span className="shrink-0 text-[12.5px] text-faint">{a.source} · {a.license}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        </div>

        {/* Activity below the entry on small screens */}
        {!isDesktop && <div className="h-[45vh] shrink-0 border-t border-line">{panel}</div>}
      </div>

      {isDesktop && panelOpen && <div className="w-[380px] shrink-0 border-l border-line">{panel}</div>}
    </div>
  );
}

/** Which footage libraries the editor can search; libraries that need a key say so. */
function SourceLine() {
  const [list, setList] = useState<FootageSource[] | null>(null);
  useEffect(() => {
    api.sources().then(setList).catch(() => setList([]));
  }, []);
  if (!list?.length) return null;
  return (
    <div className="mb-4 flex flex-wrap items-center gap-1.5">
      <span className="label mr-1">Searches</span>
      {list.map((s) => (
        <span
          key={s.name}
          title={s.enabled ? `Searching ${s.name}` : `Add ${s.needs_key} to backend/.env to search ${s.name}`}
          className={clsx(s.enabled ? "" : "opacity-55")}
        >
          <Badge tone={s.enabled ? "sage" : "neutral"}>
            <span className={clsx("size-[5px] rounded-full bg-current")} />
            {s.name}
          </Badge>
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
    <Button size="sm" onClick={copy} icon={copied ? <Check className="size-3.5 text-sage" strokeWidth={1.75} /> : <Copy className="size-3.5" strokeWidth={1.75} />}>
      {copied ? "Copied" : "Copy credits"}
    </Button>
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
      <nav className="mx-auto max-w-[800px] overflow-x-auto px-4 py-2 sm:px-8" aria-label="Sections">
        <div className="track">
          {sections.map((sec) => (
            <button key={sec.id} onClick={() => jump(sec.id)} aria-current={active === sec.id}>
              {sec.label}
              {sec.count ? <span className="text-[11.5px] font-normal text-faint">{sec.count}</span> : null}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
