// Workbench top bar: identity, history, batch, live status, settings, disconnect.

import type { BatteryStatus } from "../vendor/rynk-wasm/rynk_wasm";
import { stagedEditCount, useWorkbench } from "./state";
import { useSharedDocumentTransfer } from "./transfer-actions";
import { Chip, Button } from "./kit";
import { BatteryGlyph, PowerIcon, RedoIcon, UndoIcon, Wordmark } from "./icons";
import { KIND_LABEL } from "./session-labels";
import { SettingsMenu } from "./SettingsMenu";

function BatteryReadout({ battery, split }: { battery: BatteryStatus; split: boolean }) {
  const available = battery !== "Unavailable" ? battery.Available : null;
  const level = available?.level ?? null;
  const charging = available?.charge_state === "Charging";
  return (
    <div
      className="flex items-center gap-2"
      title={
        available
          ? `${split ? "Central half · " : ""}${available.charge_state}${level != null ? ` · ${level}%` : ""}`
          : "Battery status unavailable"
      }
    >
      <BatteryGlyph level={level} charging={charging} />
      <span className="tnum text-body text-mute">
        {level != null ? `${level}%` : available ? "—" : "n/a"}
      </span>
    </div>
  );
}

export function TopBar() {
  const { bundle, state, dispatch, io, history } = useWorkbench();
  const offline = bundle.session.kind === "offline";
  const { workspaceName } = useSharedDocumentTransfer();
  const split = bundle.caps.is_split;
  const stagedCount = stagedEditCount(state);
  const activeLabel = [...new Set([state.defaultLayer, ...state.activeLayers])]
    .sort((a, b) => a - b)
    .join(" | ");

  return (
    <header className="relative flex h-14 shrink-0 items-center gap-4 border-b border-line-soft bg-panel px-4 max-sm:gap-2 max-sm:px-2">
      <div className="flex items-center gap-3">
        <Wordmark size={26} />
        <div className="flex flex-col leading-tight">
          <span className="max-w-52 truncate text-ui font-semibold text-ink">
            {workspaceName}
          </span>
          <span className="text-caption text-faint max-sm:hidden">Rynkbench</span>
        </div>
        <Chip tone="neutral" className="max-sm:hidden">{KIND_LABEL[bundle.session.kind] ?? bundle.session.kind}</Chip>
      </div>

      <div className="flex-1" />

      <div
        className="flex items-center gap-0.5"
        title="History covers individual key binding edits only. Imports, encoder bindings, default layers, lighting, profiles, and advanced settings are not included."
      >
        <Button
          variant="ghost"
          className="px-2"
          disabled={!history.canUndo}
          reason={history.phase !== "idle" ? "Wait for the keyboard to finish saving" : "Nothing to undo"}
          onClick={() => void history.undo()}
          aria-label="Undo key binding edit"
          title={`Undo ${history.undoLabel ?? "key binding edit"} · Ctrl/⌘ Z`}
        >
          <UndoIcon size={15} />
        </Button>
        <Button
          variant="ghost"
          className="px-2"
          disabled={!history.canRedo}
          reason={history.phase !== "idle" ? "Wait for the keyboard to finish saving" : "Nothing to redo"}
          onClick={() => void history.redo()}
          aria-label="Redo key binding edit"
          title={`Redo ${history.redoLabel ?? "key binding edit"} · Ctrl/⌘ Shift Z or Ctrl Y`}
        >
          <RedoIcon size={15} />
        </Button>
      </div>

      {!offline && (
        <>
          <div className="h-6 w-px bg-line-soft max-sm:hidden" />
          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              className={state.batchMode ? "text-accent" : undefined}
              disabled={state.batchBusy || (state.batchMode && stagedCount > 0)}
              onClick={() =>
                dispatch({ type: "batchMode", enabled: !state.batchMode })
              }
              title={
                state.batchMode
                  ? stagedCount > 0
                    ? "Apply or discard the staged edits to leave batch mode"
                    : "Batch mode is on: key and encoder edits are staged locally until you apply them"
                  : "Stage key and encoder edits locally and write them to the keyboard all at once"
              }
            >
              Batch{state.batchMode ? ": on" : ""}
            </Button>
            {state.batchMode && (
              <>
                <Chip tone="accent" className="tnum">
                  {stagedCount} staged
                </Chip>
                <Button
                  variant="primary"
                  className="py-1"
                  disabled={state.batchBusy || stagedCount === 0}
                  reason={state.batchBusy ? "Applying the staged edits" : "Nothing staged yet"}
                  onClick={() => void io.applyBatch()}
                  title="Write every staged edit to the keyboard"
                >
                  {state.batchBusy ? "Applying…" : "Apply all"}
                </Button>
                <Button
                  variant="ghost"
                  disabled={state.batchBusy || stagedCount === 0}
                  onClick={() => dispatch({ type: "batchDiscard" })}
                  title="Drop every staged edit and restore what the keyboard holds"
                >
                  Discard
                </Button>
              </>
            )}
            {state.batchError && (
              <span
                className="max-w-48 truncate text-small text-danger"
                role="alert"
                title={state.batchError}
              >
                {state.batchError}
              </span>
            )}
          </div>
        </>
      )}

      {history.phase !== "idle" && (
        <span className="text-small text-accent" role="status">
          {history.phase === "writing"
            ? "Saving configuration…"
            : history.phase === "undoing"
              ? "Undoing key…"
              : "Redoing key…"}
        </span>
      )}
      {history.error && (
        <span
          className="max-w-48 truncate text-small text-danger"
          role="alert"
          title={history.error}
        >
          {history.error}
        </span>
      )}

      <div
        key={activeLabel}
        className="animate-pop max-sm:hidden"
        title={`Active layers: ${activeLabel}. Default layer: ${state.defaultLayer}.`}
      >
        <Chip tone="accent" className="tnum">
          <span className="size-1.5 rounded-full bg-accent" />
          {activeLabel}
        </Chip>
      </div>

      {!offline && <BatteryReadout battery={state.battery} split={split} />}

      <div className="h-6 w-px bg-line-soft" />

      <SettingsMenu />

      <Button variant="ghost" onClick={io.disconnect} title={offline ? "Close file" : "Disconnect"}>
        <PowerIcon size={15} />
        {offline ? "Close" : "Disconnect"}
      </Button>
    </header>
  );
}
