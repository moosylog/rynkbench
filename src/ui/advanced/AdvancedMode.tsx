// The Behaviors area's editors (combos, morse, macros, forks, global behavior,
// keymap-wide transforms) and the Insights area's usage report. The area shell
// draws the section tabs and decides which sections the firmware offers
// (src/ui/areas.ts), so each screen here renders without a nav of its own.

import { useWorkbench } from "../state";
import { CombosTab } from "./CombosTab";
import { MorseTab } from "./MorseTab";
import { MacrosTab } from "./MacrosTab";
import { ForksTab } from "./ForksTab";
import { BehaviorTab } from "./BehaviorTab";
import { TransformsTab } from "./TransformsTab";
import { UsageTab } from "./UsageTab";

export type AdvancedSectionId = "combos" | "morse" | "macros" | "forks" | "behavior" | "transforms" | "usage";

export function AdvancedSection({ section }: { section: AdvancedSectionId }) {
  const { dispatch } = useWorkbench();
  switch (section) {
    case "combos":
      return <CombosTab nav={null} goBehavior={() => dispatch({ type: "mode", mode: "behavior" })} />;
    case "morse":
      return <MorseTab nav={null} />;
    case "macros":
      return <MacrosTab nav={null} />;
    case "forks":
      return <ForksTab nav={null} />;
    case "behavior":
      return <BehaviorTab nav={null} />;
    case "transforms":
      return <TransformsTab nav={null} />;
    case "usage":
      return <UsageTab nav={null} />;
  }
}
