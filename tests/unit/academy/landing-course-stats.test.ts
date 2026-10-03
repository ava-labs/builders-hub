import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ACADEMY_COURSES } from "@/components/academy/learning-path-configs/academy.config";
import { ACADEMY_TRACKS, courseUrl } from "@/components/academy/shared/academy-tracks";
import { academyCourseUrl } from "@/lib/academy/academy-programme";
import { getCourseStats, type CourseStats } from "@/lib/academy/course-outline";
import { COURSE_STATS } from "@/lib/academy/course-stats.generated";
import { loadAcademyTree } from "@/tests/unit/academy/helpers/content-tree";

const ROOT = process.cwd();
const SEGMENTS = ["avalanche-l1", "blockchain", "team1"] as const;
// The real academy page tree (the content-tree helper: content/academy through fumadocs' own loader).
const tree = loadAcademyTree();
const statsBySegment = new Map(SEGMENTS.map((segment) => [segment, getCourseStats(tree, segment)]));
const landingStats: Record<string, CourseStats> = { ...statsBySegment.get("avalanche-l1"), ...statsBySegment.get("blockchain") };

describe("landing card stats", () => {
  it.each(ACADEMY_COURSES.map((course) => [course.name, course] as const))("%s on /academy resolves to a stats entry", (_name, course) => {
    const stats = landingStats[academyCourseUrl(course)];
    expect(stats, academyCourseUrl(course)).toBeDefined();
    expect(stats.lessons).toBeGreaterThan(0);
  });

  it("resolves every Team1 card", () => {
    const [team1] = ACADEMY_TRACKS;
    const stats = statsBySegment.get("team1") ?? {};
    team1.courses.forEach((node) => expect(stats[courseUrl(team1.id, node.slug)], node.id).toBeDefined());
  });

  it("covers the 19 cards of the two landings: 13 on /academy, 6 on Team1", () => {
    expect(ACADEMY_COURSES.length + ACADEMY_TRACKS[0].courses.length).toBe(19);
  });
});

describe("the generated stats module", () => {
  const generated: Record<string, Record<string, CourseStats>> = COURSE_STATS;

  it("holds the three url segments", () => {
    expect(Object.keys(generated)).toEqual([...SEGMENTS]);
  });

  it.each(SEGMENTS)("%s matches content/academy (after a content change, run yarn generate:course-stats)", (segment) => {
    expect(generated[segment]).toEqual(statsBySegment.get(segment));
  });
});

describe("each landing passes its stats from the generated module", () => {
  const read = (file: string) => readFileSync(join(ROOT, file), "utf8");

  it("/academy merges the avalanche-l1 and blockchain maps", () => {
    const source = read("app/(home)/academy/page.tsx");
    expect(source).toMatch(/COURSE_STATS\[["']avalanche-l1["']\]/);
    expect(source).toMatch(/COURSE_STATS\[["']blockchain["']\]/);
    expect(source).toMatch(/<AcademyLanding[\s\S]*?courseStats=\{courseStats\}/);
    // lib/source loads every MDX module of the site; the landings read the generated module instead.
    expect(source).not.toContain("@/lib/source");
  });

  it("/academy/team1 passes its own", () => {
    const source = read("app/(home)/academy/team1/page.tsx");
    expect(source).toMatch(/COURSE_STATS\[["']team1["']\]/);
    expect(source).toMatch(/<AcademyLayout[\s\S]*?courseStats=\{courseStats\}/);
    expect(source).not.toContain("@/lib/source");
  });
});
