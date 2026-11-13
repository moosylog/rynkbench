// The fields under a chosen light in the Lighting tab: a custom colour and its
// effect, a lock light's lock and two colours, a battery light's level and two
// colours. Every colour is the same ColorChoice.

import type { ReactNode } from "react";
import type { LightingRgb8 } from "../../model/lighting-types";
import { BATTERY_LEVELS, type KeyLight, type Lock } from "../lighting/keyLight";
import type { EffectKind } from "../lighting/effect";
import { ColorChoice } from "../lighting/ColorChoice";
import { cx } from "../kit";
import type { KeyLights } from "./useKeyLights";

const EFFECTS: Array<{ id: EffectKind; label: string }> = [
  { id: "Solid", label: "Steady" },
  { id: "Blink", label: "Blink" },
  { id: "Breathe", label: "Breathe" },
];
const SPEEDS = [
  { id: 500, label: "Fast" },
  { id: 1000, label: "Normal" },
  { id: 2000, label: "Slow" },
];
const LOCKS: Array<{ id: Lock; label: string }> = [
  { id: "caps_lock", label: "Caps Lock" },
  { id: "num_lock", label: "Num Lock" },
  { id: "scroll_lock", label: "Scroll Lock" },
];

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-4">
      <span className="w-20 shrink-0 pt-0.5 text-body text-mute">{label}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

function Segments<T extends string | number>({ options, value, onPick }: {
  options: Array<{ id: T; label: string }>;
  value: T;
  onPick: (id: T) => void;
}) {
  return (
    <div className="inline-flex rounded-lg border border-line-strong p-0.5">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          aria-pressed={value === option.id}
          onClick={() => onPick(option.id)}
          className={cx(
            "cursor-pointer rounded-md px-3 py-1 text-body font-semibold transition-colors",
            value === option.id ? "bg-hover text-ink" : "text-mute hover:text-ink",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function KeyLightFields({ light, lights, onChange }: {
  light: KeyLight;
  lights: KeyLights;
  onChange: (light: KeyLight) => void;
}) {
  const color = (value: LightingRgb8 | null, pick: (next: LightingRgb8 | null) => void, darkTitle?: string) => (
    <ColorChoice
      value={value}
      onPick={pick}
      darkTitle={darkTitle}
      used={lights.yours}
      usage={lights.usage}
      onRecolor={lights.recolor}
    />
  );

  if (light.kind === "color") {
    return (
      <>
        <Field label="Color">{color(light.color, (next) => next && onChange({ ...light, color: next }))}</Field>
        <Field label="Effect">
          <div className="flex flex-wrap items-center gap-2">
            <Segments options={EFFECTS} value={light.effect} onPick={(effect) => onChange({ ...light, effect })} />
            {light.effect !== "Solid" && (
              <Segments
                options={SPEEDS}
                value={light.timing.periodMs}
                onPick={(periodMs) => onChange({ ...light, timing: { ...light.timing, periodMs } })}
              />
            )}
          </div>
        </Field>
      </>
    );
  }
  if (light.kind === "lock") {
    return (
      <>
        <Field label="Lock">
          <Segments options={LOCKS} value={light.lock} onPick={(lock) => onChange({ ...light, lock })} />
        </Field>
        <Field label="When on">{color(light.on, (next) => next && onChange({ ...light, on: next }))}</Field>
        <Field label="When off">{color(light.off, (off) => onChange({ ...light, off }), "Dark while the lock is off")}</Field>
      </>
    );
  }
  if (light.kind === "battery") {
    return (
      <>
        <Field label="Level">
          <Segments
            options={BATTERY_LEVELS.map((level) => ({ id: level as number, label: `${level}%` }))}
            value={light.level}
            onPick={(level) => onChange({ ...light, level })}
          />
        </Field>
        <Field label="Below">{color(light.below, (next) => next && onChange({ ...light, below: next }))}</Field>
        <Field label="Above">{color(light.above, (next) => next && onChange({ ...light, above: next }))}</Field>
      </>
    );
  }
  return null;
}
