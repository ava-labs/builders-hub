import { describe, expect, it } from "vitest";
import {
  desktopLayout,
  mobileLayout,
} from "../../../components/validator-flow/stage-layouts";

describe("stage layout metadata", () => {
  it("types both zones on both layouts", () => {
    for (const layout of [desktopLayout, mobileLayout]) {
      const kinds = layout.zones.map((zone) => zone.kind).sort();
      expect(kinds).toEqual(["l1", "pchain"]);
    }
  });

  it("keeps rule lines inside the desktop viewBox", () => {
    expect(desktopLayout.ruleXs.length).toBeGreaterThan(0);
    for (const x of desktopLayout.ruleXs) {
      expect(x).toBeGreaterThan(0);
      expect(x).toBeLessThan(desktopLayout.viewBox.w);
    }
    expect(mobileLayout.ruleXs).toEqual([]);
  });

  it("places drafting furniture inside the desktop viewBox", () => {
    const dim = desktopLayout.dimension;
    expect(dim).toBeDefined();
    if (dim) {
      expect(dim.x0).toBeLessThan(dim.x1);
      expect(dim.y).toBeLessThan(desktopLayout.viewBox.h);
      expect(dim.label).not.toMatch(/[–—]/);
    }
  });
});
