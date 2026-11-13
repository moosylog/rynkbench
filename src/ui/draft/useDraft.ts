// The draft, as the status chip and the review window use it. In Draft mode
// changes stay in Rynkbench until Send writes them all to the keyboard in one
// go; in Live mode each change goes at once. RMK stores every write, so the
// draft is held here, not on the keyboard (docs/adr/0010-draft-and-live.md).

import { useMemo, useRef } from "react";
import { sceneTableWithLayer } from "../lighting/preview";
import { askConfirm, showToast } from "../messages/store";
import { lightingDraftFor, useWorkbench } from "../state";
import { draftGroups, draftSize, lightingLayers, changedRuleLeds, type DraftGroup } from "./changes";
import { resetDraftHistory } from "./useDraftHistory";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export function useDraft() {
  const { bundle, state, dispatch, io } = useWorkbench();
  const latest = useRef(state);
  latest.current = state;
  const groups = useMemo(() => draftGroups(state), [state]);
  const size = draftSize(groups);
  const sending = state.batchBusy || state.lightingBusy;

  /** Writes the lighting changes: every changed layer in one scene table, then the rules. */
  const sendLighting = async (): Promise<string | null> => {
    const now = latest.current;
    const layers = [...lightingLayers(now).keys()];
    if (layers.length > 0) {
      const table = layers.reduce((cells, layer) => sceneTableWithLayer(cells, layer, lightingDraftFor(now, layer)), now.scenes);
      const result = await io.applyScenes(table);
      if (!result.ok) return result.message;
    }
    if (changedRuleLeds(latest.current.runtimeConditionalDraft, latest.current.runtimeConditionalScenes).size > 0) {
      const result = await io.applyConditionalScenes(latest.current.runtimeConditionalDraft);
      if (!result.ok) return result.message;
    }
    return null;
  };

  return {
    /** A file has no keyboard to send to: everything is the file's. */
    offline: bundle.session.kind === "offline",
    live: !state.batchMode,
    groups,
    size,
    sending,

    /** Sends everything; true when the keyboard has it all. */
    async send(): Promise<boolean> {
      if (sending || size === 0) return size === 0;
      const total = size;
      resetDraftHistory();
      const keys = await io.applyBatch();
      const lighting = await sendLighting();
      const left = draftSize(draftGroups(latest.current));
      if (keys.ok && !lighting && left === 0) {
        showToast(`${plural(total, "change")} sent: the keyboard has them all`, { tone: "ok" });
        return true;
      }
      showToast(`${plural(left, "change")} could not be sent and stay in the draft: try Send again`, { tone: "danger" });
      return false;
    },

    /** Lighting only, for Live mode, where lighting goes once the painting pauses. */
    sendLighting,

    async discard() {
      const yes = await askConfirm({
        title: `Discard ${plural(size, "change")}?`,
        body: "They are not on the keyboard, and they will be gone. The keyboard keeps what it has.",
        confirmLabel: "Discard",
        danger: true,
      });
      if (yes) discardAll();
    },

    /** Drops one group of the review window. */
    discardGroup(group: DraftGroup) {
      const now = latest.current;
      if (group.area === "keys") {
        for (const edit of Object.values(now.stagedKeys).filter((edit) => edit.layer === group.layer)) {
          dispatch({ type: "keyStage", layer: edit.layer, row: edit.row, col: edit.col, action: edit.before });
        }
      } else if (group.area === "encoders") {
        for (const edit of Object.values(now.stagedEncoders).filter((edit) => edit.layer === group.layer)) {
          if (edit.before) dispatch({ type: "encoderStage", layer: edit.layer, id: edit.id, action: edit.before });
        }
      } else if (group.area === "lighting") {
        dispatch({ type: "draftReset", target: group.layer });
      } else {
        dispatch({ type: "conditionalDraftReset" });
      }
    },

    async setLive(live: boolean) {
      if (!live) return dispatch({ type: "batchMode", enabled: true });
      if (size > 0) return;
      const yes = await askConfirm({
        title: "Send each change to the keyboard at once?",
        body:
          "In Live mode every change is written to the keyboard's memory as you make it, which wears it a little with each write. " +
          "Planning several changes? Stay in Draft and send them once.",
        confirmLabel: "Turn on Live",
      });
      if (yes) dispatch({ type: "batchMode", enabled: false });
    },
  };

  function discardAll() {
    resetDraftHistory();
    dispatch({ type: "batchDiscard" });
    for (const layer of lightingLayers(latest.current).keys()) dispatch({ type: "draftReset", target: layer });
    dispatch({ type: "conditionalDraftReset" });
  }
}

export type Draft = ReturnType<typeof useDraft>;
