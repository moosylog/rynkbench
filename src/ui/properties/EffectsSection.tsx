// Layout properties' RGB Effects tab (ADR 0016): the firmware's effects across
// the keyboard. One big Effects switch first, then the effect (and the overlay
// effect, where the firmware has one), palette, speed and the effect's own
// settings. Applied to the keyboard in one go, as on the Effects screen.

import { ApplyBar, ErrorBanner, cx } from "../kit";
import { Slider } from "../lighting/BackgroundPanel";
import { NameSelect } from "../effects/EffectsMode";
import { BigSwitch } from "./BigSwitch";
import { useEffectsDraft } from "../effects/useEffectsDraft";

export function EffectsSection() {
  const fx = useEffectsDraft();
  const { draft, setDraft } = fx;
  if (!draft) return null;
  const none = fx.effects.length;

  return (
    <div className="flex flex-col gap-4">
      <BigSwitch name="Effects" state={fx.on ? fx.effectName(draft.effect) : "Off"} on={fx.on} onChange={fx.setOn} />

      <fieldset disabled={!fx.on} className={cx("flex flex-col gap-2", !fx.on && "opacity-50")}>
        <NameSelect label="Effect" names={fx.effects} value={draft.effect} onChange={(effect) => setDraft({ ...draft, effect })} />
        {fx.hasOverlaySlot && (
          <NameSelect
            label="Over it"
            names={[...fx.effects, "None"]}
            value={fx.overlayDraft ?? none}
            onChange={(index) => fx.setOverlayDraft(index === none ? undefined : index)}
          />
        )}
        {fx.palettes.length > 0 && (
          <NameSelect label="Palette" names={fx.palettes} value={draft.palette} onChange={(palette) => setDraft({ ...draft, palette })} />
        )}
        <Slider label="Bright" min={1} value={draft.value} onChange={(value) => setDraft({ ...draft, value })} />
        <Slider label="Speed" value={draft.speed} onChange={(speed) => setDraft({ ...draft, speed })} />
        {fx.blocks.map((block) => (
          <div key={block.effect} className="flex flex-col gap-2 border-t border-line-soft pt-3">
            <span className="text-small font-semibold text-mute">{fx.effectName(block.effect)}</span>
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
      </fieldset>

      {fx.error && <ErrorBanner message={fx.error} />}
      {fx.dirty && (
        <ApplyBar
          compact
          busy={fx.busy}
          apply={{ label: "Apply", disabled: fx.busy, onClick: () => void fx.apply() }}
          discard={{ label: "Revert", onClick: fx.revert }}
        />
      )}
    </div>
  );
}
