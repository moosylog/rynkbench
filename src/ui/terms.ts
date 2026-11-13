// The words the app uses for its own parts, in two voices: technical (the RMK
// and Rynk terms) and friendly (plain descriptions of what the thing does).
// One table drives both, so no screen hard-codes either, and the choice is a
// browser-local preference.
//
// Technical is today's wording and the default. The friendly names are
// proposals, meant to be edited here and nowhere else.

import { useSyncExternalStore } from "react";

export type Wording = "technical" | "friendly";

export const DEFAULT_WORDING: Wording = "technical";
const STORAGE_KEY = "rynk:wording";

export interface Term {
  technical: string;
  friendly: string;
}

// The mode rail is narrow, so a friendly mode name stays short.
export const TERMS = {
  "mode.keymap": { technical: "Keymap", friendly: "Layout" },
  "mode.lighting": { technical: "Lighting", friendly: "Lighting" },
  "mode.effects": { technical: "Effects", friendly: "Effects" },
  "mode.live": { technical: "Live", friendly: "Live view" },
  "mode.profiles": { technical: "Profiles", friendly: "Tap timing" },
  "mode.advanced": { technical: "Advanced", friendly: "Advanced" },
  "mode.device": { technical: "Device", friendly: "Keyboard" },
  "tab.combos": { technical: "Combos", friendly: "Combos" },
  "tab.morse": { technical: "Morse", friendly: "Tap patterns" },
  "tab.macros": { technical: "Macros", friendly: "Macros" },
  "tab.forks": { technical: "Forks", friendly: "Conditional keys" },
  "tab.behavior": { technical: "Behavior", friendly: "Behavior" },
  "tab.transforms": { technical: "Transforms", friendly: "Quick changes" },
  "tab.usage": { technical: "Usage", friendly: "What\u2019s used" },
} as const satisfies Record<string, Term>;

export type TermId = keyof typeof TERMS;

export function normalizeWording(value: unknown): Wording {
  return value === "friendly" || value === "technical" ? value : DEFAULT_WORDING;
}

/** A term in the given voice. */
export function termFor(id: TermId, wording: Wording): string {
  return TERMS[id][wording];
}

function storedWording(): Wording {
  try {
    return normalizeWording(typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null);
  } catch {
    // Storage access can throw in privacy modes; fall back to the default.
    return DEFAULT_WORDING;
  }
}

let active: Wording = storedWording();
const listeners = new Set<() => void>();

export function getWording(): Wording {
  return active;
}

export function subscribeWording(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setWording(wording: Wording): void {
  if (wording === active) return;
  active = wording;
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(STORAGE_KEY, wording);
  } catch {
    // Best-effort persistence only.
  }
  for (const listener of listeners) listener();
}

export function useWording(): Wording {
  return useSyncExternalStore(subscribeWording, getWording);
}

/** The lookup screens use: `const term = useTerms(); term("mode.keymap")`. */
export function useTerms(): (id: TermId) => string {
  const wording = useWording();
  return (id) => termFor(id, wording);
}
