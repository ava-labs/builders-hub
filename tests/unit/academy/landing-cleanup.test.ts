import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const SCAN = ["app", "components", "hooks", "lib", "utils"];
const DELETED = ["components/academy/shared/academy-bubble-nav.tsx", "hooks/useCourseBadges.ts"];
const NAMES = ["academy-bubble-nav", "AcademyBubbleNav", "useCourseBadges", "LearningTreeLegend"];

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.(ts|tsx)$/.test(entry) ? [path] : [];
  });
}

describe("removed landing rail, badge fetch and legend", () => {
  it.each(DELETED)("%s is gone", (file) => {
    expect(existsSync(join(ROOT, file))).toBe(false);
  });

  it("leaves no reference to the rail, the badge fetch or the legend", () => {
    const hits = SCAN.flatMap((dir) => sources(join(ROOT, dir)))
      .filter((file) => {
        const text = readFileSync(file, "utf8");
        return NAMES.some((name) => text.includes(name));
      })
      .map((file) => relative(ROOT, file));
    expect(hits).toEqual([]);
  });
});
