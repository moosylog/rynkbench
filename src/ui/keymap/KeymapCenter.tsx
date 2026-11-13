// The keyboard on the keymap screen: the layer heading, the canvas with its
// selection, drag-to-move, copy and paste, the key quick menu and the hover
// card. Keys are edited below it (KeyEditor.tsx); trackpads and encoders in
// SideInspector.tsx.

import { useEffect, useMemo, useRef, useState } from "react";

import type { KeyView } from "../../model/keyboard";
import { BoardWell, KeyboardCanvas } from "../KeyboardCanvas";
import type { KeyDecor } from "../KeyboardCanvas";
import { keyActionGlyph, keyActionDescription } from "../labels";
import { keyAddressLabel } from "../key-address";

import {
  encoderPendingId,
  keyPendingId,
  lightingBaseFor,
  lightingDraftFor,
  pointingDraftDirty,
  stagedBetween,
  useWorkbench,
} from "../state";

import { effectAnim, effectColor } from "../lighting/decor";
import { targetPreviewEffects } from "../lighting/preview";
import { layerName } from "../layer-names";
import { RowMenu, type MenuEntry } from "../RowMenu";
import { KeyHoverCard } from "./KeyHoverCard";
import { useKeyClipboard } from "./useKeyClipboard";
import {
  activePointingDevices,
  activePointingOverrides,
  pointingModeKind,
} from "../../model/pointing";

import { useCapabilities } from "../use-capabilities";

/** Which layer the canvas shows; picking and changing layers is the side panel's job. */
function LayerHeading() {
  const { state } = useWorkbench();
  const shown = layerName(state.layerMetadata, state.uiLayer);
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-1">
      <h2 className="text-title font-bold text-ink">{shown}</h2>
      {state.uiLayer === state.defaultLayer && <span className="text-small text-faint">Default layer</span>}
      {state.uiLayer !== state.currentLayer && (
        <span className="whitespace-nowrap text-small text-faint">
          {layerName(state.layerMetadata, state.currentLayer)} is active on the keyboard
        </span>
      )}
    </div>
  );
}

export function KeymapCenter() {
  const { bundle, state, dispatch, io } = useWorkbench();
  const capabilities = useCapabilities();
  const cols = bundle.caps.num_cols;
  const layer = state.layers[state.uiLayer];
  const layerLightingAvailable = capabilities.has("lighting.scenes") || capabilities.has("lighting.compiled");
  const [showLighting, setShowLighting] = useState(true);
  const [drag, setDrag] = useState<{
    source: KeyView;
    destination: KeyView | null;
  } | null>(null);
  const [keyboardMove, setKeyboardMove] = useState<{
    layer: number;
    source: KeyView;
    destination: KeyView | null;
  } | null>(null);
  const [manipulationMessage, setManipulationMessage] = useState<string | null>(
    null,
  );
  const dragLayerRef = useRef<number | null>(null);
  const [keyMenu, setKeyMenu] = useState<{ x: number; y: number; key: KeyView } | null>(null);
  const [hovered, setHovered] = useState<KeyView | null>(null);
  const latestStateRef = useRef(state);
  useEffect(() => {
    latestStateRef.current = state;
  });
  const pointingDevices = state.pointingDraft
    ? activePointingDevices(state.pointingDraft)
    : [];
  const pointingOverrides = state.pointingDraft
    ? activePointingOverrides(state.pointingDraft)
    : [];
  const pointingModeFor = (deviceId: number) =>
    pointingOverrides.find(
      (entry) => entry.layer === state.uiLayer && entry.device_id === deviceId,
    )?.mode ?? pointingDevices.find((entry) => entry.device_id === deviceId)?.mode;

  useEffect(() => {
    if (
      dragLayerRef.current !== null &&
      dragLayerRef.current !== state.uiLayer
    ) {
      setManipulationMessage(
        "Move cancelled because the selected layer changed.",
      );
    }
    dragLayerRef.current = null;
    setDrag(null);
    setKeyboardMove(null);
  }, [state.uiLayer]);

  const runClipboard = useKeyClipboard(latestStateRef, setManipulationMessage);

  const dropKey = (
    source: KeyView,
    destination: KeyView,
    selectedLayer: number,
  ) => {
    if (selectedLayer !== state.uiLayer) {
      setManipulationMessage(
        "Move cancelled because the selected layer changed.",
      );
      return;
    }
    const sourceAction =
      state.layers[selectedLayer]?.[source.row * cols + source.col];
    if (sourceAction === undefined || sourceAction === "No") {
      setManipulationMessage("That key has no binding to move.");
      return;
    }
    if (
      state.pending[keyPendingId(selectedLayer, source.row, source.col)]
        ?.status === "pending" ||
      state.pending[
        keyPendingId(selectedLayer, destination.row, destination.col)
      ]?.status === "pending"
    ) {
      setManipulationMessage(
        "Wait for both keys' current writes to finish before moving.",
      );
      return;
    }

    dispatch({
      type: "select",
      selection: { type: "key", row: destination.row, col: destination.col },
    });
    void io.moveKey(selectedLayer, source, destination).then((result) => {
      setManipulationMessage(
        result.ok
          ? `Moved ${keyActionDescription(sourceAction)} to Layer ${selectedLayer}, r${destination.row} c${destination.col}.`
          : `Move incomplete: ${result.message}`,
      );
    });
  };

  const keyboardActivateKey = (key: KeyView, event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      if (keyboardMove) {
        setKeyboardMove(null);
        setManipulationMessage("Keyboard move cancelled.");
      }
      return;
    }
    if (event.key === "Enter") {
      dispatch({
        type: "select",
        selection: { type: "key", row: key.row, col: key.col },
      });
      return;
    }

    if (!keyboardMove) {
      const action = layer?.[key.row * cols + key.col];
      const pending =
        state.pending[keyPendingId(state.uiLayer, key.row, key.col)];
      if (action === undefined || action === "No") {
        setManipulationMessage("That key has no binding to move.");
        return;
      }
      if (pending?.status === "pending") {
        setManipulationMessage(
          "Wait for that key's current write to finish before moving.",
        );
        return;
      }
      dispatch({
        type: "select",
        selection: { type: "key", row: key.row, col: key.col },
      });
      setKeyboardMove({ layer: state.uiLayer, source: key, destination: null });
      setManipulationMessage(
        `Picked up ${keyActionDescription(action)}. Tab to a destination and press Space to move it, or Escape to cancel.`,
      );
      return;
    }

    if (
      keyboardMove.source.row === key.row &&
      keyboardMove.source.col === key.col
    ) {
      setKeyboardMove(null);
      setManipulationMessage("Keyboard move cancelled.");
      return;
    }
    const { layer: moveLayer, source } = keyboardMove;
    setKeyboardMove(null);
    dropKey(source, key, moveLayer);
  };

  // The layer's staged scene, previewed under the legends so bindings and
  // lighting can be judged together. Lighting mode remains the place to paint.
  const lit = layerLightingAvailable && showLighting;
  // The compiled firmware cells are part of what the layer shows, so the
  // canvas previews the same composition Lighting mode does.
  const sceneEffects = useMemo(
    () =>
      lit
        ? targetPreviewEffects(
            state.uiLayer,
            lightingDraftFor(state, state.uiLayer),
            state.compiledScenes,
          )
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lit, state.compiledScenes, state.layerDrafts, state.scenes, state.uiLayer],
  );
  const sceneStaged = useMemo(
    () =>
      lit ? stagedBetween(lightingDraftFor(state, state.uiLayer), lightingBaseFor(state, state.uiLayer)) : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lit, state.layerDrafts, state.scenes, state.uiLayer],
  );

  const decorFor = (key: KeyView): KeyDecor => {
    const action = layer?.[key.row * cols + key.col];
    const pending =
      state.pending[keyPendingId(state.uiLayer, key.row, key.col)];
    const stagedBinding =
      state.stagedKeys[keyPendingId(state.uiLayer, key.row, key.col)] !== undefined;
    const sceneEffect =
      sceneEffects && key.ledId !== undefined ? sceneEffects.get(key.ledId) : undefined;
    const glyph = action !== undefined ? keyActionGlyph(action) : { text: "" };
    // Enrichment label as fallback for unbound keys.
    if (!glyph.text && key.label) {
      glyph.text = key.label;
      glyph.dim = true;
    }
    const selected =
      state.selection?.type === "key" &&
      state.selection.row === key.row &&
      state.selection.col === key.col;
    const moveDestination = drag?.destination ?? keyboardMove?.destination;
    const dropTarget =
      moveDestination?.row === key.row && moveDestination.col === key.col;
    const keyboardMoveHint = keyboardMove
      ? keyboardMove.source.row === key.row &&
        keyboardMove.source.col === key.col
        ? " Move source; press Space to cancel."
        : " Press Space to move here and replace this binding."
      : action === undefined || action === "No"
        ? " No binding to move."
        : " Press Space to pick up this binding for a keyboard move.";
    return {
      glyph,
      ariaLabel: `Layer ${state.uiLayer}, row ${key.row}, column ${key.col}: ${
        action === undefined ? "unavailable" : keyActionDescription(action)
      }.${keyboardMoveHint}`,
      ariaKeyShortcuts: selected
        ? "Enter Space Escape Control+C Meta+C Control+V Meta+V"
        : "Enter Space Escape",
      selected,
      highlight: dropTarget,
      pending: pending?.status === "pending",
      error: pending?.status === "error",
      fill: sceneEffect ? effectColor(sceneEffect) : undefined,
      fillAnim: sceneEffect ? effectAnim(sceneEffect) : undefined,
      staged:
        stagedBinding ||
        (key.ledId !== undefined && (sceneStaged?.has(key.ledId) ?? false)),
    };
  };

  // The key's quick menu, as in GLIDE: what it is, then copy, paste and clear.
  const keyMenuItems = (key: KeyView): MenuEntry[] => {
    const bound = layer?.[key.row * cols + key.col] ?? "No";
    return [
      { heading: `${keyAddressLabel(key)} · ${keyActionDescription(bound)}` },
      { id: "copy", label: "Copy key", hint: "Ctrl/⌘ C" },
      { id: "paste", label: "Paste", hint: "Ctrl/⌘ V" },
      "-",
      {
        id: "transparent",
        label: "Same as layer below",
        disabled: bound === "Transparent",
        reason: "It already is",
      },
      { id: "clear", label: "Clear key", danger: true, disabled: bound === "No", reason: "It does nothing already" },
    ];
  };

  return (
    <div className="relative flex min-h-0 flex-1 flex-col gap-3 max-lg:min-h-[380px]">
      <LayerHeading />
      <div className="flex min-h-5 items-center justify-between gap-4 px-1 text-small text-faint">
        <span className="flex items-center gap-3">
          {layerLightingAvailable && (
            <label className="flex shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap">
              <input
                type="checkbox"
                checked={showLighting}
                onChange={(event) => setShowLighting(event.target.checked)}
                className="accent-(--color-accent)"
              />
              Show layer lighting
            </label>
          )}
          <span>Click a key to edit · Right-click for options · Drag to move · Ctrl/⌘ C and V to copy and paste</span>
        </span>
        <span
          className="max-w-[46%] truncate text-right text-mute"
          aria-live="polite"
        >
          {drag?.destination
            ? `Release to move ${keyActionDescription(
                layer?.[drag.source.row * cols + drag.source.col] ?? "No",
              )} to r${drag.destination.row} c${drag.destination.col} and replace ${keyActionDescription(
                layer?.[drag.destination.row * cols + drag.destination.col] ??
                  "No",
              )}.`
            : keyboardMove?.destination
              ? `Press Space to move to r${keyboardMove.destination.row} c${keyboardMove.destination.col} and replace ${keyActionDescription(
                  layer?.[
                    keyboardMove.destination.row * cols +
                      keyboardMove.destination.col
                  ] ?? "No",
                )}.`
              : manipulationMessage}
        </span>
      </div>
      <BoardWell model={bundle.model}>
        <KeyboardCanvas
          model={bundle.model}
          className="h-full w-full"
          decorFor={decorFor}
          encoderDecorFor={(enc) => ({
            selected:
              state.selection?.type === "encoder" &&
              state.selection.id === enc.id,
            staged:
              state.stagedEncoders[encoderPendingId(state.uiLayer, enc.id)] !==
              undefined,
            pending:
              state.pending[encoderPendingId(state.uiLayer, enc.id)]?.status ===
              "pending",
            error:
              state.pending[encoderPendingId(state.uiLayer, enc.id)]?.status ===
              "error",
          })}
          pointingDeviceDecorFor={(device) => {
            const mode = pointingModeFor(device.id);
            return {
              selected:
                state.selection?.type === "pointing" &&
                state.selection.id === device.id,
              staged: pointingDraftDirty(state),
              mode: mode ? pointingModeKind(mode) : "Unavailable",
            };
          }}
          onKeyContextMenu={(key, event) => {
            dispatch({ type: "select", selection: { type: "key", row: key.row, col: key.col } });
            // From the keyboard (the menu key, Shift+F10) there is no pointer: open by the key.
            const fromKeyboard = event.clientX === 0 && event.clientY === 0;
            const box = (event.currentTarget as Element).getBoundingClientRect();
            setKeyMenu(
              fromKeyboard ? { x: box.left, y: box.bottom + 4, key } : { x: event.clientX, y: event.clientY, key },
            );
          }}
          onKeyHover={setHovered}
          onKeyPointerDown={(key, event) => {
            const action = layer?.[key.row * cols + key.col];
            if (
              event.button === 0 &&
              action !== undefined &&
              action !== "No" &&
              state.pending[keyPendingId(state.uiLayer, key.row, key.col)]
                ?.status !== "pending"
            ) {
              dragLayerRef.current = state.uiLayer;
            }
            setKeyboardMove(null);
            dispatch({
              type: "select",
              selection: { type: "key", row: key.row, col: key.col },
            });
          }}
          onKeyKeyboardActivate={keyboardActivateKey}
          onKeyFocus={(key) => {
            if (!keyboardMove) return;
            const destination =
              keyboardMove.source.row === key.row &&
              keyboardMove.source.col === key.col
                ? null
                : key;
            setKeyboardMove({ ...keyboardMove, destination });
          }}
          onKeyDragChange={(source, destination) => {
            setDrag(source ? { source, destination } : null);
            if (!source) dragLayerRef.current = null;
          }}
          keyDraggable={(key) => {
            const action = layer?.[key.row * cols + key.col];
            return (
              action !== undefined &&
              action !== "No" &&
              state.pending[keyPendingId(state.uiLayer, key.row, key.col)]
                ?.status !== "pending"
            );
          }}
          onKeyDrop={(source, destination) => {
            const dragLayer = dragLayerRef.current;
            if (dragLayer === null) {
              setManipulationMessage(
                "Move cancelled because its source layer is unavailable.",
              );
              return;
            }
            dropKey(source, destination, dragLayer);
          }}
          onEncoderPointerDown={(enc) =>
            dispatch({
              type: "select",
              selection: { type: "encoder", id: enc.id },
            })
          }
          onPointingDeviceActivate={(device) =>
            dispatch({
              type: "select",
              selection: { type: "pointing", id: device.id },
            })
          }
          onBackgroundPointerDown={() => {
            setKeyboardMove(null);
            dispatch({ type: "select", selection: null });
          }}
        />
      </BoardWell>
      {hovered && !drag && <KeyHoverCard keyView={hovered} />}
      {keyMenu && (
        <RowMenu
          x={keyMenu.x}
          y={keyMenu.y}
          label={`Key ${keyAddressLabel(keyMenu.key)}`}
          items={keyMenuItems(keyMenu.key)}
          onClose={() => setKeyMenu(null)}
          onAction={(id) => {
            const target = keyMenu.key;
            const selection = { type: "key" as const, row: target.row, col: target.col };
            if (id === "copy" || id === "paste") runClipboard(id, selection);
            else if (id === "transparent") void io.setKey(state.uiLayer, target.row, target.col, "Transparent");
            else if (id === "clear") void io.setKey(state.uiLayer, target.row, target.col, "No");
          }}
        />
      )}
    </div>
  );
}

