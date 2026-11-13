import { describe, expect, it } from "vitest";
import type { LightingEffect } from "../../vendor/rynk-wasm/rynk_wasm";
import { DEFAULT_TIMING } from "./effect";
import { colorsInUse, keyLightOf, lightWrite, recolorCells } from "./keyLight";
import { BLACK_EFFECT } from "./preview";

const RED = { r: 255, g: 0, b: 0 };
const BLUE = { r: 0, g: 0, b: 255 };
const solid = (color = RED): LightingEffect => ({ Solid: { color } });

describe("a key's light", () => {
  it("reads no cell as Layer below, a black cell as Off, anything else as a colour", () => {
    expect(keyLightOf(undefined)).toEqual({ kind: "below" });
    expect(keyLightOf(BLACK_EFFECT)).toEqual({ kind: "off" });
    expect(keyLightOf(solid())).toMatchObject({ kind: "color", color: RED, effect: "Solid" });
    expect(keyLightOf({ Blink: { color: RED, period_ms: 500, phase_ms: 0, duty: 128 } })).toMatchObject({
      effect: "Blink",
      timing: { periodMs: 500 },
    });
  });

  it("writes Off as a black cell, a colour as its effect, Layer below as no cell", () => {
    expect(lightWrite({ kind: "off" }, [3])).toEqual({ paint: [{ led_id: 3, effect: BLACK_EFFECT, ttl_ms: undefined }] });
    expect(lightWrite({ kind: "color", color: RED, effect: "Solid", timing: DEFAULT_TIMING }, [3, 4])).toEqual({
      paint: [3, 4].map((led_id) => ({ led_id, effect: solid(), ttl_ms: undefined })),
    });
    expect(lightWrite({ kind: "below" }, [3])).toEqual({ erase: [3] });
  });

  it("lists the colours in use, most used first, without black", () => {
    expect(colorsInUse([solid(BLUE), solid(), BLACK_EFFECT, solid(BLUE)])).toEqual([BLUE, RED]);
  });

  it("recolours every cell of one colour and keeps its effect", () => {
    const cells = [
      { led_id: 1, effect: solid(), ttl_ms: undefined },
      { led_id: 2, effect: { Breathe: { color: RED, period_ms: 900, phase_ms: 0, step_ms: 16 } }, ttl_ms: undefined },
      { led_id: 3, effect: solid(BLUE), ttl_ms: undefined },
    ];
    const out = recolorCells(cells, RED, BLUE);
    expect(out.map((cell) => cell.led_id)).toEqual([1, 2]);
    expect(out[1].effect).toEqual({ Breathe: { color: BLUE, period_ms: 900, phase_ms: 0, step_ms: 16 } });
  });
});
