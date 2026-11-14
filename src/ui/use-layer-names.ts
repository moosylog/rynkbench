// The connected keyboard's layer names, for labels.ts and keyFace.

import { useMemo } from "react";
import { layerNamesOf, type LayerNames } from "./layer-names";
import { useWorkbench } from "./state";

export function useLayerNames(): LayerNames {
  const { state } = useWorkbench();
  return useMemo(() => layerNamesOf(state.layerMetadata), [state.layerMetadata]);
}
