// From what connecting found out about the firmware to the capabilities it
// offers. Pure and free of protocol types: the inputs are plain facts, so this
// layer needs nothing from the wire package, the session or the screen.

import type { Capability, CapabilityId, CapabilitySet } from "./types";

/** The firmware facts the capabilities derive from, reduced to primitives so a
 *  hook can memoize on them without chasing object identity. */
export interface FirmwareFacts {
  /** Capacity of the on-device layer scene table; null when the firmware has none. */
  sceneSlots: number | null;
  /** Capacity of the runtime lighting rule table; null when the firmware has none. */
  ruleSlots: number | null;
  /** The firmware has the lighting subsystem at all. */
  lighting: boolean;
  /** Layer scenes compiled into this firmware build. */
  compiledScenes: boolean;
  extensionEffects: boolean;
  pointing: boolean;
  /** The three-state lighting output policy and its live state. */
  outputMode: boolean;
}

/** Anything that carries the connect-time reads: a connect bundle or the
 *  workbench state. Structural on purpose, so neither has to be imported. */
export interface FactSource {
  sceneStatus: { capacity: number } | null;
  runtimeConditionalStatus: { capacity: number } | null;
  compiledSceneStatus: unknown;
  lightingExtension: unknown;
  pointingConfig: unknown;
  lightingState: unknown;
  lightingOutputMode: unknown;
}

/** A read that came back `null` means the firmware does not have the surface. */
export function firmwareFactsOf(source: FactSource): FirmwareFacts {
  return {
    sceneSlots: source.sceneStatus?.capacity ?? null,
    ruleSlots: source.runtimeConditionalStatus?.capacity ?? null,
    lighting: source.lightingState !== null,
    compiledScenes: source.compiledSceneStatus !== null,
    extensionEffects: source.lightingExtension !== null,
    pointing: source.pointingConfig !== null,
    outputMode: source.lightingState !== null && source.lightingOutputMode !== null,
  };
}

export function resolveCapabilities(facts: FirmwareFacts): CapabilitySet {
  const found = new Map<CapabilityId, Capability>();
  const add = (capability: Capability) => found.set(capability.id, capability);

  if (facts.lighting) {
    add({ id: "lighting.state", reach: "device", readOnly: false });
  }
  if (facts.sceneSlots !== null) {
    add({ id: "lighting.scenes", slots: facts.sceneSlots, reach: "device", readOnly: false });
  }
  if (facts.ruleSlots !== null) {
    add({ id: "lighting.rules", slots: facts.ruleSlots, reach: "device", readOnly: false });
  }
  if (facts.compiledScenes) {
    add({ id: "lighting.compiled", reach: "build", readOnly: true });
  }
  if (facts.extensionEffects) {
    add({ id: "lighting.extension", reach: "device", readOnly: false });
  }
  if (facts.outputMode) {
    add({ id: "lighting.output", reach: "device", readOnly: false });
  }
  if (facts.pointing) {
    add({ id: "pointing", reach: "device", readOnly: false });
  }

  return {
    // Table capabilities are only ever stored with their slot count (above).
    get: ((id: CapabilityId) => found.get(id)) as CapabilitySet["get"],
    has: (id) => found.has(id),
    list: () => [...found.values()],
  };
}
