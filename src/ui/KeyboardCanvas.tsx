// The shared SVG keyboard canvas — rendered purely from a KeyboardModel.
// All geometry is in key-units; the viewBox does the scaling, so the canvas
// is resize-aware for free. Rotation follows the wire semantics (rmk-config
// layout.rs walk()): rect.x/y is the final visual center and r is clockwise
// degrees about the main rect's center, matching the model's keyCorners.
//
// Keys are drawn as GLIDE draws them: a cap with a top-to-bottom gradient, a
// thin highlight on top, a shadow along the bottom edge and a soft drop shadow,
// on a dot-grid canvas. Rendering is layered board-wide, not per-key: cap
// shapes, then rings, then a dedicated label pass. Keys on real boards may abut or even
// overlap slightly (Glove80 thumb clusters), so labels must never be painted
// over by a neighbouring cap drawn later.

import { memo, useCallback, useEffect, useMemo, useRef } from "react";
import type {
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
  SVGProps,
} from "react";
import type { Encoder, Key, Rect } from "../vendor/rynk-wasm/rynk_wasm";
import type { KeyboardModel, KeyView, PointingDeviceView } from "../model/keyboard";
import type { KeyGlyph } from "./labels";
import { keyHoverTitle } from "./key-address";
import { same } from "../model/deep-equal";
import { cx } from "./kit";

export interface KeyDecor {
  glyph?: KeyGlyph;
  /** Accessible description of the key and its current action. */
  ariaLabel?: string;
  ariaKeyShortcuts?: string;
  /** Per-key lighting color (CSS), rendered as a flat cap fill. */
  fill?: string;
  /** Device-wide base lighting, rendered across the full cap below labels. */
  backgroundFill?: string;
  fillAnim?: {
    name: "led-blink" | "led-breathe";
    periodMs: number;
    delayMs?: number;
  };
  staged?: boolean;
  selected?: boolean;
  pending?: boolean;
  error?: boolean;
  /** Zone-hover emphasis. */
  highlight?: boolean;
  /** Member of the current bulk selection. */
  inSelection?: boolean;
  /** Not paintable / not interactive right now. */
  disabled?: boolean;
  /** Bump to replay the paint pop animation. */
  popNonce?: number;
}

export interface EncoderDecor {
  selected?: boolean;
  staged?: boolean;
  pending?: boolean;
  error?: boolean;
  label?: string;
}

export interface PointingDeviceDecor {
  selected?: boolean;
  staged?: boolean;
  mode?: string;
}

export interface KeyboardCanvasProps {
  model: KeyboardModel;
  decorFor: (key: KeyView) => KeyDecor;
  encoderDecorFor?: (enc: Encoder) => EncoderDecor;
  pointingDeviceDecorFor?: (device: PointingDeviceView) => PointingDeviceDecor;
  onKeyPointerDown?: (key: KeyView, ev: ReactPointerEvent) => void;
  onKeyPointerEnter?: (key: KeyView, ev: ReactPointerEvent) => void;
  onKeyKeyboardActivate?: (key: KeyView, ev: ReactKeyboardEvent) => void;
  onKeyFocus?: (key: KeyView) => void;
  /** Pointer drag gesture. Callers define the operation (keymap uses move). */
  onKeyDrop?: (source: KeyView, destination: KeyView) => void;
  onKeyDragChange?: (
    source: KeyView | null,
    destination: KeyView | null,
  ) => void;
  keyDraggable?: (key: KeyView) => boolean;
  onEncoderPointerDown?: (enc: Encoder) => void;
  onPointingDeviceActivate?: (device: PointingDeviceView) => void;
  onBackgroundPointerDown?: () => void;
  interactive?: boolean;
  className?: string;
}

// GLIDE's proportions: a 62 px key on a 70 px pitch, 6 px corners.
const CORNER = 0.086;
const CAP_DROP = 0.05; // room below the board for the drop shadow
const CAP_INSET = 0.057; // half the gap between abutting caps

/** Shared paint servers, defined once per canvas (identical in every canvas,
 *  so a duplicate id resolves to the same look). */
const CAP_GRADIENT = "rb-cap-gradient";
const CAP_RELIEF = "rb-cap-relief";
const CAP_SHADOW = "rb-cap-shadow";

function CapDefs() {
  return (
    <defs>
      <linearGradient id={CAP_GRADIENT} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" style={{ stopColor: "var(--color-cap)" }} />
        <stop offset="1" style={{ stopColor: "var(--color-cap-low)" }} />
      </linearGradient>
      {/* the highlight along the top edge and the shadow along the bottom */}
      <linearGradient id={CAP_RELIEF} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#fff" stopOpacity="0.08" />
        <stop offset="0.035" stopColor="#fff" stopOpacity="0" />
        <stop offset="0.94" style={{ stopColor: "var(--color-cap-shadow)" }} stopOpacity="0" />
        <stop offset="1" style={{ stopColor: "var(--color-cap-shadow)" }} />
      </linearGradient>
      <filter id={CAP_SHADOW} x="-20%" y="-20%" width="140%" height="150%">
        <feDropShadow dx="0" dy="0.043" stdDeviation="0.036" style={{ floodColor: "var(--color-cap-shadow)" }} />
      </filter>
    </defs>
  );
}
const VIEW_PAD = 0.42;

/** Board viewBox in key-units (keys + encoders + breathing room). */
export function boardViewBox(model: KeyboardModel): {
  x: number;
  y: number;
  w: number;
  h: number;
} {
  let { minX, minY, maxX, maxY } = model.bounds;
  for (const enc of model.encoders) {
    minX = Math.min(minX, enc.x - 0.55);
    minY = Math.min(minY, enc.y - 0.55);
    maxX = Math.max(maxX, enc.x + 0.55);
    maxY = Math.max(maxY, enc.y + 0.55);
  }
  return {
    x: minX - VIEW_PAD,
    y: minY - VIEW_PAD,
    w: maxX - minX + VIEW_PAD * 2,
    h: maxY - minY + VIEW_PAD * 2 + CAP_DROP,
  };
}

/* ------------------------------------------------------------------ */
/* Fit-to-container well                                               */
/* ------------------------------------------------------------------ */

/** Largest comfortable key pitch, in CSS px per key-unit. */
const MAX_PITCH = 64;
const WELL_PAD = 20; // matches p-5

/**
 * The recessed board well, sized to hug the board: fills the available
 * space (both axes considered) but never scales keys past MAX_PITCH, so
 * large boards shrink to fit and small boards don't balloon.
 */
export function BoardWell({
  model,
  className,
  children,
}: {
  model: KeyboardModel;
  className?: string;
  children: ReactNode;
}) {
  const vb = boardViewBox(model);
  const ratio = vb.w / vb.h;
  const capPx = Math.round(vb.w * MAX_PITCH) + WELL_PAD * 2;
  return (
    <div
      className={cx("relative min-h-0 w-full flex-1", className)}
      style={{ containerType: "size" }}
    >
      <div
        className="canvas-well absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-line-soft p-5"
        style={{
          width: `min(100cqw, ${capPx}px, 100cqh * ${ratio.toFixed(4)})`,
          aspectRatio: `${vb.w.toFixed(3)} / ${vb.h.toFixed(3)}`,
          maxWidth: "100%",
        }}
      >
        {children}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Key rendering                                                       */
/* ------------------------------------------------------------------ */

function rectAttrs(rect: Rect, inset = 0, dy = 0) {
  return {
    x: rect.x - rect.w / 2 + inset,
    y: rect.y - rect.h / 2 + inset + dy,
    width: rect.w - inset * 2,
    height: rect.h - inset * 2,
  };
}

function KeyRects({
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
function fitText(text: string, capWidth: number, max: number): number {
  const len = Math.max(1, [...text].length);
  return Math.min(max, ((capWidth - 0.16) / len) * 1.5);
}

/** KeyDecor is a flat bag of values; comparing every key of both objects keeps
 *  this honest as the type grows, instead of a hand-written field list that
 *  silently stops covering it. */
function sameDecor(a: KeyDecor, b: KeyDecor): boolean {
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)]) as Set<keyof KeyDecor>) {
    if (!same(a[key], b[key])) return false;
  }
  return true;
}

/** Every key is rendered three times per paint (cap, ring, label), and a paint
 *  step rebuilds each decor object. Decor is therefore compared by value and
 *  everything else — including the canvas's own, deliberately stable handlers —
 *  by identity. */
function samePropsWithDecor<P extends { decor: KeyDecor }>(a: P, b: P): boolean {
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
function useLatestHandler<A extends unknown[], R>(
  handler: ((...args: A) => R) | undefined,
): ((...args: A) => R | undefined) | undefined {
  const latest = useRef(handler);
  useEffect(() => {
    latest.current = handler;
  });
  const stable = useCallback((...args: A) => latest.current?.(...args), []);
  return handler === undefined ? undefined : stable;
}

const KeyShape = memo(KeyShapeImpl, samePropsWithDecor);
const KeyRing = memo(KeyRingImpl, samePropsWithDecor);
const KeyLabel = memo(KeyLabelImpl, samePropsWithDecor);

function KeyShapeImpl({
  view,
  decor,
  interactive,
  onPointerDown,
  onPointerEnter,
  onKeyboardActivate,
  onFocus,
}: {
  view: KeyView;
  decor: KeyDecor;
  interactive: boolean;
  onPointerDown?: (key: KeyView, ev: ReactPointerEvent) => void;
  onPointerEnter?: (key: KeyView, ev: ReactPointerEvent) => void;
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
        clickable ? (ev) => onPointerEnter?.(view, ev) : undefined
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
          stroke={decor.fill ? "rgb(0 0 0 / 0.72)" : undefined}
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
            stroke={decor.fill ? "rgb(0 0 0 / 0.72)" : undefined}
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

function EncoderShape({
  enc,
  decor,
  interactive,
  onPointerDown,
}: {
  enc: Encoder;
  decor: EncoderDecor;
  interactive: boolean;
  onPointerDown?: (enc: Encoder) => void;
}) {
  const ticks = Array.from({ length: 12 }, (_, i) => (i * 360) / 12);
  return (
    <g
      className={`key-group${interactive ? "" : " key-static"}`}
      onPointerDown={interactive ? () => onPointerDown?.(enc) : undefined}
    >
      <circle
        cx={enc.x}
        cy={enc.y + CAP_DROP}
        r={0.42}
        fill="var(--color-cap-side)"
      />
      <circle
        cx={enc.x}
        cy={enc.y}
        r={0.42}
        fill="var(--color-cap)"
        stroke={
          decor.error
            ? "var(--color-danger)"
            : decor.staged
              ? "var(--color-accent-deep)"
              : "var(--color-cap-edge)"
        }
        strokeWidth={decor.staged || decor.error ? 0.05 : 0.028}
        strokeDasharray={decor.staged && !decor.error ? "0.1 0.07" : undefined}
      />
      {ticks.map((t) => (
        <line
          key={t}
          x1={enc.x + 0.31 * Math.cos((t * Math.PI) / 180)}
          y1={enc.y + 0.31 * Math.sin((t * Math.PI) / 180)}
          x2={enc.x + 0.38 * Math.cos((t * Math.PI) / 180)}
          y2={enc.y + 0.38 * Math.sin((t * Math.PI) / 180)}
          stroke="var(--color-cap-edge)"
          strokeWidth={0.022}
        />
      ))}
      <text
        x={enc.x}
        y={enc.y}
        fontSize={0.2}
        textAnchor="middle"
        dominantBaseline="central"
        fill="var(--color-mute)"
        style={{ userSelect: "none", pointerEvents: "none" }}
        fontFamily="var(--font-mono)"
      >
        {decor.label ?? `E${enc.id}`}
      </text>
      {decor.selected && (
        <>
          <circle
            cx={enc.x}
            cy={enc.y}
            r={0.52}
            fill="none"
            stroke="var(--color-accent)"
            strokeOpacity={0.22}
            strokeWidth={0.13}
          />
          <circle
            cx={enc.x}
            cy={enc.y}
            r={0.49}
            fill="none"
            stroke="var(--color-accent)"
            strokeWidth={0.045}
          />
        </>
      )}
      {(decor.pending || decor.error) && (
        <circle
          cx={enc.x + 0.3}
          cy={enc.y - 0.3}
          r={0.085}
          fill={decor.error ? "var(--color-danger)" : "var(--color-accent)"}
          className={decor.pending ? "animate-pulse" : undefined}
        />
      )}
    </g>
  );
}

function PointingDeviceShape({
  device,
  decor,
  interactive,
  onActivate,
}: {
  device: PointingDeviceView;
  decor: PointingDeviceDecor;
  interactive: boolean;
  onActivate?: (device: PointingDeviceView) => void;
}) {
  const activate = () => onActivate?.(device);
  return (
    <g
      data-pointing-device-id={device.id}
      className={`key-group${interactive ? "" : " key-static"}`}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-label={interactive ? `Edit ${device.label}` : device.label}
      onClick={interactive ? activate : undefined}
      onKeyDown={
        interactive
          ? (event) => {
              if (event.key !== "Enter" && event.key !== " ") return;
              event.preventDefault();
              activate();
            }
          : undefined
      }
    >
      <circle
        cx={device.x}
        cy={device.y + CAP_DROP}
        r={device.radius}
        fill="var(--color-cap-side)"
      />
      <circle
        cx={device.x}
        cy={device.y}
        r={device.radius}
        fill="var(--color-well)"
        stroke={decor.selected || decor.staged ? "var(--color-accent)" : "var(--color-cap-edge)"}
        strokeWidth={decor.selected || decor.staged ? 0.055 : 0.035}
        strokeDasharray={decor.staged && !decor.selected ? "0.12 0.08" : undefined}
      />
      {[0.72, 0.46].map((scale) => (
        <circle
          key={scale}
          cx={device.x}
          cy={device.y}
          r={device.radius * scale}
          fill="none"
          stroke="var(--color-line-soft)"
          strokeWidth={0.025}
          pointerEvents="none"
        />
      ))}
      <text
        x={device.x}
        y={device.y - 0.14}
        fontSize={0.145}
        textAnchor="middle"
        dominantBaseline="central"
        fill="var(--color-faint)"
        fontFamily="var(--font-sans)"
        fontWeight={600}
        letterSpacing={0.025}
        style={{ userSelect: "none", pointerEvents: "none" }}
      >
        {device.label.toUpperCase()}
      </text>
      {decor.mode && (
        <text
          x={device.x}
          y={device.y + 0.17}
          fontSize={0.23}
          textAnchor="middle"
          dominantBaseline="central"
          fill={decor.selected ? "var(--color-accent)" : "var(--color-mute)"}
          fontFamily="var(--font-mono)"
          style={{ userSelect: "none", pointerEvents: "none" }}
        >
          {decor.mode}
        </text>
      )}
      {decor.selected && (
        <circle
          cx={device.x}
          cy={device.y}
          r={device.radius + 0.1}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth={0.045}
        />
      )}
    </g>
  );
}

export function KeyboardCanvas({
  model,
  decorFor,
  encoderDecorFor,
  pointingDeviceDecorFor,
  onKeyPointerDown,
  onKeyPointerEnter,
  onKeyKeyboardActivate,
  onKeyFocus,
  onKeyDrop,
  onKeyDragChange,
  keyDraggable,
  onEncoderPointerDown,
  onPointingDeviceActivate,
  onBackgroundPointerDown,
  interactive = true,
  className,
}: KeyboardCanvasProps) {
  const vb = boardViewBox(model);
  const viewBox = `${vb.x} ${vb.y} ${vb.w} ${vb.h}`;
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    source: KeyView;
    destination: KeyView | null;
    started: boolean;
  } | null>(null);

  const keyAtPoint = (clientX: number, clientY: number): KeyView | null => {
    const element = document
      .elementFromPoint(clientX, clientY)
      ?.closest<SVGGElement>("[data-key-row][data-key-col]");
    if (!element || !svgRef.current?.contains(element)) return null;
    const row = Number(element.dataset.keyRow);
    const col = Number(element.dataset.keyCol);
    return model.keys.find((key) => key.row === row && key.col === col) ?? null;
  };

  const finishDrag = (pointerId: number, cancelled: boolean) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== pointerId) return;
    dragRef.current = null;
    if (svgRef.current?.hasPointerCapture(pointerId)) {
      svgRef.current.releasePointerCapture(pointerId);
    }
    if (!cancelled && drag.started && drag.destination) {
      onKeyDrop?.(drag.source, drag.destination);
    }
    onKeyDragChange?.(null, null);
  };

  const keyPointerDown = useLatestHandler(onKeyPointerDown);
  const keyPointerEnter = useLatestHandler(onKeyPointerEnter);
  const keyKeyboardActivate = useLatestHandler(onKeyKeyboardActivate);
  const keyFocus = useLatestHandler(onKeyFocus);
  const draggable = useLatestHandler(keyDraggable);
  const dragSupported = onKeyDrop !== undefined;
  const beginKeyDrag = useCallback(
    (view: KeyView, ev: ReactPointerEvent) => {
      keyPointerDown?.(view, ev);
      if (!dragSupported || ev.button !== 0 || draggable?.(view) === false) return;
      dragRef.current = {
        pointerId: ev.pointerId,
        startX: ev.clientX,
        startY: ev.clientY,
        source: view,
        destination: null,
        started: false,
      };
      svgRef.current?.setPointerCapture(ev.pointerId);
    },
    [dragSupported, draggable, keyPointerDown],
  );

  const decorated = useMemo(
    () => model.keys.map((key) => ({ key, decor: decorFor(key) })),
    [model.keys, decorFor],
  );

  return (
    <svg
      ref={svgRef}
      viewBox={viewBox}
      className={className}
      style={{ touchAction: "none", display: "block" }}
      preserveAspectRatio="xMidYMid meet"
      onPointerDown={(ev) => {
        if (ev.target === ev.currentTarget) onBackgroundPointerDown?.();
      }}
      onPointerMove={(ev) => {
        const drag = dragRef.current;
        if (!drag || drag.pointerId !== ev.pointerId) return;
        if (
          !drag.started &&
          Math.hypot(ev.clientX - drag.startX, ev.clientY - drag.startY) < 6
        ) {
          return;
        }
        drag.started = true;
        ev.preventDefault();
        const candidate = keyAtPoint(ev.clientX, ev.clientY);
        const destination =
          candidate &&
          (candidate.row !== drag.source.row ||
            candidate.col !== drag.source.col)
            ? candidate
            : null;
        if (
          destination?.row !== drag.destination?.row ||
          destination?.col !== drag.destination?.col
        ) {
          drag.destination = destination;
          onKeyDragChange?.(drag.source, destination);
        }
      }}
      onPointerUp={(ev) => finishDrag(ev.pointerId, false)}
      onPointerCancel={(ev) => finishDrag(ev.pointerId, true)}
    >
      <CapDefs />

      {decorated.map(({ key, decor }) => (
        <KeyShape
          key={`${key.row},${key.col}`}
          view={key}
          decor={decor}
          interactive={interactive}
          onPointerDown={beginKeyDrag}
          onPointerEnter={keyPointerEnter}
          onKeyboardActivate={keyKeyboardActivate}
          onFocus={keyFocus}
        />
      ))}

      {/* ring pass — selection/highlight rings above every cap, under labels */}
      {decorated.map(({ key, decor }) => (
        <KeyRing key={`ring:${key.row},${key.col}`} view={key} decor={decor} />
      ))}

      {/* label pass — always above every cap */}
      {decorated.map(({ key, decor }) => (
        <KeyLabel key={`l${key.row},${key.col}`} view={key} decor={decor} />
      ))}

      {model.encoders.map((enc) => (
        <EncoderShape
          key={enc.id}
          enc={enc}
          decor={encoderDecorFor?.(enc) ?? {}}
          interactive={interactive}
          onPointerDown={onEncoderPointerDown}
        />
      ))}

      {model.pointingDevices.map((device) => (
        <PointingDeviceShape
          key={device.id}
          device={device}
          decor={pointingDeviceDecorFor?.(device) ?? {}}
          interactive={interactive && onPointingDeviceActivate !== undefined}
          onActivate={onPointingDeviceActivate}
        />
      ))}
    </svg>
  );
}
