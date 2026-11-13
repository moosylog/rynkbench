import { describe, expect, it } from "vitest";
import { legendLayout, legendLines } from "./legend";

describe("key legends", () => {
  it("sizes a symbol, a short word and longer text as GLIDE does", () => {
    const symbol = legendLayout("W", 1);
    const short = legendLayout("Home", 1);
    const text = legendLayout("Mouse Button", 1.5);
    expect([symbol.kind, short.kind, text.kind]).toEqual(["symbol", "short", "text"]);
    expect(symbol.size).toBeCloseTo(15 / 45);
    expect(short.size).toBeCloseTo(13 / 45);
    expect(text.size).toBeLessThan(short.size);
  });

  it("breaks longer text into two lines where the longer line is shortest", () => {
    expect(legendLines("Mouse Btn1")).toEqual(["Mouse", "Btn1"]);
    expect(legendLines("SymbolNav")).toEqual(["Symbol", "Nav"]);
    expect(legendLines("Layer_Lower")).toEqual(["Layer_", "Lower"]);
    expect(legendLines("Enter")).toEqual(["Enter"]);
  });

  it("shrinks a legend that would not fit a narrow cap, but keeps it readable", () => {
    const wide = legendLayout("Backspace", 2);
    const narrow = legendLayout("Backspace", 1);
    expect(narrow.size).toBeLessThan(wide.size);
    expect(narrow.size).toBeGreaterThanOrEqual(8 / 45);
  });

  it("gives the line below a size only when there is one", () => {
    expect(legendLayout("A", 1).subSize).toBe(0);
    expect(legendLayout("A", 1, "Shift").subSize).toBeGreaterThan(0);
  });
});
