// The one Undo and Redo the top bar and Ctrl/⌘ Z use. In Draft everything is
// staged, so the staged history (useDraftHistory.ts) is the whole history. In
// Live and in a file, keys are written at once and kept in the keyboard
// history, while lighting is still staged first; the two stacks then undo in
// turn, newest first (model/history.ts pickHistorySide), until ADR 0013 makes
// them one.

import { pickHistorySide, type KeyEditHistory } from "../../model/history";
import type { WorkbenchContextValue } from "../state";
import type { useDraftHistory } from "./useDraftHistory";

type History = WorkbenchContextValue["history"];
type StagedHistory = ReturnType<typeof useDraftHistory>;

export function oneHistory(batchMode: boolean, device: History, staged: StagedHistory, keys: KeyEditHistory): History {
  const stagedHistory: History = {
    ...device,
    error: null,
    canUndo: staged.canUndo,
    canRedo: staged.canRedo,
    undoLabel: staged.undoLabel,
    redoLabel: staged.redoLabel,
    undo: async () => staged.undo(),
    redo: async () => staged.redo(),
  };
  if (batchMode) return stagedHistory;

  const tops = {
    keys: {
      past: device.canUndo ? keys.past.at(-1)?.sequence : undefined,
      future: device.canRedo ? keys.future.at(-1)?.sequence : undefined,
    },
    lights: staged.tops,
  };
  const pick = (direction: "undo" | "redo"): History =>
    pickHistorySide(tops, direction) === "lights" ? stagedHistory : device;
  const undo = pick("undo");
  const redo = pick("redo");
  return {
    ...device,
    canUndo: undo.canUndo,
    canRedo: redo.canRedo && pickHistorySide(tops, "redo") !== null,
    undoLabel: undo.undoLabel,
    redoLabel: redo.redoLabel,
    undo: undo.undo,
    redo: redo.redo,
  };
}
