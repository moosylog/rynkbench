// The panel below the keyboard, as in GLIDE: what is being edited and its
// slots on the left, the tabs that fill the active slot in the middle, the
// tab's content on the right. The key editor and the combo editor share it.

import type { CSSProperties, ReactNode } from "react";
import { cx } from "../kit";
import { CloseIcon, KeymapIcon, LightingIcon, MenuIcon, SettingsIcon } from "../icons";
import type { EditorTab } from "./editorTabs";

const TABS: Record<EditorTab, { label: string; Icon: (props: { size?: number }) => ReactNode }> = {
  pick: { label: "Pick Key", Icon: KeymapIcon },
  layer: { label: "Switch Layer", Icon: MenuIcon },
  lighting: { label: "Lighting", Icon: LightingIcon },
  all: { label: "Every action", Icon: SettingsIcon },
};

/** The panel's frame at its resizable height (a column on narrow screens). */
function Frame({ height, className, children }: { height: number; className: string; children: ReactNode }) {
  return (
    <section
      style={{ "--editor-h": `${height}px` } as CSSProperties}
      className={cx("flex h-(--editor-h) shrink-0 border-t border-line bg-panel max-lg:h-auto", className)}
    >
      {children}
    </section>
  );
}

/** Shown while nothing is selected. */
export function EditorPlaceholder({ height, children }: { height: number; children: ReactNode }) {
  return (
    <Frame height={height} className="min-h-[132px] items-center justify-center px-6 py-8 text-center">
      <p className="text-ui font-semibold text-mute">{children}</p>
    </Frame>
  );
}

export function EditorPanel({
  height,
  side,
  tabs,
  tab,
  onTab,
  children,
}: {
  height: number;
  /** The left column: what is edited and its slots. */
  side: ReactNode;
  tabs: readonly EditorTab[];
  tab: EditorTab;
  onTab: (tab: EditorTab) => void;
  /** The content of the open tab. */
  children: ReactNode;
}) {
  return (
    <Frame height={height} className="min-h-0 overflow-hidden max-lg:flex-col">
      <div className="flex w-[340px] shrink-0 flex-col gap-3 overflow-y-auto border-r border-line p-4 max-lg:w-full max-lg:border-r-0 max-lg:border-b">
        {side}
      </div>
      <div
        role="tablist"
        aria-orientation="vertical"
        className="flex w-[96px] shrink-0 flex-col gap-1.5 border-r border-line p-2 max-lg:w-full max-lg:flex-row max-lg:overflow-x-auto max-lg:border-r-0 max-lg:border-b"
      >
        {tabs.map((id) => {
          const { label, Icon } = TABS[id];
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => onTab(id)}
              className={cx(
                "flex shrink-0 cursor-pointer flex-col items-center gap-1 rounded-xl px-1.5 py-2.5 text-center text-small leading-tight font-semibold transition-colors",
                tab === id ? "bg-accent-fill text-on-accent shadow-lg" : "text-mute hover:bg-hover hover:text-ink",
              )}
            >
              <Icon size={18} />
              {label}
            </button>
          );
        })}
      </div>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto p-4 max-lg:max-h-[420px]">{children}</div>
    </Frame>
  );
}

/** The heading of the left column: a cap with the glyph, a title, a line under it, and Done. */
export function EditorHeading({
  glyph,
  title,
  detail,
  onDone,
  doneLabel,
}: {
  glyph: string;
  title: string;
  detail: ReactNode;
  onDone: () => void;
  doneLabel: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-12 min-w-12 items-center justify-center rounded-lg border-2 border-select bg-cap px-2 font-mono text-title text-cap-ink">
        {glyph || "·"}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-title leading-snug font-semibold text-ink">{title}</div>
        <div className="text-small text-faint">{detail}</div>
      </div>
      <button
        type="button"
        onClick={onDone}
        aria-label={doneLabel}
        title={doneLabel}
        className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-faint hover:bg-hover hover:text-ink"
      >
        <CloseIcon size={11} />
      </button>
    </div>
  );
}
