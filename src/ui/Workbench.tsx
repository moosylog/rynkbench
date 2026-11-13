// The workbench, laid out as GLIDE's main screen: the top bar (files, the
// other screens, history, settings), the side panel of layers and combos, and
// the keymap; the other screens open in its place with their own tabs.

import { useCallback, useEffect, useMemo, useReducer, useRef, useState, useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import type { ConnectedBundle } from "./state";
import {
  WorkbenchContext,
  canTravelKeyEditHistory,
  hasPendingConfigurationWrite,
  initialWorkbenchState,
  ioFeaturesFor,
  makeIo,
  makeWorkbenchReducer,
  useWorkbench,
} from "./state";
import { TopBar } from "./TopBar";
import { KeymapCenter, KeymapInspector } from "./keymap/KeymapMode";
import { KeyEditor } from "./keymap/KeyEditor";
import { useCapabilities } from "./use-capabilities";
import { LightingMode } from "./lighting/LightingMode";
import { EffectsMode } from "./effects/EffectsMode";
import { LiveMode } from "./live/LiveMode";
import { AdvancedSection } from "./advanced/AdvancedMode";
import { ProfilesMode } from "./ProfilesMode";
import { DeviceMode } from "./device/DeviceMode";
import { SidePanel } from "./sidepanel/SidePanel";
import { InspectorShell, cx } from "./kit";
import { historyShortcut, keyEditHistoryLabel } from "../model/history";
import { firmwareFactsOf, resolveCapabilities } from "../capabilities";
import { useTerms } from "./terms";
import { getLocaleId, subscribeLocale } from "./locale";
import { areaOfSection, areasFor, sectionTerm, type Area, type AreaId, type SectionId } from "./areas";
import { DocumentTransferContext, useDocumentTransfer } from "./transfer-actions";
import { showToast } from "./messages/store";
/** The sections of the current area, when it has more than one. */
function SectionTabs({
  sections,
  current,
  onSection,
}: {
  sections: SectionId[];
  current: SectionId;
  onSection: (section: SectionId) => void;
}) {
  const term = useTerms();
  if (sections.length < 2) return null;
  return (
    <div
      role="tablist"
      aria-label="Sections"
      className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-line-soft bg-bg px-4"
    >
      {sections.map((section) => {
        const active = section === current;
        return (
          <button
            key={section}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onSection(section)}
            className={cx(
              "relative shrink-0 cursor-pointer whitespace-nowrap px-3 py-2.5 text-ui font-medium transition-colors duration-150",
              active ? "text-ink" : "text-faint hover:text-mute",
            )}
          >
            {term(sectionTerm(section))}
            {active && <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-accent" />}
          </button>
        );
      })}
    </div>
  );
}

/** The keymap, as GLIDE lays it out: the keyboard, the key editor below it.
 *  Trackpads, encoders and the layer's pointing settings keep a side panel. */
function KeymapScreen() {
  const { state } = useWorkbench();
  const capabilities = useCapabilities();
  const selected = state.selection?.type;
  const side = selected === "encoder" || selected === "pointing" || (!selected && capabilities.has("pointing"));
  return (
    <>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
        <KeymapCenter />
        {selected !== "encoder" && selected !== "pointing" && <KeyEditor />}
      </div>
      {side && (
        <InspectorShell>
          <KeymapInspector />
        </InspectorShell>
      )}
    </>
  );
}

/** One section's screen. */
function SectionView({ section }: { section: SectionId }) {
  switch (section) {
    case "keymap":
      return <KeymapScreen />;
    case "combos":
    case "morse":
    case "macros":
    case "forks":
    case "behavior":
    case "transforms":
    case "usage":
      return <AdvancedSection section={section} />;
    case "profiles":
      return <ProfilesMode />;
    case "lighting":
      return <LightingMode />;
    case "effects":
      return <EffectsMode />;
    case "device":
      return <DeviceMode />;
    case "live":
      return <LiveMode />;
  }
}

/** Shares the workbench's one document transfer with the top bar's Open, Save and name. */
function DocumentTransferProvider({ children }: { children: ReactNode }) {
  const transfer = useDocumentTransfer();
  return <DocumentTransferContext value={transfer}>{children}</DocumentTransferContext>;
}

export function Workbench({
  bundle,
  onClose,
  onUnexpectedDisconnect,
}: {
  bundle: ConnectedBundle;
  onClose: () => void;
  onUnexpectedDisconnect: (session: ConnectedBundle["session"]) => void;
}) {
  const reducer = useMemo(
    () => makeWorkbenchReducer(bundle.caps.num_cols),
    [bundle.caps.num_cols],
  );
  const [state, dispatch] = useReducer(reducer, bundle, initialWorkbenchState);

  // Key labels everywhere derive from the active OS locale; re-render the
  // whole workbench when the TopBar selector changes it.
  useSyncExternalStore(subscribeLocale, getLocaleId);

  // The areas and their sections come from what the keyboard and the session
  // offer (src/ui/areas.ts).
  const capabilities = useMemo(() => resolveCapabilities(firmwareFactsOf(bundle)), [bundle]);
  const areas = useMemo(
    () =>
      areasFor({
        connected: bundle.session.kind !== "offline",
        combos: bundle.caps.max_combos > 0,
        morse: bundle.caps.max_morse > 0,
        macros: bundle.caps.macro_space_size > 0,
        forks: bundle.caps.max_forks > 0,
        tapProfiles: bundle.morseProfileCapacity > 0,
        lighting: capabilities.has("lighting.state"),
        effects: capabilities.has("lighting.extension"),
      }),
    [bundle, capabilities],
  );
  // A section the board does not offer (a link from elsewhere) falls back to
  // the keymap, which every board has.
  const currentArea = areaOfSection(areas, state.mode);
  const section: SectionId = currentArea ? state.mode : "keymap";
  const area = currentArea ?? areas[0];
  // The phone's side-panel drawer.
  const [drawer, setDrawer] = useState(false);
  // Each area remembers the section last shown in it.
  const lastSection = useRef<Partial<Record<AreaId, SectionId>>>({});
  useEffect(() => {
    lastSection.current[area.id] = section;
  }, [area.id, section]);
  const showArea = (next: Area) => {
    const remembered = lastSection.current[next.id];
    const target = remembered && next.sections.includes(remembered) ? remembered : next.sections[0];
    dispatch({ type: "mode", mode: target });
  };

  const stateRef = useRef(state);
  stateRef.current = state;

  // The bundle is an immutable connect-time snapshot, so it is the whole
  // dependency: every feature flag derives from it.
  const io = useMemo(
    () =>
      makeIo(bundle.session, () => stateRef.current, dispatch, {
        cols: bundle.caps.num_cols,
        onDisconnect: onClose,
        features: ioFeaturesFor(bundle),
      }),
    [bundle, onClose],
  );

  // Undo and redo say what they did, with the way back on the toast.
  const travel = useCallback(
    async (direction: "undo" | "redo"): Promise<void> => {
      const entry =
        direction === "undo"
          ? stateRef.current.keyEditHistory.past.at(-1)
          : stateRef.current.keyEditHistory.future.at(-1);
      const result = direction === "undo" ? await io.undoKeyEdit() : await io.redoKeyEdit();
      if (!result.ok) return;
      const label = entry ? keyEditHistoryLabel(entry) : "key edit";
      const back = direction === "undo" ? "redo" : "undo";
      showToast(`${direction === "undo" ? "Undone" : "Redone"}: ${label}`, {
        action: {
          label: back === "undo" ? "Undo" : "Redo",
          run: () => {
            if (canTravelKeyEditHistory(stateRef.current, back)) void travel(back);
          },
        },
      });
    },
    [io],
  );

  const historyBusy = hasPendingConfigurationWrite(state);
  const historyOperation = state.keyEditHistory.operation;
  const undoEntry = state.keyEditHistory.past.at(-1);
  const redoEntry = state.keyEditHistory.future.at(-1);
  const history = useMemo(
    () => ({
      canUndo: canTravelKeyEditHistory(state, "undo"),
      canRedo: canTravelKeyEditHistory(state, "redo"),
      phase: historyOperation
        ? historyOperation.direction === "undo"
          ? ("undoing" as const)
          : ("redoing" as const)
        : historyBusy
          ? ("writing" as const)
          : ("idle" as const),
      error: state.keyEditHistory.error,
      undoLabel: undoEntry ? keyEditHistoryLabel(undoEntry) : null,
      redoLabel: redoEntry ? keyEditHistoryLabel(redoEntry) : null,
      undo: () => travel("undo"),
      redo: () => travel("redo"),
      clear: () => dispatch({ type: "keyHistoryClear" }),
    }),
    [historyBusy, historyOperation, redoEntry, state, travel, undoEntry],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const shortcut = historyShortcut(event);
      if (!shortcut || !canTravelKeyEditHistory(stateRef.current, shortcut)) return;
      event.preventDefault();
      void travel(shortcut);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [travel]);

  // Server-push topics.
  useEffect(() => {
    bundle.session.onTopic((event) => {
      if ("LayerChange" in event) {
        io.refreshLayerState();
      } else if ("BatteryStatusChange" in event) {
        dispatch({ type: "topicBattery", battery: event.BatteryStatusChange });
      } else if ("ConnectionChange" in event) {
        dispatch({ type: "topicConnection", connection: event.ConnectionChange });
      } else if ("LightingChange" in event) {
        io.refreshLighting();
      } else if ("LedIndicatorChange" in event) {
        dispatch({ type: "topicLedIndicator", indicator: event.LedIndicatorChange });
      } else if ("ModifierChange" in event) {
        dispatch({ type: "topicModifier", modifiers: event.ModifierChange });
      }
    });
    // Subscribe first, then resample state whose topic updates could have
    // landed between the connect snapshot and this handler registration.
    if (bundle.caps.lighting_enabled) {
      io.refreshLighting();
    }
    // Old firmware rejects this additive endpoint and keeps the matrix
    // fallback.
    bundle.session.device.modifierState().then(
      (modifiers) => dispatch({ type: "topicModifier", modifiers }),
      () => {},
    );
    bundle.session.onDisconnect(() => onUnexpectedDisconnect(bundle.session));
  }, [bundle.session, bundle.caps.lighting_enabled, io, onUnexpectedDisconnect]);

  const ctx = useMemo(
    () => ({ bundle, state, dispatch, io, history }),
    [bundle, state, io, history],
  );

  return (
    <WorkbenchContext value={ctx}>
      <DocumentTransferProvider>
      <div className="relative flex h-full flex-col" aria-busy={state.layerBusy}>
        {state.layerBusy && (
          <div
            className="absolute inset-0 z-50 flex items-center justify-center bg-well/70 backdrop-blur-[1px]"
            role="status"
          >
            <div className="rounded-xl border border-line bg-panel px-4 py-3 text-ui text-ink shadow-lg">
              Rewriting and verifying layers on the keyboard…
            </div>
          </div>
        )}
        <TopBar
          areas={areas}
          current={area.id}
          onArea={showArea}
          onDrawer={section === "keymap" ? () => setDrawer(true) : undefined}
        />
        <div className="flex min-h-0 flex-1">
          {section === "keymap" && (
            <div className="max-sm:hidden">
              <SidePanel />
            </div>
          )}
          {section === "keymap" && drawer && (
            <div className="fixed inset-0 z-[60] sm:hidden" onClick={() => setDrawer(false)}>
              <div className="absolute inset-0 bg-well/70" />
              <div className="absolute inset-y-0 left-0 w-[86vw] max-w-sm shadow-2xl" onClick={(e) => e.stopPropagation()}>
                <SidePanel onPicked={() => setDrawer(false)} />
              </div>
            </div>
          )}
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <SectionTabs
              sections={area.sections}
              current={section}
              onSection={(mode) => dispatch({ type: "mode", mode })}
            />
            <main className="flex min-h-0 flex-1 gap-4 p-4 max-lg:flex-col max-lg:overflow-y-auto max-sm:p-2">
              <SectionView section={section} />
            </main>
          </div>
        </div>
      </div>
      </DocumentTransferProvider>
    </WorkbenchContext>
  );
}
