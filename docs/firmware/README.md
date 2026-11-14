# Firmware patches

Changes Rynkbench would like in the RMK firmware it talks to (built from `colonelpanic8/rmk`). Rynkbench works without them; each makes the keyboard protect itself as well.

## `rmk-skip-unchanged-keys.patch`

**What:** the storage task leaves a key, or an encoder action, alone when flash already holds that same value, instead of storing it again.

**Why:** RMK keeps settings in sequential-storage, an append-only log over two flash sectors by default. Every store appends an item, and when a sector fills, its live items are moved and the sector is erased: that is the pause of seconds to minutes that Rynkbench allows for (`FLASH_TIMEOUT_MS`), and it is what wears the flash. Keys were stored unconditionally (`storage/mod.rs`, `FlashOperationMessage::KeymapKey`), while the lighting tables in the same file are already compared first. Rynkbench never sends an unchanged key (ADR 0012), but other hosts (Vial, older Rynkbench, a whole-layer import) do. QMK's `eeprom_update_*` and wear-leveling layer skip unchanged writes the same way.

**Cost:** one flash read per key write, which does not wear flash.

**Checked:** against `colonelpanic8/rmk` at `4bed409`. It compiles, and RMK's storage tests pass (`cargo nextest run --no-default-features --features=vial,storage storage`, 5 passed). Still to add in the fork: a test that drives the storage task with the same key twice and counts stored items.

**Apply:** `git apply rmk-skip-unchanged-keys.patch` in the RMK checkout.

## Later: keymap transactions

Lighting tables have begin, put and commit; the keymap does not, so a link dropped half-way leaves a keymap half-written (Rynkbench resumes it by planning again). A keymap transaction, or ZMK Studio-style changes held in RAM until Save, would make a large change all-or-nothing on the keyboard itself. It needs new protocol commands; see ADR 0012.
