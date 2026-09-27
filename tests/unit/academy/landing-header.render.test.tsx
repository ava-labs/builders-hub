import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next-auth/react", () => ({ useSession: () => ({ data: null, status: "unauthenticated" }) }));

import { AcademyLayout } from "@/components/academy/shared/academy-layout";
import { coursesInOrder, courseUrl, getAcademyTrack } from "@/components/academy/shared/academy-tracks";
import type { AcademyLandingPageConfig, AcademyPathType } from "@/components/academy/shared/academy-types";
import { avalancheDeveloperAcademyLandingPageConfig } from "@/app/(home)/academy/avalanche-l1/config";
import { blockchainAcademyLandingPageConfig } from "@/app/(home)/academy/blockchain/config";
import { entrepreneurAcademyLandingPageConfig } from "@/app/(home)/academy/entrepreneur/config";
import { team1AcademyLandingPageConfig } from "@/app/(home)/academy/team1/config";

// No stats: the cards render without counts (index C8); Task 6's test covers the counts.
const render = (config: AcademyLandingPageConfig) =>
  renderToStaticMarkup(createElement(AcademyLayout, { config, courseStats: {} }));
/** The markup of the first anchor that contains `text`, up to the next anchor. */
const anchor = (html: string, text: string) =>
  html.split("<a ").map((segment) => `<a ${segment}`).find((segment) => segment.includes(text)) ?? "";
/** The class list of a markup segment's first tag. */
const classesOf = (markup: string) => (markup.match(/^<[^>]*?\bclass="([^"]*)"/)?.[1] ?? "").split(" ");
/** The ruled keyboard focus ring: 2 px of ink, 2 px outside the control. */
const FOCUS_RING = ["focus-visible:outline-2", "focus-visible:outline-offset-2", "focus-visible:outline-ac-ink"];

// [track, its landing config, the title and the line the landing has always shown]
const TRACKS: Array<[AcademyPathType, AcademyLandingPageConfig, string, string]> = [
  ["avalanche", avalancheDeveloperAcademyLandingPageConfig, "Avalanche L1 Learning Tree", "Deploy L1s, bridge tokens, run and customize your own infrastructure"],
  ["blockchain", blockchainAcademyLandingPageConfig, "Blockchain Learning Tree", "Master Solidity and deploy smart contracts"],
  ["entrepreneur", entrepreneurAcademyLandingPageConfig, "Entrepreneur Learning Tree", "Build your foundation, scale your Web3 venture"],
  ["team1", team1AcademyLandingPageConfig, "Team1 Learning Tree", "From fundamentals to advanced technical leadership and event organizing"],
];

describe("landing header server markup", () => {
  it.each(TRACKS)("%s: the h1 carries the title at server render, the line under it", (_id, config, title, line) => {
    const html = render(config);
    expect(html).toContain(`>${title}</h1><p class=`);
    expect(html).toMatch(new RegExp(`</h1><p [^>]*>${line}</p>`));
  });

  it.each(TRACKS)("%s: the button starts card 01's course", (id, config) => {
    const [first] = coursesInOrder(getAcademyTrack(id).courses);
    const button = anchor(render(config), `>Start with ${first.name}<`);
    expect(button).toContain(`href="${courseUrl(id, first.slug)}"`);
    expect(button).toContain("bg-ac-ink");
  });

  it.each(TRACKS)("%s: the button draws the 2 px ink focus ring", (id, config) => {
    const [first] = coursesInOrder(getAcademyTrack(id).courses);
    expect(classesOf(anchor(render(config), `>Start with ${first.name}<`))).toEqual(expect.arrayContaining(FOCUS_RING));
  });

  it.each(TRACKS)("%s: the tabs follow the button, with this track current", (id, config) => {
    const html = render(config);
    // The tab row is a div with the navigation role, not a nav element (app/global.css styles every `nav a`).
    expect(html.indexOf('<div role="navigation"')).toBeGreaterThan(html.indexOf(">Start with "));
    expect(anchor(html, 'aria-current="page"')).toContain(`href="${getAcademyTrack(id).href}"`);
  });

  it("paints the hub's ground inside the landing root, with no typewriter, legend or rail", () => {
    const html = render(avalancheDeveloperAcademyLandingPageConfig);
    expect(html).toMatch(/<main [^>]*data-academy="landing"[^>]*><div aria-hidden="true" class="[^"]*bg-ac-ground/);
    expect(html).not.toContain("bg-[size:24px_24px]");
    expect(html).not.toContain("animate-pulse");
    expect(html).not.toContain("sm:block");
    expect(html).not.toContain("fixed left-3");
  });
});
