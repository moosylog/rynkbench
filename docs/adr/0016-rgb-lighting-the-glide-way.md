# 0016. RGB lighting the GLIDE way

**Status:** Accepted (decided with the project owner); built in stages, one session each.

## Context
Lighting is its own top-bar area with two tabs, both named for what they are only by context: Lighting (paint keys on an "Overlay" or a layer, status-light presets, condition rules, zones, a brush) and Effects (the firmware's effects and palettes). Beginners do not know what the Overlay is (lights that are never saved and vanish on reboot) or how it relates to the layers. GLIDE has no lighting screen: a key's light is a choice in the key editor's Key Lighting tab (Off, a colour, a status light), Paint turns that choice into a brush over the canvas (one undo step per stroke), and brightness and effects live in Layout properties.

## Decision
- **Words:** "RGB Lighting" for each key's own light (per layer, status lights included); "RGB Effects" for the firmware's effects across the keyboard. Decorations, later, are "Appearance". Never "key colours".
- **RGB Lighting on the Keymap:** the key editor tab is "RGB Lighting" with GLIDE's choices for every selected key: Off, Colour (steady, blink, breathe), Status light (Caps/Num/Scroll Lock, battery level per half, Bluetooth profile, USB). Paint makes the choice a brush: click or drag over keys; one undo step per stroke. Zones are replaced by selecting or painting keys. The canvas's lit view shows the result.
- **Layout properties:** "RGB Lighting" tab: lights on or off, brightness, background; under Advanced the presets (Magic status cluster, stock Magic layer) and the condition rules. "RGB Effects" tab: one big Effects on/off first, then effect, palette, speed and the effect's settings.
- **Quick links:** the Keymap's sun button gets a small menu (Show lights, RGB settings…, RGB effects…); each properties tab links back ("Paint keys on the Keymap →"); empty states point to where things are.
- **The Overlay leaves the normal flow:** every light set is saved on its layer. A "Try out (not saved)" option can come back as an advanced choice if it is missed.
- **The Lighting area leaves the top bar** in the last stage; until then its tabs are named RGB Lighting and RGB Effects.

## Stages (each shippable)
1. Key editor "RGB Lighting" tab with GLIDE's choices and Paint (`ui/lighting/` pieces reused; writes through the draft and the one write path).
2. Layout properties "RGB Lighting" (on/off, brightness, background, Advanced) and "RGB Effects" (Effects on/off first).
3. Quick links: sun-button menu, links back, empty states.
4. Overlay out of the normal flow; Lighting area removed from the top bar (`ui/areas.ts`), its screens deleted or moved.

## Consequences
- A lighting feature goes either on a key (key editor, Paint) or in Layout properties; there is no lighting screen to add it to.
- The big lighting panels (`ConditionalRulesPanel`, `LightingMode`) shrink or go as their parts move; their size ceilings only go down.
