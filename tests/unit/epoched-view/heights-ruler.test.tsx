import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { HeightsRuler } from "../../../components/epoched-view/HeightsRuler";
import {
  RULER_FOOTER,
  RULER_NAMES,
  RULER_ROLES,
  RULER_VALUES,
} from "../../../components/epoched-view/timeline-layouts";

/**
 * The ruler is a server component with zero state and zero motion; its markup
 * must be deterministic and carry the full vocabulary: three names, three
 * roles (desktop sheet), three values, and the ordering law.
 */
describe("HeightsRuler SSR markup", () => {
  const html = renderToStaticMarkup(<HeightsRuler />);
  const text = html.replace(/&#x27;|&apos;/g, "'");

  it("renders the desktop and mobile sheets", () => {
    expect(html.match(/<svg/g)).toHaveLength(2);
    expect(html).toContain("hidden w-full sm:block");
    expect(html).toContain("w-full sm:hidden");
  });

  it("carries the full vocabulary", () => {
    for (const needle of [
      ...Object.values(RULER_NAMES),
      ...Object.values(RULER_ROLES),
      ...Object.values(RULER_VALUES),
      RULER_FOOTER,
      "Bridge block row",
    ]) {
      expect(text, `missing "${needle}"`).toContain(needle);
    }
  });

  it("is deterministic across renders", () => {
    expect(renderToStaticMarkup(<HeightsRuler />)).toBe(html);
  });
});
