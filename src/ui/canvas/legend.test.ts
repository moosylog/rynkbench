import { describe, expect, it } from "vitest";
import { legendLayout, legendLines } from "./legend";

/** A canvas where a key unit is 60 px on screen. */
const U = 1 / 60;

describe("key legends", () => {
  it("sizes a symbol, a short word and longer text in GLIDE's pixels", () => {
    const symbol = legendLayout("W", 1, U);
    const short = legendLayout("Home", 1, U);
    const text = legendLayout("Mouse Button", 1.5, U);
    expect([symbol.kind, short.kind, text.kind]).toEqual(["symbol", "short", "text"]);
    expect(symbol.size / U).toBeCloseTo(15);
    expect(short.size / U).toBeCloseTo(13);
    expect(text.size / U).toBeCloseTo(11);
  });

  it("keeps the same pixel size on a bigger canvas", () => {
    expect(legendLayout("W", 1, 1 / 90).size * 90).toBeCloseTo(15);
  });

  it("breaks longer text into two lines where the longer line is shortest", () => {
    expect(legendLines("Mouse Btn1")).toEqual(["Mouse", "Btn1"]);
    expect(legendLines("SymbolNav")).toEqual(["Symbol", "Nav"]);
    expect(legendLines("Layer_Lower")).toEqual(["Layer_", "Lower"]);
    expect(legendLines("Enter")).toEqual(["Enter"]);
  });

  it("shrinks a legend too wide for its cap, but keeps it readable", () => {
    const narrow = legendLayout("Backspace", 1, 1 / 30);
    expect(narrow.size).toBeLessThan((11 / 30));
    expect(narrow.size).toBeGreaterThanOrEqual(8 / 30);
  });

  it("sizes the line below and the character on top only when there is one", () => {
    expect(legendLayout("2", 1, U)).toMatchObject({ subSize: 0, topSize: 0 });
    expect(legendLayout("2", 1, U, { top: "@" }).topSize / U).toBeCloseTo(11);
    expect(legendLayout("A", 1, U, { sub: "Shift" }).subSize).toBeGreaterThan(0);
  });
});
