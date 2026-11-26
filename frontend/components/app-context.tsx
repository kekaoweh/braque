"use client";

import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from "react";
import { ConnectKeyDialog } from "@/components/connect-key";
import { Account, api, ProjectSummary, Settings, Style, User } from "@/lib/api";

type AppState = {
  user: User;
  setUser: (u: User) => void;
  projects: ProjectSummary[];
  refreshProjects: () => Promise<void>;
  patchProjectSummary: (id: string, patch: Partial<ProjectSummary>) => void;
  styles: Style[];
  refreshStyles: () => Promise<void>;
  settings: Settings;
  /** Optimistically apply a change and save it; resolves when the server has it. */
  updateSettings: (patch: Partial<Settings>) => Promise<void>;
  /** Who pays for this user's videos, and studio credit used. */
  account: Account;
  refreshAccount: () => Promise<void>;
  /** Open "Connect your API key"; `then` runs once a key is connected (e.g. start the video). */
  connectKey: (then?: () => void) => void;
};

const Ctx = createContext<AppState | null>(null);

export function useApp() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useApp outside AppProvider");
  return ctx;
}

export function AppProvider({ children, fallback }: { children: ReactNode; fallback: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [styles, setStyles] = useState<Style[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [connecting, setConnecting] = useState(false);
  const afterConnect = useRef<(() => void) | undefined>(undefined);

  const refreshProjects = useCallback(async () => setProjects(await api.projects()), []);
  const refreshStyles = useCallback(async () => setStyles(await api.styles()), []);
  const patchProjectSummary = useCallback(
    (id: string, patch: Partial<ProjectSummary>) =>
      setProjects((ps) => ps.map((p) => (p.id === id ? { ...p, ...patch } : p))),
    [],
  );

  // A ref holds the latest settings so quick successive changes build on each other.
  const settingsRef = useRef<Settings | null>(null);
  settingsRef.current = settings;
  const updateSettings = useCallback(async (patch: Partial<Settings>) => {
    if (!settingsRef.current) return;
    const next = { ...settingsRef.current, ...patch };
    settingsRef.current = next;
    setSettings(next);
    const saved = await api.saveSettings(next);
    // Ignore a stale response if another change went out meanwhile.
    if (settingsRef.current === next) setSettings(saved);
  }, []);

  const refreshAccount = useCallback(async () => setAccount(await api.account()), []);
  const connectKey = useCallback((then?: () => void) => {
    afterConnect.current = then;
    setConnecting(true);
  }, []);
  const closeConnect = useCallback(() => setConnecting(false), []);

  useEffect(() => {
    // api.request redirects to /login on 401.
    api.me().then(async (u) => {
      const [, , s, a] = await Promise.all([refreshProjects(), refreshStyles(), api.settings(), api.account()]);
      setSettings(s);
      setAccount(a);
      setUser(u);
    }).catch(() => {});
  }, [refreshProjects, refreshStyles]);

  if (!user || !settings || !account) return <>{fallback}</>;
  return (
    <Ctx.Provider
      value={{
        user, setUser, projects, refreshProjects, patchProjectSummary, styles, refreshStyles, settings, updateSettings,
        account, refreshAccount, connectKey,
      }}
    >
      {children}
      <ConnectKeyDialog
        open={connecting}
        onClose={closeConnect}
        onConnected={async (u) => {
          setUser(u);
          setConnecting(false);
          await refreshAccount();
          const then = afterConnect.current;
          afterConnect.current = undefined;
          then?.();
        }}
      />
    </Ctx.Provider>
  );
}
