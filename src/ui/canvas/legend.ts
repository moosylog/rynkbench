// How a key's legend sits on its cap, by GLIDE's rules (core/keycodes/keyFace.js
// and the .kc-main sizes in its app.css): a single character reads largest, a
// word of up to five characters a little smaller (Esc, Home, Enter), longer
// text smaller again on up to two lines, broken where the longer line comes
// out shortest. Sizes are in key units; GLIDE's px sizes are taken at its 45 px
// key. Pure.

const KEY_PX = 45;
const SIZE = { symbol: 15 / KEY_PX, short: 13 / KEY_PX, text: 11 / KEY_PX } as const;
const SUB_SIZE = 9.5 / KEY_PX;
const MIN_SIZE = 8 / KEY_PX;
/** Up to this many characters a line reads at the short size. */
const SHORT = 5;
/** Room the cap's edge and padding take from its width. */
const MARGIN = 0.2;
/** Average glyph width of Inter as a fraction of its size. */
const GLYPH_WIDTH = 0.62;

export type LegendKind = "symbol" | "short" | "text";

export interface LegendLayout {
  kind: LegendKind;
  lines: string[];
  /** Font size of the legend, in key units. */
  size: number;
  /** Font size of the line below it (a hold), in key units. */
  subSize: number;
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

/** Shrinks `size` until `chars` characters fit the cap's width. */
function fitWidth(size: number, chars: number, capWidth: number): number {
  return Math.max(MIN_SIZE, Math.min(size, (capWidth - MARGIN) / (Math.max(1, chars) * GLYPH_WIDTH)));
}

export function legendLayout(text: string, capWidth: number, sub = ""): LegendLayout {
  const lines = legendLines(text);
  const kind: LegendKind = [...text].length === 1 ? "symbol" : longest(lines) <= SHORT ? "short" : "text";
  return {
    kind,
    lines,
    size: fitWidth(SIZE[kind], longest(lines), capWidth),
    subSize: sub ? fitWidth(SUB_SIZE, width(sub), capWidth) : 0,
  };
}
