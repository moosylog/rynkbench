import type { KeyAction } from "../vendor/rynk-wasm/rynk_wasm";
import { same } from "./deep-equal";

export const KEY_EDIT_HISTORY_LIMIT = 100;

/* ---- one order for every edit ------------------------------------------ */
// Until the histories are one (ADR 0013), a key written to the keyboard and a
// light change each keep their own stack. Every edit takes the next number
// from one counter, so the two stacks still undo as one: newest first.

let editOrder = 0;
/** The next edit's place in time; key edits and light changes share it. */
export const nextEditOrder = () => ++editOrder;

export type HistorySide = "keys" | "lights";

/** The orders at the top of each stack: the last done edit and the last undone one. */
export interface StackTops {
  keys: { past?: number; future?: number };
  lights: { past?: number; future?: number };
}

/** Which stack undo or redo takes from. Undo takes the newest done edit. Redo
 *  takes the oldest undone one, and only while nothing newer was done since
 *  (a new edit on either stack ends what could be redone). */
export function pickHistorySide(tops: StackTops, direction: "undo" | "redo"): HistorySide | null {
  const { keys, lights } = tops;
  if (direction === "undo") {
    if (keys.past === undefined && lights.past === undefined) return null;
    return (keys.past ?? -1) > (lights.past ?? -1) ? "keys" : "lights";
  }
  const newestDone = Math.max(keys.past ?? -1, lights.past ?? -1);
  const keyRedo = keys.future !== undefined && keys.future > newestDone ? keys.future : undefined;
  const lightRedo = lights.future !== undefined && lights.future > newestDone ? lights.future : undefined;
  if (keyRedo === undefined && lightRedo === undefined) return null;
  if (lightRedo === undefined) return "keys";
  if (keyRedo === undefined) return "lights";
  return keyRedo < lightRedo ? "keys" : "lights";
}

export interface KeyEditHistoryEntry {
  sequence: number;
  layer: number;
  row: number;
  col: number;
  before: KeyAction;
  after: KeyAction;
}

export interface KeyEditHistory {
  past: KeyEditHistoryEntry[];
  future: KeyEditHistoryEntry[];
  operation: { direction: "undo" | "redo"; entry: KeyEditHistoryEntry } | null;
  error: string | null;
}

export type KeyEditHistoryAction =
  | { type: "record"; entry: KeyEditHistoryEntry }
  | { type: "start"; direction: "undo" | "redo"; entry: KeyEditHistoryEntry }
  | { type: "finish"; direction: "undo" | "redo"; entry: KeyEditHistoryEntry }
  | { type: "fail"; direction: "undo" | "redo"; message: string }
  | { type: "clear" }
  | { type: "dismissError" };

export function initialKeyEditHistory(): KeyEditHistory {
  return { past: [], future: [], operation: null, error: null };
}

export function reduceKeyEditHistory(
  history: KeyEditHistory,
  action: KeyEditHistoryAction,
): KeyEditHistory {
  switch (action.type) {
    case "record": {
      if (same(action.entry.before, action.entry.after)) {
        return history;
      }
      const past = [...history.past, action.entry]
        .sort((a, b) => a.sequence - b.sequence)
        .slice(-KEY_EDIT_HISTORY_LIMIT);
      return { past, future: [], operation: null, error: null };
    }
    case "start":
      return {
        ...history,
        operation: { direction: action.direction, entry: action.entry },
        error: null,
      };
    case "finish":
      return action.direction === "undo"
        ? {
            past: history.past.slice(0, -1),
            future: [...history.future, action.entry],
            operation: null,
            error: null,
          }
        : {
            past: [...history.past, action.entry],
            future: history.future.slice(0, -1),
            operation: null,
            error: null,
          };
    case "fail":
      return {
        ...history,
        operation: null,
        error: `${action.direction === "undo" ? "Undo" : "Redo"} failed: ${action.message}`,
      };
    case "clear":
      return initialKeyEditHistory();
    case "dismissError":
      return { ...history, error: null };
  }
}

/** `layerName` names the entry's layer (ui/layer-names.ts layerName). */
export function keyEditHistoryLabel(
  entry: KeyEditHistoryEntry,
  layerName: (layer: number) => string = (layer) => `Layer ${layer}`,
): string {
  return `${layerName(entry.layer)}, row ${entry.row}, column ${entry.col}`;
}

export type HistoryShortcut = "undo" | "redo";

interface HistoryKeyboardEvent {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  defaultPrevented: boolean;
  target: EventTarget | null;
}

function isTextEntryTarget(target: EventTarget | null): boolean {
  const candidate = target as {
    closest?: (selectors: string) => unknown;
  } | null;
  return Boolean(
    candidate?.closest?.(
      'input, textarea, select, [role="textbox"], [contenteditable]:not([contenteditable="false"])',
    ),
  );
}

export function historyShortcut(event: HistoryKeyboardEvent): HistoryShortcut | null {
  if (
    event.defaultPrevented ||
    (!event.ctrlKey && !event.metaKey) ||
    event.altKey ||
    isTextEntryTarget(event.target)
  ) {
    return null;
  }
  const key = event.key.toLowerCase();
  if (key === "z") return event.shiftKey ? "redo" : "undo";
  if (key === "y" && !event.shiftKey) return "redo";
  return null;
}
