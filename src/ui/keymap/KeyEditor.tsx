// The key editor, below the keyboard, as in GLIDE. Left: which key it is and
// its actions as slots (On Tap, and On Hold, which makes it a tap-hold). Right:
// the tabs that fill the active slot — Pick Key (search, quick links, every key
// in groups, modifiers), Switch Layer, Lighting, and Every action (the full
// editor, for macros, morse patterns and the rest).

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import type { Action, KeyAction } from "../../model/action-types";
import { keyActionGlyph, keyActionDescription, actionDescription } from "../labels";
import { keyAddressLabel, matrixKeyLabel } from "../key-address";
import { keyPendingId, useWorkbench } from "../state";
import { useCapabilities } from "../use-capabilities";
import { layerName } from "../layer-names";

import { cx, SectionLabel } from "../kit";
import { CloseIcon, PlusIcon, WarningIcon } from "../icons";
import { slotsOf, withProfile, withSlot, withoutSlot, type Slot } from "../../model/key-slots";
import { DEFAULT_TAP_HOLD_PROFILE } from "../../model/morse";
import { morseProfileSummary } from "../morse-profile";

import { ActionEditor } from "./ActionEditor";
import { LayerLighting } from "./LayerLighting";

import { PickKey } from "./PickKey";
import { SwitchLayer, type LayerKind } from "./SwitchLayer";

type Tab = "pick" | "layer" | "lighting" | "all";

const SLOT_NAME: Record<Slot, string> = { tap: "On Tap", hold: "On Hold" };

/* ------------------------------------------------------------------ */
/* The panel                                                           */
/* ------------------------------------------------------------------ */

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
          title={slot === "hold" ? "Remove the hold: a plain key again" : "Clear the tap"}
          className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-faint hover:bg-hover hover:text-ink"
        >
          <CloseIcon size={11} />
        </button>
      </div>
    </div>
  );
}

export function KeyEditor({ height = 310 }: { height?: number }) {
  const { bundle, state, dispatch, io } = useWorkbench();
  const capabilities = useCapabilities();
  const [tab, setTab] = useState<Tab>("pick");
  const [slot, setSlot] = useState<Slot>("tap");
  const selection = state.selection?.type === "key" ? state.selection : null;
  const selectionId = selection ? `${state.uiLayer}:${selection.row}:${selection.col}` : null;
  useEffect(() => setSlot("tap"), [selectionId]);

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
  const slots = slotsOf(action);
  const commit = (next: KeyAction) => io.setKey(layer, row, col, next);
  const fill = (value: Action | "Transparent") => {
    if (value === "Transparent") commit("Transparent");
    else commit(withSlot(action, slot, value));
  };
  const pickLayer = (kind: LayerKind, target: number) => {
    if (kind === "HoldTap") {
      commit(withSlot(action, "hold", { LayerOn: target } as Action));
      setSlot("tap");
      setTab("pick");
      return;
    }
    fill({ [kind]: target } as unknown as Action);
  };
  const glyph = keyActionGlyph(action);

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
          <>
            <SlotRow
              slot="tap"
              value={slots.tap}
              active={slot === "tap"}
              onSelect={() => setSlot("tap")}
              onClear={() => commit(withoutSlot(action, "tap"))}
            />
            {slots.hold !== null ? (
              <>
                <SlotRow
                  slot="hold"
                  value={slots.hold}
                  active={slot === "hold"}
                  onSelect={() => setSlot("hold")}
                  onClear={() => {
                    setSlot("tap");
                    commit(withoutSlot(action, "hold"));
                  }}
                />
                <label className="flex flex-col gap-1 text-small text-faint">
                  Hold timing
                  <select
                    value={slots.profile}
                    onChange={(event) => commit(withProfile(action, Number(event.target.value)))}
                    className="rounded-lg border border-line bg-raised px-2 py-1.5 text-body text-ink"
                  >
                    <option value={DEFAULT_TAP_HOLD_PROFILE}>The keyboard's default</option>
                    {state.morseProfiles.map((entry) => (
                      <option key={entry.index} value={entry.index}>
                        {entry.name} · {morseProfileSummary(entry.profile)}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setSlot("hold")}
                  className={cx(
                    "flex cursor-pointer items-center gap-1.5 rounded-full border border-dashed px-3 py-1 text-small font-semibold transition-colors",
                    slot === "hold" ? "border-accent text-accent" : "border-line-strong text-mute hover:text-ink",
                  )}
                >
                  <PlusIcon size={10} /> On Hold
                </button>
              </div>
            )}
            {slot === "hold" && slots.hold === null && (
              <p className="text-small text-accent">Pick what the key does when held →</p>
            )}
          </>
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
