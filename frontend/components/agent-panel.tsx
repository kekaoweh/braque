"use client";

import clsx from "clsx";
import { ArrowRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { StatusPill } from "@/components/status";
import { Button, ErrorNote, Spinner, StepNumber } from "@/components/ui";
import { ACTIVE_STATUSES, api, Asset, formatDuration, media, Run, RunEvent, timeAgo } from "@/lib/api";

/** Live event stream for one run; reconnects from the last seen event. */
function useRunEvents(run: Run | null, onFinished: () => void) {
  const [events, setEvents] = useState<RunEvent[]>([]);
  const finished = useRef(onFinished);
  finished.current = onFinished;

  useEffect(() => {
    setEvents([]);
    if (!run) return;
    let last = 0;
    let es: EventSource | null = null;
    let closed = false;
    let retry: ReturnType<typeof setTimeout>;

    const open = () => {
      es = new EventSource(`${media.events(run.id)}?after=${last}`);
      const onEvent = (e: MessageEvent) => {
        const data = JSON.parse(e.data) as RunEvent;
        last = Math.max(last, data.id);
        setEvents((prev) => (prev.some((p) => p.id === data.id) ? prev : [...prev, data]));
        if (data.type === "status" && data.status && !ACTIVE_STATUSES.includes(data.status)) finished.current();
      };
      ["status", "message", "tool", "progress", "error"].forEach((t) => es!.addEventListener(t, onEvent));
      es.addEventListener("end", () => { closed = true; es?.close(); });
      es.onerror = () => {
        es?.close();
        if (!closed) retry = setTimeout(open, 1500);
      };
    };
    open();
    return () => {
      closed = true;
      clearTimeout(retry);
      es?.close();
    };
  }, [run?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return events;
}

const clock = (iso: string) =>
  new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false });

export function AgentPanel({
  projectId,
  runs,
  assets,
  hasTimeline,
  hasBrief,
  selectedRunId,
  onSelectRun,
  onRunsChange,
  onRunFinished,
  beforeStart,
}: {
  projectId: string;
  runs: Run[];
  assets: Asset[];
  hasTimeline: boolean;
  hasBrief: boolean;
  selectedRunId: string | null;
  onSelectRun: (id: string) => void;
  onRunsChange: (runs: Run[]) => void;
  onRunFinished: () => void;
  beforeStart?: () => Promise<void>;
}) {
  const latest = runs[0] ?? null;
  const active = latest && ACTIVE_STATUSES.includes(latest.status) ? latest : null;
  const events = useRunEvents(latest, onRunFinished);
  const [instruction, setInstruction] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const logEnd = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logEnd.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [events.length]);

  const start = async (mode: "agent" | "render", text = "") => {
    setBusy(true);
    setError(null);
    try {
      await beforeStart?.();
      const run = await api.startRun(projectId, text, mode);
      onRunsChange([run, ...runs]);
      setInstruction("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't start");
    } finally {
      setBusy(false);
    }
  };

  const stop = async () => {
    if (active) await api.cancelRun(active.id);
  };

  const assetName = (id: unknown) => assets.find((a) => a.id === id)?.name ?? "a clip";
  const progress = [...events].reverse().find((e) => e.type === "progress");
  const status = [...events].reverse().find((e) => e.type === "status")?.status ?? latest?.status;

  const entry = (e: RunEvent): React.ReactNode => {
    if (e.type === "tool") {
      if (e.name === "list_assets") return "Surveyed the materials";
      if (e.name === "view_asset") {
        const at = typeof e.input?.start === "number" ? ` from ${formatDuration(e.input.start as number)}` : "";
        return <>Studied <span className="font-medium text-fg">{assetName(e.input?.asset_id)}</span>{at}</>;
      }
      if (e.name === "search_footage") {
        const kind = e.input?.kind === "image" ? "stills" : e.input?.kind === "audio" ? "music" : "footage";
        return <>Searched for {kind}: <span className="text-fg">“{String(e.input?.query ?? "")}”</span></>;
      }
      if (e.name === "import_footage") {
        const n = Number(e.input?.count ?? 0);
        return <>Collected {n} {n === 1 ? "piece" : "pieces"} of footage</>;
      }
      if (e.name === "WebSearch") return <>Researched <span className="text-fg">“{String(e.input?.query ?? "")}”</span></>;
      if (e.name === "write_script") return "Drafted the script";
      if (e.name === "set_timeline") return <>Cut the timeline{e.input?.clips ? <span className="text-faint"> · {String(e.input.clips)} shots</span> : null}</>;
      return e.label;
    }
    if (e.type === "status") {
      if (e.status === "planning") return "The editor sets to work";
      if (e.status === "rendering") return "Rendering the final cut";
      if (e.status === "done") return <span className="text-sage">Finished. The piece is ready to view.</span>;
      if (e.status === "cancelled") return "Set aside";
    }
    return null;
  };

  return (
    <div className="flex h-full flex-col bg-paper/60">
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-line px-5">
        <span className="text-[14px] font-semibold tracking-[-0.01em]">Activity</span>
        {status && <StatusPill status={status} />}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
        {!latest ? (
          <Prelude hasBrief={hasBrief} />
        ) : (
          <div>
            {latest.instruction && (
              <div className="mb-5 rounded-control border border-line bg-bg px-3.5 py-2.5">
                <div className="label mb-0.5">Your direction</div>
                <p className="text-[13.5px] leading-relaxed">{latest.instruction}</p>
              </div>
            )}
            <ol className="space-y-3">
              {events.map((e) => {
                if (e.type === "message")
                  return (
                    <li key={e.id} className="fade-up card px-4 py-3.5 shadow-none">
                      <div className="label mb-1.5">Editor&apos;s note · {clock(e.at)}</div>
                      <div className="prose-doc text-[13.5px] leading-relaxed text-fg">
                        <ReactMarkdown>{e.text ?? ""}</ReactMarkdown>
                      </div>
                    </li>
                  );
                if (e.type === "status" && e.status === "error")
                  return (
                    <li key={e.id} className="fade-up">
                      <ErrorNote>{e.error || latest.error || "Something went wrong."}</ErrorNote>
                    </li>
                  );
                const body = entry(e);
                if (!body) return null;
                return (
                  <li key={e.id} className="fade-up grid grid-cols-[44px_1fr] items-baseline text-[13.5px] leading-relaxed text-muted">
                    <span className="text-[11.5px] text-faint tabular-nums">{clock(e.at)}</span>
                    <span className="min-w-0">{body}</span>
                  </li>
                );
              })}
            </ol>
            {active && (
              <div className="mt-4 grid grid-cols-[44px_1fr] items-center">
                <Spinner className="text-accent" />
                {status === "rendering" && progress?.total ? (
                  <div>
                    <div className="mb-1.5 flex justify-between text-[12px] text-muted">
                      <span>Rendering shots</span>
                      <span className="tabular-nums text-faint">{progress.done} / {progress.total}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-active">
                      <div className="h-full rounded-full bg-accent transition-all duration-500" style={{ width: `${((progress.done ?? 0) / progress.total) * 100}%` }} />
                    </div>
                  </div>
                ) : (
                  <span className="text-[13.5px] text-muted">
                    {status === "queued" ? "Getting ready…" : status === "rendering" ? "Rendering…" : "Working…"}
                  </span>
                )}
              </div>
            )}
            <div ref={logEnd} />
          </div>
        )}

        {runs.length > 1 && (
          <div className="mt-8">
            <div className="label mb-2">Versions</div>
            <ol className="space-y-0.5">
              {runs.map((r, i) => {
                const n = runs.length - i;
                const selected = r.id === selectedRunId;
                return (
                  <li key={r.id}>
                    <button
                      disabled={!r.has_video}
                      onClick={() => onSelectRun(r.id)}
                      className={clsx(
                        "grid w-full grid-cols-[30px_1fr_auto] items-center gap-2 rounded-control px-2 py-1.5 text-left transition-colors",
                        selected ? "bg-paper text-fg shadow-e1" : "text-muted enabled:hover:bg-hover enabled:hover:text-fg",
                        !r.has_video && "cursor-default",
                      )}
                    >
                      <span className={clsx("text-[12px] font-semibold", selected ? "text-accent" : "text-faint")}>v{n}</span>
                      <span className="truncate text-[13px]">{r.instruction || (r.mode === "render" ? "Re-rendered" : "First version")}</span>
                      {r.has_video ? <span className="text-[11.5px] text-faint">{timeAgo(r.created_at)}</span> : <StatusPill status={r.status} />}
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-line bg-paper p-4">
        {error && <ErrorNote className="mb-3">{error}</ErrorNote>}
        {active ? (
          <Button className="w-full" size="lg" onClick={stop}>
            Stop the editor
          </Button>
        ) : !hasTimeline ? (
          <div className="space-y-2.5">
            <textarea
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              rows={1}
              placeholder="Any direction for the editor? (optional)"
              className="field block max-h-32 min-h-10 w-full resize-none px-3 py-2 text-[13.5px] leading-relaxed"
            />
            <Button
              variant="primary"
              size="lg"
              className="w-full"
              loading={busy}
              disabled={!hasBrief && !instruction.trim()}
              onClick={() => start("agent", instruction)}
            >
              Make the video
              <ArrowRight className="size-4" strokeWidth={1.75} />
            </Button>
          </div>
        ) : (
          <div>
            <textarea
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && instruction.trim()) {
                  e.preventDefault();
                  start("agent", instruction);
                }
              }}
              rows={2}
              placeholder="Direct the next revision… “let the opening breathe, end on the wide shot”"
              className="field block max-h-40 min-h-16 w-full resize-none px-3 py-2.5 text-[13.5px] leading-relaxed"
            />
            <div className="mt-2.5 flex items-center justify-between">
              <Button size="sm" variant="ghost" onClick={() => start("render")} disabled={busy} title="Render the current cut again, e.g. after changing the style or format">
                Re-render
              </Button>
              <Button size="sm" variant="primary" onClick={() => start("agent", instruction)} disabled={busy || !instruction.trim()} aria-label="Send revision">
                Revise
                <ArrowRight className="size-3.5" strokeWidth={1.75} />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Prelude({ hasBrief }: { hasBrief: boolean }) {
  const steps = [
    ["Researches the subject", "Checks facts, places and names on the web"],
    ["Finds the footage", "Searches licensed libraries and judges every shot"],
    ["Writes and cuts", "A script, then shots, words, motion and music"],
    ["Renders the video", "Finished, credited and ready to share"],
  ];
  return (
    <div>
      <p className="text-[14px] leading-relaxed text-muted">
        {hasBrief ? "When you're ready, the editor makes the whole video, footage included." : "Write a brief and the editor makes the whole video, footage included. No uploads needed."}
      </p>
      <ol className="relative mt-6 space-y-5 before:absolute before:top-3 before:bottom-3 before:left-[11.5px] before:w-px before:bg-line">
        {steps.map(([title, sub], i) => (
          <li key={title} className="relative flex gap-3">
            <StepNumber n={i + 1} />
            <span className="pt-0.5">
              <span className="block text-[13.5px] font-medium">{title}</span>
              <span className="block text-[12.5px] leading-relaxed text-faint">{sub}</span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
