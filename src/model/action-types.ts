// The key-action types screens use, named once here so that new screens never
// import the generated wire package (src/architecture/boundaries.ts). Today
// they are RMK's shapes; a second protocol changes this file, not the screens.

export type {
  Action,
  /** A combo: keys pressed together and what they do. */
  ComboDefinition,
  EncoderAction,
  /** A key that becomes another while certain modifiers are held. */
  Fork,
  HidKeyCode,
  KeyAction,
  KeyboardAction,
  KeyCode,
  LightAction,
  ModifierCombination,
  /** A morse (tap-dance) entry a key can be bound to. */
  Morse,
  /** A named tap-hold timing profile in its slot. */
  MorseProfileEntry,
} from "../vendor/rynk-wasm/rynk_wasm";
