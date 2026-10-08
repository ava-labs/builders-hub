import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { getPathMatch } from "next/dist/shared/lib/router/utils/path-match";
import { matchHas } from "next/dist/shared/lib/router/utils/prepare-destination";
import { describe, expect, it, vi } from "vitest";

// next.config.mjs wraps its config in fumadocs-mdx's createMDX; the redirects are plain data under it.
vi.mock("fumadocs-mdx/next", () => ({ createMDX: () => (config: unknown) => config }));

import nextConfig from "@/next.config.mjs";
import quizData from "@/components/quizzes/data";
import courses, { getCourseConfig } from "@/content/courses";
import { firstRedirect, type RedirectRule } from "./helpers/redirects";

const ROOT = process.cwd();
const TRACK_URL = "/academy/entrepreneur";
const COURSE_IDS = ["foundations-web3-venture", "go-to-market", "web3-community-architect", "fundraising-finance"];
const redirects = (await nextConfig.redirects!()) as RedirectRule[];

const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => (statSync(join(dir, name)).isDirectory() ? files(join(dir, name)) : [join(dir, name)]));

/** The redirect Next.js applies to `pathname` with `query` and no headers or cookies, `has` conditions included (resolve-routes.js). */
const redirectWithQuery = (pathname: string, query: Record<string, string>) =>
  redirects.find(
    (rule) =>
      getPathMatch(rule.source, { strict: true, removeUnnamedParams: true })(pathname) !== false &&
      matchHas({ headers: {} } as never, query, rule.has as never) !== false,
  );

describe("Entrepreneur Academy redirects (FDE-153)", () => {
  it.each([
    TRACK_URL,
    `${TRACK_URL}/go-to-market`,
    `${TRACK_URL}/go-to-market/06-pricing/01-introduction`,
    `${TRACK_URL}/go-to-market/certificate`,
    `${TRACK_URL}/go-to-market/06-pricing/01-introduction.md`,
    // The two targets of the five Team1 links, which stay (R6).
    `${TRACK_URL}/web3-community-architect`,
    `${TRACK_URL}/web3-community-architect/07-community-building/09-event-planning-for-community`,
  ])("%s answers a 308 to /academy", (path) => {
    expect(firstRedirect(redirects, path)).toMatchObject({ destination: "/academy", permanent: true });
  });

  it.each([
    "/codebase-entrepreneur",
    "/codebase-entrepreneur/foundations-web3-venture",
    "/codebase-entrepreneur-academy",
    "/codebase-entrepreneur-academy/09-fundraising",
    "/academy/codebase-entrepreneur-academy/09-fundraising/01-introduction",
  ])("the old Codebase URL %s goes straight to /academy", (path) => {
    expect(firstRedirect(redirects, path)).toMatchObject({ destination: "/academy", permanent: true });
  });

  it("points no redirect into the removed track", () => {
    expect(redirects.filter((rule) => rule.destination.startsWith(TRACK_URL)).map((rule) => rule.source)).toEqual([]);
  });

  it("renders /academy?path=entrepreneur as /academy, with no redirect (one to /academy would loop)", () => {
    expect(redirectWithQuery("/academy", { path: "entrepreneur" })).toBeUndefined();
    // The matcher does read query rules: the Team1 one still applies.
    expect(redirectWithQuery("/academy", { path: "team1" })).toMatchObject({ destination: "/academy/team1" });
  });
});

describe("Entrepreneur Academy removal (FDE-153)", () => {
  it("deletes the track's pages and landing, and drops it from the Academy sidebar", () => {
    expect(existsSync(join(ROOT, "content/academy/entrepreneur"))).toBe(false);
    expect(existsSync(join(ROOT, "app/(home)/academy/entrepreneur"))).toBe(false);
    const meta = JSON.parse(readFileSync(join(ROOT, "content/academy/meta.json"), "utf8"));
    expect(meta.pages).not.toContain("entrepreneur");
  });

  it("keeps no quiz data for the four courses", () => {
    expect(COURSE_IDS.filter((id) => id in quizData.courses)).toEqual([]);
    expect(COURSE_IDS.filter((id) => existsSync(join(ROOT, `components/quizzes/data/courses/${id}.json`)))).toEqual([]);
  });

  it("no longer issues their certificates or lists them in any course list (R3)", () => {
    expect(COURSE_IDS.filter((id) => getCourseConfig()[id])).toEqual([]);
    const listed = Object.values(courses).flat().map((course) => course.slug);
    expect(COURSE_IDS.filter((id) => listed.includes(id))).toEqual([]);
  });

  it("leaves only the Avalanche Academy template, the one the certificate route fills", () => {
    const templates = new Set(Object.values(getCourseConfig()).map((course) => course.template.split("/").pop()));
    expect([...templates]).toEqual(["AvalancheAcademy_Certificate.pdf"]);
  });

  it("deletes the Flashcards component and the track's media, which no remaining page uses (R7, R8)", () => {
    expect(existsSync(join(ROOT, "components/flashcards"))).toBe(false);
    expect(existsSync(join(ROOT, "public/common-images/academy/entrepreneur"))).toBe(false);
    const using = files(join(ROOT, "content"))
      .filter((file) => /\.mdx?$/.test(file) && /components\/flashcards|common-images\/academy\/entrepreneur/.test(readFileSync(file, "utf8")))
      .map((file) => file.slice(ROOT.length + 1));
    expect(using).toEqual([]);
  });
});
