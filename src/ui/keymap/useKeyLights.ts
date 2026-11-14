// Reading and writing keys' lights on the layer shown, for the Lighting tab
// and for Paint on the canvas. A light lives in the layer's scene (Off, a
// colour, Layer below) or in the rule table (a lock or battery light); both
// are staged in the draft and sent with it. Your colours and changing one
// colour everywhere work over every layer's scene and the rules.

import { useMemo } from "react";
import type { LightingRgb8 } from "../../model/lighting-types";
import { rgbToHex } from "../color";
import { effectRgb } from "../lighting/effect";
import {
  colorsInUse,
  keyLightOf,
  planLight,
  recolorCells,
  recolorRules,
  statusLightOf,
  type KeyLight,
} from "../lighting/keyLight";
import { targetPreviewEffects } from "../lighting/preview";
import { lightingDraftFor, useWorkbench } from "../state";
import { useCapability } from "../use-capabilities";

export function useKeyLights() {
  const { bundle, state, dispatch } = useWorkbench();
  const scenes = useCapability("lighting.scenes");
  const rulesTable = useCapability("lighting.rules");
  const layer = state.uiLayer;
  const layers = Array.from({ length: bundle.caps.num_layers }, (_, index) => index);
  const draft = lightingDraftFor(state, layer);
  const rules = state.runtimeConditionalDraft;
  const preview = useMemo(() => targetPreviewEffects(layer, draft, state.compiledScenes), [layer, draft, state.compiledScenes]);

  // A lock or battery light watches the half of a split board its key is on.
  const nodeOf = (led: number) => {
    const key = bundle.model.keys.find((candidate) => candidate.ledId === led);
    return bundle.caps.is_split && key?.address?.startsWith("RH") ? 1 : 0;
  };
  const everyCell = () => layers.flatMap((index) => Object.values(lightingDraftFor(state, index)));

  return {
    /** The firmware can store a layer's lighting; without it lights can only be read. */
    writable: scenes !== undefined,
    /** Lock and battery lights need the firmware's rule table. */
    statusLights: rulesTable !== undefined,
    /** A split board has a battery on each half. */
    split: bundle.caps.is_split,
    preview,
    lightOf: (led: number): KeyLight => keyLightOf(preview.get(led), statusLightOf(rules, layer, led)),

    /** Gives keys a light on the layer shown (staged). */
    set(light: KeyLight, leds: readonly number[]) {
      const plan = planLight(light, leds, layer, rules, nodeOf);
      if (plan.paint.length) dispatch({ type: "paint", cells: plan.paint, target: layer });
      if (plan.erase.length) dispatch({ type: "erase", ledIds: plan.erase, target: layer });
      if (plan.rules) dispatch({ type: "conditionalDraft", cells: plan.rules });
    },
    /** Your colours: those lit in the layout's scenes and rules, most used first. */
    yours: colorsInUse([...everyCell().map((cell) => cell.effect), ...rules.map((rule) => rule.cell.effect)]),
    usage(color: LightingRgb8) {
      const hex = rgbToHex(color);
      const lit = layers.filter((index) =>
        Object.values(lightingDraftFor(state, index)).some((cell) => rgbToHex(effectRgb(cell.effect)) === hex),
      );
      const keys = everyCell().filter((cell) => rgbToHex(effectRgb(cell.effect)) === hex).length;
      const ruleKeys = rules.filter((rule) => rgbToHex(effectRgb(rule.cell.effect)) === hex).length;
      return { keys: keys + ruleKeys, layers: lit.length };
    },
    /** Changes one colour on every key of every layer, effects kept; returns how many changed. */
    recolor(from: LightingRgb8, to: LightingRgb8): number {
      let count = 0;
      for (const index of layers) {
        const cells = recolorCells(Object.values(lightingDraftFor(state, index)), from, to);
        count += cells.length;
        if (cells.length) dispatch({ type: "paint", cells, target: index });
      }
      const recolored = recolorRules(rules, from, to);
      const ruleCount = recolored.filter((rule, i) => rule !== rules[i]).length;
      if (ruleCount) dispatch({ type: "conditionalDraft", cells: recolored });
      return count + ruleCount;
    },
  };
}

export type KeyLights = ReturnType<typeof useKeyLights>;
