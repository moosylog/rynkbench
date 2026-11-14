// Effects mode: the firmware's animated effect pack as a first-class view.
// The gallery picks the base effect (and, where the firmware carries a second
// slot, the overlay); the inspector carries palette, brightness, speed and
// whatever parameters the keyboard advertises for each staged effect. The
// draft and its Apply are useEffectsDraft's, shared with Layout properties'
// RGB Effects tab. Every label and range comes from the connected firmware.

import { useMemo, useState } from "react";
import { useWorkbench } from "../state";
import {
  ApplyBar,
  Button,
  Chip,
  ErrorBanner,
  InspectorShell,
  SectionLabel,
  Segmented,
  TextInput,
  cx,
} from "../kit";
import { Slider } from "../lighting/BackgroundPanel";
import { useEffectsDraft, type Slot } from "./useEffectsDraft";

export function NameSelect({
  label,
  names,
  value,
  onChange,
}: {
  label: string;
  names: string[];
  value: number;
  onChange: (index: number) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 text-body text-mute">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="min-w-0 max-w-[60%] rounded-lg border border-line bg-well px-2 py-1 text-body text-ink"
      >
        {names.map((name, index) => (
          <option key={index} value={index}>
            {name}
          </option>
        ))}
      </select>
    </label>
  );
}

/** One effect tile. `assigned` marks the slots this effect currently fills. */
function EffectCard({
  name,
  index,
  selected,
  assigned,
  onClick,
}: {
  name: string;
  index: number | null;
  selected: boolean;
  assigned: Slot[];
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={index === null ? "Leave the overlay slot empty" : `Effect ${index} · ${name}`}
      className={cx(
        "flex cursor-pointer flex-col gap-1.5 rounded-xl border px-3 py-2.5 text-left transition-colors duration-120",
        selected
          ? "border-accent-deep bg-accent-dim/30 text-ink"
          : "border-line bg-raised text-mute hover:border-line-strong hover:text-ink",
      )}
      aria-pressed={selected}
    >
      <span className="truncate text-body font-medium">{name}</span>
      <span className="flex min-h-4 items-center gap-1.5">
        {assigned.includes("base") && <Chip tone="accent">base</Chip>}
        {assigned.includes("overlay") && <Chip tone="neutral">overlay</Chip>}
        <span className="flex-1" />
        {index !== null && <span className="tnum text-caption text-faint">#{index}</span>}
      </span>
    </button>
  );
}

export function EffectsMode() {
  const { state } = useWorkbench();
  const fx = useEffectsDraft();
  const { draft, setDraft, overlayDraft, setOverlayDraft, hasOverlaySlot, assignedFor, blocks, effects, palettes, effectName } = fx;
  const [slot, setSlot] = useState<Slot>("base");
  const [filter, setFilter] = useState("");
  const visible = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    const all = effects.map((name, index) => ({ name, index }));
    return needle === "" ? all : all.filter((e) => e.name.toLowerCase().includes(needle));
  }, [effects, filter]);

  if (!draft) {
    return (
      <div className="flex flex-1 items-center justify-center text-body text-faint">
        This firmware has no effect extension.
      </div>
    );
  }

  const activeSlot = hasOverlaySlot ? slot : "base";
  const pick = (index: number | null) => {
    if (activeSlot === "base") {
      if (index !== null) setDraft({ ...draft, effect: index });
    } else {
      setOverlayDraft(index ?? undefined);
    }
  };
  const slotValue = activeSlot === "base" ? draft.effect : overlayDraft;
  const dirty = fx.dirty;

  const outputOff = state.lightingState?.output_enabled === false;

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col gap-3 max-lg:min-h-[380px]">
        <div className="flex flex-wrap items-center gap-3 px-1">
          <SectionLabel>Effects</SectionLabel>
          <span className="tnum text-body text-faint">
            {effects.length} from firmware
            {filter.trim() !== "" && ` · ${visible.length} shown`}
          </span>
          {outputOff && (
            <span className="text-small text-warn">lighting output is off</span>
          )}
        </div>

        <div className="flex items-center gap-3 px-1">
          {hasOverlaySlot && (
            <Segmented
              layout="fit"
              className="px-1"
              items={[
                {
                  value: "base",
                  label: `Base · ${effectName(draft.effect)}`,
                  title: "The effect the pack renders across the board",
                },
                {
                  value: "overlay",
                  label: `Overlay · ${effectName(overlayDraft)}`,
                  title: "A second effect composited over the base — optional",
                },
              ]}
              value={activeSlot}
              onChange={setSlot}
            />
          )}
          <div className="flex-1" />
          <div className="w-44 shrink-0">
            <TextInput
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter effects"
              className="text-body"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto rounded-2xl border border-line-soft bg-well p-3">
          {effects.length === 0 ? (
            <p className="text-body text-faint">
              This firmware advertises no effect names.
            </p>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(148px,1fr))] gap-2">
              {activeSlot === "overlay" && filter.trim() === "" && (
                <EffectCard
                  name="None"
                  index={null}
                  selected={overlayDraft === undefined}
                  assigned={[]}
                  onClick={() => pick(null)}
                />
              )}
              {visible.map(({ name, index }) => (
                <EffectCard
                  key={index}
                  name={name}
                  index={index}
                  selected={slotValue === index}
                  assigned={assignedFor(index)}
                  onClick={() => pick(index)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <InspectorShell>
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
          <div>
            <div className="flex items-center justify-between">
              <SectionLabel>Firmware effect extension</SectionLabel>
              {dirty && <span className="text-caption text-warn">unapplied</span>}
            </div>
            <p className="mt-1 text-small leading-relaxed text-faint">
              Names and control behavior are supplied by the connected firmware.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            {palettes.length > 0 && (
              <NameSelect
                label="Palette"
                names={palettes}
                value={draft.palette}
                onChange={(palette) => setDraft({ ...draft, palette })}
              />
            )}
            <Slider
              label="Value"
              value={draft.value}
              onChange={(value) => setDraft({ ...draft, value })}
            />
            <Slider
              label="Speed"
              value={draft.speed}
              onChange={(speed) => setDraft({ ...draft, speed })}
            />
          </div>

          {blocks.map((block) => (
            <div
              key={block.effect}
              className="flex flex-col gap-2 border-t border-line-soft pt-4"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-1.5">
                  <SectionLabel>{effectName(block.effect)} parameters</SectionLabel>
                  {hasOverlaySlot &&
                    block.slots.map((s) => (
                      <Chip key={s} tone={s === "base" ? "accent" : "neutral"}>
                        {s}
                      </Chip>
                    ))}
                </div>
                <Button
                  variant="ghost"
                  className="px-1.5 py-0 text-caption"
                  disabled={block.items.every(
                    (param, index) => block.values[index] === param.default,
                  )}
                  onClick={() => fx.defaults(block)}
                >
                  Defaults
                </Button>
              </div>
              {block.items.map((param, index) => (
                <Slider
                  key={`${block.effect}:${index}:${param.name}`}
                  label={param.name}
                  min={param.min}
                  max={param.max}
                  value={block.values[index]}
                  onChange={(value) => fx.setParam(block.effect, index, value)}
                />
              ))}
            </div>
          ))}
        </div>

        <div className="mt-4 border-t border-line-soft pt-3">
          {state.lightingError && (
            <ErrorBanner className="mb-2" message={state.lightingError} />
          )}
          <ApplyBar
            busy={state.lightingBusy}
            apply={{
              label: "Apply",
              disabled: !dirty || state.lightingBusy,
              onClick: () => void fx.apply(),
            }}
            discard={{
              label: "Revert",
              disabled: !dirty,
              onClick: fx.revert,
            }}
          />
        </div>
      </InspectorShell>
    </>
  );
}
