// How a key's legend sits on its cap, by GLIDE's rules (core/keycodes/keyFace.js
// and the .kc-* sizes in its app.css): a single character reads largest, a word
// of up to five characters a little smaller (Esc, Home, Enter), longer text
// smaller again on up to two lines, broken where the longer line comes out
// shortest. A key that types another character with Shift shows it small on
// top (the "@" over "2") with its own character a little smaller below.
// GLIDE sizes these in px for its 62 px key and its zoom scales them with the
// keys, so here they are fractions of the key pitch (GLIDE's is 70 px). Pure.

const PITCH_PX = 70;
const SIZE = {
  symbol: 15 / PITCH_PX,
  short: 13 / PITCH_PX,
  text: 11 / PITCH_PX,
  /** The character under a shifted one, and the shifted one on top. */
  belowTop: 13.44 / PITCH_PX,
  top: 11.52 / PITCH_PX,
  /** A hold under the legend. */
  sub: 9.5 / PITCH_PX,
} as const;
const MIN = 8 / PITCH_PX;
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

/** `size`, shrunk until `chars` characters fit the cap's width. */
function fit(size: number, chars: number, capWidth: number): number {
  return Math.max(MIN, Math.min(size, (capWidth - MARGIN) / (Math.max(1, chars) * GLYPH_WIDTH)));
}

export function legendLayout(
  text: string,
  capWidth: number,
  { sub = "", top = "" }: { sub?: string; top?: string } = {},
): LegendLayout {
  const lines = legendLines(text);
  const kind: LegendKind = [...text].length === 1 ? "symbol" : longest(lines) <= SHORT ? "short" : "text";
  return {
    kind,
    lines,
    size: fit(top && kind === "symbol" ? SIZE.belowTop : SIZE[kind], longest(lines), capWidth),
    subSize: sub ? fit(SIZE.sub, width(sub), capWidth) : 0,
    topSize: top ? fit(SIZE.top, width(top), capWidth) : 0,
  };
}
