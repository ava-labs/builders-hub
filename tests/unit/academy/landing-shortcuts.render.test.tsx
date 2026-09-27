import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AcademyShortcutSection } from "@/components/academy/shared/academy-shortcut-section";

const render = (pathType: "avalanche" | "blockchain") =>
  renderToStaticMarkup(createElement(AcademyShortcutSection, { pathType }));
/** Each shortcut card: its anchor, up to the next one. */
const cards = (html: string) => html.split("<a ").slice(1).map((segment) => `<a ${segment}`);

describe("Quick Access in the card anatomy", () => {
  it.each(["avalanche", "blockchain"] as const)("%s: five paper cards numbered 01 to 05, each with an ink tile", (pathType) => {
    const list = cards(render(pathType));
    expect(list).toHaveLength(5);
    list.forEach((card, index) => {
      expect(card).toContain(`>${String(index + 1).padStart(2, "0")}</span>`);
      expect(card).toContain("rounded-xl border border-ac-rule bg-ac-paper");
      expect(card).toContain("bg-ac-tile");
      expect(card).not.toContain("zinc");
    });
  });

  it("sets the heading in the display face, without the rocket icon", () => {
    const html = render("avalanche");
    expect(html).toMatch(/<h2 class="[^"]*font-ac-display[^"]*">Quick Access<\/h2>/);
    expect(html).not.toContain("lucide-rocket");
  });
});
