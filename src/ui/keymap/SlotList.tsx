// A key's slots in the key editor, as in GLIDE: On Tap always, On Hold and On
// Double Tap when set, else a chip that adds them. The slot being filled is
// marked; the tabs beside the list fill it.

import type { Action } from "../../model/action-types";
import type { Slot, SlotsOf } from "../../model/key-slots";
import { DEFAULT_TAP_HOLD_PROFILE } from "../../model/morse";
import type { ConnectedBundle } from "../../model/workbench-state";
import { actionDescription } from "../labels";
import { cx, SectionLabel } from "../kit";
import { CloseIcon, PlusIcon } from "../icons";
import { morseProfileSummary } from "../morse-profile";

const SLOT_NAME: Record<Slot, string> = { tap: "On Tap", hold: "On Hold", doubleTap: "On Double Tap" };

const CLEAR_HINT: Record<Slot, string> = {
  tap: "Clear the tap",
  hold: "Remove the hold",
  doubleTap: "Remove the double tap",
};

const PICK_HINT: Record<Slot, string> = {
  tap: "Pick what the key does →",
  hold: "Pick what the key does when held →",
  doubleTap: "Pick what the key does when pressed twice →",
};

function SlotRow({
  slot,
  value,
  active,
  onSelect,
  onClear,
}: {
  slot: Slot;
  value: Action;
  active: boolean;
  onSelect: () => void;
  onClear: () => void;
}) {
  const empty = value === "No";
  return (
    <div className="flex flex-col gap-1">
      <SectionLabel>{SLOT_NAME[slot]}</SectionLabel>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={onSelect}
          aria-pressed={active}
          className={cx(
            "flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-left transition-colors",
            active ? "border-accent bg-accent-dim/25" : "border-line bg-raised hover:border-line-strong",
          )}
        >
          <span className={cx("truncate text-body font-semibold", empty ? "text-faint" : "text-ink")}>
            {empty ? "Pick an action →" : actionDescription(value)}
          </span>
        </button>
        <button
          type="button"
          onClick={onClear}
          aria-label={`Clear ${SLOT_NAME[slot]}`}
          title={CLEAR_HINT[slot]}
          className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-faint hover:bg-hover hover:text-ink"
        >
          <CloseIcon size={11} />
        </button>
      </div>
    </div>
  );
}

export function SlotList({
  slots,
  active,
  offerDoubleTap,
  profiles,
  onSelect,
  onClear,
  onProfile,
}: {
  slots: SlotsOf;
  active: Slot;
  /** The keyboard can do a double tap (capability `keys.doubleTap`). */
  offerDoubleTap: boolean;
  profiles: ConnectedBundle["morseProfiles"];
  onSelect: (slot: Slot) => void;
  onClear: (slot: Slot) => void;
  onProfile: (profile: number) => void;
}) {
  const extra: Array<Exclude<Slot, "tap">> = offerDoubleTap ? ["hold", "doubleTap"] : ["hold"];
  const set = extra.filter((slot) => slots[slot] !== null);
  const unset = extra.filter((slot) => slots[slot] === null);
  const row = (slot: Slot, value: Action) => (
    <SlotRow
      key={slot}
      slot={slot}
      value={value}
      active={active === slot}
      onSelect={() => onSelect(slot)}
      onClear={() => onClear(slot)}
    />
  );

  return (
    <>
      {row("tap", slots.tap)}
      {set.map((slot) => row(slot, slots[slot]!))}
      {/* A morse-backed key keeps its timing in its morse entry. */}
      {slots.hold !== null && slots.morse === null && (
        <label className="flex flex-col gap-1 text-small text-faint">
          Hold timing
          <select
            value={slots.profile}
            onChange={(event) => onProfile(Number(event.target.value))}
            className="rounded-lg border border-line bg-raised px-2 py-1.5 text-body text-ink"
          >
            <option value={DEFAULT_TAP_HOLD_PROFILE}>The keyboard's default</option>
            {profiles.map((entry) => (
              <option key={entry.index} value={entry.index}>
                {entry.name} · {morseProfileSummary(entry.profile)}
              </option>
            ))}
          </select>
        </label>
      )}
      {unset.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {unset.map((slot) => (
            <button
              key={slot}
              type="button"
              onClick={() => onSelect(slot)}
              aria-pressed={active === slot}
              className={cx(
                "flex cursor-pointer items-center gap-1.5 rounded-full border border-dashed px-3 py-1 text-small font-semibold transition-colors",
                active === slot ? "border-accent text-accent" : "border-line-strong text-mute hover:text-ink",
              )}
            >
              <PlusIcon size={10} /> {SLOT_NAME[slot]}
            </button>
          ))}
        </div>
      )}
      {slots[active] === null && <p className="text-small text-accent">{PICK_HINT[active]}</p>}
    </>
  );
}
