"use client";

import clsx from "clsx";
import { ChevronDown, Upload, X } from "lucide-react";
import { DragEvent, useRef, useState } from "react";
import { Badge, ErrorNote, Menu, MenuItem, MenuLabel, useDebouncedCallback } from "@/components/ui";
import { api, Asset, AssetRole, formatDuration, media, uploadAssets } from "@/lib/api";

const ROLES: { value: AssetRole; label: string; hint: string }[] = [
  { value: "footage", label: "Footage", hint: "Cut into the film" },
  { value: "reference", label: "Reference", hint: "A look or pace to match" },
  { value: "music", label: "Score", hint: "The soundtrack" },
];

export function AssetGrid({
  projectId,
  assets,
  onChange,
}: {
  projectId: string;
  assets: Asset[];
  onChange: (assets: Asset[]) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const upload = async (files: File[]) => {
    if (!files.length) return;
    setError(null);
    setProgress(0);
    try {
      const created = await uploadAssets(projectId, files, setProgress);
      onChange([...assets, ...created]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setProgress(null);
    }
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    upload(Array.from(e.dataTransfer.files));
  };

  const update = (asset: Asset) => onChange(assets.map((a) => (a.id === asset.id ? asset : a)));
  const remove = async (asset: Asset) => {
    onChange(assets.filter((a) => a.id !== asset.id));
    await api.deleteAsset(asset.id);
  };

  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => progress === null && input.current?.click()}
        className={clsx(
          "flex cursor-pointer flex-col items-center justify-center rounded-card border border-dashed px-4 text-center transition-colors",
          assets.length ? "py-5" : "py-10",
          dragging ? "border-accent bg-accent-soft" : "border-line-strong bg-bg/60 hover:border-fg/30 hover:bg-hover",
        )}
      >
        <input
          ref={input}
          type="file"
          multiple
          accept="video/*,image/*,audio/*"
          className="hidden"
          onChange={(e) => { upload(Array.from(e.target.files ?? [])); e.target.value = ""; }}
        />
        {progress !== null ? (
          <div className="w-full max-w-xs">
            <div className="mb-2 text-[13px] text-muted">{progress < 1 ? `Uploading · ${Math.round(progress * 100)}%` : "Preparing your files…"}</div>
            <div className="h-1.5 overflow-hidden rounded-full bg-active">
              <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${progress * 100}%` }} />
            </div>
          </div>
        ) : (
          <>
            <span className="mb-2.5 flex size-9 items-center justify-center rounded-full border border-line bg-paper text-muted shadow-e1">
              <Upload className="size-4" strokeWidth={1.75} />
            </span>
            <p className="text-[14px] font-medium">
              {assets.length ? "Add more footage, stills or music" : "Optional: add your own footage, stills or music"}
            </p>
            <p className="mt-0.5 text-[12.5px] text-faint">
              Drop files here or <span className="text-fg underline decoration-line-strong underline-offset-4">browse</span>
            </p>
          </>
        )}
      </div>
      {error && <ErrorNote className="mt-3">{error}</ErrorNote>}

      {assets.length > 0 && (
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {assets.map((a) => (
            <AssetCard key={a.id} asset={a} onUpdate={update} onRemove={() => remove(a)} />
          ))}
        </div>
      )}
    </div>
  );
}

function AssetCard({ asset, onUpdate, onRemove }: { asset: Asset; onUpdate: (a: Asset) => void; onRemove: () => void }) {
  const [note, setNote] = useState(asset.note);
  const saveNote = useDebouncedCallback(async (value: string) => {
    onUpdate(await api.updateAsset(asset.id, { note: value }));
  }, 600);
  const role = ROLES.find((r) => r.value === asset.role) ?? ROLES[0];
  const meta = asset.kind === "image" ? `Still · ${asset.width}×${asset.height}` : `${asset.kind === "video" ? "Video" : "Audio"} · ${formatDuration(asset.duration)}`;

  return (
    <div className="group card p-1.5 shadow-none transition-shadow hover:shadow-e2">
      {/* Overlays live outside the clipped thumbnail so the role menu can open past its edge. */}
      <div className="relative">
        <div className="aspect-video overflow-hidden rounded-[9px] bg-soft">
          {asset.has_thumb ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={media.thumb(asset.id)} alt="" className="gallery-img size-full object-cover" loading="lazy" />
          ) : (
            <div className="flex size-full items-center justify-center text-faint">
              <Waveform />
            </div>
          )}
        </div>
        <div className="absolute top-1.5 left-1.5 z-10">
          <Menu
            width="w-60"
            trigger={({ toggle }) => (
              <button onClick={toggle} aria-label={role.label} className="rounded-full bg-paper/90 shadow-e1 backdrop-blur transition-transform hover:scale-[1.03]">
                <Badge tone={asset.role === "reference" ? "accent" : asset.role === "music" ? "dusk" : "neutral"}>
                  {role.label}
                  <ChevronDown className="-mr-0.5 size-3" strokeWidth={2} />
                </Badge>
              </button>
            )}
          >
            {(close) => (
              <>
                <MenuLabel>Use this as</MenuLabel>
                {ROLES.map((r) => (
                  <MenuItem
                    key={r.value}
                    hint={r.hint}
                    active={r.value === asset.role}
                    onClick={async () => { close(); onUpdate(await api.updateAsset(asset.id, { role: r.value })); }}
                  >
                    {r.label}
                  </MenuItem>
                ))}
              </>
            )}
          </Menu>
        </div>
        <button
          onClick={onRemove}
          className="absolute top-1.5 right-1.5 flex size-6 items-center justify-center rounded-full bg-paper/90 text-muted opacity-0 shadow-e1 backdrop-blur transition-opacity group-hover:opacity-100 hover:text-brick focus-visible:opacity-100"
          aria-label={`Remove ${asset.name}`}
        >
          <X className="size-3.5" strokeWidth={1.75} />
        </button>
      </div>
      <div className="px-1.5 pt-2 pb-1">
        <div className="truncate text-[13px] font-medium" title={asset.name}>{asset.name}</div>
        <div className="mt-0.5 truncate text-[11.5px] text-faint">
          {meta}
          {asset.source !== "upload" && (
            <>
              {" · "}
              <a
                href={asset.source_url || undefined}
                target="_blank"
                rel="noreferrer"
                title={[asset.credit && `By ${asset.credit}`, asset.license].filter(Boolean).join(" · ")}
                className="underline-offset-2 hover:text-muted hover:underline"
              >
                {asset.source}
              </a>
            </>
          )}
        </div>
        <input
          value={note}
          onChange={(e) => { setNote(e.target.value); saveNote(e.target.value); }}
          placeholder="A note for the editor…"
          className="-mx-1 mt-1 h-7 w-[calc(100%+8px)] rounded-[7px] border border-transparent bg-transparent px-1 text-[12.5px] text-muted transition-colors outline-none placeholder:text-faint hover:bg-hover focus:border-line-strong focus:bg-paper"
        />
      </div>
    </div>
  );
}
function Waveform() {
  const bars = [6, 14, 9, 20, 12, 24, 10, 17, 8, 15, 22, 11, 7, 18, 10, 13, 6];
  return (
    <div className="flex h-8 items-center gap-[3px]">
      {bars.map((h, i) => (
        <span key={i} className="w-px bg-current" style={{ height: h }} />
      ))}
    </div>
  );
}
