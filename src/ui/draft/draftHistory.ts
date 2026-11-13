// Undo and redo for the draft. Device history covers only edits that reached
// the keyboard; in Draft keys are staged instead, so these steps are taken from
// how the staged keys change: every change to them in one go (a key, a paste,
// a swap) is one step. Undo stages the keys back. Send and Discard start a new
// history, as the draft starts over. Pure; the hook that drives it is in
// useDraftHistory.ts.

import type { KeyAction } from "../../model/action-types";
import type { StagedKeyEdit } from "../../model/workbench-state";

export interface KeyChange {
  layer: number;
  row: number;
  col: number;
  from: KeyAction;
  to: KeyAction;
}

export type Step = KeyChange[];

export interface DraftHistory {
  past: Step[];
  future: Step[];
}

export const emptyHistory = (): DraftHistory => ({ past: [], future: [] });

/** The keys a state transition changed among those staged before or after it. */
export function stepBetween(
  before: { layers: KeyAction[][]; stagedKeys: Record<string, StagedKeyEdit> },
  after: { layers: KeyAction[][]; stagedKeys: Record<string, StagedKeyEdit> },
  cols: number,
): Step {
  const places = new Map<string, StagedKeyEdit>();
  for (const edit of [...Object.values(before.stagedKeys), ...Object.values(after.stagedKeys)]) {
    places.set(`${edit.layer}:${edit.row}:${edit.col}`, edit);
  }
  const step: Step = [];
  for (const { layer, row, col } of places.values()) {
    const from = before.layers[layer]?.[row * cols + col] ?? "No";
    const to = after.layers[layer]?.[row * cols + col] ?? "No";
    if (JSON.stringify(from) !== JSON.stringify(to)) step.push({ layer, row, col, from, to });
  }
  return step;
}

/** A new step: it goes on the past, and the future is gone. */
export function record(history: DraftHistory, step: Step): DraftHistory {
  return step.length === 0 ? history : { past: [...history.past, step], future: [] };
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
