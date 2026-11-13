// A key's light as GLIDE's Key Lighting tab offers it, on RMK's lighting:
// - Off: a black scene cell (which also hides a firmware default);
// - Custom color: a scene cell with a colour and an effect (steady, blink, breathe);
// - Layer below: no cell, so the layers underneath show;
// - Lock light: two rules, one colour while Caps, Num or Scroll Lock is on and
//   another (or dark) while it is off;
// - Battery level: two rules, one colour below a level and another above.
// Rules belong to the key's LED on the layer shown. And the colours a layout
// already uses, most used first, to pick again or change everywhere. Pure.

import type { LightingEffect, LightingOverlayCell, LightingRgb8 } from "../../model/lighting-types";
import { rgbToHex } from "../color";
import { buildEffect, effectKind, effectRgb, effectTiming, type EffectKind, type EffectTiming } from "./effect";
import { BLACK_EFFECT } from "./preview";
import type { Rule, Rules } from "./rules";

export type Lock = "caps_lock" | "num_lock" | "scroll_lock";
export const BATTERY_LEVELS = [20, 40, 60, 80] as const;

export type KeyLight =
  | { kind: "off" }
  | { kind: "below" }
  | { kind: "color"; color: LightingRgb8; effect: EffectKind; timing: EffectTiming }
  /** `off` null: dark while the lock is off. */
  | { kind: "lock"; lock: Lock; on: LightingRgb8; off: LightingRgb8 | null }
  | { kind: "battery"; level: number; below: LightingRgb8; above: LightingRgb8 };

export type StatusLight = Extract<KeyLight, { kind: "lock" | "battery" }>;

const isBlack = (c: LightingRgb8) => c.r === 0 && c.g === 0 && c.b === 0;
const solid = (color: LightingRgb8): LightingEffect => ({ Solid: { color } });

/* ---- rules ------------------------------------------------------------- */

/** A rule this tab writes: on this LED, while this layer is on, with only a
 *  lock or only a battery condition. Other rules are the Lighting screen's. */
function isKeyRule(rule: Rule, layer: number, led: number): boolean {
  const { conditions } = rule.cell;
  if (rule.cell.led_id !== led || conditions.layer?.layer !== layer || conditions.layer.active !== true) return false;
  if (conditions.output_mode || rule.connection || rule.effects || rule.layers || rule.maintenance || rule.split_transport) {
    return false;
  }
  return Boolean(rule.indicators) !== Boolean(conditions.battery);
}

function newRule(layer: number, led: number, color: LightingRgb8): Rule {
  return {
    cell: {
      conditions: { layer: { layer, active: true }, battery: undefined, output_mode: undefined },
      led_id: led,
      effect: solid(color),
    },
    connection: undefined,
    effects: undefined,
    layers: undefined,
    indicators: undefined,
    maintenance: undefined,
    split_transport: undefined,
  };
}

/** The lock or battery light a key has on a layer, read from its rules. */
export function statusLightOf(rules: Rules, layer: number, led: number): StatusLight | null {
  const own = rules.filter((rule) => isKeyRule(rule, layer, led));
  const colorOf = (rule: Rule | undefined) => (rule ? effectRgb(rule.cell.effect) : null);
  const lockRules = own.filter((rule) => rule.indicators);
  if (lockRules.length > 0) {
    const set = (rule: Rule) => (Object.entries(rule.indicators ?? {}) as Array<[Lock, boolean | undefined]>).find(([, v]) => v !== undefined);
    const on = lockRules.find((rule) => set(rule)?.[1] === true);
    const off = lockRules.find((rule) => set(rule)?.[1] === false);
    const lock = set(on ?? off ?? lockRules[0])?.[0] ?? "caps_lock";
    const offColor = colorOf(off);
    return { kind: "lock", lock, on: colorOf(on) ?? { r: 0, g: 0, b: 0 }, off: offColor && !isBlack(offColor) ? offColor : null };
  }
  const battery = own.filter((rule) => rule.cell.conditions.battery);
  if (battery.length > 0) {
    const above = battery.find((rule) => rule.cell.conditions.battery?.min_level !== undefined);
    const below = battery.find((rule) => rule.cell.conditions.battery?.max_level !== undefined);
    const level = above?.cell.conditions.battery?.min_level ?? (below?.cell.conditions.battery?.max_level ?? 39) + 1;
    return {
      kind: "battery",
      level,
      below: colorOf(below) ?? { r: 0, g: 0, b: 0 },
      above: colorOf(above) ?? { r: 0, g: 0, b: 0 },
    };
  }
  return null;
}

/** The rules with this key's lock or battery light replaced by `light` (none: removed). */
export function withStatusLight(rules: Rules, layer: number, led: number, light: StatusLight | null, node = 0): Rules {
  const kept = rules.filter((rule) => !isKeyRule(rule, layer, led));
  if (!light) return kept;
  if (light.kind === "lock") {
    const state = (value: boolean, color: LightingRgb8) => {
      const rule = newRule(layer, led, color);
      rule.indicators = { num_lock: undefined, caps_lock: undefined, scroll_lock: undefined, [light.lock]: value };
      return rule;
    };
    return [...kept, state(false, light.off ?? { r: 0, g: 0, b: 0 }), state(true, light.on)];
  }
  const level = (color: LightingRgb8, min: number | undefined, max: number | undefined) => {
    const rule = newRule(layer, led, color);
    rule.cell.conditions.battery = { node, min_level: min, max_level: max, charge: "Any" };
    return rule;
  };
  return [...kept, level(light.below, undefined, light.level - 1), level(light.above, light.level, undefined)];
}

/* ---- a key's light ----------------------------------------------------- */

/** The light a key shows on a layer: its lock or battery rules first, then its scene cell. */
export function keyLightOf(effect: LightingEffect | undefined, status: StatusLight | null = null): KeyLight {
  if (status) return status;
  if (!effect) return { kind: "below" };
  const color = effectRgb(effect);
  if (effectKind(effect) === "Solid" && isBlack(color)) return { kind: "off" };
  return { kind: "color", color, effect: effectKind(effect), timing: effectTiming(effect) };
}

/** The colour a lit board shows for a key: a lock light lit, a battery above its level. */
export function shownColor(light: KeyLight): LightingRgb8 | null {
  if (light.kind === "color") return light.color;
  if (light.kind === "lock") return light.on;
  if (light.kind === "battery") return light.above;
  return null;
}

export function sameLight(a: KeyLight, b: KeyLight): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export interface LightPlan {
  paint: LightingOverlayCell[];
  erase: number[];
  /** The whole rule table after the change; null when it does not change. */
  rules: Rules | null;
}

/** What to write for keys to get `light` on `layer`. A lock or battery light
 *  lives in rules, so the key's scene cell goes; any other light lives in the
 *  scene, so the key's lock or battery rules go. */
export function planLight(
  light: KeyLight,
  leds: readonly number[],
  layer: number,
  rules: Rules,
  nodeOf: (led: number) => number = () => 0,
): LightPlan {
  const status = light.kind === "lock" || light.kind === "battery" ? light : null;
  let nextRules = rules;
  for (const led of leds) nextRules = withStatusLight(nextRules, layer, led, status, nodeOf(led));
  const changed = JSON.stringify(nextRules) !== JSON.stringify(rules);
  if (light.kind !== "off" && light.kind !== "color") return { paint: [], erase: [...leds], rules: changed ? nextRules : null };
  const effect = light.kind === "off" ? BLACK_EFFECT : buildEffect(light.effect, light.color, light.timing);
  return { paint: leds.map((led_id) => ({ led_id, effect, ttl_ms: undefined })), erase: [], rules: changed ? nextRules : null };
}

/* ---- colours ----------------------------------------------------------- */

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

/** Rules with every use of `from` turned into `to`. */
export function recolorRules(rules: Rules, from: LightingRgb8, to: LightingRgb8): Rules {
  const hex = rgbToHex(from);
  return rules.map((rule) =>
    rgbToHex(effectRgb(rule.cell.effect)) === hex
      ? { ...rule, cell: { ...rule.cell, effect: buildEffect(effectKind(rule.cell.effect), to, effectTiming(rule.cell.effect)) } }
      : rule,
  );
}
