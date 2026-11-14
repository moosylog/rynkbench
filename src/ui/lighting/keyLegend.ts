import type { KeyView } from "../../model/keyboard";
import type { KeyAction } from "../../model/action-types";
import { keyActionGlyph } from "../labels";
import type { LayerNames } from "../layer-names";
import { effectiveAction } from "../live/compositor";

/** What a key does where the lighting view looks: on the overlay, what the
 *  active layers resolve to; on one layer, its own binding, or the base
 *  layer's where it is transparent. */
export function lightingKeyAction(
  key: KeyView,
  layers: KeyAction[][],
  cols: number,
  target: "overlay" | number,
  activeLayers: number[],
  defaultLayer: number,
): KeyAction {
  const index = key.row * cols + key.col;
  if (target === "overlay") return effectiveAction(layers, activeLayers, defaultLayer, index);
  const action = layers[target]?.[index];
  return action === undefined || action === "Transparent" ? effectiveAction(layers, [], defaultLayer, index) : action;
}

/** The legend of lightingKeyAction's key; `names` names its layer keys. */
export function lightingKeyLegend(
  ...[key, layers, cols, target, activeLayers, defaultLayer, names]: [...Parameters<typeof lightingKeyAction>, LayerNames?]
): string {
  return keyActionGlyph(lightingKeyAction(key, layers, cols, target, activeLayers, defaultLayer), [], names).text;
}
