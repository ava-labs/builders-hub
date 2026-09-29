import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const auth = vi.hoisted(() => ({ attrs: null as string[] | null }));
vi.mock("next-auth/react", () => ({
  useSession: () =>
    auth.attrs
      ? { data: { user: { custom_attributes: auth.attrs } }, status: "authenticated" }
      : { data: null, status: "unauthenticated" },
}));

import { AcademyTrackTabs } from "@/components/academy/shared/academy-track-tabs";
import { getAcademyTrack } from "@/components/academy/shared/academy-tracks";
import type { AcademyPathType } from "@/components/academy/shared/academy-types";

const render = (active: AcademyPathType, attrs: string[] | null = null) => {
  auth.attrs = attrs;
  return renderToStaticMarkup(createElement(AcademyTrackTabs, { active }));
};
/** The markup of the tab whose label is `label`, up to the next anchor. */
const tab = (html: string, label: string) =>
  html.split("<a ").map((segment) => `<a ${segment}`).find((segment) => segment.includes(`>${label}<`)) ?? "";
/** The course count the config gives a track, as the tab prints it. */
const count = (id: AcademyPathType) => `>${String(getAcademyTrack(id).courses.length).padStart(2, "0")}</span>`;
/** The class list of a markup segment's first tag. */
const classesOf = (markup: string) => (markup.match(/^<[^>]*?\bclass="([^"]*)"/)?.[1] ?? "").split(" ");
/** The keyboard focus ring: 2 px of ink, 2 px outside the control. */
const FOCUS_RING = ["focus-visible:outline-2", "focus-visible:outline-offset-2", "focus-visible:outline-ac-ink"];

describe("AcademyTrackTabs", () => {
  it("shows the two public tracks with their course counts and no Team1 tab without access", () => {
    const html = render("avalanche");
    expect(tab(html, "Avalanche L1")).toContain('href="/academy/avalanche-l1"');
    expect(tab(html, "Avalanche L1")).toContain(count("avalanche"));
    expect(tab(html, "Blockchain")).toContain(count("blockchain"));
    expect(html).not.toContain(">Entrepreneur<");
    expect(html).not.toContain(">Team1<");
  });

  it("hides the Team1 tab from a signed-in user without Team1 access", () => {
    expect(render("avalanche", [])).not.toContain(">Team1<");
    expect(render("blockchain", ["hackathon-judge"])).not.toContain(">Team1<");
  });

  it("adds the Team1 tab with its count for a Team1 member", () => {
    const team1 = tab(render("avalanche", ["team1-member"]), "Team1");
    expect(team1).toContain('href="/academy/team1"');
    expect(team1).toContain(count("team1"));
  });

  it("keeps the Team1 tab on the Team1 landing before the session has loaded", () => {
    expect(tab(render("team1"), "Team1")).toContain('aria-current="page"');
  });

  it("puts only the active track on the red rule", () => {
    const html = render("blockchain");
    expect(tab(html, "Blockchain")).toContain('aria-current="page"');
    expect(tab(html, "Blockchain")).toContain("border-ac-red");
    expect(tab(html, "Avalanche L1")).not.toContain("aria-current");
    expect(tab(html, "Avalanche L1")).not.toContain("border-ac-red");
  });

  it("names the tab row Academy tracks, a navigation landmark that is not a nav element", () => {
    const container = render("avalanche").match(/^<[^>]+>/)?.[0] ?? "";
    expect(container).toContain('role="navigation"');
    expect(container).toContain('aria-label="Academy tracks"');
    // app/global.css pads and recolours every `nav a` with !important, which would move the tabs.
    expect(container).toMatch(/^<div /);
  });

  it("draws the 2 px ink focus ring on every tab, inside the tab below 768 px where the row clips", () => {
    const html = render("team1");
    ["Avalanche L1", "Blockchain", "Team1"].forEach((label) =>
      expect(classesOf(tab(html, label))).toEqual(
        expect.arrayContaining([...FOCUS_RING, "max-md:focus-visible:-outline-offset-3"]),
      ),
    );
  });

  it("scrolls the row only sideways below 768 px", () => {
    const container = render("avalanche").match(/^<[^>]+>/)?.[0] ?? "";
    expect(container).toContain("max-md:overflow-x-auto");
    // Without it, overflow-y computes to auto and the tabs' -1 px margin leaves a 1 px vertical scroll.
    expect(container).toContain("max-md:overflow-y-hidden");
  });
});
