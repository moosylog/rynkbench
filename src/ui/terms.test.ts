import { describe, expect, it } from "vitest";
import { DEFAULT_WORDING, TERMS, normalizeWording, termFor, type TermId } from "./terms";

describe("terms", () => {
  it("has both voices for every term, and none empty", () => {
    for (const [id, term] of Object.entries(TERMS)) {
      expect(term.technical.length, `${id} technical`).toBeGreaterThan(0);
      expect(term.friendly.length, `${id} friendly`).toBeGreaterThan(0);
    }
  });

  it("keeps today's wording as the technical voice and the default", () => {
    expect(DEFAULT_WORDING).toBe("technical");
    const today: Record<string, string> = {
      "mode.keymap": "Keymap",
      "mode.lighting": "Lighting",
      "mode.effects": "Effects",
      "mode.live": "Live",
      "mode.profiles": "Profiles",
      "mode.advanced": "Advanced",
      "mode.device": "Device",
      "tab.combos": "Combos",
      "tab.morse": "Morse",
      "tab.macros": "Macros",
      "tab.forks": "Forks",
      "tab.behavior": "Behavior",
      "tab.transforms": "Transforms",
      "tab.usage": "Usage",
    };
    expect(Object.keys(TERMS).sort()).toEqual(Object.keys(today).sort());
    for (const [id, label] of Object.entries(today)) expect(termFor(id as TermId, "technical")).toBe(label);
  });

  it("keeps friendly mode names short enough for the narrow mode rail", () => {
    for (const [id, term] of Object.entries(TERMS)) {
      if (id.startsWith("mode.")) expect(term.friendly.length, id).toBeLessThanOrEqual(10);
    }
  });

  it("falls back to the default for anything that is not a voice", () => {
    expect(normalizeWording("friendly")).toBe("friendly");
    expect(normalizeWording("technical")).toBe("technical");
    expect(normalizeWording("pirate")).toBe("technical");
    expect(normalizeWording(undefined)).toBe("technical");
  });
});
