// The side panel's combo list, as in GLIDE: Create Combo, then a row per
// combo with its action, keys and layer, and a warning when it lacks an
// action or a second key, or shares its keys with another. Clicking a row
// (or Create) opens the combo in Focus Mode; its ⋮ menu edits or deletes it.

import { comboIsEmpty, comboLayer, comboNeeds, comboOutput, comboTriggerCount, comboTwins } from "../../model/combos";
import { emptyCombo } from "../../model/slots";
import { keyActionGlyph } from "../labels";
import { layerName } from "../layer-names";
import { showToast } from "../messages/store";
import { useWorkbench } from "../state";
import { useTerms } from "../terms";
import { Button, cx } from "../kit";
import { MoreIcon, PlusIcon, WarningIcon } from "../icons";
import { RowMenu, useRowMenu } from "../RowMenu";

function rowWarning(needs: ReturnType<typeof comboNeeds>, twins: number[]): string | null {
  if (needs === "action") return "No action";
  if (needs === "keys") return "Needs another key";
  return twins.length > 0 ? "Duplicate keys" : null;
}

export function ComboList() {
  const { bundle, state, dispatch, io } = useWorkbench();
  const term = useTerms();
  const menu = useRowMenu<number>();
  const capacity = bundle.caps.max_combos;
  const editing = state.selection?.type === "combo" ? state.selection.index : null;
  const used = state.combos.filter((combo) => !comboIsEmpty(combo)).length;
  const rows = state.combos
    .map((combo, index) => ({ combo, index }))
    .filter(({ combo, index }) => comboTriggerCount(combo) > 0 || index === editing);
  const free = state.combos.findIndex(comboIsEmpty);
  const focus = (index: number) => dispatch({ type: "select", selection: { type: "combo", index } });

  const remove = (index: number) => {
    const before = state.combos[index];
    if (!before) return;
    if (editing === index) dispatch({ type: "select", selection: null });
    void io.setSlot("combos", index, emptyCombo());
    showToast(`Combo C${index} deleted`, { action: { label: "Undo", run: () => void io.setSlot("combos", index, before) } });
  };

  if (capacity === 0) {
    return <p className="px-1 text-small leading-relaxed text-faint">This keyboard has no combos.</p>;
  }
  return (
    <div className="flex flex-col gap-1.5">
      <Button
        onClick={() => focus(free)}
        disabled={free === -1}
        reason={`All ${capacity} combos are in use: delete one first`}
        className="w-full border-dashed border-line-strong py-2.5 font-semibold text-mute hover:text-ink"
      >
        <PlusIcon size={12} /> Create {term("section.combos").toLowerCase().replace(/s$/, "")}
      </Button>
      {rows.length === 0 && (
        <p className="px-1 pt-2 text-small leading-relaxed text-faint">
          No combos yet. A combo does something when several keys are pressed together.
        </p>
      )}
      {rows.map(({ combo, index }) => {
        const layer = comboLayer(combo);
        const warning = rowWarning(comboNeeds(combo), comboTwins(state.combos, index));
        const open = editing === index;
        return (
          <div
            key={index}
            {...menu.rowProps(index)}
            data-testid="combo-row"
            className={cx(
              "group relative flex items-center rounded-xl border transition-all duration-200",
              open
                ? "border-accent bg-raised shadow-sm"
                : menu.openFor === index
                  ? "border-line-strong bg-panel"
                  : "border-transparent hover:border-line-strong hover:bg-panel",
            )}
          >
            <button
              type="button"
              aria-current={open ? "true" : undefined}
              onClick={() => focus(index)}
              className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 py-2 pl-3 pr-1 text-left"
            >
              <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-raised font-mono text-caption text-mute">
                C{index}
              </span>
              <span className="min-w-0 flex-1">
                <span className={cx("block truncate text-body font-semibold", open ? "text-accent" : "text-ink")}>
                  {keyActionGlyph(comboOutput(combo)).text || "No action"}
                </span>
                <span className="block truncate text-small text-faint">
                  {comboTriggerCount(combo)} keys
                  {layer !== undefined ? ` · ${layerName(state.layerMetadata, layer)} only` : ""}
                </span>
                {warning && (
                  <span className="flex items-center gap-1 text-small font-semibold text-warn">
                    <WarningIcon size={11} /> {warning}
                  </span>
                )}
              </span>
            </button>
            <button
              type="button"
              aria-label={`Actions for combo C${index}`}
              title="Combo actions (or right-click the combo)"
              onClick={(event) => menu.openFrom(event, index)}
              className={cx(
                "mr-1.5 flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-mute transition-[opacity,visibility] hover:bg-hover hover:text-ink",
                open || menu.openFor === index
                  ? "opacity-100"
                  : "sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100",
              )}
            >
              <MoreIcon size={15} />
            </button>
          </div>
        );
      })}
      {menu.at && (
        <RowMenu
          x={menu.at.x}
          y={menu.at.y}
          label={`Combo C${menu.at.id}`}
          items={[{ id: "edit", label: "Edit on the keyboard" }, "-", { id: "delete", label: "Delete", danger: true }]}
          onAction={(id) => {
            if (!menu.at) return;
            if (id === "edit") focus(menu.at.id);
            else if (id === "delete") remove(menu.at.id);
          }}
          onClose={menu.close}
        />
      )}
      <p className="px-1 pt-1 text-caption text-faint">
        {used} of {capacity} used
      </p>
    </div>
  );
}
