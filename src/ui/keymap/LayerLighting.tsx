// The key editor's Lighting tab, as GLIDE's Key Lighting: one choice for the
// key on the layer shown (Off, Custom color, Layer below), the chosen one's
// fields under it, and Paint, which makes the choice a brush for the canvas.
// While the tab is open the canvas shows the board under its lights. Changes
// are staged on the layer's scene and written with Apply. Brushes, zones and
// rules stay in the Lighting screen.

import { useEffect, useMemo, useState } from "react";
import type { LightingRgb8 } from "../../model/lighting-types";
import { lightingBaseFor, lightingDraftFor, stagedBetween, useWorkbench } from "../state";
import { effectColor } from "../lighting/decor";
import { DEFAULT_TIMING, type EffectKind } from "../lighting/effect";
import { colorsInUse, keyLightOf, lightWrite, recolorCells, sameLight, type KeyLight } from "../lighting/keyLight";
import { sceneTableWithLayer, targetPreviewEffects } from "../lighting/preview";
import { cssRgb, hexToRgb, LED_PRESETS, rgbToHex } from "../color";
import { layerName } from "../layer-names";
import { ApplyBar, cx, ErrorBanner } from "../kit";
import { BrushIcon } from "../icons";
import { useCapability } from "../use-capabilities";
import { lightView, useLightView } from "./lightView";

const CHOICES: Array<{ kind: KeyLight["kind"]; title: string; text: string }> = [
  { kind: "off", title: "Off", text: "The LED stays dark." },
  { kind: "color", title: "Custom color", text: "One color you pick." },
  { kind: "below", title: "Layer below", text: "Shows what the layer below lights." },
];

const EFFECTS: Array<{ kind: EffectKind; label: string }> = [
  { kind: "Solid", label: "Steady" },
  { kind: "Blink", label: "Blink" },
  { kind: "Breathe", label: "Breathe" },
];

const SPEEDS = [
  { periodMs: 500, label: "Fast" },
  { periodMs: 1000, label: "Normal" },
  { periodMs: 2000, label: "Slow" },
];

const sameColor = (a: LightingRgb8, b: LightingRgb8) => rgbToHex(a) === rgbToHex(b);

function Swatch({ color, chosen, title, onPick, onDoubleClick }: {
  color: LightingRgb8;
  chosen: boolean;
  title: string;
  onPick: () => void;
  onDoubleClick?: () => void;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={chosen}
      onClick={onPick}
      onDoubleClick={onDoubleClick}
      style={{ background: cssRgb(color) }}
      className={cx(
        "size-6 shrink-0 cursor-pointer rounded-full border border-cap-edge transition-transform hover:scale-110",
        chosen && "ring-2 ring-ink ring-offset-2 ring-offset-panel",
      )}
    />
  );
}

/** A key's light when the firmware only lets it be read. */
function ReadOnlyLight({ effect }: { effect: Parameters<typeof effectColor>[0] }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2 text-body text-mute">
        <span className="size-3 rounded-sm border border-cap-edge" style={{ background: effectColor(effect) }} />
        Lit on this layer · firmware default
      </div>
      <p className="text-small text-faint">This firmware exposes layer lighting for viewing only.</p>
    </div>
  );
}

export function LayerLighting({ ledId }: { ledId: number | undefined }) {
  const { bundle, state, dispatch, io } = useWorkbench();
  const scenes = useCapability("lighting.scenes");
  const view = useLightView();
  const layer = state.uiLayer;

  useEffect(() => {
    lightView.setOpen(true);
    return () => lightView.setOpen(false);
  }, []);

  const draft = lightingDraftFor(state, layer);
  const base = lightingBaseFor(state, layer);
  const staged = useMemo(() => stagedBetween(draft, base), [draft, base]);
  const preview = useMemo(() => targetPreviewEffects(layer, draft, state.compiledScenes), [layer, draft, state.compiledScenes]);
  const effect = ledId === undefined ? undefined : preview.get(ledId);
  const current = keyLightOf(effect);

  // Your colours: those lit anywhere in the layout, most used first.
  const layers = Array.from({ length: bundle.caps.num_layers }, (_, index) => index);
  const yours = colorsInUse(layers.flatMap((index) => Object.values(lightingDraftFor(state, index)).map((cell) => cell.effect)));

  // The custom colour's fields, seeded from the key, kept while trying choices.
  const [custom, setCustom] = useState<Extract<KeyLight, { kind: "color" }>>({
    kind: "color",
    color: LED_PRESETS[0],
    effect: "Solid",
    timing: DEFAULT_TIMING,
  });
  const [hex, setHex] = useState("");
  const [recolor, setRecolor] = useState<LightingRgb8 | null>(null);
  useEffect(() => {
    if (current.kind === "color") setCustom(current);
    // Re-seed only when the key or layer changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ledId, layer]);

  if (scenes === undefined) {
    return effect ? <ReadOnlyLight effect={effect} /> : null;
  }

  const shown: KeyLight = view.brush ?? current;
  const choose = (light: KeyLight) => {
    if (light.kind === "color") setCustom(light);
    if (view.brush) return lightView.setBrush(light);
    if (ledId === undefined || sameLight(light, current)) return;
    const write = lightWrite(light, [ledId]);
    if ("paint" in write) dispatch({ type: "paint", cells: write.paint, target: layer });
    else dispatch({ type: "erase", ledIds: write.erase, target: layer });
  };
  const pickColor = (color: LightingRgb8) => {
    if (recolor) {
      // Change one colour on every layer, keeping each key's effect.
      for (const index of layers) {
        const cells = recolorCells(Object.values(lightingDraftFor(state, index)), recolor, color);
        if (cells.length) dispatch({ type: "paint", cells, target: index });
      }
      setRecolor(null);
      return;
    }
    choose({ ...custom, color });
  };
  const name = layerName(state.layerMetadata, layer);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-small font-semibold tracking-widest text-mute uppercase">Key lighting · {name}</h3>
        <button
          type="button"
          aria-pressed={view.brush !== null}
          onClick={() => lightView.setBrush(view.brush ? null : shown)}
          className={cx(
            "flex h-8 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-body font-semibold transition-colors",
            view.brush ? "border-accent bg-accent-fill text-on-accent" : "border-line-strong text-ink hover:border-mute",
          )}
        >
          <BrushIcon size={13} /> Paint
        </button>
      </div>
      {view.brush && <p className="text-small text-accent">Click or drag over keys to give them this lighting.</p>}
      {ledId === undefined && !view.brush && (
        <p className="text-small text-mute">This key has no LED. Turn on Paint to light other keys.</p>
      )}

      {CHOICES.map((choice) => {
        const chosen = shown.kind === choice.kind;
        const off = ledId === undefined && !view.brush;
        return (
          <div
            key={choice.kind}
            className={cx(
              "rounded-xl border transition-colors",
              chosen ? "border-accent bg-accent-dim" : "border-line-strong hover:border-mute",
              off && "opacity-50",
            )}
          >
            <button
              type="button"
              role="radio"
              aria-checked={chosen}
              disabled={off}
              onClick={() => choose(choice.kind === "color" ? custom : { kind: choice.kind })}
              className="flex w-full cursor-pointer items-start gap-3 px-4 py-2.5 text-left disabled:cursor-not-allowed"
            >
              <span
                className={cx(
                  "mt-0.5 flex size-3.5 shrink-0 items-center justify-center rounded-full border",
                  chosen ? "border-accent" : "border-mute",
                )}
              >
                {chosen && <span className="size-2 rounded-full bg-accent" />}
              </span>
              <span>
                <span className="block text-ui font-semibold text-ink">{choice.title}</span>
                <span className="block text-small text-mute">{choice.text}</span>
              </span>
            </button>

            {choice.kind === "color" && chosen && shown.kind === "color" && (
              <div className="flex flex-col gap-3 px-4 pt-1 pb-4 pl-11">
                <div className="flex items-start gap-4">
                  <span className="w-12 shrink-0 pt-1 text-body text-mute">Color</span>
                  <div className="flex flex-col gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      {LED_PRESETS.map((color) => (
                        <Swatch
                          key={rgbToHex(color)}
                          color={color}
                          title={rgbToHex(color)}
                          chosen={!recolor && sameColor(color, shown.color)}
                          onPick={() => pickColor(color)}
                        />
                      ))}
                      {yours.length > 0 && <span className="mx-1 h-5 w-px bg-line-strong" aria-hidden />}
                      {yours.map((color) => (
                        <Swatch
                          key={`yours-${rgbToHex(color)}`}
                          color={color}
                          title={`${rgbToHex(color)} · your color; double-click to change it on every key`}
                          chosen={recolor ? sameColor(color, recolor) : sameColor(color, shown.color)}
                          onPick={() => pickColor(color)}
                          onDoubleClick={() => setRecolor(color)}
                        />
                      ))}
                    </div>
                    <label className="flex h-8 w-36 items-center gap-2 rounded-full border border-line-strong bg-hover pr-3 pl-1.5">
                      <span className="size-5 shrink-0 rounded-full border border-cap-edge" style={{ background: cssRgb(shown.color) }} />
                      <input
                        value={hex || rgbToHex(shown.color).toUpperCase()}
                        onChange={(event) => setHex(event.target.value)}
                        onBlur={() => setHex("")}
                        onKeyDown={(event) => {
                          if (event.key !== "Enter") return;
                          const color = hexToRgb(hex);
                          if (color) pickColor(color);
                          setHex("");
                        }}
                        aria-label="Color as hex"
                        className="min-w-0 flex-1 bg-transparent font-mono text-small text-ink outline-none"
                      />
                    </label>
                    {recolor && (
                      <p className="text-small text-accent">
                        Pick the new color for every key lit {rgbToHex(recolor).toUpperCase()}, on every layer.{" "}
                        <button type="button" className="cursor-pointer underline" onClick={() => setRecolor(null)}>
                          Cancel
                        </button>
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="w-12 shrink-0 text-body text-mute">Effect</span>
                  <div className="flex rounded-lg border border-line-strong p-0.5">
                    {EFFECTS.map((option) => (
                      <button
                        key={option.kind}
                        type="button"
                        aria-pressed={shown.effect === option.kind}
                        onClick={() => choose({ ...shown, effect: option.kind })}
                        className={cx(
                          "cursor-pointer rounded-md px-3 py-1 text-body font-semibold transition-colors",
                          shown.effect === option.kind ? "bg-hover text-ink" : "text-mute hover:text-ink",
                        )}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                  {shown.effect !== "Solid" && (
                    <select
                      aria-label="Speed"
                      value={shown.timing.periodMs}
                      onChange={(event) =>
                        choose({ ...shown, timing: { ...shown.timing, periodMs: Number(event.target.value) } })
                      }
                      className="rounded-lg border border-line-strong bg-hover px-2 py-1 text-body text-ink"
                    >
                      {SPEEDS.map((speed) => (
                        <option key={speed.periodMs} value={speed.periodMs}>
                          {speed.label}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {state.lightingError && <ErrorBanner message={state.lightingError} />}
      {staged.size > 0 && (
        <ApplyBar
          busy={state.lightingBusy}
          apply={{
            label: `Apply to the keyboard · ${staged.size} key${staged.size === 1 ? "" : "s"}`,
            title: `Write ${name}'s lighting to the keyboard`,
            disabled: state.lightingBusy,
            onClick: () => io.applyScenes(sceneTableWithLayer(state.scenes, layer, draft)),
          }}
          discard={{
            label: "Discard",
            title: "Go back to the lighting stored on the keyboard",
            disabled: state.lightingBusy,
            onClick: () => dispatch({ type: "draftReset", target: layer }),
          }}
        />
      )}
      <button
        type="button"
        className="self-start cursor-pointer text-small text-mute underline-offset-2 hover:text-ink hover:underline"
        onClick={() => {
          dispatch({ type: "lightingTarget", target: layer });
          dispatch({ type: "mode", mode: "lighting" });
        }}
      >
        Brushes, zones and rules: open the Lighting screen
      </button>
    </div>
  );
}
