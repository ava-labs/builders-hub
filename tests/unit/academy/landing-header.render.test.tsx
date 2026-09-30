import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AcademyLayout } from "@/components/academy/shared/academy-layout";
import { coursesInOrder, courseUrl, getAcademyTrack } from "@/components/academy/shared/academy-tracks";
import { team1AcademyLandingPageConfig } from "@/app/(home)/academy/team1/config";

// No stats: the cards render without counts; learning-tree.render.test.tsx covers the counts.
const html = renderToStaticMarkup(createElement(AcademyLayout, { config: team1AcademyLandingPageConfig, courseStats: {} }));
/** The markup of the first anchor that contains `text`, up to the next anchor. */
const anchor = (markup: string, text: string) =>
  markup.split("<a ").map((segment) => `<a ${segment}`).find((segment) => segment.includes(text)) ?? "";
/** The class list of a markup segment's first tag. */
const classesOf = (markup: string) => (markup.match(/^<[^>]*?\bclass="([^"]*)"/)?.[1] ?? "").split(" ");
/** The keyboard focus ring: 2 px of ink, 2 px outside the control. */
const FOCUS_RING = ["focus-visible:outline-2", "focus-visible:outline-offset-2", "focus-visible:outline-ac-ink"];

describe("Team1 landing header server markup", () => {
  it("carries the Team1 title at server render, the line under it", () => {
    expect(html).toContain(">Team1 Learning Tree</h1><p class=");
    expect(html).toMatch(/<\/h1><p [^>]*>From fundamentals to advanced technical leadership and event organizing<\/p>/);
  });

  it("starts card 01's course from an ink button with the 2 px ink focus ring", () => {
    const [first] = coursesInOrder(getAcademyTrack("team1").courses);
    const button = anchor(html, `>Start with ${first.name}<`);
    expect(button).toContain(`href="${courseUrl("team1", first.slug)}"`);
    expect(button).toContain("bg-ac-ink");
    expect(classesOf(button)).toEqual(expect.arrayContaining(FOCUS_RING));
  });

  it("has no track tabs: the other two tracks merged into /academy", () => {
    expect(html).not.toContain('role="navigation"');
    expect(html).not.toContain('href="/academy/avalanche-l1"');
    expect(html).not.toContain('href="/academy/blockchain"');
  });

  it("paints the hub's ground inside the landing root", () => {
    expect(html).toMatch(/<main [^>]*data-academy="landing"[^>]*><div aria-hidden="true" class="[^"]*bg-ac-ground/);
  });
});
