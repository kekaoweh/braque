"use client";

import clsx from "clsx";
import { CornerDownLeft, Film, Home, LogOut, Palette, Plus, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "@/components/app-context";
import { STATUS_LABELS } from "@/components/status";
import { api, formatLength } from "@/lib/api";

const OPEN_EVENT = "picasso:open-palette";

/** Open the quick switcher from anywhere (e.g. the sidebar's search field). */
export function openPalette() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

type Item = { id: string; group: string; label: string; hint?: string; icon: ReactNode; run: () => void | Promise<void> };

export function CommandPalette() {
  const { projects, refreshProjects } = useApp();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setIndex(0);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_EVENT, onOpen);
    };
  }, []);

  const items = useMemo<Item[]>(() => {
    const go = (href: string) => () => router.push(href);
    const actions: Item[] = [
      {
        id: "new", group: "Actions", label: "New video", hint: "Create", icon: <Plus className="size-4" strokeWidth={1.5} />,
        run: async () => {
          const p = await api.createProject({ name: "Untitled" });
          await refreshProjects();
          router.push(`/projects/${p.id}`);
        },
      },
      { id: "studio", group: "Go to", label: "Studio", hint: "Home", icon: <Home className="size-4" strokeWidth={1.5} />, run: go("/") },
      { id: "styles", group: "Go to", label: "Styles", icon: <Palette className="size-4" strokeWidth={1.5} />, run: go("/styles") },
    ];
    const videos: Item[] = projects.map((p) => ({
      id: p.id,
      group: "Your videos",
      label: p.name || "Untitled",
      hint: `${formatLength(p.target_seconds)}${p.latest_status ? ` · ${STATUS_LABELS[p.latest_status]}` : ""}`,
      icon: <Film className="size-4" strokeWidth={1.5} />,
      run: go(`/projects/${p.id}`),
    }));
    const account: Item[] = [{
      id: "signout", group: "Account", label: "Sign out", icon: <LogOut className="size-4" strokeWidth={1.5} />,
      run: async () => { await api.logout(); window.location.href = "/login"; },
    }];
    const all = [...actions, ...videos, ...account];
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter((i) => `${i.label} ${i.hint ?? ""} ${i.group}`.toLowerCase().includes(q));
  }, [projects, query, router, refreshProjects]);

  useEffect(() => setIndex(0), [query]);
  useEffect(() => {
    list.current?.querySelector(`[data-index="${index}"]`)?.scrollIntoView({ block: "nearest" });
  }, [index]);

  if (!open) return null;

  const choose = async (item: Item | undefined) => {
    if (!item) return;
    close();
    await item.run();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") close();
    else if (e.key === "ArrowDown") { e.preventDefault(); setIndex((i) => Math.min(i + 1, items.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setIndex((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); choose(items[index]); }
  };

  let lastGroup = "";
  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center p-4 pt-[14vh]" onMouseDown={close}>
      <div className="absolute inset-0 bg-fg/20 backdrop-blur-[2px]" />
      <div
        role="dialog"
        aria-label="Quick switcher"
        className="fade-up relative w-full max-w-[560px] overflow-hidden rounded-sheet border border-line bg-paper/95 shadow-e4 backdrop-blur-xl"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Search className="size-4 text-faint" strokeWidth={1.5} />
          <input
            ref={input}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search videos, pages and actions…"
            // Focus on mount so keystrokes typed right after ⌘K are never lost.
            autoFocus
            className="h-12 flex-1 bg-transparent text-[15px] outline-none placeholder:text-faint"
            aria-label="Search"
          />
          <kbd className="kbd">Esc</kbd>
        </div>
        <div ref={list} className="max-h-[52vh] overflow-y-auto p-1.5" role="listbox">
          {items.length === 0 && <p className="px-3 py-8 text-center text-[13.5px] text-faint">Nothing matches “{query}”.</p>}
          {items.map((item, i) => {
            const header = item.group !== lastGroup ? item.group : null;
            lastGroup = item.group;
            return (
              <div key={item.id}>
                {header && <div className="label px-3 pt-3 pb-1">{header}</div>}
                <button
                  data-index={i}
                  role="option"
                  aria-selected={i === index}
                  onMouseMove={() => setIndex(i)}
                  onClick={() => choose(item)}
                  className={clsx(
                    "flex w-full items-center gap-3 rounded-control px-3 py-2 text-left transition-colors",
                    i === index ? "bg-active text-fg" : "text-muted",
                  )}
                >
                  <span className={clsx("flex size-7 shrink-0 items-center justify-center rounded-[8px] border border-line bg-paper shadow-e1", i === index ? "text-accent" : "text-faint")}>
                    {item.icon}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[14px]">{item.label}</span>
                  {item.hint && <span className="shrink-0 text-[12px] text-faint">{item.hint}</span>}
                  {i === index && <CornerDownLeft className="size-3.5 shrink-0 text-faint" strokeWidth={1.5} />}
                </button>
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-4 border-t border-line bg-bg/60 px-4 py-2 text-[12px] text-faint">
          <span className="flex items-center gap-1.5"><kbd className="kbd">↑</kbd><kbd className="kbd">↓</kbd> to move</span>
          <span className="flex items-center gap-1.5"><kbd className="kbd">↵</kbd> to open</span>
          <span className="ml-auto flex items-center gap-1.5"><kbd className="kbd">⌘K</kbd> to close</span>
        </div>
      </div>
    </div>
  );
}
