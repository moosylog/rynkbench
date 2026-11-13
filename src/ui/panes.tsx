// Resizable panes, as in GLIDE: a handle on a pane's edge to drag, a
// double-click to put it back, and the size remembered in this browser. The
// handle is a separator people can also move with the arrow keys.

import { useCallback, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from "react";
import { cx } from "./kit";

const KEY_STEP = 16;

function stored(key: string): number | null {
  try {
    const value = Number(localStorage.getItem(key));
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

/** A pane size in px, kept between `min` and `max` and remembered under `key`. */
export function usePaneSize(key: string, initial: number, min: number, max: number) {
  const clamp = useCallback((value: number) => Math.round(Math.min(max, Math.max(min, value))), [min, max]);
  const [size, setSizeState] = useState(() => clamp(stored(key) ?? initial));
  const setSize = useCallback(
    (value: number) => {
      const next = clamp(value);
      setSizeState(next);
      try {
        localStorage.setItem(key, String(next));
      } catch {
        // Private modes may refuse storage; the size still applies now.
      }
    },
    [clamp, key],
  );
  return { size, setSize, reset: () => setSize(initial), min, max };
}

/**
 * The handle on a pane's edge. `edge` says which edge it sits on: "right" grows
 * the pane as it moves right (a left side panel); "top" grows it as it moves up
 * (a panel along the bottom).
 */
export function ResizeHandle({
  edge,
  label,
  pane,
}: {
  edge: "right" | "top";
  label: string;
  pane: ReturnType<typeof usePaneSize>;
}) {
  const drag = useRef<{ id: number; start: number; from: number } | null>(null);
  const horizontal = edge === "right";
  const sign = horizontal ? 1 : -1;
  const at = (event: ReactPointerEvent) => (horizontal ? event.clientX : event.clientY);

  return (
    <div
      role="separator"
      tabIndex={0}
      aria-label={label}
      aria-orientation={horizontal ? "vertical" : "horizontal"}
      aria-valuenow={pane.size}
      aria-valuemin={pane.min}
      aria-valuemax={pane.max}
      title={`${label}: drag to resize, double-click to reset`}
      onPointerDown={(event) => {
        drag.current = { id: event.pointerId, start: at(event), from: pane.size };
        event.currentTarget.setPointerCapture(event.pointerId);
        event.preventDefault();
      }}
      onPointerMove={(event) => {
        const current = drag.current;
        if (!current || current.id !== event.pointerId) return;
        pane.setSize(current.from + sign * (at(event) - current.start));
      }}
      onPointerUp={() => (drag.current = null)}
      onPointerCancel={() => (drag.current = null)}
      onDoubleClick={pane.reset}
      onKeyDown={(event: ReactKeyboardEvent) => {
        const grow = horizontal ? "ArrowRight" : "ArrowUp";
        const shrink = horizontal ? "ArrowLeft" : "ArrowDown";
        if (event.key === grow) pane.setSize(pane.size + KEY_STEP);
        else if (event.key === shrink) pane.setSize(pane.size - KEY_STEP);
        else return;
        event.preventDefault();
      }}
      style={{ touchAction: "none" }}
      className={cx(
        "group z-20 flex shrink-0 items-center justify-center outline-none",
        horizontal ? "w-3 self-stretch cursor-col-resize" : "h-3 w-full cursor-row-resize",
      )}
    >
      <span
        className={cx(
          "rounded-full bg-line-strong transition-colors group-hover:bg-accent group-focus-visible:bg-accent",
          horizontal ? "h-14 w-1" : "h-1 w-14",
        )}
      />
    </div>
  );
}
