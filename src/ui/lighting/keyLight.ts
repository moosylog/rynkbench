// A key's light as GLIDE's Key Lighting tab offers it, on RMK's layer scenes:
// Off (a black cell, which also hides a firmware default), Custom color (a
// cell with a colour and an effect: steady, blink or breathe), or Layer below
// (no cell, so the layers underneath show). And the colours a layout already
// uses, most used first, so they can be picked again or changed everywhere.
// Pure.

import type { LightingEffect, LightingOverlayCell, LightingRgb8 } from "../../model/lighting-types";
import { rgbToHex } from "../color";
import { buildEffect, effectKind, effectRgb, effectTiming, type EffectKind, type EffectTiming } from "./effect";
import { BLACK_EFFECT } from "./preview";

export type KeyLight =
  | { kind: "off" }
  | { kind: "below" }
  | { kind: "color"; color: LightingRgb8; effect: EffectKind; timing: EffectTiming };

const isBlack = (c: LightingRgb8) => c.r === 0 && c.g === 0 && c.b === 0;

/** The light a key shows on a layer: what its effect is, or Layer below when it has none. */
export function keyLightOf(effect: LightingEffect | undefined): KeyLight {
  if (!effect) return { kind: "below" };
  const color = effectRgb(effect);
  if (effectKind(effect) === "Solid" && isBlack(color)) return { kind: "off" };
  return { kind: "color", color, effect: effectKind(effect), timing: effectTiming(effect) };
}

export function sameLight(a: KeyLight, b: KeyLight): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** What to write for keys to get `light`: cells to paint, or LEDs to erase. */
export function lightWrite(
  light: KeyLight,
  ledIds: readonly number[],
): { paint: LightingOverlayCell[] } | { erase: number[] } {
  if (light.kind === "below") return { erase: [...ledIds] };
  const effect = light.kind === "off" ? BLACK_EFFECT : buildEffect(light.effect, light.color, light.timing);
  return { paint: ledIds.map((led_id) => ({ led_id, effect, ttl_ms: undefined })) };
}

/** The lit colours in `effects`, most used first (black is Off, not a colour). */
export function colorsInUse(effects: Iterable<LightingEffect>, limit = 12): LightingRgb8[] {
  const counts = new Map<string, { color: LightingRgb8; count: number }>();
  for (const effect of effects) {
    const color = effectRgb(effect);
    if (isBlack(color)) continue;
    const key = rgbToHex(color);
    const entry = counts.get(key) ?? { color, count: 0 };
    entry.count += 1;
    counts.set(key, entry);
  }
  return [...counts.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
    .map((entry) => entry.color);
}

/** Cells of one layer with every use of `from` turned into `to`, keeping each effect. */
export function recolorCells(cells: readonly LightingOverlayCell[], from: LightingRgb8, to: LightingRgb8): LightingOverlayCell[] {
  const hex = rgbToHex(from);
  return cells
    .filter((cell) => rgbToHex(effectRgb(cell.effect)) === hex)
    .map((cell) => ({ ...cell, effect: buildEffect(effectKind(cell.effect), to, effectTiming(cell.effect)) }));
}
