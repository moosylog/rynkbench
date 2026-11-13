// A key's actions as GLIDE's key editor shows them: slots. On Tap is what the
// key does when pressed; On Hold, when held, makes it an RMK tap-hold (with a
// timing profile). A key bound to a morse pattern, or set to fall through to
// the layer below, has no slots of its own here. Pure: a binding in, slots
// out, and back.

import type { Action, KeyAction } from "../vendor/rynk-wasm/rynk_wasm";
import { DEFAULT_TAP_HOLD_PROFILE } from "./morse";

export type Slot = "tap" | "hold";

export type KeySlots =
  | {
      kind: "slots";
      tap: Action;
      /** null: no On Hold slot. */
      hold: Action | null;
      /** The tap-hold timing profile; the board default without a hold. */
      profile: number;
      /** RMK's `Tap` binding (tap only), kept as it is when only its tap changes. */
      tapOnly: boolean;
    }
  | { kind: "transparent" }
  | { kind: "morse"; index: number };

export function slotsOf(action: KeyAction): KeySlots {
  if (action === "No") return { kind: "slots", tap: "No", hold: null, profile: DEFAULT_TAP_HOLD_PROFILE, tapOnly: false };
  if (action === "Transparent") return { kind: "transparent" };
  if ("Single" in action) {
    return { kind: "slots", tap: action.Single, hold: null, profile: DEFAULT_TAP_HOLD_PROFILE, tapOnly: false };
  }
  if ("Tap" in action) {
    return { kind: "slots", tap: action.Tap, hold: null, profile: DEFAULT_TAP_HOLD_PROFILE, tapOnly: true };
  }
  if ("TapHold" in action) {
    const [tap, hold, profile] = action.TapHold;
    return { kind: "slots", tap, hold, profile, tapOnly: false };
  }
  return { kind: "morse", index: action.Morse };
}

/** The binding for a set of slots. A hold makes a tap-hold; without one the
 *  key is a single action, or nothing when its tap is empty too. */
export function bindingOf(slots: Extract<KeySlots, { kind: "slots" }>): KeyAction {
  if (slots.hold !== null) return { TapHold: [slots.tap, slots.hold, slots.profile] };
  if (slots.tap === "No") return "No";
  return slots.tapOnly ? { Tap: slots.tap } : { Single: slots.tap };
}

/** Empty slots, for a key that has none of its own (transparent or morse). */
export function emptySlots(): Extract<KeySlots, { kind: "slots" }> {
  return { kind: "slots", tap: "No", hold: null, profile: DEFAULT_TAP_HOLD_PROFILE, tapOnly: false };
}

/** The binding after putting `value` in one slot of the key's current binding. */
export function withSlot(current: KeyAction, slot: Slot, value: Action): KeyAction {
  const slots = slotsOf(current);
  const base = slots.kind === "slots" ? slots : emptySlots();
  return bindingOf(slot === "tap" ? { ...base, tap: value } : { ...base, hold: value });
}

/** The binding after removing a slot: the hold goes, or the tap is emptied. */
export function withoutSlot(current: KeyAction, slot: Slot): KeyAction {
  const slots = slotsOf(current);
  if (slots.kind !== "slots") return current;
  return bindingOf(slot === "hold" ? { ...slots, hold: null } : { ...slots, tap: "No" });
}

/** The binding with another tap-hold timing profile. */
export function withProfile(current: KeyAction, profile: number): KeyAction {
  const slots = slotsOf(current);
  if (slots.kind !== "slots" || slots.hold === null) return current;
  return bindingOf({ ...slots, profile });
}
