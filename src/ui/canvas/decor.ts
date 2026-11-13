// What the canvas shows on each key, encoder and trackpad: decided by the screen
// that draws it, passed in, never worked out here.

import type { KeyGlyph } from "../labels";

export interface KeyDecor {
  glyph?: KeyGlyph;
  /** Accessible description of the key and its current action. */
  ariaLabel?: string;
  ariaKeyShortcuts?: string;
  /** Per-key lighting color (CSS), rendered as a flat cap fill. */
  fill?: string;
  /** Device-wide base lighting, rendered across the full cap below labels. */
  backgroundFill?: string;
  fillAnim?: {
    name: "led-blink" | "led-breathe";
    periodMs: number;
    delayMs?: number;
  };
  staged?: boolean;
  selected?: boolean;
  pending?: boolean;
  error?: boolean;
  /** Zone-hover emphasis. */
  highlight?: boolean;
  /** Member of the current bulk selection. */
  inSelection?: boolean;
  /** Not paintable / not interactive right now. */
  disabled?: boolean;
  /** Bump to replay the paint pop animation. */
  popNonce?: number;
}

export interface EncoderDecor {
  selected?: boolean;
  staged?: boolean;
  pending?: boolean;
  error?: boolean;
  label?: string;
}

export interface PointingDeviceDecor {
  selected?: boolean;
  staged?: boolean;
  mode?: string;
}
