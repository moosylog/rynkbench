// How a layer is named to the person: by the name it was given, else by its
// number. Pure; the screens use it through ui/layer-names.ts.

/** The name a layer was given, or undefined when it has none. */
export type LayerNames = (layer: number) => string | undefined;

/** The names a keyboard's layer metadata gives its layers. An empty or blank
 *  stored name is no name. */
export function layerNamesOf(metadata: readonly { name: string }[] | null | undefined): LayerNames {
  return (layer) => metadata?.[layer]?.name.trim() || undefined;
}

/** A layer on its own: its name, else "Layer n". */
export function layerName(metadata: readonly { name: string }[] | null | undefined, layer: number): string {
  return layerNamesOf(metadata)(layer) ?? `Layer ${layer}`;
}

/** A layer inside a sentence: its name, else its number ("Momentary layer 3"). */
export function layerRef(layer: number, names?: LayerNames): string {
  return names?.(layer) ?? String(layer);
}
