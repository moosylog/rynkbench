// The key editor, below the keyboard, as in GLIDE. Left: which key it is and
// its actions as slots (On Tap, and On Hold, which makes it a tap-hold). Right:
// the tabs that fill the active slot — Pick Key (search, quick links, every key
// in groups, modifiers), Switch Layer, Lighting, and Every action (the full
// editor, for macros, morse patterns and the rest).

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { Action, KeyAction, ModifierCombination } from "../../vendor/rynk-wasm/rynk_wasm";
import { keyActionGlyph, keyActionDescription, actionDescription, modifierSymbols, anyModifier } from "../labels";
import { keyAddressLabel, matrixKeyLabel } from "../key-address";
import { keyPendingId, useWorkbench } from "../state";
import { useCapabilities } from "../use-capabilities";
import { layerName } from "../layer-names";
import { LOCALES, activeLocale, getLocaleId, subscribeLocale } from "../locale";
import { cx, SectionLabel } from "../kit";
import { CloseIcon, PlusIcon, WarningIcon } from "../icons";
import { slotsOf, withProfile, withSlot, withoutSlot, type Slot } from "../../model/key-slots";
import { DEFAULT_TAP_HOLD_PROFILE } from "../../model/morse";
import { morseProfileSummary } from "../morse-profile";
import { noModifiers } from "../../model/slots";
import { ActionEditor } from "./ActionEditor";
import { LayerLighting } from "./LayerLighting";
import { mergeModifiers } from "./actions";
import { layerTiles, pickKeyGroups, searchTiles, type Tile, type TileGroup } from "./pickKey";

type Tab = "pick" | "layer" | "lighting" | "all";

const SLOT_NAME: Record<Slot, string> = { tap: "On Tap", hold: "On Hold" };

/* ------------------------------------------------------------------ */
/* Pick Key                                                            */
/* ------------------------------------------------------------------ */

const MODIFIER_CHIPS: Array<{ id: "ctrl" | "alt" | "shift" | "gui"; symbol: string; name: string }> = [
  { id: "gui", symbol: "⌘", name: "Command / Windows" },
  { id: "alt", symbol: "⌥", name: "Alt / Option" },
  { id: "shift", symbol: "⇧", name: "Shift" },
  { id: "ctrl", symbol: "⌃", name: "Ctrl" },
];

function armedModifiers(side: "left" | "right", armed: Set<string>): ModifierCombination {
  const mods = noModifiers();
  for (const id of armed) (mods as unknown as Record<string, boolean>)[`${side}_${id}`] = true;
  return mods;
}

/** A tile's action with the armed modifiers added; they go with keys only. */
function withArmed(action: Action, mods: ModifierCombination): Action {
  if (!anyModifier(mods) || typeof action !== "object") return action;
  if ("Key" in action && typeof action.Key === "object" && "Hid" in action.Key) {
    return { KeyWithModifier: [action.Key.Hid, mods] } as Action;
  }
  if ("KeyWithModifier" in action) {
    const [code, own] = action.KeyWithModifier;
    return { KeyWithModifier: [code, mergeModifiers(mods, own)] } as Action;
  }
  return action;
}

function TileButton({ tile, onPick }: { tile: Tile; onPick: (tile: Tile) => void }) {
  return (
    <button
      type="button"
      onClick={() => onPick(tile)}
      title={tile.lilac ? `${tile.label} (needs Shift or AltGr)` : tile.label}
      className={cx(
        "flex h-9 min-w-9 cursor-pointer items-center justify-center rounded-lg border px-2.5 text-body font-semibold transition-all duration-150 hover:-translate-y-px hover:border-line-strong hover:bg-hover hover:shadow-md",
        tile.lilac ? "border-accent-deep/40 bg-accent-dim/30 text-ink" : "border-line bg-raised text-ink",
      )}
    >
      {tile.label}
    </button>
  );
}

function GroupTiles({ group, onPick }: { group: TileGroup; onPick: (tile: Tile) => void }) {
  // Tiles under their small captions, in the order the captions first appear.
  const clusters: Array<[string | undefined, Tile[]]> = [];
  for (const tile of group.tiles) {
    const last = clusters.at(-1);
    if (last && last[0] === tile.cluster) last[1].push(tile);
    else clusters.push([tile.cluster, [tile]]);
  }
  return (
    <div className="flex flex-col gap-2">
      {clusters.map(([cluster, tiles], index) => (
        <div key={index} className="flex flex-col gap-1.5">
          {cluster && <span className="text-caption text-faint">{cluster}</span>}
          <div className="flex flex-wrap gap-1.5">
            {tiles.map((tile) => (
              <TileButton key={tile.id} tile={tile} onPick={onPick} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function PickKey({ onPick, disabled }: { onPick: (action: Action | "Transparent") => void; disabled: boolean }) {
  const { bundle, state } = useWorkbench();
  const localeId = useSyncExternalStore(subscribeLocale, getLocaleId, getLocaleId);
  const groups = useMemo(
    () =>
      pickKeyGroups(LOCALES.find((locale) => locale.id === localeId) ?? activeLocale(), {
        userActions: bundle.boardProfile?.userActions,
      }),
    [localeId, bundle.boardProfile],
  );
  const [query, setQuery] = useState("");
  const [side, setSide] = useState<"left" | "right">("left");
  const [armed, setArmed] = useState<Set<string>>(new Set());
  const [showMore, setShowMore] = useState(false);
  const [lit, setLit] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);

  const layers = (state.layerMetadata ?? [])
    .map((metadata, index) => ({ index, occupied: metadata.occupied, name: layerName(state.layerMetadata, index) }))
    .filter((layer) => layer.occupied);
  const found = query.trim()
    ? [layerTiles(layers, query), ...searchTiles(groups, query)].filter((g): g is TileGroup => g !== null)
    : [...groups.main, ...(showMore ? groups.more.map((g) => ({ ...g, name: `All keys · ${g.name}` })) : [])];
  const first = found[0]?.tiles[0];
  const mods = armedModifiers(side, armed);

  const pick = (tile: Tile) => {
    onPick(tile.action === "Transparent" ? "Transparent" : withArmed(tile.action, mods));
    setArmed(new Set());
  };
  const jump = (id: string) => {
    const target = scroller.current?.querySelector<HTMLElement>(`[data-group="${id}"]`);
    if (!target || !scroller.current) return;
    scroller.current.scrollTo({ top: target.offsetTop - 4, behavior: "smooth" });
    setLit(id);
    window.setTimeout(() => setLit(null), 900);
  };

  return (
    <div className={cx("flex min-h-0 flex-1 flex-col gap-2.5", disabled && "pointer-events-none opacity-40")}>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-line bg-raised p-0.5" title="Which side's modifiers">
          {(["left", "right"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setSide(value)}
              className={cx(
                "cursor-pointer rounded-md px-2 py-1 text-small font-semibold uppercase",
                side === value ? "bg-hover text-ink" : "text-faint hover:text-mute",
              )}
            >
              {value === "left" ? "L" : "R"}
            </button>
          ))}
        </div>
        {MODIFIER_CHIPS.map((chip) => {
          const on = armed.has(chip.id);
          return (
            <button
              key={chip.id}
              type="button"
              aria-pressed={on}
              title={`${chip.name}: click it, then a key`}
              onClick={() => {
                const next = new Set(armed);
                if (on) next.delete(chip.id);
                else next.add(chip.id);
                setArmed(next);
              }}
              className={cx(
                "flex size-8 cursor-pointer items-center justify-center rounded-lg border text-ui transition-colors",
                on ? "border-accent bg-accent-dim/40 text-accent" : "border-line bg-raised text-mute hover:text-ink",
              )}
            >
              {chip.symbol}
            </button>
          );
        })}
        <div className="relative min-w-48 flex-1">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && first) {
                event.preventDefault();
                pick(first);
              }
            }}
            placeholder="Search keys, symbols, layers…"
            aria-label="Search keys"
            className="w-full rounded-lg border border-line bg-raised px-3 py-1.5 text-body text-ink placeholder:text-faint focus:border-accent focus:outline-none"
          />
          {query.trim() && first && (
            <span className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-caption text-faint">
              ↵ {first.label}
            </span>
          )}
        </div>
      </div>
      <p className="text-small text-faint">
        {armed.size > 0
          ? `Now click a key: ${modifierSymbols(mods)} goes with it (not with layers or actions).`
          : "For combinations like Shift+A: click a modifier first, then the key."}
      </p>
      {!query.trim() && (
        <div className="flex gap-1.5 overflow-x-auto pb-0.5">
          {groups.main
            .filter((group) => group.chip)
            .map((group) => (
              <button
                key={group.id}
                type="button"
                onClick={() => jump(group.id)}
                className="shrink-0 cursor-pointer rounded-full border border-line px-2.5 py-0.5 text-small font-semibold text-mute transition-colors hover:border-line-strong hover:text-ink"
              >
                {group.chip}
              </button>
            ))}
        </div>
      )}
      <div ref={scroller} className="relative min-h-0 flex-1 overflow-y-auto pr-1">
        {found.length === 0 && (
          <p className="py-6 text-center text-body text-faint">Nothing matches “{query}”.</p>
        )}
        <div className="flex flex-col gap-4">
          {found.map((group) => (
            <section key={group.id + group.name} data-group={group.id} className="flex flex-col gap-2">
              <h3
                className={cx(
                  "text-caption font-semibold uppercase tracking-widest transition-colors duration-300",
                  lit === group.id ? "text-accent" : "text-faint",
                )}
              >
                {group.name}
              </h3>
              <GroupTiles group={group} onPick={pick} />
            </section>
          ))}
          {!query.trim() && !showMore && (
            <button
              type="button"
              onClick={() => setShowMore(true)}
              className="self-start cursor-pointer rounded-lg border border-dashed border-line-strong px-3 py-1.5 text-body font-semibold text-mute hover:text-ink"
            >
              All keys…
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Switch Layer                                                        */
/* ------------------------------------------------------------------ */

type LayerKind = "LayerOn" | "HoldTap" | "OneShotLayer" | "LayerToggle" | "LayerToggleOnly" | "DefaultLayer";

const LAYER_KINDS: Array<{ id: LayerKind; label: string; hint: string }> = [
  { id: "LayerOn", label: "While held", hint: "The layer is on while the key is held" },
  { id: "HoldTap", label: "Hold layer, tap key", hint: "Held: the layer. Tapped: a key you pick next" },
  { id: "OneShotLayer", label: "Next key only", hint: "The layer is on for the next key press" },
  { id: "LayerToggle", label: "Toggle", hint: "Each press turns the layer on or off" },
  { id: "LayerToggleOnly", label: "Switch to", hint: "Turns the layer on and every other off" },
  { id: "DefaultLayer", label: "Make default", hint: "The keyboard starts on this layer from now on" },
];

function SwitchLayer({ onPick, disabled }: { onPick: (kind: LayerKind, layer: number) => void; disabled: boolean }) {
  const { state } = useWorkbench();
  const [kind, setKind] = useState<LayerKind>("LayerOn");
  const layers = (state.layerMetadata ?? [])
    .map((metadata, index) => ({ index, occupied: metadata.occupied }))
    .filter((layer) => layer.occupied);
  return (
    <div className={cx("flex flex-col gap-3", disabled && "pointer-events-none opacity-40")}>
      <div className="flex flex-wrap gap-1.5">
        {LAYER_KINDS.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => setKind(option.id)}
            className={cx(
              "cursor-pointer rounded-full border px-3 py-1 text-small font-semibold transition-colors",
              kind === option.id ? "border-accent bg-accent-dim/40 text-accent" : "border-line text-mute hover:text-ink",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
      <p className="text-small text-faint">{LAYER_KINDS.find((option) => option.id === kind)?.hint}</p>
      <div className="flex flex-wrap gap-1.5">
        {layers.map((layer) => (
          <button
            key={layer.index}
            type="button"
            onClick={() => onPick(kind, layer.index)}
            className="flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-line bg-raised px-3 text-body font-semibold text-ink transition-all hover:-translate-y-px hover:border-line-strong hover:bg-hover"
          >
            <span className="font-mono text-caption text-faint">{layer.index}</span>
            {layerName(state.layerMetadata, layer.index)}
          </button>
        ))}
      </div>
    </div>
  );
}

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

export function KeyEditor() {
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
      <section className="flex min-h-[132px] shrink-0 items-center justify-center rounded-2xl border border-line bg-panel px-6 py-8 text-center">
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
    <section className="flex h-[310px] min-h-0 shrink-0 overflow-hidden rounded-2xl border border-line bg-panel max-lg:h-auto max-lg:flex-col">
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
