"use client";

import { Menu as MenuIcon, Search } from "lucide-react";
import { useState } from "react";
import { AppProvider } from "@/components/app-context";
import { CommandPalette, openPalette } from "@/components/command-palette";
import { Logo, Wordmark } from "@/components/logo";
import { Sidebar } from "@/components/sidebar";
import { Spinner } from "@/components/ui";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <AppProvider
      fallback={
        <div className="flex h-dvh flex-col items-center justify-center gap-4 text-faint">
          <Logo className="size-9" />
          <Spinner />
        </div>
      }
    >
      {/* The sidebar sits on the canvas; the workspace is a raised sheet floating above it. */}
      <div className="flex h-dvh overflow-hidden bg-soft">
        <div className="hidden md:block">
          <Sidebar />
        </div>
        {mobileOpen && (
          <div className="fixed inset-0 z-40 md:hidden">
            <div className="absolute inset-0 bg-fg/25 backdrop-blur-[2px]" onClick={() => setMobileOpen(false)} />
            <div className="fade-up relative h-full w-[256px] bg-soft shadow-e4">
              <Sidebar onClose={() => setMobileOpen(false)} />
            </div>
          </div>
        )}
        <div className="flex min-w-0 flex-1 flex-col md:py-2 md:pr-2">
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-bg md:rounded-[12px] md:border md:border-line md:shadow-e3">
            <header className="glass flex h-12 shrink-0 items-center gap-3 border-b border-line px-4 md:hidden">
              <button onClick={() => setMobileOpen(true)} className="rounded-[6px] p-1.5 hover:bg-hover" aria-label="Open sidebar">
                <MenuIcon className="size-4" strokeWidth={1.5} />
              </button>
              <Wordmark />
              <button onClick={openPalette} className="ml-auto rounded-[6px] p-1.5 text-muted hover:bg-hover" aria-label="Search">
                <Search className="size-4" strokeWidth={1.5} />
              </button>
            </header>
            <div className="min-h-0 flex-1">{children}</div>
          </div>
        </div>
      </div>
      <CommandPalette />
    </AppProvider>
  );
}
