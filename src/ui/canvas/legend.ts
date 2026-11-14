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

/** A row of pictures and short text (keyface/keyFace.ts), laid out centred on
 *  the cap with GLIDE's proportions (its .kc-icons rules, measured on its 62 px
 *  cap): one picture is 40% of the cap; with more parts the first picture is
 *  36% and the next ones 23% (GLIDE's .kc-dual, .kc-icon-2), and a number
 *  beside a picture (the Bluetooth profile) is 26% of the cap tall. The small
 *  tiers (a hold, a chord's modifiers) use GLIDE's 13 px pictures and the
 *  hold's text size. A wide picture (the MoErgo logo) alone is GLIDE's
 *  .kc-wide: 132% of the face's content box wide, past its padding but clear
 *  of the cap's edge. Sizes are in key units; the cap is 62/70 of the pitch. */
export interface FaceItem {
  kind: "icon" | "text";
  /** Index into the face's parts. */
  part: number;
  /** Centre, from the cap's centre, and size (an icon's height, a text's font size), in key units. */
  dx: number;
  size: number;
  /** Drawn width in key units (an icon's side unless it is wide). */
  width: number;
}

/** A face part to lay out; `aspect` is a picture's width over its height (1 when square). */
export type FacePiece = { icon: string; aspect?: number } | { text: string };

const CAP = 62 / PITCH_PX;
const FACE = {
  alone: 0.402 * CAP,
  first: 0.356 * CAP,
  next: 0.232 * CAP,
  text: 0.263 * CAP,
  smallIcon: 13 / PITCH_PX,
  gap: 0.03 * CAP,
  smallGap: 1 / PITCH_PX,
  /** GLIDE's .kc-icon is 52% of the face's content box, .kc-wide 132% of it. */
  wide: (1.32 / 0.52) * 0.402 * CAP,
} as const;

export function faceLayout(parts: readonly FacePiece[], capWidth: number, tier: "main" | "small"): FaceItem[] {
  const small = tier === "small";
  const aspect = (part: FacePiece) => ("icon" in part ? (part.aspect ?? 1) : 1);
  const wideAlone = !small && parts.length === 1 && aspect(parts[0]) > 1;
  const sizes = parts.map((part, i) => {
    if ("text" in part) return small ? SIZE.sub : FACE.text;
    if (wideAlone) return FACE.wide / aspect(part);
    if (small) return FACE.smallIcon;
    return parts.length === 1 ? FACE.alone : i === 0 ? FACE.first : FACE.next;
  });
  const widths = parts.map((part, i) =>
    "text" in part ? [...part.text].length * GLYPH_WIDTH * sizes[i] : sizes[i] * aspect(part),
  );
  const gap = small ? FACE.smallGap : FACE.gap;
  const total = widths.reduce((sum, w) => sum + w, 0) + gap * (parts.length - 1);
  // A wide picture alone may cross the face's padding (GLIDE's .kc-wide), not the cap's edge.
  const scale = Math.min(1, (capWidth - (wideAlone ? MARGIN / 2 : MARGIN)) / total);
  let x = -(total * scale) / 2;
  return parts.map((part, i) => {
    const w = widths[i] * scale;
    const item: FaceItem = { kind: "text" in part ? "text" : "icon", part: i, dx: x + w / 2, size: sizes[i] * scale, width: w };
    x += w + gap * scale;
    return item;
  });
}
