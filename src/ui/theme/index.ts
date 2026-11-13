// The color theme: dark by default, light on request. The choice is a
// browser-local preference, kept with the other settings (../settings.ts) and applied as
// <html data-theme="...">; src/index.css holds the values for each theme.

import { useSyncExternalStore } from "react";
import { SETTING_KEYS, createSetting } from "../settings";

export type Theme = "dark" | "light";

export const DEFAULT_THEME: Theme = "dark";

/** Anything that is not a known theme is the default. */
export function normalizeTheme(value: unknown): Theme {
  return value === "light" || value === "dark" ? value : DEFAULT_THEME;
}

const themeSetting = createSetting(SETTING_KEYS.theme, normalizeTheme);

function apply(theme: Theme): void {
  if (typeof document !== "undefined") document.documentElement.dataset.theme = theme;
}

export function getTheme(): Theme {
  return themeSetting.get();
}

export function subscribeTheme(listener: () => void): () => void {
  return themeSetting.subscribe(listener);
}

/** Applies the saved theme to the page. Called once before the first render. */
export function applyStoredTheme(): void {
  apply(themeSetting.reload());
}

export function setTheme(theme: Theme): void {
  apply(theme);
  themeSetting.set(theme);
}

export function useTheme(): Theme {
  return useSyncExternalStore(subscribeTheme, getTheme, getTheme);
}
