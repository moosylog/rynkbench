// Undo and redo for the draft. Device history covers only edits that reached
// the keyboard; in Draft changes are staged instead, so these steps are taken
// from how the staged keys and the layers' lighting change: every change in
// one go (a key, a paste, a swap, a light) is one step, and a Paint stroke,
// however many keys it crosses, is one step too (`merge`). Undo stages the
// keys and lights back. Send and Discard start a new history, as the draft
// starts over. Pure; the hook that drives it is in useDraftHistory.ts.

import type { KeyAction } from "../../model/action-types";
import type { LightingOverlayCell } from "../../model/lighting-types";
import type { StagedKeyEdit } from "../../model/workbench-state";
import type { Rules } from "../lighting/rules";

export interface KeyChange {
  layer: number;
  row: number;
  col: number;
  from: KeyAction;
  to: KeyAction;
}

/** A layer's lighting draft, by LED. */
export type Cells = Record<number, LightingOverlayCell>;

/** One layer's whole lighting draft before and after. */
export interface LightChange {
  layer: number;
  from: Cells;
  to: Cells;
}

export interface Step {
  keys: KeyChange[];
  lights: LightChange[];
  /** The rule table (status lights) before and after; null when it stayed. */
  rules: { from: Rules; to: Rules } | null;
}

export interface DraftHistory {
  past: Step[];
  future: Step[];
}

/** What a step is taken from: the keys, the staged ones, and each layer's lighting and the rules. */
export interface DraftImage {
  layers: KeyAction[][];
  stagedKeys: Record<string, StagedKeyEdit>;
  lighting: Cells[];
  rules: Rules;
}

export const emptyHistory = (): DraftHistory => ({ past: [], future: [] });
export const isEmptyStep = (step: Step) => step.keys.length === 0 && step.lights.length === 0 && step.rules === null;

/** Values compared as values: key order does not matter. */
function canonical(value: unknown): string {
  return JSON.stringify(value, (_, v: unknown) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)))
      : v,
  );
}
const same = (a: unknown, b: unknown) => a === b || canonical(a) === canonical(b);

/** What a state transition changed: the keys among those staged before or
 *  after it, each layer's lighting, and the rules. */
export function stepBetween(before: DraftImage, after: DraftImage, cols: number): Step {
  const places = new Map<string, StagedKeyEdit>();
  for (const edit of [...Object.values(before.stagedKeys), ...Object.values(after.stagedKeys)]) {
    places.set(`${edit.layer}:${edit.row}:${edit.col}`, edit);
  }
  const keys: KeyChange[] = [];
  for (const { layer, row, col } of places.values()) {
    const from = before.layers[layer]?.[row * cols + col] ?? "No";
    const to = after.layers[layer]?.[row * cols + col] ?? "No";
    if (!same(from, to)) keys.push({ layer, row, col, from, to });
  }
  const lights: LightChange[] = [];
  for (let layer = 0; layer < Math.max(before.lighting.length, after.lighting.length); layer += 1) {
    const from = before.lighting[layer] ?? {};
    const to = after.lighting[layer] ?? {};
    if (!same(from, to)) lights.push({ layer, from, to });
  }
  const rules = same(before.rules, after.rules) ? null : { from: before.rules, to: after.rules };
  return { keys, lights, rules };
}

/** Two steps one after the other as one: each thing from where the first found
 *  it to where the second left it; what ends where it started drops out. */
export function merge(first: Step, second: Step): Step {
  const keyAt = (change: KeyChange) => `${change.layer}:${change.row}:${change.col}`;
  const keys = new Map(first.keys.map((change) => [keyAt(change), change]));
  for (const change of second.keys) {
    const earlier = keys.get(keyAt(change));
    keys.set(keyAt(change), earlier ? { ...change, from: earlier.from } : change);
  }
  const lights = new Map(first.lights.map((change) => [change.layer, change]));
  for (const change of second.lights) {
    const earlier = lights.get(change.layer);
    lights.set(change.layer, earlier ? { ...change, from: earlier.from } : change);
  }
  const rules = first.rules && second.rules ? { from: first.rules.from, to: second.rules.to } : (second.rules ?? first.rules);
  return {
    keys: [...keys.values()].filter((change) => !same(change.from, change.to)),
    lights: [...lights.values()].filter((change) => !same(change.from, change.to)).sort((a, b) => a.layer - b.layer),
    rules: rules && !same(rules.from, rules.to) ? rules : null,
  };
}

/** A new step: it goes on the past, and the future is gone. With `join`, it
 *  joins the last step instead (the rest of a Paint stroke). */
export function record(history: DraftHistory, step: Step, join = false): DraftHistory {
  if (isEmptyStep(step)) return history;
  const last = history.past.at(-1);
  if (!join || !last) return { past: [...history.past, step], future: [] };
  const joined = merge(last, step);
  return { past: isEmptyStep(joined) ? history.past.slice(0, -1) : [...history.past.slice(0, -1), joined], future: [] };
}

/** The step undo takes back and the history after it; null when there is none. */
export function undo(history: DraftHistory): { step: Step; history: DraftHistory } | null {
  const step = history.past.at(-1);
  if (!step) return null;
  return { step, history: { past: history.past.slice(0, -1), future: [...history.future, step] } };
}

export function redo(history: DraftHistory): { step: Step; history: DraftHistory } | null {
  const step = history.future.at(-1);
  if (!step) return null;
  return { step, history: { past: [...history.past, step], future: history.future.slice(0, -1) } };
}
