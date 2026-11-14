# Firmware patches

Changes Rynkbench would like in the RMK firmware it talks to (built from `colonelpanic8/rmk`). Rynkbench works without them; each one makes the keyboard protect itself as well. Every patch is a folder with the patch as a commit (`git am`), a README (problem, change, test, results, how to apply and try it) and an `apply.sh` that applies it and runs RMK's tests.

| Patch | What it does | Status |
|---|---|---|
| [rmk-skip-unchanged-keys](rmk-skip-unchanged-keys/README.md) | Does not store a key or encoder action that flash already holds, as RMK's lighting tables already do. Saves flash wear and storage pauses for every host. | Tested in RMK (6 of 6 storage tests, with a new one that fails without the change); not yet tried on a keyboard |

## Later: keymap transactions

Lighting tables have begin, put and commit; the keymap does not, so a link dropped half-way leaves a keymap half-written (Rynkbench resumes it by planning again, `docs/sync.md`). A keymap transaction, or ZMK Studio-style changes held in RAM until Save, would make a large change all-or-nothing on the keyboard itself. It needs new protocol commands; see ADR 0012.
