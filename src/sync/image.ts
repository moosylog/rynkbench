// What Rynkbench knows a keyboard stores: one record per kind of stored item.
// The planner compares two of these (what the keyboard holds, what you want);
// a part that is missing on either side is simply not compared (ADR 0012).

import type {
  AutoMouseLayerConfig,
  BehaviorOptions,
  ComboDefinition,
  EncoderAction,
  Fork,
  KeyAction,
  LightingSceneCell,
  MacroOp,
  Morse,
  PointingConfig,
} from "../vendor/rynk-wasm/rynk_wasm";
import type { LayerMetadata, RuntimeLightingRule } from "../session/types";

export interface KeyboardImage {
  /** Per layer slot: used or not, and its name. Empty when the firmware keeps none. */
  metadata: LayerMetadata[];
  /** Per layer, row-major. */
  layers: KeyAction[][];
  /** Per layer, per encoder. */
  encoders: EncoderAction[][];
  defaultLayer: number;
  combos: ComboDefinition[];
  morse: Morse[];
  forks: Fork[];
  /** The macro region, one entry per macro; absent when it was not read. */
  macroOps?: MacroOp[][];
  behaviorOptions: BehaviorOptions | null;
  autoMouseLayers: AutoMouseLayerConfig[];
  scenes: LightingSceneCell[];
  runtimeConditionalScenes: RuntimeLightingRule[];
  wakeLayers: number;
  pointing: PointingConfig | null;
}

export type SlotTable = "combos" | "morse" | "forks";
