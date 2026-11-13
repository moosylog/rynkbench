// The color theme: dark by default, light on request. The choice is a
// browser-local preference, kept in localStorage and applied as
// <html data-theme="...">; src/index.css holds the values for each theme.

import { useSyncExternalStore } from "react";

export type Theme = "dark" | "light";

export const DEFAULT_THEME: Theme = "dark";
const STORAGE_KEY = "rynk:theme";

/** Anything that is not a known theme is the default. */
export function normalizeTheme(value: unknown): Theme {
  return value === "light" || value === "dark" ? value : DEFAULT_THEME;
}

function storedTheme(): Theme {
  try {
    return normalizeTheme(typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null);
  } catch {
    // Storage access can throw in privacy modes; fall back to the default.
    return DEFAULT_THEME;
  }
}

let active: Theme = storedTheme();
const listeners = new Set<() => void>();

function apply(theme: Theme): void {
  if (typeof document !== "undefined") document.documentElement.dataset.theme = theme;
}

export function getTheme(): Theme {
  return active;
}

export function subscribeTheme(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Applies the saved theme to the page. Called once before the first render. */
export function applyStoredTheme(): void {
  active = storedTheme();
  apply(active);
}

export function setTheme(theme: Theme): void {
  if (theme === active) return;
  active = theme;
  apply(theme);
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Best-effort persistence only.
  }
  for (const listener of listeners) listener();
}

export function useTheme(): Theme {
  return useSyncExternalStore(subscribeTheme, getTheme, getTheme);
}
