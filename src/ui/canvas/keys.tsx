// Drawing one key, as GLIDE draws it: a cap with a top-to-bottom gradient, a thin
// highlight on top, a shadow along the bottom edge and a soft drop shadow. Cap,
// ring and label are separate passes (see KeyboardCanvas.tsx), each memoized on
// the key's decoration.

import { memo } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent, SVGProps } from "react";
import type { Key, Rect } from "../../model/keyboard";
import type { KeyView } from "../../model/keyboard";

import { keyHoverTitle } from "../key-address";
import { same } from "../../model/deep-equal";

import type { KeyDecor } from "./decor";
import { CORNER, CAP_INSET, CAP_GRADIENT, CAP_RELIEF, CAP_SHADOW } from "./geometry";

export function CapDefs() {
  return (
    <defs>
      <linearGradient id={CAP_GRADIENT} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" style={{ stopColor: "var(--color-cap)" }} />
        <stop offset="1" style={{ stopColor: "var(--color-cap-low)" }} />
      </linearGradient>
      {/* the highlight along the top edge and the shadow along the bottom */}
      <linearGradient id={CAP_RELIEF} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" style={{ stopColor: "var(--color-cap-sheen)" }} />
        <stop offset="0.035" style={{ stopColor: "var(--color-cap-sheen)" }} stopOpacity="0" />
        <stop offset="0.94" style={{ stopColor: "var(--color-cap-shadow)" }} stopOpacity="0" />
        <stop offset="1" style={{ stopColor: "var(--color-cap-shadow)" }} />
      </linearGradient>
      <filter id={CAP_SHADOW} x="-20%" y="-20%" width="140%" height="150%">
        <feDropShadow dx="0" dy="0.043" stdDeviation="0.036" style={{ floodColor: "var(--color-cap-shadow)" }} />
      </filter>
    </defs>
  );
}

/* ------------------------------------------------------------------ */
/* Key rendering                                                       */
/* ------------------------------------------------------------------ */

export function rectAttrs(rect: Rect, inset = 0, dy = 0) {
  return {
    x: rect.x - rect.w / 2 + inset,
    y: rect.y - rect.h / 2 + inset + dy,
    width: rect.w - inset * 2,
    height: rect.h - inset * 2,
  };
}

export function KeyRects({
  shape,
  inset = 0,
  dy = 0,
  rx = CORNER,
  ...rest
}: {
  shape: Key;
  inset?: number;
  dy?: number;
  rx?: number;
} & SVGProps<SVGRectElement>) {
  const rects = shape.rect2 ? [shape.rect, shape.rect2] : [shape.rect];
  return (
    <>
      {rects.map((r, i) => (
        <rect key={i} {...rectAttrs(r, inset, dy)} rx={rx} {...rest} />
      ))}
    </>
  );
}

/** Fit label size to the available cap width — labels must never clip. */
export function fitText(text: string, capWidth: number, max: number): number {
  const len = Math.max(1, [...text].length);
  return Math.min(max, ((capWidth - 0.16) / len) * 1.5);
}

/** KeyDecor is a flat bag of values; comparing every key of both objects keeps
 *  this honest as the type grows, instead of a hand-written field list that
 *  silently stops covering it. */
export function sameDecor(a: KeyDecor, b: KeyDecor): boolean {
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)]) as Set<keyof KeyDecor>) {
    if (!same(a[key], b[key])) return false;
  }
  return true;
}

/** Every key is rendered three times per paint (cap, ring, label), and a paint
 *  step rebuilds each decor object. Decor is therefore compared by value and
 *  everything else — including the canvas's own, deliberately stable handlers —
 *  by identity. */
export function samePropsWithDecor<P extends { decor: KeyDecor }>(a: P, b: P): boolean {
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)]) as Set<keyof P>) {
    if (key !== "decor" && !Object.is(a[key], b[key])) return false;
  }
  return sameDecor(a.decor, b.decor);
}

/** A handler with a stable identity that always calls the caller's latest one.
 *  Callers pass inline closures over live state; without this the memoized key
 *  components would either re-render every paint or hold a stale closure.
 *  `undefined` is preserved, since it is how the canvas advertises that a
 *  gesture is unsupported. */
export const KeyShape = memo(KeyShapeImpl, samePropsWithDecor);
export const KeyRing = memo(KeyRingImpl, samePropsWithDecor);
export const KeyLabel = memo(KeyLabelImpl, samePropsWithDecor);

function KeyShapeImpl({
  view,
  decor,
  interactive,
  onPointerDown,
  onPointerEnter,
  onContextMenu,
  onHover,
  onKeyboardActivate,
  onFocus,
}: {
  view: KeyView;
  decor: KeyDecor;
  interactive: boolean;
  onPointerDown?: (key: KeyView, ev: ReactPointerEvent) => void;
  onPointerEnter?: (key: KeyView, ev: ReactPointerEvent) => void;
  onContextMenu?: (key: KeyView, ev: ReactMouseEvent) => void;
  onHover?: (key: KeyView | null) => void;
  onKeyboardActivate?: (key: KeyView, ev: ReactKeyboardEvent) => void;
  onFocus?: (key: KeyView) => void;
}) {
  const { shape } = view;
  const deg = shape.r;
  const clickable = interactive && !decor.disabled;
  const keyboardInteractive = clickable && onKeyboardActivate !== undefined;

  const hoverTitle = keyHoverTitle({ ...view, label: decor.glyph?.text ?? view.label });

  const capFill = decor.fill ?? decor.backgroundFill ?? `url(#${CAP_GRADIENT})`;

  const anim = decor.fillAnim;
  const fillStyle = anim
    ? {
        animationName: anim.name,
        animationDuration: `${Math.max(200, anim.periodMs)}ms`,
        animationDelay: `${anim.delayMs ?? 0}ms`,
        animationTimingFunction:
          anim.name === "led-breathe" ? "ease-in-out" : "steps(1)",
        animationIterationCount: "infinite" as const,
      }
    : undefined;

  const cx0 = shape.rect.x;
  const cy0 = shape.rect.y;

  return (
    <g
      className={`key-group${clickable ? "" : " key-static"}`}
      data-key-row={view.row}
      data-key-col={view.col}
      transform={`rotate(${deg} ${cx0} ${cy0})`}
      opacity={decor.disabled ? 0.38 : 1}
      role={keyboardInteractive ? "button" : undefined}
      tabIndex={keyboardInteractive ? 0 : undefined}
      aria-label={decor.ariaLabel ?? hoverTitle}
      aria-keyshortcuts={clickable ? decor.ariaKeyShortcuts : undefined}
      onPointerDown={clickable ? (ev) => onPointerDown?.(view, ev) : undefined}
      onPointerEnter={
        clickable
          ? (ev) => {
              onPointerEnter?.(view, ev);
              onHover?.(view);
            }
          : undefined
      }
      onPointerLeave={clickable ? () => onHover?.(null) : undefined}
      onContextMenu={
        clickable && onContextMenu
          ? (ev) => {
              ev.preventDefault();
              onContextMenu(view, ev);
            }
          : undefined
      }
      onFocus={keyboardInteractive ? () => onFocus?.(view) : undefined}
      onKeyDown={
        keyboardInteractive
          ? (ev) => {
              if (ev.key !== "Enter" && ev.key !== " " && ev.key !== "Escape")
                return;
              if (ev.key !== "Escape") ev.preventDefault();
              onKeyboardActivate?.(view, ev);
            }
          : undefined
      }
    >
      <title>{hoverTitle}</title>
      <g
        className="key-lift"
        style={{
          transform: decor.selected ? "translateY(-0.045px)" : undefined,
        }}
      >
        {/* drop shadow */}
        <KeyRects shape={shape} inset={CAP_INSET} fill="var(--color-cap-low)" filter={`url(#${CAP_SHADOW})`} />
        {/* Lighting is deliberately a flat color swatch. Effect timing, when
            present, animates the whole swatch rather than simulating a diode. */}
        <g
          key={decor.popNonce}
          className={decor.fill ? "key-paint-pop" : undefined}
          style={fillStyle}
        >
          <KeyRects
            shape={shape}
            inset={CAP_INSET}
            className="key-cap"
            fill={capFill}
          />
        </g>

        {/* relief: top highlight, bottom shadow */}
        <KeyRects shape={shape} inset={CAP_INSET} fill={`url(#${CAP_RELIEF})`} style={{ pointerEvents: "none" }} />
        {/* edge */}
        <KeyRects
          shape={shape}
          inset={CAP_INSET}
          fill="none"
          className="key-edge"
          stroke={
            decor.error
              ? "var(--color-danger)"
              : decor.staged
                ? "var(--color-accent-deep)"
                : "var(--color-cap-edge)"
          }
          strokeWidth={decor.staged || decor.error ? 0.05 : 0.016}
          strokeDasharray={
            decor.staged && !decor.error ? "0.1 0.07" : undefined
          }
        />
        {/* pending / error status dot */}
        {(decor.pending || decor.error) && (
          <circle
            cx={shape.rect.x + shape.rect.w / 2 - 0.16}
            cy={shape.rect.y - shape.rect.h / 2 + 0.16}
            r={0.085}
            fill={decor.error ? "var(--color-danger)" : "var(--color-accent)"}
            className={decor.pending ? "animate-pulse" : undefined}
          />
        )}
      </g>
    </g>
  );
}

/**
 * Selection / zone-highlight rings extend outside the cap, so — like labels —
 * they get their own pass above every cap; drawn per-key they'd be painted
 * over by neighbouring caps (thumb fans abut and even overlap).
 */
function KeyRingImpl({ view, decor }: { view: KeyView; decor: KeyDecor }) {
  const { shape } = view;
  if (!decor.selected && !decor.highlight && !decor.inSelection) return null;

  return (
    <g
      transform={`rotate(${shape.r} ${shape.rect.x} ${shape.rect.y})`}
      opacity={decor.disabled ? 0.38 : 1}
      style={{ pointerEvents: "none" }}
    >
      <g
        className="key-lift"
        style={{
          transform: decor.selected ? "translateY(-0.045px)" : undefined,
        }}
      >
        {/* zone hover / bulk selection emphasis */}
        {(decor.highlight || decor.inSelection) && (
          <KeyRects
            shape={shape}
            inset={CAP_INSET - 0.035}
            rx={0.13}
            fill="none"
            stroke="var(--color-select)"
            strokeOpacity={decor.inSelection ? 0.9 : 0.5}
            strokeWidth={0.04}
          />
        )}
        {/* selection ring + soft glow */}
        {decor.selected && (
          <>
            <KeyRects
              shape={shape}
              inset={CAP_INSET - 0.09}
              rx={0.16}
              fill="none"
              stroke="var(--color-select)"
              strokeOpacity={0.22}
              strokeWidth={0.13}
            />
            <KeyRects
              shape={shape}
              inset={CAP_INSET - 0.06}
              rx={0.14}
              fill="none"
              stroke="var(--color-select)"
              strokeWidth={0.045}
            />
          </>
        )}
      </g>
    </g>
  );
}

/**
 * Labels are painted in a pass above every cap. Neighbouring keys can abut
 * or overlap (thumb clusters), and a later cap must never cover an earlier
 * key's legend — "Esc" turning into "sc".
 */
function KeyLabelImpl({ view, decor }: { view: KeyView; decor: KeyDecor }) {
  const { shape } = view;
  const glyph = decor.glyph;
  if (!glyph?.text) return null;

  const deg = shape.r;
  const primarySize = fitText(glyph.text, shape.rect.w, glyph.sub ? 0.26 : 0.3);
  const subSize = glyph.sub ? fitText(glyph.sub, shape.rect.w, 0.185) : 0;
  const cxc = shape.rect.x;
  const cyc = shape.rect.y;

  return (
    <g
      transform={`rotate(${deg} ${cxc} ${cyc})`}
      opacity={decor.disabled ? 0.38 : 1}
      style={{ pointerEvents: "none", userSelect: "none" }}
    >
      <g
        className="key-lift"
        style={{
          transform: decor.selected ? "translateY(-0.045px)" : undefined,
        }}
      >
        <text
          x={cxc}
          y={glyph.sub ? cyc - 0.07 : cyc}
          fontSize={primarySize}
          textAnchor="middle"
          dominantBaseline="central"
          fill={glyph.dim ? "var(--color-cap-ink-dim)" : "var(--color-cap-ink)"}
          stroke={decor.fill ? "var(--color-legend-halo)" : undefined}
          strokeWidth={decor.fill ? 0.045 : undefined}
          paintOrder={decor.fill ? "stroke fill" : undefined}
          strokeLinejoin="round"
          fontFamily="var(--font-sans)"
          fontWeight={500}
        >
          {glyph.text}
        </text>
        {glyph.sub && (
          <text
            x={cxc}
            y={cyc + 0.22}
            fontSize={subSize}
            textAnchor="middle"
            dominantBaseline="central"
            fill="var(--color-mute)"
            stroke={decor.fill ? "var(--color-legend-halo)" : undefined}
            strokeWidth={decor.fill ? 0.035 : undefined}
            paintOrder={decor.fill ? "stroke fill" : undefined}
            strokeLinejoin="round"
            fontFamily="var(--font-sans)"
          >
            {glyph.sub}
          </text>
        )}
      </g>
    </g>
  );
}
