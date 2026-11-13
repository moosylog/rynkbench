import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { profileById } from "../../model/boards/profiles";
import { WorkbenchContext, type WorkbenchContextValue } from "../state";
import { DocumentTransferContext, type DocumentTransfer } from "../transfer-actions";
import { LibraryMode } from "./LibraryMode";

function library(board?: string, kind = "webhid") {
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
        <LibraryMode />
      </DocumentTransferContext>
    </WorkbenchContext>,
  );
}

describe("library", () => {
  it("says so when a generic keyboard has no file formats", () => {
    const html = library();
    expect(html).toContain("No file formats for this keyboard yet");
    expect(html).not.toContain("Import layout");
  });

  it.each([
    ["glove80", "Go60"],
    ["go60", "Glove80"],
  ])("offers %s its formats and its sibling board", (board, peer) => {
    const html = library(board);
    expect(html).toContain("Import layout");
    expect(html).toContain("TOML");
    expect(html).toContain("MoErgo JSON");
    expect(html).toContain(`Move to ${peer}`);
  });

  it("opens a file rather than importing when no keyboard is attached", () => {
    const html = library("glove80", "offline");
    expect(html).toContain("Open file");
    expect(html).not.toContain("Import layout");
  });
});
