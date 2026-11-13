import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { testWorkbench } from "../../test/workbench";
import type { KeyAction } from "../../vendor/rynk-wasm/rynk_wasm";
import { WorkbenchContext } from "../state";
import { KeyEditor } from "./KeyEditor";

const A = { Single: { Key: { Hid: "A" } } } as unknown as KeyAction;
const TAP_HOLD = { TapHold: [{ Key: { Hid: "A" } }, { Modifier: { left_shift: true } }, 255] } as unknown as KeyAction;

function editor(binding: KeyAction | null) {
  const workbench = testWorkbench({
    bundle: {
      caps: { num_cols: 2, num_layers: 2 },
      model: { keys: [{ row: 0, col: 0, address: "LH-C1R1" }] },
      session: { kind: "offline" },
      lightingState: null,
      sceneStatus: null,
      compiledSceneStatus: null,
      lightingExtension: null,
      pointingConfig: null,
      runtimeConditionalStatus: null,
      lightingOutputMode: null,
    },
    state: {
      selection: binding ? { type: "key", row: 0, col: 0 } : null,
      uiLayer: 0,
      layers: [[binding ?? "No", "No"]],
      pending: {},
      stagedKeys: {},
      layerMetadata: [{ occupied: true, name: "Base" }, { occupied: true, name: "Lower" }],
      morseProfiles: [],
    },
    dispatch: () => {},
    io: {},
  });
  return renderToStaticMarkup(
    <WorkbenchContext value={workbench}>
      <KeyEditor />
    </WorkbenchContext>,
  );
}

describe("key editor", () => {
  it("points at the keyboard when no key is selected", () => {
    expect(editor(null)).toContain("Click a key on the keyboard to change what it does");
  });

  it("shows a plain key's On Tap and offers an On Hold", () => {
    const html = editor(A);
    expect(html).toContain("On Tap");
    expect(html).toContain("Key · A");
    expect(html).toContain("On Hold");
    expect(html).not.toContain("Hold timing");
  });

  it("shows a tap-hold's two slots and its timing", () => {
    const html = editor(TAP_HOLD);
    expect(html).toContain("Clear On Hold");
    expect(html).toContain("Hold timing");
    expect(html).toContain("The keyboard&#x27;s default");
  });

  it("opens on Pick Key with GLIDE's quick links", () => {
    const html = editor(A);
    expect(html).toContain("Pick Key");
    expect(html).toContain("Search keys, symbols, layers");
    for (const chip of ["Letters", "Numbers", "Symbols", "Navigation", "Media", "Device"]) expect(html).toContain(chip);
  });
});
