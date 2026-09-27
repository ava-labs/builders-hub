import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AcademyShortcutSection } from "@/components/academy/shared/academy-shortcut-section";

const render = (pathType: "avalanche" | "blockchain") =>
  renderToStaticMarkup(createElement(AcademyShortcutSection, { pathType }));
/** Each shortcut card: its anchor, up to the next one. */
const cards = (html: string) => html.split("<a ").slice(1).map((segment) => `<a ${segment}`);
/** The class list of a markup segment's first tag. */
const classesOf = (markup: string) => (markup.match(/^<[^>]*?\bclass="([^"]*)"/)?.[1] ?? "").split(" ");
/** The ruled keyboard focus ring: 2 px of ink, 2 px outside the control. */
const FOCUS_RING = ["focus-visible:outline-2", "focus-visible:outline-offset-2", "focus-visible:outline-ac-ink"];

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

  it.each(["avalanche", "blockchain"] as const)("%s: every card draws the 2 px ink focus ring", (pathType) => {
    const list = cards(render(pathType));
    expect(list).toHaveLength(5);
    list.forEach((card) => expect(classesOf(card)).toEqual(expect.arrayContaining(FOCUS_RING)));
  });

  it("sets the heading in the display face, without the rocket icon", () => {
    const html = render("avalanche");
    expect(html).toMatch(/<h2 class="[^"]*font-ac-display[^"]*">Quick Access<\/h2>/);
    expect(html).not.toContain("lucide-rocket");
  });
});
