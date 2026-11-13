// The key-action types screens use, named once here so that new screens never
// import the generated wire package (src/architecture/boundaries.ts). Today
// they are RMK's shapes; a second protocol changes this file, not the screens.

export type {
  Action,
  EncoderAction,
  HidKeyCode,
  KeyAction,
  KeyboardAction,
  LightAction,
  ModifierCombination,
} from "../vendor/rynk-wasm/rynk_wasm";
