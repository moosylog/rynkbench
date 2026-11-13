import { describe, expect, it } from "vitest";
import { firmwareFactsOf, resolveCapabilities, type FactSource } from "./resolve";

const none: FactSource = {
  sceneStatus: null,
  runtimeConditionalStatus: null,
  compiledSceneStatus: null,
  lightingExtension: null,
  pointingConfig: null,
  lightingState: null,
  lightingOutputMode: null,
};

describe("firmwareFactsOf", () => {
  it("reads a null connect-time read as a missing surface", () => {
    expect(firmwareFactsOf(none)).toEqual({
      sceneSlots: null,
      ruleSlots: null,
      lighting: false,
      compiledScenes: false,
      extensionEffects: false,
      pointing: false,
      outputMode: false,
    });
  });

  it("carries capacities through, including an empty table", () => {
    const facts = firmwareFactsOf({
      ...none,
      sceneStatus: { capacity: 0 },
      runtimeConditionalStatus: { capacity: 24 },
    });
    expect(facts.sceneSlots).toBe(0);
    expect(facts.ruleSlots).toBe(24);
  });

  it("reads the lighting subsystem from the lighting state alone", () => {
    expect(firmwareFactsOf({ ...none, lightingState: {} }).lighting).toBe(true);
    expect(firmwareFactsOf(none).lighting).toBe(false);
  });

  it("needs both the state and the output mode for the output capability", () => {
    expect(firmwareFactsOf({ ...none, lightingState: {} }).outputMode).toBe(false);
    expect(firmwareFactsOf({ ...none, lightingOutputMode: {} }).outputMode).toBe(false);
    expect(firmwareFactsOf({ ...none, lightingState: {}, lightingOutputMode: {} }).outputMode).toBe(true);
  });
});

describe("resolveCapabilities", () => {
  it("offers nothing for a board with none of the optional surfaces", () => {
    const set = resolveCapabilities(firmwareFactsOf(none));
    expect(set.list()).toEqual([]);
    expect(set.get("lighting.scenes")).toBeUndefined();
    expect(set.has("pointing")).toBe(false);
  });

  it("describes each surface with its slots, reach and write access", () => {
    const set = resolveCapabilities({
      sceneSlots: 16,
      ruleSlots: 24,
      lighting: true,
      compiledScenes: true,
      extensionEffects: true,
      pointing: true,
      outputMode: true,
    });
    expect(set.get("lighting.scenes")).toEqual({ id: "lighting.scenes", slots: 16, reach: "device", readOnly: false });
    expect(set.get("lighting.rules")).toEqual({ id: "lighting.rules", slots: 24, reach: "device", readOnly: false });
    expect(set.get("lighting.compiled")).toEqual({ id: "lighting.compiled", reach: "build", readOnly: true });
    expect(set.get("lighting.state")).toEqual({ id: "lighting.state", reach: "device", readOnly: false });
    expect(set.has("lighting.extension")).toBe(true);
    expect(set.has("lighting.output")).toBe(true);
    expect(set.has("pointing")).toBe(true);
    expect(set.list()).toHaveLength(7);
  });

  it("gives table capabilities a slot count the type can rely on", () => {
    const set = resolveCapabilities({ ...firmwareFactsOf(none), sceneSlots: 4, ruleSlots: 8 });
    const scenes = set.get("lighting.scenes");
    const rules = set.get("lighting.rules");
    // `slots` is a plain number here, not `number | undefined`.
    expect((scenes?.slots ?? 0) + (rules?.slots ?? 0)).toBe(12);
  });

  it("treats a supported but empty table as present with zero slots", () => {
    const set = resolveCapabilities({ ...firmwareFactsOf(none), sceneSlots: 0 });
    expect(set.has("lighting.scenes")).toBe(true);
    expect(set.get("lighting.scenes")?.slots).toBe(0);
  });
});
