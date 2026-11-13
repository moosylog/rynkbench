// The LED lighting types screens use, named once here so that screens never
// import the generated wire package (src/architecture/boundaries.ts). Today
// they are RMK's shapes; a second protocol changes this file, not the screens.

export type {
  /** What one LED does: steady, blinking or breathing in a colour. */
  LightingEffect,
  /** One LED's effect in a scene or the overlay. */
  LightingOverlayCell,
  /** An LED colour, 0–255 per channel. */
  LightingRgb8,
} from "../vendor/rynk-wasm/rynk_wasm";
