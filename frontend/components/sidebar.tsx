"use client";

import clsx from "clsx";
import { ChevronsUpDown, Home, LogOut, Palette, PanelLeftClose, Pencil, Plus, Search, ShieldOff } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useApp } from "@/components/app-context";
import { openPalette } from "@/components/command-palette";
import { Cover } from "@/components/frame";
import { Wordmark } from "@/components/logo";
import { STATUS_LABELS } from "@/components/status";
import { Button, IconButton, Menu, MenuItem, MenuLabel } from "@/components/ui";
import { ACTIVE_STATUSES, api, media } from "@/lib/api";

export function Sidebar({ onClose }: { onClose?: () => void }) {
  const { user, setUser, projects, refreshProjects } = useApp();
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
    <aside className="flex h-full w-[248px] flex-col">
      <div className="flex h-14 items-center justify-between px-4">
        <Link href="/" onClick={onClose} aria-label="Picasso home" className="rounded-control px-1 py-0.5">
          <Wordmark />
        </Link>
        {onClose && (
          <IconButton onClick={onClose} aria-label="Close sidebar">
            <PanelLeftClose className="size-4" strokeWidth={1.5} />
          </IconButton>
        )}
      </div>

      <div className="space-y-2 px-3 pt-1">
        <Button variant="primary" className="w-full" onClick={newVideo} loading={creating} icon={<Plus className="size-4" strokeWidth={1.75} />}>
          New video
        </Button>
        <button
          onClick={() => { onClose?.(); openPalette(); }}
          className="field flex h-9 w-full items-center gap-2.5 px-3 text-left text-[13px] text-faint"
        >
          <Search className="size-3.5" strokeWidth={1.75} />
          <span className="flex-1">Search</span>
          <kbd className="kbd">⌘K</kbd>
        </button>
      </div>

      <nav className="mt-4 space-y-0.5 px-3">
        <NavLink href="/" active={pathname === "/"} icon={<Home className="size-4" strokeWidth={1.75} />} onClick={onClose}>
          Studio
        </NavLink>
        <NavLink href="/styles" active={pathname === "/styles"} icon={<Palette className="size-4" strokeWidth={1.75} />} onClick={onClose}>
          Styles
        </NavLink>
      </nav>

      <div className="mt-5 flex items-center justify-between px-5 pb-1.5">
        <span className="label">Your videos</span>
        {projects.length > 0 && <span className="label">{projects.length}</span>}
      </div>
      <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-3 pb-3">
        {projects.length === 0 && (
          <p className="px-2 py-1 text-[13px] leading-relaxed text-faint">Videos you make will show up here.</p>
        )}
        {projects.map((p) => {
          const active = pathname === `/projects/${p.id}`;
          const working = p.latest_status && ACTIVE_STATUSES.includes(p.latest_status);
          return (
            <Link
              key={p.id}
              href={`/projects/${p.id}`}
              onClick={onClose}
              title={p.name || "Untitled"}
              className={clsx(
                "group flex items-center gap-2.5 rounded-control p-1.5 pr-2 transition-colors",
                active ? "bg-paper text-fg shadow-e1" : "text-muted hover:bg-hover hover:text-fg",
              )}
            >
              <span className="relative h-[24px] w-[36px] shrink-0 overflow-hidden rounded-[5px] bg-soft ring-1 ring-line">
                {p.cover_asset_id ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={media.thumb(p.cover_asset_id)} alt="" className="gallery-img size-full object-cover" loading="lazy" />
                ) : (
                  <Cover seed={p.id} small />
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

      <div className="border-t border-line p-3">
        <Menu
          width="w-60"
          up
          className="w-full"
          trigger={({ toggle }) => (
            <button onClick={toggle} className="flex w-full items-center gap-2.5 rounded-control p-1.5 text-left transition-colors hover:bg-hover">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--accent),color-mix(in_srgb,var(--accent)_60%,var(--fg)))] text-[12.5px] font-semibold text-white shadow-e1">
                {user.name.slice(0, 1).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium">{user.name}</span>
                <span className="block text-[11.5px] text-faint">{user.token_kind === "oauth" ? "Claude account" : "API key"}</span>
              </span>
              <ChevronsUpDown className="size-3.5 text-faint" strokeWidth={1.75} />
            </button>
          )}
        >
          {(close) => (
            <>
              <MenuLabel>Connected as <span className="font-mono text-muted">{user.token_hint}</span></MenuLabel>
              <div className="my-1 h-px bg-line" />
              <MenuItem icon={<Pencil className="size-3.5" strokeWidth={1.75} />} onClick={() => { close(); rename(); }}>
                Rename studio
              </MenuItem>
              <MenuItem icon={<LogOut className="size-3.5" strokeWidth={1.75} />} onClick={signOut}>
                Sign out
              </MenuItem>
              <MenuItem icon={<ShieldOff className="size-3.5" strokeWidth={1.75} />} onClick={forget} danger>
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
      aria-current={active ? "page" : undefined}
      className={clsx(
        "flex h-9 items-center gap-2.5 rounded-control px-2.5 text-[13.5px] font-medium transition-colors",
        active ? "bg-paper text-fg shadow-e1" : "text-muted hover:bg-hover hover:text-fg",
      )}
    >
      <span className={clsx("flex w-4 justify-center", active ? "text-accent" : "text-faint")}>{icon}</span>
      {children}
    </Link>
  );
}
