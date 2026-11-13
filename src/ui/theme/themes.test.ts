import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { normalizeTheme } from "./index";
import { contrastRatio } from "./contrast";

const css = readFileSync(fileURLToPath(new URL("../../index.css", import.meta.url)), "utf8");

/** The `--color-*` values declared in the block that starts at `opener`. */
function tokens(opener: string): Record<string, string> {
  const start = css.indexOf(opener);
  if (start < 0) throw new Error(`no ${opener} block in index.css`);
  const block = css.slice(start, css.indexOf("\n}", start));
  const found: Record<string, string> = {};
  for (const match of block.matchAll(/--color-([a-z-]+):\s*(oklch\([^)]*\));/g)) found[match[1]] = match[2];
  return found;
}

const themes = { dark: tokens("@theme {"), light: tokens(':root[data-theme="light"] {') };

describe("theme tokens", () => {
  it("gives the light theme exactly the dark theme's token names", () => {
    expect(Object.keys(themes.light).sort()).toEqual(Object.keys(themes.dark).sort());
    expect(Object.keys(themes.dark).length).toBeGreaterThan(20);
  });

  it("falls back to dark for anything that is not a theme", () => {
    expect(normalizeTheme("light")).toBe("light");
    expect(normalizeTheme("dark")).toBe("dark");
    expect(normalizeTheme("sepia")).toBe("dark");
    expect(normalizeTheme(null)).toBe("dark");
  });
});

// Text needs 4.5:1 (WCAG AA); a dimmed keycap legend, which is graphical, 3:1.
const surfaces = ["bg", "well", "panel", "raised", "hover"];
const pairs: { fg: string; on: string[]; min: number }[] = [
  { fg: "ink", on: surfaces, min: 4.5 },
  { fg: "mute", on: surfaces, min: 4.5 },
  { fg: "faint", on: ["bg", "panel", "raised"], min: 4.5 },
  { fg: "accent", on: ["bg", "panel", "raised"], min: 4.5 },
  { fg: "danger", on: ["bg", "panel", "raised"], min: 4.5 },
  { fg: "ok", on: ["bg", "panel", "raised"], min: 4.5 },
  { fg: "warn", on: ["bg", "panel", "raised"], min: 4.5 },
  { fg: "cap-ink", on: ["cap"], min: 4.5 },
  { fg: "cap-ink-dim", on: ["cap"], min: 3 },
  // Primary buttons set the page background color on the accent.
  { fg: "bg", on: ["accent"], min: 4.5 },
];

for (const [name, values] of Object.entries(themes)) {
  describe(`${name} theme contrast`, () => {
    for (const { fg, on, min } of pairs) {
      for (const surface of on) {
        it(`${fg} on ${surface} is at least ${min}:1`, () => {
          expect(contrastRatio(values[fg], values[surface])).toBeGreaterThanOrEqual(min);
        });
      }
    }
  });
}
