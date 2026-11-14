import { useMemo } from "react";
import type { LayerMetadata } from "../session/types";
import type { LayerNames } from "./labels";
import { useWorkbench } from "./state";

/** The user-facing name of a layer, falling back to its physical number. */
export function layerName(
  metadata: readonly LayerMetadata[] | null | undefined,
  layer: number,
): string {
  return metadata?.[layer]?.name || `Layer ${layer}`;
}

/** The layout's layer names, by layer ("" when unnamed), for the label functions. */
export function layerNamesOf(metadata: readonly LayerMetadata[] | null | undefined): LayerNames {
  return (metadata ?? []).map((layer) => layer?.name?.trim() || undefined);
}

/** The open layout's layer names: every key and line names layers by them, as GLIDE does. */
export function useLayerNames(): LayerNames {
  const { state } = useWorkbench();
  return useMemo(() => layerNamesOf(state.layerMetadata), [state.layerMetadata]);
}
