// How the screens name a layer (model/layer-names.ts), and the one layer a key
// draws as a picture. Screens get the keyboard's names from useLayerNames.

export { layerName, layerNamesOf, layerRef, type LayerNames } from "../model/layer-names";

/** MoErgo's Magic layer: a key that holds it shows the MoErgo logo, as GLIDE draws &magic. */
export const isMagicLayer = (name: string | undefined): boolean => name?.toLowerCase() === "magic";
