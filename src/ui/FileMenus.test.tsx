import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { profileById } from "../model/boards/profiles";
import { WorkbenchContext, type WorkbenchContextValue } from "./state";
import { DocumentTransferContext, type DocumentTransfer } from "./transfer-actions";
import { FileMenus } from "./FileMenus";

function menus(board?: string, kind = "webhid") {
  const documentTools = board ? profileById(board)?.documents : undefined;
  const workbench = {
    bundle: { session: { kind } },
    history: { phase: "idle" },
  } as unknown as WorkbenchContextValue;
  const transfer = {
    phase: null,
    report: null,
    documentTools,
    migrationTarget: documentTools?.migrationTarget?.name ?? null,
  } as unknown as DocumentTransfer;
  return renderToStaticMarkup(
    <WorkbenchContext value={workbench}>
      <DocumentTransferContext value={transfer}>
        <FileMenus />
      </DocumentTransferContext>
    </WorkbenchContext>,
  );
}

describe("file menus", () => {
  it("are absent for a keyboard with no file formats", () => {
    expect(menus()).toBe("");
  });

  it("open a file when no keyboard is attached, and import onto one that is", () => {
    expect(menus("glove80", "offline")).toContain(">Open<");
    expect(menus("glove80")).toContain(">Import<");
  });

  it("save in the board's main format at one click", () => {
    const html = menus("glove80");
    expect(html).toContain(">Save<");
    expect(html).toMatch(/Save this layout as (TOML|MoErgo JSON)/);
    expect(html).toContain("More ways to save");
  });
});
