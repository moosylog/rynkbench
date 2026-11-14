// Layout properties' RGB Lighting tab (ADR 0016): the keyboard's lights as a
// whole (on or off, brightness, background), and under Advanced, closed, the
// status setups and the condition rules. Each key's own light is set on the
// key, in the key editor's RGB Lighting tab.

import { useState } from "react";
import { BackgroundPanel } from "../lighting/BackgroundPanel";
import { ConditionalRulesPanel } from "../lighting/ConditionalRulesPanel";
import { StatusPresetsPanel } from "../lighting/StatusPresetsPanel";
import { ChevronDownIcon } from "../icons";
import { useWorkbench } from "../state";
import { useCapabilities } from "../use-capabilities";
import { cx } from "../kit";

export function LightingSection() {
  const { state } = useWorkbench();
  const rules = useCapabilities().has("lighting.rules");
  const [advanced, setAdvanced] = useState(false);
  const count = state.runtimeConditionalDraft.length;

  return (
    <div className="flex flex-col gap-4">
      <BackgroundPanel />
      {rules && (
        <div className="border-t border-line-soft pt-3">
          <button
            type="button"
            aria-expanded={advanced}
            onClick={() => setAdvanced(!advanced)}
            className="flex cursor-pointer items-center gap-1.5 text-body font-semibold text-mute hover:text-ink"
          >
            <ChevronDownIcon size={13} className={cx("transition-transform", !advanced && "-rotate-90")} />
            Advanced{count > 0 ? ` · ${count} rule${count === 1 ? "" : "s"}` : ""}
          </button>
          {advanced && (
            <div className="mt-3 flex flex-col gap-4">
              <StatusPresetsPanel />
              <div className="border-t border-line-soft pt-4">
                <ConditionalRulesPanel />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
