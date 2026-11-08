"use client";

import { ArrowRight, Lightbulb } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useApp } from "@/components/app-context";
import { Cover, TiltCard } from "@/components/frame";
import { AspectPicker, LengthPicker, StylePicker } from "@/components/pickers";
import { StatusPill } from "@/components/status";
import { Button, PageHeader, SectionHeader } from "@/components/ui";
import { Aspect, api, formatLength, media, timeAgo } from "@/lib/api";

const IDEAS: [string, string][] = [
  ["Team offsite recap", "A sixty-second recap of our team offsite, warm and funny, names on screen"],
  ["Film cameras essay", "A ten-minute essay on why film cameras are coming back"],
  ["Product launch teaser", "A thirty-second vertical teaser for a product launch, with a hook in the first breath"],
  ["Japan travel diary", "A quiet travel diary from Japan, in chapters by city"],
];

function greeting() {
  const h = new Date().getHours();
  return h < 5 ? "Working late" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

export default function StudioPage() {
  const { user, projects, styles, settings, refreshProjects } = useApp();
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [seconds, setSeconds] = useState(settings.default_seconds);
  const [aspect, setAspect] = useState<Aspect>(settings.default_aspect);
  const [styleId, setStyleId] = useState(settings.default_style_id ?? "sty_explainer");
  const [busy, setBusy] = useState(false);

  const begin = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const firstLine = prompt.trim().split(/[.\n]/)[0];
      const name = firstLine ? firstLine.slice(0, 60) : "Untitled";
      const p = await api.createProject({ name, prompt: prompt.trim(), target_seconds: seconds, aspect, style_id: styleId });
      await refreshProjects();
      router.push(`/projects/${p.id}`);
    } catch {
      setBusy(false);
    }
  };

  return (
    <div className="studio-glow h-full overflow-y-auto">
      <div className="mx-auto max-w-[1000px] px-5 pt-10 pb-24 sm:px-10 sm:pt-16">
        <PageHeader
          eyebrow={`${greeting()}, ${user.name}`}
          title={<>What shall we <span className="text-accent">make</span> today?</>}
          description="Describe a video and the editor researches it, finds licensed footage, writes it and cuts it."
        />

        {/* Composer */}
        <div className="card mt-8 overflow-hidden shadow-e3 transition-shadow focus-within:shadow-e4">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) begin();
            }}
            rows={3}
            placeholder="Describe the piece: its subject, who it's for, how it should feel. The editor finds the footage."
            aria-label="Describe your video"
            className="block max-h-80 min-h-28 w-full resize-none bg-transparent px-5 pt-5 pb-3 text-[16px] leading-relaxed outline-none placeholder:text-faint"
          />
          <div className="flex flex-wrap items-center gap-2 border-t border-line bg-bg/60 px-3 py-3 sm:px-4">
            <LengthPicker value={seconds} onChange={setSeconds} />
            <AspectPicker value={aspect} onChange={setAspect} />
            <StylePicker styles={styles} value={styleId} onChange={setStyleId} />
            <Button variant="primary" className="ml-auto" onClick={begin} loading={busy} title="Create (⌘↵)" aria-label="Create video">
              Create video
              <ArrowRight className="size-4" strokeWidth={1.75} />
            </Button>
          </div>
        </div>

        {/* Ideas */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="label mr-1 inline-flex items-center gap-1.5">
            <Lightbulb className="size-3.5" strokeWidth={1.75} />
            Try an idea
          </span>
          {IDEAS.map(([label, idea]) => (
            <button
              key={label}
              onClick={() => setPrompt(idea)}
              title={idea}
              className="rounded-full border border-line bg-paper/70 px-3 py-1.5 text-[12.5px] text-muted shadow-e1 transition-colors hover:border-line-strong hover:bg-paper hover:text-fg"
            >
              {label}
            </button>
          ))}
        </div>

        {/* Library */}
        <section className="mt-16">
          <SectionHeader title="Your videos" count={projects.length} />
          {projects.length === 0 ? (
            <div className="card grid place-items-center px-6 py-14 text-center shadow-none">
              <p className="text-[15px] font-medium">No videos yet</p>
              <p className="mt-1 text-[13.5px] text-faint">Describe one above and it will appear here.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {projects.map((p) => (
                <Link key={p.id} href={`/projects/${p.id}`} className="group block rounded-card">
                  <TiltCard
                    media={
                      <>
                        {p.cover_asset_id ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={media.thumb(p.cover_asset_id)} alt="" className="gallery-img size-full object-cover group-hover:scale-[1.02]" />
                        ) : (
                          <Cover seed={p.id} />
                        )}
                        {p.latest_status && p.latest_status !== "done" && (
                          <div className="absolute top-2 left-2 rounded-full bg-paper/90 shadow-e1 backdrop-blur">
                            <StatusPill status={p.latest_status} />
                          </div>
                        )}
                      </>
                    }
                  >
                    <div className="truncate text-[14.5px] font-semibold tracking-[-0.01em]">{p.name || "Untitled"}</div>
                    <div className="mt-0.5 text-[12.5px] text-faint">
                      {formatLength(p.target_seconds)} · {p.aspect} · Edited {timeAgo(p.updated_at)}
                    </div>
                  </TiltCard>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
