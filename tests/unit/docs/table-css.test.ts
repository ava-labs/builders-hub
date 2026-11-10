import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import postcss from "postcss";
import { describe, expect, it } from "vitest";

// fumadocs draws the frame of a docs table (border, radius, background) on the table element, and the header
// cells (th) draw the header fill. A rule that makes the table a block keeps the frame at the full column width,
// but the rows form an anonymous inner table only as wide as their content. The frame then shows an empty band
// at the right. fumadocs puts each MDX table in an overflow-auto div, so a wide table scrolls without the block
// rule. tests/e2e/docs/tables.e2e.ts checks the same thing in a browser.
const ROOT = process.cwd();
// Every CSS file in app/docs: the docs layout imports them (styles.css, critical.css, book/*.css).
const DOCS_CSS = readdirSync(join(ROOT, "app/docs"), { recursive: true, encoding: "utf8" })
  .filter((name) => name.endsWith(".css"))
  .map((name) => `app/docs/${name}`)
  .sort();
const GLOBAL_CSS = "app/global.css";

// The last compound selector names the table element, as in "article table" or ".prose > div > table:first-child".
const TABLE_SUBJECT = /(?:^|[\s>+~])table(?![\w-])[^\s>+~]*$/;
// A rule in global.css reaches the docs when it is not scoped to another surface.
const OTHER_SURFACE = /data-layout="(?!docs")|data-academy|\.profile|\.gradient-border-card/;

// Returns each declaration that sets the display of a table to a value other than table, as "file:line: rule".
function tableDisplayRules(css: string, file: string, inScope: (selector: string) => boolean): string[] {
  const found: string[] = [];
  postcss.parse(css, { from: file }).walkRules((rule) => {
    const selectors = rule.selectors.filter((selector) => TABLE_SUBJECT.test(selector.trim()) && inScope(selector));
    if (selectors.length === 0) return;
    rule.walkDecls("display", (decl) => {
      if (decl.value === "table") return;
      const value = decl.important ? `${decl.value} !important` : decl.value;
      found.push(`${file}:${decl.source?.start?.line}: ${selectors.join(", ")} { display: ${value} }`);
    });
  });
  return found;
}

function read(file: string): string {
  return readFileSync(join(ROOT, file), "utf8");
}

describe("docs table CSS", () => {
  it("reads the docs styles", () => {
    expect(DOCS_CSS).toEqual(expect.arrayContaining(["app/docs/styles.css", "app/docs/critical.css"]));
  });

  it("does not change the display of a table in the docs styles", () => {
    expect(DOCS_CSS.flatMap((file) => tableDisplayRules(read(file), file, () => true))).toEqual([]);
  });

  it("does not change the display of a table in the global rules that reach the docs", () => {
    expect(tableDisplayRules(read(GLOBAL_CSS), GLOBAL_CSS, (selector) => !OTHER_SURFACE.test(selector))).toEqual([]);
  });

  it("finds the block rule that made tables narrower than their frame", () => {
    // The checks above pass when the pattern finds nothing, so this proves that it finds the old rule.
    const old = `@media (min-width: 1024px) {
  body[data-layout="docs"] article table,
  body[data-layout="docs"] .prose table:not(.x),
  body[data-layout="docs"] .prose table td,
  aside[aria-label*="table" i] {
    display: block !important;
  }
}`;
    expect(tableDisplayRules(old, "old.css", () => true)).toEqual([
      'old.css:6: body[data-layout="docs"] article table, body[data-layout="docs"] .prose table:not(.x) { display: block !important }',
    ]);
  });
});
