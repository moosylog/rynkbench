import { describe, expect, it } from "vitest";
import type { Action, KeyAction } from "../vendor/rynk-wasm/rynk_wasm";
import { DEFAULT_TAP_HOLD_PROFILE } from "./morse";
import { bindingOf, slotsOf, withProfile, withSlot, withoutSlot } from "./key-slots";

const A: Action = { Key: { Hid: "A" } } as unknown as Action;
const SHIFT: Action = { Modifier: { left_shift: true } } as unknown as Action;
const LOWER: Action = { LayerOn: 1 } as unknown as Action;

describe("key slots", () => {
  it("reads every binding RMK has", () => {
    expect(slotsOf("No")).toMatchObject({ kind: "slots", tap: "No", hold: null });
    expect(slotsOf("Transparent")).toEqual({ kind: "transparent" });
    expect(slotsOf({ Single: A } as KeyAction)).toMatchObject({ tap: A, hold: null, tapOnly: false });
    expect(slotsOf({ Tap: A } as KeyAction)).toMatchObject({ tap: A, hold: null, tapOnly: true });
    expect(slotsOf({ TapHold: [A, SHIFT, 2] } as KeyAction)).toMatchObject({ tap: A, hold: SHIFT, profile: 2 });
    expect(slotsOf({ Morse: 3 } as KeyAction)).toEqual({ kind: "morse", index: 3 });
  });

  it("writes back what it read", () => {
    for (const action of [
      "No",
      { Single: A },
      { Tap: A },
      { TapHold: [A, SHIFT, 2] },
    ] as KeyAction[]) {
      const slots = slotsOf(action);
      if (slots.kind !== "slots") throw new Error("not slots");
      expect(bindingOf(slots)).toEqual(action);
    }
  });

  it("makes a tap-hold when a hold is added, with the board's default timing", () => {
    expect(withSlot({ Single: A } as KeyAction, "hold", SHIFT)).toEqual({
      TapHold: [A, SHIFT, DEFAULT_TAP_HOLD_PROFILE],
    });
  });

  it("gives a transparent or morse key fresh slots when one is filled", () => {
    expect(withSlot("Transparent", "tap", A)).toEqual({ Single: A });
    expect(withSlot({ Morse: 1 } as KeyAction, "hold", LOWER)).toEqual({
      TapHold: ["No", LOWER, DEFAULT_TAP_HOLD_PROFILE],
    });
  });

  it("goes back to a single action when the hold is removed, and to nothing when the tap is", () => {
    const tapHold = { TapHold: [A, SHIFT, 2] } as KeyAction;
    expect(withoutSlot(tapHold, "hold")).toEqual({ Single: A });
    expect(withoutSlot({ Single: A } as KeyAction, "tap")).toEqual("No");
    expect(withoutSlot(tapHold, "tap")).toEqual({ TapHold: ["No", SHIFT, 2] });
  });

  it("changes the timing profile of a tap-hold only", () => {
    expect(withProfile({ TapHold: [A, SHIFT, 2] } as KeyAction, 4)).toEqual({ TapHold: [A, SHIFT, 4] });
    expect(withProfile({ Single: A } as KeyAction, 4)).toEqual({ Single: A });
  });
});
