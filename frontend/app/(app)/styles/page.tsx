"use client";

import clsx from "clsx";
import { CopyPlus, Plus, X } from "lucide-react";
import { useState } from "react";
import { useApp } from "@/components/app-context";
import { SceneSwatch } from "@/components/artwork";
import { TiltCard } from "@/components/frame";
import { Button, IconButton, PageHeader, SectionHeader, Segmented } from "@/components/ui";
import { api, Style, StyleInput } from "@/lib/api";

const BLANK: StyleInput = {
  name: "",
  emoji: "🎨",
  description: "",
  pacing_seconds: 3.5,
  caption_position: "bottom",
  caption_color: "#F2EFE8",
  caption_box: true,
  transition: "cut",
  brightness: 0,
  contrast: 1,
  saturation: 1,
};

export default function StylesPage() {
  const { styles, refreshStyles } = useApp();
  const [editing, setEditing] = useState<{ id: string | null; data: StyleInput } | null>(null);

  const toInput = (s: Style): StyleInput =>
    Object.fromEntries(Object.entries(s).filter(([k]) => k !== "id" && k !== "builtin")) as StyleInput;

  const remove = async (s: Style) => {
    if (!window.confirm(`Remove the “${s.name}” style? Works using it return to Explainer.`)) return;
    await api.deleteStyle(s.id);
    await refreshStyles();
  };

  const builtin = styles.filter((s) => s.builtin);
  const own = styles.filter((s) => !s.builtin);

  return (
    <div className="studio-glow h-full overflow-y-auto">
      <div className="mx-auto max-w-[1000px] px-5 pt-10 pb-24 sm:px-10 sm:pt-16">
        <PageHeader
          eyebrow="Styles"
          title={<>A way of <span className="text-accent">seeing</span></>}
          description="A style tells the editor how to cut (pacing, tone, how words are used) and the renderer how the video should look."
          actions={
            <Button variant="primary" onClick={() => setEditing({ id: null, data: BLANK })} icon={<Plus className="size-4" strokeWidth={1.75} />}>
              Compose a style
            </Button>
          }
        />

        {own.length > 0 && (
          <Gallery
            title="Your styles"
            styles={own}
            onDuplicate={(s) => setEditing({ id: null, data: { ...toInput(s), name: `${s.name} variation` } })}
            onEdit={(s) => setEditing({ id: s.id, data: toInput(s) })}
            onRemove={remove}
          />
        )}
        <Gallery
          title="House styles"
          styles={builtin}
          onDuplicate={(s) => setEditing({ id: null, data: { ...toInput(s), name: `${s.name} variation` } })}
        />
      </div>

      {editing && (
        <StyleEditor
          initial={editing.data}
          isNew={!editing.id}
          onClose={() => setEditing(null)}
          onSave={async (data) => {
            if (editing.id) await api.updateStyle(editing.id, data);
            else await api.createStyle(data);
            await refreshStyles();
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function Gallery({
  title,
  styles,
  onDuplicate,
  onEdit,
  onRemove,
}: {
  title: string;
  styles: Style[];
  onDuplicate: (s: Style) => void;
  onEdit?: (s: Style) => void;
  onRemove?: (s: Style) => void;
}) {
  return (
    <section className="mt-14">
      <SectionHeader title={title} count={styles.length} />
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {styles.map((s) => (
          <div key={s.id} className="group">
            <TiltCard media={<StylePreview style={s} />}>
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-[14.5px] font-semibold tracking-[-0.01em]">{s.name}</span>
                <span className="shrink-0 text-[12px] text-faint">~{s.pacing_seconds}s · {s.transition === "fade" ? "Fades" : "Cuts"}</span>
              </div>
              <p className="mt-1 line-clamp-2 min-h-[2lh] text-[13px] leading-relaxed text-muted">{s.description}</p>
              <div className="-mx-1 mt-2.5 flex gap-1 border-t border-line pt-2">
                <Button size="sm" variant="ghost" onClick={() => onDuplicate(s)} icon={<CopyPlus className="size-3.5" strokeWidth={1.75} />}>Make a variation</Button>
                {onEdit && <Button size="sm" variant="ghost" onClick={() => onEdit(s)}>Edit</Button>}
                {onRemove && <Button size="sm" variant="danger" className="ml-auto" onClick={() => onRemove(s)}>Remove</Button>}
              </div>
            </TiltCard>
          </div>
        ))}
      </div>
    </section>
  );
}

/** The same quiet scene under each style's grade and caption treatment. */
function StylePreview({ style, large }: { style: StyleInput; large?: boolean }) {
  const filter = `brightness(${1 + style.brightness * 2}) contrast(${style.contrast}) saturate(${style.saturation})`;
  const pos = {
    top: "top-[9%]",
    center: "top-1/2 -translate-y-1/2",
    bottom: "bottom-[9%]",
    lower_third: "top-[66%]",
  }[style.caption_position];
  return (
    <div className="absolute inset-0 overflow-hidden">
      <SceneSwatch className="absolute inset-0 size-full" style={{ filter }} />
      <div className={clsx("absolute inset-x-0 flex justify-center px-4", pos)}>
        <span
          className={clsx(
            "px-2 py-0.5 text-center font-medium",
            large ? "text-[17px]" : "text-[11.5px]",
            style.caption_box ? "bg-[#1c1a17]/60" : "[text-shadow:0_1px_3px_rgba(0,0,0,.6)]",
          )}
          style={{ color: style.caption_color }}
        >
          The light changes everything
        </span>
      </div>
    </div>
  );
}

function StyleEditor({
  initial,
  isNew,
  onClose,
  onSave,
}: {
  initial: StyleInput;
  isNew: boolean;
  onClose: () => void;
  onSave: (data: StyleInput) => Promise<void>;
}) {
  const [data, setData] = useState<StyleInput>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof StyleInput>(k: K, v: StyleInput[K]) => setData((d) => ({ ...d, [k]: v }));

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await onSave(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save");
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-fg/20 p-4 pt-[6vh] backdrop-blur-[2px]" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-label={isNew ? "Compose a style" : "Edit style"}
        className="fade-up w-full max-w-[680px] overflow-hidden rounded-sheet border border-line bg-paper shadow-e4"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.key === "Escape" && onClose()}
      >
        <div className="flex h-14 items-center justify-between border-b border-line px-6">
          <span className="text-[15px] font-semibold tracking-[-0.01em]">{isNew ? "Compose a style" : "Edit style"}</span>
          <IconButton onClick={onClose} aria-label="Close"><X className="size-4" strokeWidth={1.75} /></IconButton>
        </div>

        <div className="space-y-6 p-6">
          <div className="relative aspect-video overflow-hidden rounded-card shadow-e2">
            <StylePreview style={data} large />
          </div>

          <Field label="Name">
            <input
              value={data.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Name the style"
              autoFocus
              className="field h-11 w-full px-3.5 text-[16px] font-medium"
            />
          </Field>

          <Field label="Direction for the editor" hint="Pacing, tone, how words are used, what to avoid. The editor reads this before every cut.">
            <textarea
              value={data.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="Warm and unhurried. Linger on faces, cut on laughter, words only at the start of each chapter…"
              className="field block min-h-24 w-full resize-none px-3.5 py-2.5 text-[14px] leading-relaxed"
            />
          </Field>

          <div className="grid gap-6 sm:grid-cols-2">
            <Field label={`Average shot length · ${data.pacing_seconds.toFixed(1)}s`}>
              <input type="range" min={0.5} max={12} step={0.5} value={data.pacing_seconds} onChange={(e) => set("pacing_seconds", +e.target.value)} className="w-full accent-[var(--accent)]" />
            </Field>
            <Field label="Between shots">
              <Segmented value={data.transition} options={[["cut", "Hard cut"], ["fade", "Fade"]]} onChange={(v) => set("transition", v)} />
            </Field>
            <Field label="Where words sit">
              <Segmented
                value={data.caption_position}
                options={[["top", "Top"], ["center", "Center"], ["lower_third", "Lower third"], ["bottom", "Bottom"]]}
                onChange={(v) => set("caption_position", v)}
              />
            </Field>
            <Field label="How words look">
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={data.caption_color}
                  onChange={(e) => set("caption_color", e.target.value.toUpperCase())}
                  className="field h-9 w-10 cursor-pointer p-1"
                  aria-label="Caption color"
                />
                <Segmented value={data.caption_box ? "box" : "shadow"} options={[["box", "On a band"], ["shadow", "Bare"]]} onChange={(v) => set("caption_box", v === "box")} />
              </div>
            </Field>
          </div>

          <Field label="The grade">
            <div className="grid gap-5 sm:grid-cols-3">
              <Slider label="Light" value={data.brightness} min={-0.3} max={0.3} step={0.01} onChange={(v) => set("brightness", v)} />
              <Slider label="Contrast" value={data.contrast} min={0.5} max={1.6} step={0.01} onChange={(v) => set("contrast", v)} />
              <Slider label="Color" value={data.saturation} min={0} max={2} step={0.01} onChange={(v) => set("saturation", v)} />
            </div>
          </Field>

          {error && <p className="text-[13px] text-brick">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 border-t border-line bg-bg/60 px-6 py-3.5">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={busy} disabled={!data.name.trim() || !data.description.trim()} onClick={submit}>
            Save style
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="label mb-1.5 !text-muted">{label}</div>
      {hint && <div className="-mt-0.5 mb-2 text-[12.5px] leading-relaxed text-faint">{hint}</div>}
      {children}
    </div>
  );
}

function Slider({ label, value, min, max, step, onChange }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <div className="mb-1.5 flex justify-between text-[12.5px] text-muted">
        <span>{label}</span>
        <span className="text-[12px] text-faint tabular-nums">{value.toFixed(2)}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(+e.target.value)} className="w-full accent-[var(--accent)]" />
    </label>
  );
}
