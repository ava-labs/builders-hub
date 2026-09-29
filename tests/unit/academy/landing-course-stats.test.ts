import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getCourseStats, type CourseStats } from "@/lib/academy/course-outline";
import { COURSE_STATS } from "@/lib/academy/course-stats.generated";
import { ACADEMY_TRACKS, courseUrl } from "@/components/academy/shared/academy-tracks";
import { loadAcademyTree } from "@/tests/unit/academy/helpers/content-tree";

const ROOT = process.cwd();

// The real academy page tree (the content-tree helper: content/academy through fumadocs' own loader).
const tree = loadAcademyTree();
const statsByTrack = new Map(ACADEMY_TRACKS.map((track) => [track.id, getCourseStats(tree, track.segment)]));

describe("landing card stats", () => {
  it.each(ACADEMY_TRACKS.map((track) => [track.label, track] as const))("every %s card resolves to a stats entry", (_label, track) => {
    const stats = statsByTrack.get(track.id) ?? {};
    track.courses.forEach((node) => {
      const url = courseUrl(track.id, node.slug);
      expect(stats[url], `${node.id} -> ${url}`).toBeDefined();
      expect(stats[url].lessons).toBeGreaterThan(0);
    });
  });

  it("resolves every card on the four landings (23)", () => {
    const cards = ACADEMY_TRACKS.flatMap((track) => track.courses.map((node) => ({ track, node })));
    const resolved = cards.filter(({ track, node }) => (statsByTrack.get(track.id) ?? {})[courseUrl(track.id, node.slug)]);
    expect(cards).toHaveLength(23);
    expect(resolved).toHaveLength(cards.length);
  });
});

describe("the generated stats module", () => {
  const generated: Record<string, Record<string, CourseStats>> = COURSE_STATS;

  it("holds the four landing tracks", () => {
    expect(Object.keys(generated)).toEqual(ACADEMY_TRACKS.map((track) => track.segment));
  });

  it.each(ACADEMY_TRACKS.map((track) => [track.segment, track] as const))("%s matches content/academy (after a content change, run yarn generate:course-stats)", (segment, track) => {
    expect(generated[segment]).toEqual(statsByTrack.get(track.id));
  });
});

const PAGES: Array<[string, string]> = [
  ["avalanche-l1", "app/(home)/academy/avalanche-l1/page.tsx"],
  ["blockchain", "app/(home)/academy/blockchain/page.tsx"],
  ["entrepreneur", "app/(home)/academy/entrepreneur/page.tsx"],
  ["team1", "app/(home)/academy/team1/page.tsx"],
];

describe("each track page passes its own stats", () => {
  it.each(PAGES)("%s", (segment, file) => {
    const source = readFileSync(join(ROOT, file), "utf8");
    expect(source).toMatch(new RegExp(`COURSE_STATS\\[["']${segment}["']\\]`));
    expect(source).toMatch(/<AcademyLayout[\s\S]*?courseStats=\{courseStats\}/);
    // lib/source loads every MDX module of the site; the landings read the generated module instead.
    expect(source).not.toContain("@/lib/source");
  });
});
