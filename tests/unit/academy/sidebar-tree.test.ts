import { describe, expect, it } from "vitest";
import { loadAcademyTree } from "./helpers/content-tree";

// fumadocs puts a page that no meta.json lists in a fallback tree with no course folder. Its sidebar then lists the
// track folders (Avalanche l1, Blockchain, Team1 Academy) in place of the course, and the page has no previous or next.
describe("academy page tree", () => {
  it("lists every academy page in a meta.json", () => {
    const fallback = loadAcademyTree().fallback;
    const urls = (nodes: NonNullable<typeof fallback>["children"]): string[] =>
      nodes.flatMap((node) => (node.type === "page" ? [node.url] : node.type === "folder" ? [...(node.index ? [node.index.url] : []), ...urls(node.children)] : []));
    expect(fallback ? urls(fallback.children) : []).toEqual([]);
  });
});
