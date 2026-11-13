// The left side panel, as in GLIDE: the keymap's contents as lists. Layers
// (pick one, and from its ⋮ menu or a right-click: rename, duplicate, move,
// make default, delete) and Combos (see them, open the combo editor). The
// panel never edits a key; it chooses what the canvas and the editor show.

import { useEffect, useState } from "react";
import { layerName } from "../layer-names";
import { comboLayer, comboOutput, comboTriggerCount } from "../../model/combos";
import { pointingDraftDirty, useWorkbench } from "../state";
import { useCapabilities } from "../use-capabilities";
import { askConfirm, showToast } from "../messages/store";
import { deletionBlockedMessage, layerDeletionBlockers } from "../keymap/layerImpact";
import { keyActionGlyph } from "../labels";
import { useTerms } from "../terms";
import { cx } from "../kit";
import { MoreIcon, StarIcon, PlusIcon } from "../icons";
import { RowMenu, useRowMenu, type MenuEntry } from "../RowMenu";

type List = "layers" | "combos";

function ListSwitch({ value, onChange }: { value: List; onChange: (list: List) => void }) {
  const term = useTerms();
  return (
    <div className="flex gap-1 rounded-lg border border-line bg-raised p-1 shadow-inner">
      {(
        [
          ["layers", "Layers"],
          ["combos", term("section.combos")],
        ] as const
      ).map(([id, label]) => (
        <button
          key={id}
          type="button"
          aria-pressed={value === id}
          onClick={() => onChange(id)}
          className={cx(
            "flex-1 cursor-pointer rounded-md py-1.5 text-small font-semibold uppercase tracking-widest transition-all duration-150",
            value === id ? "bg-accent-fill text-on-accent shadow-sm" : "text-mute hover:text-ink",
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function LayerList({ onPicked }: { onPicked?: () => void }) {
  const { bundle, state, dispatch, io } = useWorkbench();
  const capabilities = useCapabilities();
  const menu = useRowMenu<number>();
  const [renaming, setRenaming] = useState<number | null>(null);
  const [name, setName] = useState("");
  useEffect(() => setRenaming(null), [state.layerMetadata]);

  const numLayers = bundle.caps.num_layers;
  const layers = state.layerMetadata
    ? state.layerMetadata.flatMap((metadata, layer) => (metadata.occupied ? [layer] : []))
    : Array.from({ length: numLayers }, (_, layer) => layer);
  const canRename = state.layerMetadata !== null;
  const structureSupported =
    state.layerMetadata !== null &&
    capabilities.has("pointing") &&
    state.behaviorOptions !== null &&
    (!capabilities.has("lighting.state") || capabilities.has("lighting.output"));
  const block = !structureSupported
    ? "This keyboard cannot change its layers yet"
    : state.layerBusy
      ? "Wait for the layer change in progress"
      : pointingDraftDirty(state)
        ? "Apply or discard the staged pointing changes first"
        : null;

  const remove = (layer: number) => {
    const label = layerName(state.layerMetadata, layer);
    // Say what still uses the layer now, before reading the keyboard to find out.
    const blockers = layerDeletionBlockers(
      {
        layers: state.layers,
        cols: bundle.caps.num_cols,
        layerMetadata: state.layerMetadata,
        combos: state.combos,
        morse: state.morse,
        forks: state.forks,
      },
      layer,
    );
    if (blockers.length > 0) {
      dispatch({ type: "layerOperationError", message: deletionBlockedMessage(label, blockers) });
      return;
    }
    void askConfirm({
      title: `Delete layer “${label}”?`,
      body: "Its keys are removed and the layers after it move up one place; keys that switch to those layers follow them. This cannot be undone.",
      confirmLabel: "Delete layer",
      danger: true,
    }).then(async (yes) => {
      if (!yes) return;
      const result = await io.deleteLayer(layer);
      if (result.ok) showToast(`Layer “${label}” deleted`, { tone: "ok" });
    });
  };

  const items = (layer: number): MenuEntry[] => {
    const position = layers.indexOf(layer);
    return [
      { id: "rename", label: "Rename", disabled: !canRename, reason: "This keyboard does not store layer names" },
      {
        id: "default",
        label: layer === state.defaultLayer ? "The default layer" : "Make default",
        hint: "The layer the keyboard starts on",
        disabled: layer === state.defaultLayer,
        reason: "This is already the layer the keyboard starts on",
      },
      "-",
      {
        id: "duplicate",
        label: "Duplicate",
        disabled: block !== null || layers.length >= numLayers,
        reason: block ?? `All ${numLayers} layers are in use`,
      },
      {
        id: "up",
        label: "Move up",
        disabled: block !== null || position <= 0,
        reason: block ?? "This is already the first layer",
      },
      {
        id: "down",
        label: "Move down",
        disabled: block !== null || position >= layers.length - 1,
        reason: block ?? "This is already the last layer",
      },
      "-",
      {
        id: "delete",
        label: "Delete",
        danger: true,
        disabled: block !== null || layers.length <= 1,
        reason: block ?? "A keyboard needs at least one layer",
      },
    ];
  };

  const act = (layer: number, id: string) => {
    if (id === "rename") {
      setName(layerName(state.layerMetadata, layer));
      setRenaming(layer);
    } else if (id === "default") io.setDefaultLayer(layer);
    else if (id === "duplicate") void io.duplicateLayer(layer);
    else if (id === "up") void io.moveLayer(layer, layer - 1);
    else if (id === "down") void io.moveLayer(layer, layer + 1);
    else if (id === "delete") remove(layer);
  };

  return (
    <div className="flex flex-col gap-1.5">
      {layers.map((layer) => {
        const active = layer === state.uiLayer;
        const label = layerName(state.layerMetadata, layer);
        if (renaming === layer) {
          return (
            <form
              key={layer}
              onSubmit={(event) => {
                event.preventDefault();
                void io.renameLayer(layer, name).then((result) => {
                  if (result.ok) setRenaming(null);
                });
              }}
            >
              <input
                autoFocus
                value={name}
                maxLength={32}
                aria-label="Layer name"
                onChange={(event) => setName(event.target.value)}
                onBlur={() => setRenaming(null)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") setRenaming(null);
                }}
                className="w-full rounded-xl border border-accent bg-panel px-3 py-2 text-body font-semibold text-ink outline-none"
              />
            </form>
          );
        }
        return (
          <div
            key={layer}
            {...menu.rowProps(layer)}
            className={cx(
              "group relative flex items-center rounded-xl border transition-all duration-200",
              active
                ? "border-accent bg-raised shadow-sm"
                : menu.openFor === layer
                  ? "border-line-strong bg-panel"
                  : "border-transparent hover:border-line-strong hover:bg-panel",
            )}
          >
            <button
              type="button"
              aria-current={active ? "true" : undefined}
              onClick={() => {
                dispatch({ type: "uiLayer", layer });
                onPicked?.();
              }}
              onDoubleClick={() => canRename && act(layer, "rename")}
              className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 py-2.5 pl-3 pr-1 text-left"
            >
              <span className="w-4 shrink-0 text-right font-mono text-caption text-faint">{layer}</span>
              <span className={cx("min-w-0 flex-1 truncate text-body font-semibold", active ? "text-accent" : "text-ink")}>
                {label}
              </span>
              {layer === state.defaultLayer && (
                <span title="The layer the keyboard starts on" className="inline-flex shrink-0">
                  <StarIcon size={11} filled className="text-warn" />
                </span>
              )}
              {layer === state.currentLayer && layer !== state.uiLayer && (
                <span title="Active on the keyboard now" className="size-1.5 shrink-0 rounded-full bg-ok" />
              )}
            </button>
            <button
              type="button"
              aria-label={`Layer actions for ${label}`}
              title="Layer actions (or right-click the layer)"
              onClick={(event) => menu.openFrom(event, layer)}
              className={cx(
                "mr-1.5 flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-mute transition-[opacity,visibility] hover:bg-hover hover:text-ink",
                active || menu.openFor === layer
                  ? "opacity-100"
                  : "sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100",
              )}
            >
              <MoreIcon size={15} />
            </button>
          </div>
        );
      })}
      {menu.at && (
        <RowMenu
          x={menu.at.x}
          y={menu.at.y}
          label={`Layer ${layerName(state.layerMetadata, menu.at.id)}`}
          items={items(menu.at.id)}
          onAction={(id) => menu.at && act(menu.at.id, id)}
          onClose={menu.close}
        />
      )}
      {state.layerError && (
        <p role="alert" className="mt-1 px-1 text-small leading-relaxed text-danger">
          {state.layerError}
        </p>
      )}
    </div>
  );
}

function ComboList() {
  const { bundle, state, dispatch } = useWorkbench();
  const term = useTerms();
  const capacity = bundle.caps.max_combos;
  const combos = state.combos
    .map((combo, index) => ({ combo, index }))
    .filter(({ combo }) => comboTriggerCount(combo) > 0);
  const open = () => dispatch({ type: "mode", mode: "combos" });

  if (capacity === 0) {
    return <p className="px-1 text-small leading-relaxed text-faint">This keyboard has no combos.</p>;
  }
  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        onClick={open}
        className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-line-strong py-2.5 text-body font-semibold text-mute transition-all duration-150 hover:-translate-y-px hover:border-mute hover:bg-raised hover:text-ink"
      >
        <PlusIcon size={12} /> Create {term("section.combos").toLowerCase().replace(/s$/, "")}
      </button>
      {combos.length === 0 && (
        <p className="px-1 pt-2 text-small leading-relaxed text-faint">
          No combos yet. A combo does something when several keys are pressed together.
        </p>
      )}
      {combos.map(({ combo, index }) => {
        const layer = comboLayer(combo);
        return (
          <button
            key={index}
            type="button"
            onClick={open}
            className="flex w-full cursor-pointer items-center gap-2.5 rounded-xl border border-transparent px-3 py-2 text-left transition-all duration-150 hover:border-line-strong hover:bg-panel"
          >
            <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-raised font-mono text-caption text-mute">
              C{index}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-body font-semibold text-ink">
                {keyActionGlyph(comboOutput(combo)).text || "No action"}
              </span>
              <span className="block truncate text-small text-faint">
                {comboTriggerCount(combo)} keys
                {layer !== undefined ? ` · ${layerName(state.layerMetadata, layer)} only` : ""}
              </span>
            </span>
          </button>
        );
      })}
      <p className="px-1 pt-1 text-caption text-faint">
        {combos.length} of {capacity} used
      </p>
    </div>
  );
}

/** The panel; on a phone it is a drawer the top bar opens. */
export function SidePanel({ onPicked }: { onPicked?: () => void }) {
  const [list, setList] = useState<List>("layers");
  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-line bg-bg">
      <div className="shrink-0 border-b border-line bg-panel p-3">
        <ListSwitch value={list} onChange={setList} />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {list === "layers" ? <LayerList onPicked={onPicked} /> : <ComboList />}
      </div>
    </aside>
  );
}
