// Reading what a keyboard stores, as one image (ADR 0012). Reading costs no
// flash, so every write is planned against a fresh read, never a kept copy.

import type { RynkSession } from "../session/types";
import type { KeyboardImage } from "./image";

/** Which parts this keyboard has. The workbench's io features fit this shape. */
export interface ImageFeatures {
  scenesSupported: boolean;
  conditionalScenesSupported: boolean;
  pointingSupported: boolean;
  lightingOutputSupported: boolean;
  /** The firmware keeps layer names and which layer slots are used. */
  layerMetadata?: boolean;
  /** Read the macro region too (it is written as one item). */
  macros?: boolean;
}

/** A read image, with the layer state the layer rules need. */
export interface ReadImage extends KeyboardImage {
  activeLayers: number[];
  /** False only on old firmware without the full layer state. */
  layerStateComplete: boolean;
}

const none = <T,>(): Promise<T[]> => Promise.resolve([]);

export async function readImage(session: RynkSession, features: ImageFeatures): Promise<ReadImage> {
  const caps = await session.device.capabilities();
  const each = <T,>(count: number, read: (index: number) => Promise<T>) =>
    Promise.all(Array.from({ length: count }, (_, index) => read(index)));
  const [metadata, layerKeymaps, layerState, combos, morse, forks, behaviorOptions, autoMouse, pointing, macroOps] =
    await Promise.all([
      features.layerMetadata ? each(caps.num_layers, (layer) => session.keymap.getLayerMetadata(layer)) : none<never>(),
      session.keymap.readAll(),
      session.keymap.layerState(),
      caps.max_combos > 0 ? session.combos.readAll() : none<never>(),
      caps.max_morse > 0 ? session.morse.readAll() : none<never>(),
      caps.max_forks > 0 ? session.forks.readAll() : none<never>(),
      session.behavior.options(),
      session.behavior.autoMouseLayers(),
      features.pointingSupported ? session.pointing.get() : Promise.resolve(null),
      features.macros ? session.macros.read() : Promise.resolve(undefined),
    ]);
  const encoders = await each(caps.num_layers, (layer) =>
    each(caps.num_encoders, (encoder) => session.keymap.getEncoder(encoder, layer)),
  );
  const [scenes, runtimeConditionalScenes, outputMode] = await Promise.all([
    features.scenesSupported ? session.lighting.scenes.readScenes() : none<never>(),
    features.conditionalScenesSupported ? session.lighting.conditionalScenes.read() : none<never>(),
    features.lightingOutputSupported ? session.lighting.outputMode() : Promise.resolve(null),
  ]);
  const layers = Array.from({ length: caps.num_layers }, (_, layer) => {
    const found = layerKeymaps.find((candidate) => candidate.layer === layer);
    if (!found) throw new Error(`keymap read omitted layer ${layer}`);
    return found.actions;
  });
  return {
    metadata,
    layers,
    encoders,
    defaultLayer: layerState.defaultLayer,
    activeLayers: layerState.activeLayers,
    layerStateComplete: layerState.complete,
    combos,
    morse,
    forks,
    ...(macroOps ? { macroOps } : {}),
    behaviorOptions,
    autoMouseLayers: autoMouse.configs,
    scenes,
    runtimeConditionalScenes,
    wakeLayers: outputMode?.wake_layers ?? 0,
    pointing,
  };
}
