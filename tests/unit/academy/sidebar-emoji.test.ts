import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// The Academy sidebar shows meta.json titles and separators and each page's title. None of them may hold an emoji.
const ACADEMY = join(process.cwd(), "content/academy");
// RGI_Emoji also covers keycaps and flags, and leaves out text symbols such as the trademark sign.
const PICTOGRAPH = new RegExp("\\p{RGI_Emoji}", "v");

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? files(join(dir, entry.name)) : [join(dir, entry.name)],
  );
}

/** The sidebar text of one file: a meta.json's title and page entries, or an MDX page's title. */
function sidebarText(file: string): string[] {
  const source = readFileSync(file, "utf8");
  if (file.endsWith("meta.json")) {
    const meta = JSON.parse(source) as { title?: string; pages?: unknown[] };
    return [meta.title ?? "", ...(meta.pages ?? []).filter((page): page is string => typeof page === "string")];
  }
  const frontmatter = /^---\n([\s\S]*?)\n---/.exec(source)?.[1] ?? "";
  return frontmatter.split("\n").filter((line) => /^(title|sidebarTitle):/.test(line));
}

describe("academy sidebar text", () => {
  it("holds no emoji", () => {
    const found = files(ACADEMY)
      .filter((file) => file.endsWith("meta.json") || file.endsWith(".mdx"))
      .flatMap((file) => sidebarText(file).filter((text) => PICTOGRAPH.test(text)).map((text) => `${file.slice(ACADEMY.length + 1)}: ${text}`));
    expect(found).toEqual([]);
  });
});
