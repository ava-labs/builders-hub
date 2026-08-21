import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { staleViewFigure } from "../../../components/epoched-view/data/figure";
import { StaircaseFigure } from "../../../components/epoched-view/StaircaseFigure";
import {
  figureDesktop,
  figureMobile,
  LEGEND_LINE_1,
  LEGEND_LINE_2,
  mapX,
  mapY,
  seriesYAt,
  viewSeriesPoints,
} from "../../../components/epoched-view/timeline-layouts";

/**
 * The figure is a server component with zero state and zero motion; its
 * markup must be deterministic and carry the stamped vocabulary: the two
 * legend lines, the three mark labels, the gap label, and the phase words.
 */
describe("StaircaseFigure SSR markup", () => {
  const html = renderToStaticMarkup(<StaircaseFigure />);
  /* React escapes apostrophes in text nodes; normalize before matching. */
  const text = html.replace(/&#x27;|&apos;/g, "'");

  it("renders the desktop and mobile sheets", () => {
    expect(html.match(/<svg/g)).toHaveLength(2);
    expect(html).toContain("hidden w-full sm:block");
    expect(html).toContain("w-full sm:hidden");
  });

  it("carries the full stamped vocabulary", () => {
    for (const needle of [
      LEGEND_LINE_1,
      LEGEND_LINE_2,
      "BLOCK",
      "REGISTRATION",
      "SKIPPED SLOT",
      "42 DAYS BEHIND",
      "42 DAYS",
      "HEALTHY",
      "FROZEN",
      "HEALED",
      "all numbers illustrative",
    ]) {
      expect(text, `missing "${needle}"`).toContain(needle);
    }
  });

  it("is deterministic across renders", () => {
    expect(renderToStaticMarkup(<StaircaseFigure />)).toBe(html);
  });

  it("bounds the alarm span at the heal point (paint order never load-bearing)", () => {
    /* The alarm series is the only ACCENT-stroked 2.5px path per sheet. */
    const alarmDs = Array.from(
      html.matchAll(/<path d="([^"]+)" stroke="#E6212F" stroke-width="2.5"/g),
      (m) => m[1],
    );
    expect(alarmDs).toHaveLength(2);
    const hf = staleViewFigure.view.healFrom as number;
    const vPts = viewSeriesPoints(staleViewFigure.view);
    const flatY = seriesYAt(vPts, (staleViewFigure.view.alarmFrom as number + hf) / 2);
    for (const [layout, d] of [
      [figureDesktop, alarmDs[0]],
      [figureMobile, alarmDs[1]],
    ] as const) {
      expect(d.endsWith(`L${mapX(layout, hf).toFixed(1)} ${mapY(layout, flatY).toFixed(1)}`)).toBe(
        true,
      );
    }
  });
});
