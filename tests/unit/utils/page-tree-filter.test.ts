import { describe, expect, it } from "vitest";
import { filterTreeByPrefix } from "@/lib/page-tree-filter";

type Node = { name: string; url?: string; children?: Node[] };

const leaf = (url: string): Node => ({ name: url, url });

describe("filterTreeByPrefix", () => {
  it("returns the same node reference when nothing under it was filtered out", () => {
    const folder: Node = { name: "L1", url: "/academy/avalanche-l1", children: [leaf("/academy/avalanche-l1/a"), leaf("/academy/avalanche-l1/b")] };
    const [out] = filterTreeByPrefix([folder], "/academy/avalanche-l1") as Node[];
    expect(out).toBe(folder);
    expect(out.children?.[0]).toBe(folder.children?.[0]);
  });

  it("returns a new node with filtered children when part of a subtree drops", () => {
    const folder: Node = { name: "root", children: [leaf("/academy/avalanche-l1/a"), leaf("/academy/blockchain/x")] };
    const [out] = filterTreeByPrefix([folder], "/academy/avalanche-l1") as Node[];
    expect(out).not.toBe(folder);
    expect(out.children).toEqual([leaf("/academy/avalanche-l1/a")]);
    expect(folder.children).toHaveLength(2);
  });

  it("drops a leaf outside the prefix and keeps a matching leaf by reference", () => {
    const a = leaf("/academy/avalanche-l1/a");
    const out = filterTreeByPrefix([a, leaf("/academy/blockchain/x")], "/academy/avalanche-l1") as Node[];
    expect(out).toHaveLength(1);
    expect(out[0]).toBe(a);
    expect("children" in out[0]).toBe(false);
  });

  it("keeps a separator (no url) and does not clone it when its subtree is unchanged", () => {
    const sep: Node = { name: "---" };
    const [out] = filterTreeByPrefix([sep], "/academy/avalanche-l1") as Node[];
    expect(out).toBe(sep);
  });

  it("accepts the object form with children", () => {
    const root = { children: [leaf("/academy/avalanche-l1/a"), leaf("/academy/blockchain/x")] };
    const out = filterTreeByPrefix(root, "/academy/avalanche-l1") as { children: Node[] };
    expect(out.children).toEqual([leaf("/academy/avalanche-l1/a")]);
  });
});
