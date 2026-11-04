"use client";

import clsx from "clsx";
import { ChevronsUpDown, Home, LogOut, Palette, PanelLeftClose, Pencil, Plus, Search, ShieldOff } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useApp } from "@/components/app-context";
import { openPalette } from "@/components/command-palette";
import { Wordmark } from "@/components/logo";
import { STATUS_LABELS } from "@/components/status";
import { Button, Menu, MenuItem, plate } from "@/components/ui";
import { ACTIVE_STATUSES, api, media } from "@/lib/api";

export function Sidebar({ onClose }: { onClose?: () => void }) {
  const { user, setUser, projects, refreshProjects, plateOf } = useApp();
  const pathname = usePathname();
  const router = useRouter();
  const [creating, setCreating] = useState(false);

  const newVideo = async () => {
    setCreating(true);
    try {
      const p = await api.createProject({ name: "Untitled" });
      await refreshProjects();
      router.push(`/projects/${p.id}`);
      onClose?.();
    } finally {
      setCreating(false);
    }
  };

  const rename = async () => {
    const name = window.prompt("Studio name", user.name);
    if (name?.trim()) setUser(await api.updateMe(name.trim()));
  };

  const signOut = async () => {
    await api.logout();
    window.location.href = "/login";
  };

  const forget = async () => {
    if (!window.confirm("Sign out everywhere and delete your stored Claude token? Your videos stay.")) return;
    await api.forget();
    window.location.href = "/login";
  };

  return (
    <aside className="flex h-full w-[256px] flex-col">
      <div className="flex items-center justify-between px-4 pt-4 pb-4">
        <Link href="/" onClick={onClose} aria-label="Picasso home" className="rounded-[6px] px-1 py-0.5">
          <Wordmark />
        </Link>
        {onClose && (
          <button onClick={onClose} className="rounded-[6px] p-1.5 text-faint hover:bg-hover hover:text-fg" aria-label="Close sidebar">
            <PanelLeftClose className="size-4" strokeWidth={1.5} />
          </button>
        )}
      </div>

      <div className="space-y-2 px-3">
        <button
          onClick={() => { onClose?.(); openPalette(); }}
          className="flex h-9 w-full items-center gap-2.5 rounded-[7px] border border-line bg-paper/70 px-3 text-left text-[13px] text-faint shadow-e1 transition-colors hover:border-line-strong hover:text-muted"
        >
          <Search className="size-3.5" strokeWidth={1.5} />
          <span className="flex-1">Search</span>
          <kbd className="rounded-[4px] border border-line bg-bg px-1.5 font-mono text-[10px]">⌘K</kbd>
        </button>
        <Button variant="primary" className="w-full" onClick={newVideo} loading={creating} icon={<Plus className="size-4" strokeWidth={1.75} />}>
          New video
        </Button>
      </div>

      <nav className="mt-5 space-y-0.5 px-3">
        <NavLink href="/" active={pathname === "/"} icon={<Home className="size-4" strokeWidth={1.5} />} onClick={onClose}>
          Studio
        </NavLink>
        <NavLink href="/styles" active={pathname === "/styles"} icon={<Palette className="size-4" strokeWidth={1.5} />} onClick={onClose}>
          Styles
        </NavLink>
      </nav>

      <div className="mt-6 flex items-center justify-between px-5 pb-2">
        <span className="label">Your videos</span>
        <span className="font-mono text-[10px] text-faint">{projects.length}</span>
      </div>
      <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-3 pb-3">
        {projects.length === 0 && (
          <p className="px-2 py-1 text-[13px] leading-relaxed text-faint">No videos yet. Start one with New video.</p>
        )}
        {projects.map((p) => {
          const active = pathname === `/projects/${p.id}`;
          const working = p.latest_status && ACTIVE_STATUSES.includes(p.latest_status);
          return (
            <Link
              key={p.id}
              href={`/projects/${p.id}`}
              onClick={onClose}
              title={`${plate(plateOf(p.id))} · ${p.name || "Untitled"}`}
              className={clsx(
                "group flex items-center gap-2.5 rounded-[7px] p-1.5 pr-2 transition-all",
                active ? "bg-paper text-fg shadow-e1" : "text-muted hover:bg-hover hover:text-fg",
              )}
            >
              <span className="relative h-[26px] w-[36px] shrink-0 overflow-hidden rounded-[4px] border border-line bg-soft">
                {p.cover_asset_id ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={media.thumb(p.cover_asset_id)} alt="" className="gallery-img size-full object-cover" loading="lazy" />
                ) : (
                  <span className="absolute inset-0 flex items-center justify-center font-mono text-[8.5px] text-faint">
                    {String(plateOf(p.id)).padStart(2, "0")}
                  </span>
                )}
              </span>
              <span className="min-w-0 flex-1 truncate text-[13.5px]">{p.name || "Untitled"}</span>
              {working && (
                <span className="ink-pulse size-[6px] shrink-0 rounded-full bg-accent" title={STATUS_LABELS[p.latest_status!]} />
              )}
            </Link>
          );
        })}
      </div>

      <div className="border-t border-line px-3 pt-2 pb-3">
        <Menu
          width="w-60"
          trigger={({ toggle }) => (
            <button onClick={toggle} className="flex w-full items-center gap-2.5 rounded-[7px] px-2 py-1.5 text-left hover:bg-hover">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-[6px] bg-[linear-gradient(135deg,var(--accent),color-mix(in_srgb,var(--accent)_60%,var(--fg)))] text-[12px] font-semibold text-white shadow-e1">
                {user.name.slice(0, 1).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium">{user.name}</span>
                <span className="block text-[11px] text-faint">{user.token_kind === "oauth" ? "Claude account" : "API key"}</span>
              </span>
              <ChevronsUpDown className="size-3.5 text-faint" strokeWidth={1.5} />
            </button>
          )}
        >
          {(close) => (
            <>
              <div className="px-2.5 pt-2 pb-2">
                <div className="label">Connected</div>
                <div className="mt-1 font-mono text-[11px] text-muted">{user.token_hint}</div>
              </div>
              <div className="my-1 h-px bg-line" />
              <MenuItem icon={<Pencil className="size-3.5" strokeWidth={1.5} />} onClick={() => { close(); rename(); }}>
                Rename studio
              </MenuItem>
              <MenuItem icon={<LogOut className="size-3.5" strokeWidth={1.5} />} onClick={signOut}>
                Sign out
              </MenuItem>
              <MenuItem icon={<ShieldOff className="size-3.5" strokeWidth={1.5} />} onClick={forget} danger>
                Disconnect Claude
              </MenuItem>
            </>
          )}
        </Menu>
      </div>
    </aside>
  );
}

function NavLink({
  href,
  active,
  icon,
  children,
  onClick,
}: {
  href: string;
  active: boolean;
  icon: React.ReactNode;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={clsx(
        "flex items-center gap-2.5 rounded-[7px] px-2.5 py-1.5 text-[14px] font-medium transition-all",
        active ? "bg-paper text-fg shadow-e1" : "text-muted hover:bg-hover hover:text-fg",
      )}
    >
      <span className={clsx("flex w-4 justify-center", active ? "text-accent" : "text-faint")}>{icon}</span>
      {children}
    </Link>
  );
}
