import { describe, expect, it } from "vitest";
import type { KeyAction } from "../../vendor/rynk-wasm/rynk_wasm";
import { emptyHistory, record, redo, stepBetween, undo } from "./draftHistory";

const A = { Single: { Key: { Hid: "A" } } } as unknown as KeyAction;
const B = { Single: { Key: { Hid: "B" } } } as unknown as KeyAction;
const edit = (action: KeyAction) => ({ layer: 0, row: 0, col: 1, before: "No" as KeyAction, action });

describe("the draft's undo and redo", () => {
  it("takes a step from how the staged keys changed", () => {
    const before = { layers: [["No", "No"]] as KeyAction[][], stagedKeys: {} };
    const after = { layers: [["No", A]] as KeyAction[][], stagedKeys: { k: edit(A) } };
    expect(stepBetween(before, after, 2)).toEqual([{ layer: 0, row: 0, col: 1, from: "No", to: A }]);
    // A key edited back to what the keyboard has leaves the staged set, and is still a step.
    expect(stepBetween(after, { layers: [["No", "No"]], stagedKeys: {} }, 2)).toEqual([
      { layer: 0, row: 0, col: 1, from: A, to: "No" },
    ]);
  });

  it("ignores changes that are not to staged keys", () => {
    const before = { layers: [[A, "No"]] as KeyAction[][], stagedKeys: {} };
    const after = { layers: [[B, "No"]] as KeyAction[][], stagedKeys: {} };
    expect(stepBetween(before, after, 2)).toEqual([]);
  });

  it("undoes, redoes, and drops the future on a new step", () => {
    const one = [{ layer: 0, row: 0, col: 1, from: "No" as KeyAction, to: A }];
    const two = [{ layer: 0, row: 0, col: 1, from: A, to: B }];
    let history = record(record(emptyHistory(), one), two);
    const back = undo(history)!;
    expect(back.step).toBe(two);
    history = back.history;
    expect(redo(history)!.step).toBe(two);
    history = record(history, one);
    expect(history.future).toEqual([]);
    expect(undo(emptyHistory())).toBeNull();
  });
});
