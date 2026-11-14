# RMK patch: do not store a key flash already holds

A firmware change for RMK (`colonelpanic8/rmk`, the source Rynkbench's protocol client is built from). It makes the keyboard leave a key, or an encoder action, alone when flash already holds that exact value, instead of storing it again. Rynkbench already never sends an unchanged key (ADR 0012, `docs/sync.md`); this protects the keyboard from every other host too.

| | |
|---|---|
| Files | `0001-storage-skip-unchanged-key-and-encoder-actions.patch` (one commit, `git am`), `apply.sh` |
| Changes | `rmk/src/storage/mod.rs` only: two helpers, the two places that use them, one test |
| Based on | `colonelpanic8/rmk` at `4bed409` ("feat: expose held modifier combinations in config") |
| Cost | One flash read per key write. Reads do not wear flash. |
| Status | Compiles; RMK's storage tests pass (6 of 6, including the new one); clippy clean; not yet tried on a keyboard |

## The problem

RMK keeps everything you change at runtime in **sequential-storage**: an append-only log of items spread over a few flash sectors (two by default, `storage.num_sectors`). Storing an item appends it; the older copy becomes dead. When a sector is full, its live items are moved and the sector is erased. That move-and-erase is:

- **slow:** seconds on a nearly full store, up to minutes on older builds. Rynkbench gives such writes two minutes (`FLASH_TIMEOUT_MS`), and the firmware answers `Busy` meanwhile;
- **wear:** each erase uses up one of the flash's limited erase cycles (typically about 10,000 on nRF52).

So every stored item brings the next slow pause and the next erase closer, including one that changes nothing.

Before this patch, RMK stored every key it was sent, unconditionally:

```rust
// rmk/src/storage/mod.rs, the storage task
FlashOperationMessage::KeymapKey { layer, row, col, action } => {
    self.store_data(StorageKey::keymap(layer, row, col), &StorageData::KeyAction(action)).await
}
```

Hosts send unchanged keys all the time: a whole-layer or whole-keymap write (an import, a layer move, Vial's bulk buffer write), a retry after a timeout, a configurator that writes "to be sure". The same file already does the right thing for lighting, comparing a scene shard with what is stored before storing it. Keys and encoder actions did not.

Other firmware does the same as this patch: QMK's `eeprom_update_byte` reads first and writes only when the value differs, and its wear-leveling layer skips writes that change nothing.

## The change

Two small helpers in `Storage`, used by the storage task in place of the unconditional store:

```rust
/// Stores a key's action unless flash already holds that same action.
#[cfg(feature = "host")]
async fn store_key_action(&mut self, layer: u8, row: u8, col: u8, action: KeyAction)
    -> Result<(), SSError<F::Error>>
{
    let key = StorageKey::keymap(layer, row, col);
    match self.fetch_data(key).await {
        Some(StorageData::KeyAction(saved)) if saved == action => Ok(()),
        _ => self.store_data(key, &StorageData::KeyAction(action)).await,
    }
}
// store_encoder_action: the same for StorageKey::encoder / EncoderAction.
```

```rust
FlashOperationMessage::KeymapKey { layer, row, col, action } => self.store_key_action(layer, row, col, action).await,
FlashOperationMessage::Encoder { layer, idx, action } => self.store_encoder_action(layer, idx, action).await,
```

What stays the same:

- **The keyboard's behaviour.** The keymap in RAM is updated before the storage message is sent (`host/context.rs`, `set_action`), exactly as before. Only the flash write is skipped, and only when flash already holds the value.
- **The answer to the host.** The task still reports a finished flash operation, so `Busy` handling and timeouts are unchanged.
- **Reading at boot.** Nothing changes in what is stored or how it is read back.
- **When nothing is stored yet** (`fetch_data` returns `None`), or a different value is stored, the key is stored as before.

## The test

`storage::tests::unchanged_key_and_encoder_actions_are_not_stored_again` counts writes on the test flash (`FLASH_WRITES`, added to the existing `TestFlash`) and checks:

1. after initialization, storing the action a key already has writes nothing;
2. a different action is written and reads back;
3. sending that action again writes nothing;
4. the same for an encoder action.

With the comparison removed, the test fails, so it really guards the behaviour.

## Results

Run against `4bed409` with the patch applied, stable Rust, `cargo-nextest` 0.9:

| Check | Result |
|---|---|
| `cargo nextest run --no-default-features --features=vial,storage storage` | 6 passed (the 5 existing storage tests and the new one) |
| `cargo nextest run --no-default-features --features=split,vial,storage,async_matrix,_ble storage` | 6 passed |
| The new test with the comparison removed | fails, as it should |
| `cargo clippy --no-default-features --features=vial,storage --tests` | no findings in `storage/mod.rs` |
| `cargo build` (default features) | builds |
| `rustfmt` | formatted |

Not yet done: a run on a real keyboard (see below), and RMK's full matrix (`sh scripts/test_all.sh`).

## Apply it

In a checkout of `colonelpanic8/rmk`:

```sh
./apply.sh /path/to/rmk          # checks the base, applies the commit, runs the storage tests
```

or by hand:

```sh
cd /path/to/rmk
git am /path/to/0001-storage-skip-unchanged-key-and-encoder-actions.patch
cd rmk && cargo nextest run --no-default-features --features=vial,storage storage
```

RMK's tests need `cargo-nextest` (`cargo install cargo-nextest --locked`): embassy-time's mock driver is one per process.

## Try it on a keyboard

1. Build and flash firmware with the patch.
2. In Rynkbench, open the keyboard and write the same key twice from another tool, or import a layout that is already on the keyboard: the write returns at once and no `Busy` pauses appear.
3. Over many such writes, the storage page migrations (the long pauses) should come far less often than before.

## For upstream

The change is general and small enough to offer to RMK itself: it fixes wear for every host, not only Rynkbench. Combo, morse and fork slots go through the same storage task and could get the same comparison once their types can be compared for equality; the lighting tables already have it.
