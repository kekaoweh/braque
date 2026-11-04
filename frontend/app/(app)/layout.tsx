"use client";

import { Menu as MenuIcon, Search } from "lucide-react";
import { useState } from "react";
import { AppProvider } from "@/components/app-context";
import { CommandPalette, openPalette } from "@/components/command-palette";
import { Logo, Wordmark } from "@/components/logo";
import { Sidebar } from "@/components/sidebar";
import { IconButton, Spinner } from "@/components/ui";

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
            <div className="fade-up relative h-full w-[248px] bg-soft shadow-e4">
              <Sidebar onClose={() => setMobileOpen(false)} />
            </div>
          </div>
        )}
        <div className="flex min-w-0 flex-1 flex-col md:py-2 md:pr-2">
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-bg md:rounded-sheet md:border md:border-line md:shadow-e3">
            <header className="glass flex h-14 shrink-0 items-center gap-2 border-b border-line px-3 md:hidden">
              <IconButton onClick={() => setMobileOpen(true)} aria-label="Open sidebar">
                <MenuIcon className="size-4" strokeWidth={1.5} />
              </IconButton>
              <Wordmark />
              <IconButton onClick={openPalette} className="ml-auto" aria-label="Search">
                <Search className="size-4" strokeWidth={1.5} />
              </IconButton>
            </header>
            <div className="min-h-0 flex-1">{children}</div>
          </div>
        </div>
      </div>
      <CommandPalette />
    </AppProvider>
  );
}
