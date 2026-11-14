// Drives the draft's undo and redo (draftHistory.ts): records a step each time
// the staged keys change, stages keys back on undo, and starts over when the
// draft is sent or discarded (resetDraftHistory).

import { useEffect, useRef, useSyncExternalStore } from "react";
import { keyActionGlyph } from "../labels";
import { layerName } from "../layer-names";
import { showToast } from "../messages/store";
import type { WorkbenchAction, WorkbenchState } from "../../model/workbench-state";
import { emptyHistory, record, redo, stepBetween, undo, type DraftHistory, type Step } from "./draftHistory";

let history: DraftHistory = emptyHistory();
/** The next change to the staged keys is not an edit (a send, a discard, an undo): skip it. */
let skipNext = false;
const listeners = new Set<() => void>();
function set(next: DraftHistory) {
  history = next;
  for (const listener of listeners) listener();
}
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** The draft starts over: called just before a send or a discard changes the staged keys. */
export function resetDraftHistory() {
  skipNext = true;
  set(emptyHistory());
}

/** Called by the Workbench itself, above its context, so it is given what it needs. */
export function useDraftHistory(state: WorkbenchState, dispatch: (action: WorkbenchAction) => void, cols: number) {
  const current = useSyncExternalStore(subscribe, () => history, () => history);
  const previous = useRef({ layers: state.layers, stagedKeys: state.stagedKeys });

  useEffect(() => {
    const before = previous.current;
    previous.current = { layers: state.layers, stagedKeys: state.stagedKeys };
    if (skipNext) {
      skipNext = false;
      return;
    }
    if (state.batchMode) set(record(history, stepBetween(before, previous.current, cols)));
  }, [state.layers, state.stagedKeys, state.batchMode, cols]);

  const label = (step: Step | undefined) => {
    if (!step) return null;
    if (step.length > 1) return `${step.length} keys`;
    const [change] = step;
    return `${keyActionGlyph(change.to, state.morse).text || "an empty key"} on ${layerName(state.layerMetadata, change.layer)}`;
  };
  const travel = (direction: "undo" | "redo") => {
    const moved = direction === "undo" ? undo(history) : redo(history);
    if (!moved) return;
    skipNext = true;
    set(moved.history);
    for (const change of moved.step) {
      const action = direction === "undo" ? change.from : change.to;
      dispatch({ type: "keyStage", layer: change.layer, row: change.row, col: change.col, action });
    }
    const back = direction === "undo" ? "Redo" : "Undo";
    showToast(`${direction === "undo" ? "Undone" : "Redone"}: ${label(moved.step)}`, {
      action: { label: back, run: () => travel(direction === "undo" ? "redo" : "undo") },
    });
  };

  return {
    canUndo: current.past.length > 0,
    canRedo: current.future.length > 0,
    undoLabel: label(current.past.at(-1)),
    redoLabel: label(current.future.at(-1)),
    undo: () => travel("undo"),
    redo: () => travel("redo"),
  };
}
