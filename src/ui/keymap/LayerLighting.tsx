// The key editor's Lighting tab, as GLIDE's Key Lighting: one choice for the
// key on the layer shown (Off, Custom color, Layer below, and with the
// firmware's rule table Lock light and Battery level), the chosen one's fields
// under it, and Paint, which makes the choice a brush for the canvas. While
// the tab is open the canvas shows the board under its lights. Changes join
// the draft (sent with Review & send; in Live, once painting pauses). Brushes,
// zones and rules stay in the Lighting screen.

import { useEffect, useState } from "react";
import type { LightingEffect } from "../../model/lighting-types";
import { useWorkbench } from "../state";
import { effectColor } from "../lighting/decor";
import { DEFAULT_TIMING } from "../lighting/effect";
import { sameLight, type KeyLight } from "../lighting/keyLight";
import { LED_PRESETS } from "../color";
import { layerName } from "../layer-names";
import { cx, ErrorBanner } from "../kit";
import { BrushIcon } from "../icons";
import { KeyLightFields } from "./KeyLightFields";
import { lightView, useLightView } from "./lightView";
import { useKeyLights } from "./useKeyLights";

const [RED, , , GREEN] = LED_PRESETS;

/** Each choice, with what it starts as when picked. */
const CHOICES: Array<{ start: KeyLight; title: string; text: string; needsRules?: boolean }> = [
  { start: { kind: "off" }, title: "Off", text: "The LED stays dark." },
  { start: { kind: "color", color: RED, effect: "Solid", timing: DEFAULT_TIMING }, title: "Custom color", text: "One color you pick." },
  { start: { kind: "below" }, title: "Layer below", text: "Shows what the layer below lights." },
  {
    start: { kind: "lock", lock: "caps_lock", on: RED, off: null },
    title: "Lock light",
    text: "Lights up while Caps, Num or Scroll Lock is on.",
    needsRules: true,
  },
  {
    start: { kind: "battery", level: 40, below: RED, above: GREEN },
    title: "Battery level",
    text: "One color below a battery level, another above.",
    needsRules: true,
  },
];

/** A key's light when the firmware only lets it be read. */
function ReadOnlyLight({ effect }: { effect: LightingEffect }) {
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
  const { state, dispatch } = useWorkbench();
  const view = useLightView();
  const lights = useKeyLights();
  const layer = state.uiLayer;

  useEffect(() => {
    lightView.setOpen(true);
    return () => lightView.setOpen(false);
  }, []);

  const current: KeyLight = ledId === undefined ? { kind: "below" } : lights.lightOf(ledId);
  // What each choice had last, so trying another and coming back keeps its fields.
  const [kept, setKept] = useState<Partial<Record<KeyLight["kind"], KeyLight>>>({});
  // Re-seed only when the key or the layer changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => setKept({ [current.kind]: current }), [ledId, layer]);

  if (!lights.writable) {
    const effect = ledId === undefined ? undefined : lights.preview.get(ledId);
    return effect ? <ReadOnlyLight effect={effect} /> : null;
  }

  const shown: KeyLight = view.brush ?? current;
  const choose = (light: KeyLight) => {
    setKept((all) => ({ ...all, [light.kind]: light }));
    if (view.brush) return lightView.setBrush(light);
    if (ledId !== undefined && !sameLight(light, current)) lights.set(light, [ledId]);
  };
  const unusable = ledId === undefined && !view.brush;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <h3 className="mr-auto text-small font-semibold tracking-widest text-mute uppercase">
          Key lighting · {layerName(state.layerMetadata, layer)}
        </h3>
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
      {state.lightingError && <ErrorBanner message={state.lightingError} />}

      {CHOICES.filter((choice) => !choice.needsRules || lights.statusLights).map((choice) => {
        const chosen = shown.kind === choice.start.kind;
        return (
          <div
            key={choice.start.kind}
            className={cx(
              "rounded-xl border transition-colors",
              chosen ? "border-accent bg-accent-dim" : "border-line-strong hover:border-mute",
              unusable && "opacity-50",
            )}
          >
            <button
              type="button"
              role="radio"
              aria-checked={chosen}
              disabled={unusable}
              onClick={() => choose(kept[choice.start.kind] ?? choice.start)}
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
            {chosen && (shown.kind === "color" || shown.kind === "lock" || shown.kind === "battery") && (
              <div className="flex flex-col gap-3 px-4 pt-1 pb-4 pl-11">
                <KeyLightFields light={shown} lights={lights} onChange={choose} />
              </div>
            )}
          </div>
        );
      })}

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
