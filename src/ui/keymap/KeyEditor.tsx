// The key editor, below the keyboard, as in GLIDE. Left: which key it is and
// its actions as slots (On Tap; On Hold, a tap-hold; On Double Tap, a morse
// entry of its own, written by model/key-slots' plan). Right:
// the tabs that fill the active slot — Pick Key (search, quick links, every key
// in groups, modifiers), Switch Layer, Lighting, and Every action (the full
// editor, for macros, morse patterns and the rest).

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import type { Action, KeyAction } from "../../model/action-types";
import { keyActionGlyph, keyActionDescription } from "../labels";
import { keyAddressLabel, matrixKeyLabel } from "../key-address";
import { keyPendingId, useWorkbench } from "../state";
import { useCapabilities } from "../use-capabilities";
import { layerName } from "../layer-names";

import { cx } from "../kit";
import { CloseIcon, WarningIcon } from "../icons";
import { showToast } from "../messages/store";
import {
  morseUses,
  planSlotWrites,
  putSlot,
  slotsOf,
  withProfile,
  type Slot,
  type SlotValues,
} from "../../model/key-slots";

import { ActionEditor } from "./ActionEditor";
import { LayerLighting } from "./LayerLighting";

import { PickKey } from "./PickKey";
import { SlotList } from "./SlotList";
import { SwitchLayer, type LayerKind } from "./SwitchLayer";

type Tab = "pick" | "layer" | "lighting" | "all";

export function KeyEditor({ height = 310 }: { height?: number }) {
  const { bundle, state, dispatch, io } = useWorkbench();
  const capabilities = useCapabilities();
  const [tab, setTab] = useState<Tab>("pick");
  const [slot, setSlot] = useState<Slot>("tap");
  const selection = state.selection?.type === "key" ? state.selection : null;
  const selectionId = selection ? `${state.uiLayer}:${selection.row}:${selection.col}` : null;
  useEffect(() => setSlot("tap"), [selectionId]);
  const uses = useMemo(() => morseUses(state.layers), [state.layers]);

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: "pick", label: "Pick Key" },
    { id: "layer", label: "Switch Layer" },
    ...(capabilities.has("lighting.scenes") || capabilities.has("lighting.compiled")
      ? [{ id: "lighting" as Tab, label: "Lighting" }]
      : []),
    { id: "all", label: "Every action" },
  ];

  if (!selection) {
    return (
      <section
        style={{ "--editor-h": `${height}px` } as CSSProperties}
        className="flex h-(--editor-h) min-h-[132px] shrink-0 items-center justify-center rounded-2xl border border-line bg-panel px-6 py-8 text-center max-lg:h-auto"
      >
        <p className="text-ui font-semibold text-mute">↑ Click a key on the keyboard to change what it does</p>
      </section>
    );
  }

  const { row, col } = selection;
  const cols = bundle.caps.num_cols;
  const layer = state.uiLayer;
  const action: KeyAction = state.layers[layer]?.[row * cols + col] ?? "No";
  const pending = state.pending[keyPendingId(layer, row, col)];
  const staged = state.stagedKeys[keyPendingId(layer, row, col)];
  const key = bundle.model.keys.find((candidate) => candidate.row === row && candidate.col === col);
  const addressable = key ?? { row, col };
  const slots = slotsOf(action, state.morse);
  const commit = (next: KeyAction) => io.setKey(layer, row, col, next);
  /** Writes the morse entry (when the plan has one) before the key, and stops at the first failure. */
  const apply = async (next: SlotValues | "Transparent") => {
    const writes = planSlotWrites(action, next, state.morse, uses);
    if (!writes) {
      showToast("No double tap added: every morse entry is in use", { tone: "danger" });
      return;
    }
    for (const write of writes) {
      const result =
        write.kind === "morse" ? await io.setSlot("morse", write.index, write.entry) : await commit(write.binding);
      if (!result.ok) return;
    }
  };
  const put = (target: Slot, value: Action | null) => apply(putSlot(slots, target, value));
  const fill = (value: Action | "Transparent") => (value === "Transparent" ? apply("Transparent") : put(slot, value));
  const pickLayer = (kind: LayerKind, target: number) => {
    if (kind === "HoldTap") {
      void put("hold", { LayerOn: target } as Action);
      setSlot("tap");
      setTab("pick");
      return;
    }
    void fill({ [kind]: target } as unknown as Action);
  };
  const glyph = keyActionGlyph(action, state.morse);

  return (
    <section
      style={{ "--editor-h": `${height}px` } as CSSProperties}
      className="flex h-(--editor-h) min-h-0 shrink-0 overflow-hidden rounded-2xl border border-line bg-panel max-lg:h-auto max-lg:flex-col"
    >
      {/* which key, and its slots */}
      <div className="flex w-[300px] shrink-0 flex-col gap-3 overflow-y-auto border-r border-line p-4 max-lg:w-full max-lg:border-r-0 max-lg:border-b">
        <div className="flex items-start gap-3">
          <div className="flex h-12 min-w-12 items-center justify-center rounded-lg border-2 border-select bg-cap px-2 font-mono text-title text-cap-ink">
            {glyph.text || "·"}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-ui font-semibold text-ink">{keyAddressLabel(addressable)}</div>
            <div className="text-small text-faint">
              {layerName(state.layerMetadata, layer)} · matrix {matrixKeyLabel(addressable)}
            </div>
          </div>
          <button
            type="button"
            onClick={() => dispatch({ type: "select", selection: null })}
            aria-label="Done with this key"
            title="Done with this key"
            className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-faint hover:bg-hover hover:text-ink"
          >
            <CloseIcon size={11} />
          </button>
        </div>

        {slots.kind === "slots" ? (
          <SlotList
            slots={slots}
            active={slot}
            offerDoubleTap={capabilities.has("keys.doubleTap")}
            profiles={state.morseProfiles}
            onSelect={setSlot}
            onClear={(target) => {
              if (target !== "tap") setSlot("tap");
              void put(target, null);
            }}
            onProfile={(profile) => commit(withProfile(action, profile))}
          />
        ) : (
          <p className="text-body leading-relaxed text-mute">
            {slots.kind === "transparent"
              ? "Same as the layer below. Pick an action to give this key its own."
              : slots.kind === "morse"
                ? `${keyActionDescription(action)}. Edit it under Behaviors → Morse, or pick an action to replace it.`
                : `${keyActionDescription(action)}. Edit it under Every action, or pick an action to replace it.`}
          </p>
        )}

        {pending?.status === "pending" && <p className="text-small text-accent">Writing to the keyboard…</p>}
        {staged && <p className="text-small text-accent">Staged: written when the batch is applied</p>}
        {pending?.status === "error" && (
          <div className="flex items-start gap-2 rounded-lg border border-danger/40 bg-danger-dim/25 px-3 py-2 text-body text-danger">
            <WarningIcon size={14} className="mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <div>Not written: {pending.message}</div>
              <div className="mt-1 flex gap-3">
                {pending.attempted && (
                  <button type="button" className="cursor-pointer font-semibold underline" onClick={() => commit(pending.attempted!)}>
                    Retry
                  </button>
                )}
                <button
                  type="button"
                  className="cursor-pointer text-mute underline"
                  onClick={() => dispatch({ type: "keyErrDismiss", layer, row, col })}
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* the tabs that fill the active slot */}
      <div
        role="tablist"
        aria-orientation="vertical"
        className="flex w-[132px] shrink-0 flex-col gap-1 border-r border-line p-2 max-lg:w-full max-lg:flex-row max-lg:overflow-x-auto max-lg:border-r-0 max-lg:border-b"
      >
        {tabs.map((option) => (
          <button
            key={option.id}
            type="button"
            role="tab"
            aria-selected={tab === option.id}
            onClick={() => setTab(option.id)}
            className={cx(
              "shrink-0 cursor-pointer rounded-lg px-3 py-2 text-left text-body font-semibold transition-colors",
              tab === option.id ? "bg-raised text-accent" : "text-mute hover:bg-hover hover:text-ink",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto p-4 max-lg:max-h-[420px]">
        {tab === "pick" && <PickKey onPick={fill} disabled={false} />}
        {tab === "layer" && <SwitchLayer onPick={pickLayer} disabled={false} />}
        {tab === "lighting" && <LayerLighting ledId={key?.ledId} />}
        {tab === "all" && (
          <ActionEditor
            current={action}
            numLayers={bundle.caps.num_layers}
            onCommit={commit}
            lightingKey={key && { layer, key }}
          />
        )}
      </div>
    </section>
  );
}
