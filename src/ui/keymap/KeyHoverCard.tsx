// The card at the foot of the keyboard while the pointer is on a key, as in
// GLIDE: the key's name, what it does in parts (when tapped / when held), and
// how many combos use it.

import type { KeyView } from "../../model/keyboard";
import { comboIsPositions, samePosition } from "../../model/combos";
import { slotsOf } from "../../model/key-slots";
import { actionDescription, keyActionDescription } from "../labels";
import { keyAddressLabel } from "../key-address";
import { useWorkbench } from "../state";
import { useLayerNames } from "../use-layer-names";

function Part({ word, text }: { word: string; text: string }) {
  return (
    <span className="flex flex-col leading-tight">
      <span className="text-caption text-faint">{word}</span>
      <span className="text-body font-semibold text-ink">{text}</span>
    </span>
  );
}

export function KeyHoverCard({ keyView }: { keyView: KeyView }) {
  const { bundle, state } = useWorkbench();
  const layerNames = useLayerNames();
  const action = state.layers[state.uiLayer]?.[keyView.row * bundle.caps.num_cols + keyView.col] ?? "No";
  const slots = slotsOf(action, state.morse);
  const combos = state.combos.filter(
    (combo) =>
      comboIsPositions(combo) &&
      combo.Positions.positions.some((position) => samePosition(position, keyView)),
  ).length;

  return (
    <div
      aria-hidden
      className="pointer-events-none flex min-h-9 max-w-[32rem] flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-line-strong bg-raised px-3 py-1.5 shadow-2xl max-sm:hidden"
    >
      <span className="font-mono text-small font-semibold text-mute">{keyAddressLabel(keyView)}</span>
      {slots.kind === "slots" && (slots.hold !== null || slots.doubleTap !== null) ? (
        <>
          <Part word="When tapped" text={actionDescription(slots.tap, layerNames)} />
          {slots.hold !== null && <Part word="When held" text={actionDescription(slots.hold, layerNames)} />}
          {slots.doubleTap !== null && <Part word="When pressed twice" text={actionDescription(slots.doubleTap, layerNames)} />}
        </>
      ) : (
        <span className="text-ui font-semibold text-ink">{keyActionDescription(action, layerNames)}</span>
      )}
      {combos > 0 && (
        <span className="rounded-md border border-line px-1.5 py-0.5 text-small font-semibold text-mute">
          In {combos} combo{combos === 1 ? "" : "s"}
        </span>
      )}
    </div>
  );
}
