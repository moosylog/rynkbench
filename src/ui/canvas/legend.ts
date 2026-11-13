// How a key's legend sits on its cap, by GLIDE's rules (core/keycodes/keyFace.js
// and the .kc-* sizes in its app.css): a single character reads at 15 px, a
// word of up to five characters at 13 px (Esc, Home, Enter), longer text at
// 11 px on up to two lines, broken where the longer line comes out shortest.
// A key that types another character with Shift shows it small on top (the
// "@" over "2"). Sizes are pixels on screen, turned into key units with the
// canvas's scale, and never wider than the cap. Pure.

const PX = { symbol: 15, short: 13, text: 11 } as const;
const SUB_PX = 9.5;
const TOP_PX = 11;
const MIN_PX = 8;
/** Up to this many characters a line reads at the short size. */
const SHORT = 5;
/** Room the cap's edge and padding take from its width, in key units. */
const MARGIN = 0.2;
/** Average glyph width of Inter as a fraction of its size. */
const GLYPH_WIDTH = 0.62;

export type LegendKind = "symbol" | "short" | "text";

export interface LegendLayout {
  kind: LegendKind;
  lines: string[];
  /** Font sizes in key units: the legend, the line below it (a hold), the character on top. */
  size: number;
  subSize: number;
  topSize: number;
}

const width = (line: string) => [...line.trimEnd()].length;
const longest = (lines: string[]) => Math.max(...lines.map(width));

/** The legend on one line, or two broken after a space or an underscore, or
 *  between words written together, whichever leaves the longer line shortest. */
export function legendLines(text: string): string[] {
  if (width(text) <= SHORT) return [text];
  const chunks = text.split(/(?<=[ _])|(?<=[a-z]{2})(?=[A-Z][a-z])/);
  let best = [text];
  for (let i = 1; i < chunks.length; i++) {
    const split = [chunks.slice(0, i).join(""), chunks.slice(i).join("")];
    if (longest(split) < longest(best)) best = split;
  }
  return best.map((line) => line.trimEnd());
}

/** `px` on screen in key units, shrunk until `chars` characters fit the cap. */
function fit(px: number, chars: number, capWidth: number, unitsPerPixel: number): number {
  const widest = (capWidth - MARGIN) / (Math.max(1, chars) * GLYPH_WIDTH);
  return Math.max(MIN_PX * unitsPerPixel, Math.min(px * unitsPerPixel, widest));
}

export function legendLayout(
  text: string,
  capWidth: number,
  unitsPerPixel: number,
  { sub = "", top = "" }: { sub?: string; top?: string } = {},
): LegendLayout {
  const lines = legendLines(text);
  const kind: LegendKind = [...text].length === 1 ? "symbol" : longest(lines) <= SHORT ? "short" : "text";
  return {
    kind,
    lines,
    size: fit(PX[kind], longest(lines), capWidth, unitsPerPixel),
    subSize: sub ? fit(SUB_PX, width(sub), capWidth, unitsPerPixel) : 0,
    topSize: top ? fit(TOP_PX, width(top), capWidth, unitsPerPixel) : 0,
  };
}
