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

// Area names sit in the narrow rail, so they stay short in both voices.
export const TERMS = {
  "area.layout": { technical: "Keymap", friendly: "Layout" },
  "area.behaviors": { technical: "Behaviors", friendly: "Behaviors" },
  "area.lighting": { technical: "Lighting", friendly: "Lighting" },
  "area.device": { technical: "Device", friendly: "Keyboard" },
  "area.library": { technical: "Library", friendly: "Library" },
  "area.insights": { technical: "Insights", friendly: "Insights" },
  "section.keymap": { technical: "Keymap", friendly: "Keys" },
  "section.combos": { technical: "Combos", friendly: "Combos" },
  "section.morse": { technical: "Morse", friendly: "Tap patterns" },
  "section.macros": { technical: "Macros", friendly: "Macros" },
  "section.forks": { technical: "Forks", friendly: "Conditional keys" },
  "section.profiles": { technical: "Profiles", friendly: "Tap timing" },
  "section.behavior": { technical: "Behavior", friendly: "Behavior" },
  "section.transforms": { technical: "Transforms", friendly: "Quick changes" },
  "section.lighting": { technical: "Lighting", friendly: "Colors" },
  "section.effects": { technical: "Effects", friendly: "Effects" },
  "section.device": { technical: "Device", friendly: "Keyboard" },
  "section.library": { technical: "Files", friendly: "Files" },
  "section.usage": { technical: "Usage", friendly: "What\u2019s used" },
  "section.live": { technical: "Live", friendly: "Live view" },
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
