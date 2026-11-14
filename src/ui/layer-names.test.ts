import { describe, expect, it } from "vitest";
import type { LayerMetadata } from "../session/types";
import { isMagicLayer, layerName, layerNamesOf, layerRef } from "./layer-names";

const metadata: LayerMetadata[] = [
  { name: "Base", occupied: true },
  { name: "", occupied: true },
];

describe("layer names", () => {
  it("falls back to the physical number for a stored empty name", () => {
    expect(layerName(metadata, 0)).toBe("Base");
    // An empty stored name is not a name: `?? ` would render a blank tab.
    expect(layerName(metadata, 1)).toBe("Layer 1");
  });

  it("falls back for layers the device did not describe", () => {
    expect(layerName(metadata, 7)).toBe("Layer 7");
    expect(layerName(null, 2)).toBe("Layer 2");
  });
});

describe("layers in sentences", () => {
  it("use the name, else the number", () => {
    const names = layerNamesOf(metadata);
    expect(layerRef(0, names)).toBe("Base");
    expect(layerRef(1, names)).toBe("1");
    expect(layerRef(3)).toBe("3");
  });
  it("know the Magic layer by its name", () => {
    expect(isMagicLayer("Magic")).toBe(true);
    expect(isMagicLayer("magic")).toBe(true);
    expect(isMagicLayer("Magic copy")).toBe(false);
    expect(isMagicLayer(undefined)).toBe(false);
  });
});
