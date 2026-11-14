import { describe, expect, it } from "vitest";
import type { KeyAction } from "../../vendor/rynk-wasm/rynk_wasm";
import { renderInWorkbench } from "../../test/workbench";
import { ConnectionChip } from "./ConnectionChip";
import { setLink } from "./link";

const A = { Single: { Key: { Hid: "A" } } } as unknown as KeyAction;
const keyboard = { session: { kind: "webhid" as const }, info: { product_name: "Glove80" } };
const staged = { "k:0:0:0": { layer: 0, row: 0, col: 0, before: "No" as KeyAction, action: A } };

describe("the connection chip", () => {
  it("says a file is a file", () => {
    expect(renderInWorkbench(<ConnectionChip />)).toContain("File");
  });

  it("names the keyboard and starts in Draft, up to date", () => {
    const html = renderInWorkbench(<ConnectionChip />, { bundle: keyboard, state: { batchMode: true } });
    expect(html).toContain("Glove80");
    expect(html).toContain("Draft");
    expect(html).toContain("Up to date");
  });

  it("counts the changes not on the keyboard and offers Review & send", () => {
    const html = renderInWorkbench(<ConnectionChip />, { bundle: keyboard, state: { batchMode: true, stagedKeys: staged } });
    expect(html).toContain("Review &amp; send");
    expect(html).toMatch(/Review &amp; send<span[^>]*>1<\/span>/);
    expect(html).toContain("Discard the changes not on the keyboard");
  });

  it("shows Live without a count", () => {
    const html = renderInWorkbench(<ConnectionChip />, { bundle: keyboard, state: { batchMode: false } });
    expect(html).toContain("Live");
    expect(html).not.toContain("Review");
  });

  it("says when the keyboard cannot be reached, keeps the changes and offers Reconnect", () => {
    setLink({ lost: true, reconnect: () => {} });
    try {
      const html = renderInWorkbench(<ConnectionChip />, { bundle: keyboard, state: { batchMode: true, stagedKeys: staged } });
      expect(html).toContain("not connected");
      expect(html).toContain("1 change kept for when it is back");
      expect(html).toContain("Reconnect");
      expect(html).not.toContain("Review &amp; send");
    } finally {
      setLink({ lost: false });
    }
  });
});

