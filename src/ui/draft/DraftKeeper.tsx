// What the draft does on its own, mounted once per workbench:
// - keeps it in this browser for the keyboard (by serial), so closing the tab
//   or losing the connection loses nothing, and offers it back next time;
// - asks before the page closes while changes are not on the keyboard;
// - in Live mode, sends lighting once the painting pauses (a scene is written
//   whole, so not on every stroke).

import { useEffect, useRef } from "react";
import { readSetting, SETTING_KEYS, writeSetting } from "../settings";
import { useWorkbench } from "../state";
import { draftSnapshot, lightingLayers, parseStoredDraft } from "./changes";
import { earlierDraft, setEarlier } from "./earlier";
import { useDraft } from "./useDraft";

const LIVE_LIGHTING_PAUSE_MS = 900;

export function DraftKeeper() {
  const { bundle, state } = useWorkbench();
  const draft = useDraft();
  const key = SETTING_KEYS.draft(bundle.info.serial_number);
  const offered = useRef(false);

  // On connect: offer a draft kept from before, unless this one already has changes.
  useEffect(() => {
    if (draft.offline || offered.current) return;
    offered.current = true;
    const kept = parseStoredDraft(readSetting(key));
    setEarlier(kept && kept.size > 0 && draft.size === 0 ? kept : null);
    return () => setEarlier(null);
    // Once per keyboard.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Keep the draft for this keyboard, a moment after each change.
  useEffect(() => {
    if (draft.offline || earlierDraft.get()) return;
    const timer = setTimeout(() => {
      const snapshot = draftSnapshot(state);
      writeSetting(key, snapshot ? JSON.stringify(snapshot) : "");
    }, 400);
    return () => clearTimeout(timer);
  }, [state, key, draft.offline]);

  // Ask before closing the page with changes not on the keyboard.
  useEffect(() => {
    if (draft.offline || draft.size === 0) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [draft.offline, draft.size]);

  // Live: lighting goes to the keyboard once painting pauses.
  const lightingChanged = draft.live ? lightingLayers(state).size : 0;
  useEffect(() => {
    if (draft.offline || !draft.live || lightingChanged === 0 || state.lightingBusy) return;
    const timer = setTimeout(() => void draft.sendLighting(), LIVE_LIGHTING_PAUSE_MS);
    return () => clearTimeout(timer);
    // The latest draft is read when the timer fires.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.offline, draft.live, lightingChanged, state.layerDrafts, state.lightingBusy]);

  return null;
}
