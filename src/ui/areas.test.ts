import { describe, expect, it } from "vitest";
import { ALL_SECTIONS, areaOfSection, areasFor, type AreaFacts } from "./areas";

const plainRmk: AreaFacts = {
  connected: true,
  combos: false,
  morse: false,
  macros: false,
  forks: false,
  tapProfiles: false,
  lighting: false,
  effects: false,
};
const everything: AreaFacts = {
  connected: true,
  combos: true,
  morse: true,
  macros: true,
  forks: true,
  tapProfiles: true,
  lighting: true,
  effects: true,
};

const ids = (facts: AreaFacts) => areasFor(facts).map((area) => area.id);

describe("areas", () => {
  it("shows a plain RMK board everything but Lighting", () => {
    expect(ids(plainRmk)).toEqual(["layout", "behaviors", "device", "insights"]);
    expect(areasFor(plainRmk).find((a) => a.id === "behaviors")?.sections).toEqual(["behavior", "transforms"]);
  });

  it("adds Lighting, and Effects inside it, for an RGB board", () => {
    const lighting = areasFor(everything).find((a) => a.id === "lighting");
    expect(lighting?.sections).toEqual(["lighting", "effects"]);
    expect(areasFor({ ...everything, effects: false }).find((a) => a.id === "lighting")?.sections).toEqual([
      "lighting",
    ]);
  });

  it("offers the Behaviors editors the firmware has, in order", () => {
    expect(areasFor(everything).find((a) => a.id === "behaviors")?.sections).toEqual([
      "combos",
      "morse",
      "macros",
      "forks",
      "profiles",
      "behavior",
      "transforms",
    ]);
  });

  it("drops Device and Live for a file opened without a keyboard", () => {
    const offline = { ...everything, connected: false };
    expect(ids(offline)).toEqual(["layout", "behaviors", "lighting", "insights"]);
    expect(areasFor(offline).find((a) => a.id === "insights")?.sections).toEqual(["usage"]);
  });

  it("places every section in exactly one area when all are offered", () => {
    const placed = areasFor(everything).flatMap((area) => area.sections);
    expect([...placed].sort()).toEqual([...ALL_SECTIONS].sort());
    for (const section of ALL_SECTIONS) expect(areaOfSection(areasFor(everything), section)).toBeDefined();
  });
});
