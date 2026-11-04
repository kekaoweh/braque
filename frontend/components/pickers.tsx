"use client";

import clsx from "clsx";
import { Check, Clock, Sparkles } from "lucide-react";
import { useState } from "react";
import { Menu, MenuItem, MenuLabel, SelectButton } from "@/components/ui";
import { Aspect, formatLength, Style } from "@/lib/api";

export const LENGTHS = [15, 30, 60, 90, 180, 300, 600, 900, 1200, 1800];

export function LengthPicker({ value, onChange, label }: { value: number; onChange: (v: number) => void; label?: string }) {
  const [custom, setCustom] = useState("");
  return (
    <Menu
      width="w-52"
      trigger={({ open, toggle }) => (
        <SelectButton label={label} open={open} onClick={toggle} icon={<Clock className="size-3.5" strokeWidth={1.75} />}>
          {formatLength(value)}
        </SelectButton>
      )}
    >
      {(close) => (
        <>
          <MenuLabel>Running time</MenuLabel>
          <div className="max-h-64 overflow-y-auto">
            {LENGTHS.map((s) => (
              <MenuItem key={s} active={s === value} onClick={() => { onChange(s); close(); }} hint={s === value ? <Check className="size-3.5" strokeWidth={1.75} /> : null}>
                {formatLength(s)}
              </MenuItem>
            ))}
          </div>
          <form
            className="mt-1 border-t border-line p-1 pt-2"
            onSubmit={(e) => {
              e.preventDefault();
              const secs = parseDuration(custom);
              if (secs) { onChange(secs); close(); setCustom(""); }
            }}
          >
            <input
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              placeholder="Custom, e.g. 2:30 or 45s"
              className="field h-8 w-full px-2.5 text-[13px]"
            />
          </form>
        </>
      )}
    </Menu>
  );
}

function parseDuration(text: string): number | null {
  const t = text.trim().toLowerCase();
  let secs: number | null = null;
  if (/^\d+:\d{1,2}$/.test(t)) {
    const [m, s] = t.split(":").map(Number);
    secs = m * 60 + s;
  } else if (/^\d+(\.\d+)?\s*(m|min|mins|minutes?)$/.test(t)) secs = Math.round(parseFloat(t) * 60);
  else if (/^\d+\s*(s|sec|secs|seconds?)?$/.test(t)) secs = parseInt(t, 10);
  if (!secs) return null;
  return Math.min(Math.max(secs, 5), 3600);
}

/** Proportional outline of the frame, so the format reads at a glance. */
export function FrameIcon({ aspect }: { aspect: Aspect }) {
  const [w, h] = { "16:9": [14, 8], "9:16": [8, 14], "1:1": [11, 11], "4:5": [10, 12.5] }[aspect];
  return <span className="inline-block rounded-[2px] border-[1.5px] border-current" style={{ width: w, height: h }} />;
}

const ASPECTS: { value: Aspect; label: string }[] = [
  { value: "16:9", label: "Landscape" },
  { value: "9:16", label: "Vertical" },
  { value: "1:1", label: "Square" },
  { value: "4:5", label: "Portrait" },
];

export function AspectPicker({ value, onChange, label }: { value: Aspect; onChange: (v: Aspect) => void; label?: string }) {
  const current = ASPECTS.find((a) => a.value === value) ?? ASPECTS[0];
  return (
    <Menu
      width="w-48"
      trigger={({ open, toggle }) => (
        <SelectButton label={label} open={open} onClick={toggle} icon={<span className="flex w-3.5 justify-center"><FrameIcon aspect={current.value} /></span>}>
          {current.label} <span className="text-faint">{current.value}</span>
        </SelectButton>
      )}
    >
      {(close) => (
        <>
          <MenuLabel>Format</MenuLabel>
          {ASPECTS.map((a) => (
            <MenuItem key={a.value} icon={<FrameIcon aspect={a.value} />} active={a.value === value} hint={a.value} onClick={() => { onChange(a.value); close(); }}>
              {a.label}
            </MenuItem>
          ))}
        </>
      )}
    </Menu>
  );
}

export function StylePicker({
  styles,
  value,
  onChange,
  label,
}: {
  styles: Style[];
  value: string | null;
  onChange: (v: string) => void;
  label?: string;
}) {
  const current = styles.find((s) => s.id === value);
  return (
    <Menu
      width="w-80"
      trigger={({ open, toggle }) => (
        <SelectButton label={label} open={open} onClick={toggle} icon={<Sparkles className="size-3.5" strokeWidth={1.75} />}>
          {current?.name ?? "Choose a style"}
        </SelectButton>
      )}
    >
      {(close) => (
        <>
          <MenuLabel>Style</MenuLabel>
          <div className="max-h-80 overflow-y-auto">
            {styles.map((s) => (
              <button
                key={s.id}
                onClick={() => { onChange(s.id); close(); }}
                className={clsx("block w-full rounded-[8px] px-2.5 py-2 text-left transition-colors hover:bg-hover", s.id === value && "bg-hover")}
              >
                <span className="flex items-center justify-between gap-3">
                  <span className="text-[13.5px] font-medium">{s.name}</span>
                  {s.id === value ? <Check className="size-3.5 text-accent" strokeWidth={1.75} /> : <span className="text-[11.5px] text-faint">~{s.pacing_seconds}s shots</span>}
                </span>
                <span className="mt-0.5 line-clamp-2 block text-[12px] leading-snug text-muted">{s.description}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </Menu>
  );
}
