"use client";

import { useEffect, useState } from "react";
import { MOTION_KEY, THEME_KEY } from "@/lib/appearance-script";

/**
 * Appearance is per device (a laptop and a phone can differ), so it lives in localStorage and
 * is applied to <html> before first paint by APPEARANCE_SCRIPT (lib/appearance-script) in the root layout.
 */
export type Theme = "system" | "light" | "dark";
export type Motion = "full" | "reduced";

const EVENT = "picasso:appearance";

function read<T extends string>(key: string, allowed: T[], fallback: T): T {
  try {
    const v = localStorage.getItem(key) as T | null;
    return v && allowed.includes(v) ? v : fallback;
  } catch {
    return fallback;
  }
}

export const getTheme = () => read<Theme>(THEME_KEY, ["system", "light", "dark"], "system");
export const getMotion = () => read<Motion>(MOTION_KEY, ["full", "reduced"], "full");

/** The theme actually showing right now ("system" resolved against the OS). */
export function resolvedTheme(): "light" | "dark" {
  const t = getTheme();
  if (t !== "system") return t;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function store(key: string, value: string, isDefault: boolean) {
  try {
    if (isDefault) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {}
}

export function setTheme(theme: Theme) {
  store(THEME_KEY, theme, theme === "system");
  const root = document.documentElement;
  // Swap every color at once instead of letting each surface's transition run.
  root.classList.add("theme-switching");
  if (theme === "system") delete root.dataset.theme;
  else root.dataset.theme = theme;
  requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove("theme-switching")));
  window.dispatchEvent(new Event(EVENT));
}

export function setMotion(motion: Motion) {
  store(MOTION_KEY, motion, motion === "full");
  if (motion === "reduced") document.documentElement.dataset.motion = "reduced";
  else delete document.documentElement.dataset.motion;
  window.dispatchEvent(new Event(EVENT));
}

/** Flip between light and dark from whatever is showing now. */
export const toggleTheme = () => setTheme(resolvedTheme() === "dark" ? "light" : "dark");

/** Live appearance state for components (updates on changes from anywhere, and OS switches). */
export function useAppearance() {
  const [state, setState] = useState<{ theme: Theme; motion: Motion; resolved: "light" | "dark" }>({
    theme: "system",
    motion: "full",
    resolved: "light",
  });
  useEffect(() => {
    const sync = () => setState({ theme: getTheme(), motion: getMotion(), resolved: resolvedTheme() });
    sync();
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    window.addEventListener(EVENT, sync);
    mql.addEventListener("change", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      mql.removeEventListener("change", sync);
    };
  }, []);
  return state;
}
