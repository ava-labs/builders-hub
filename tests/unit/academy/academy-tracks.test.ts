import { describe, expect, it } from "vitest";
import { ACADEMY_TRACKS, coursesInOrder, courseUrl, getAcademyTrack, twoDigits } from "@/components/academy/shared/academy-tracks";
import { team1LearningPaths } from "@/components/academy/learning-path-configs/team1.config";

describe("academy tracks", () => {
  it("keeps only the gated Team1 track: Avalanche L1 and Blockchain merged into the single landing", () => {
    expect(ACADEMY_TRACKS.map((t) => [t.id, t.label, t.href, t.segment])).toEqual([["team1", "Team1", "/academy/team1", "team1"]]);
  });

  it("takes the Team1 courses from its config array, so counts are never typed", () => {
    expect(getAcademyTrack("team1").courses).toBe(team1LearningPaths);
  });

  it("orders courses by mobileOrder without touching the config", () => {
    const before = team1LearningPaths.map((node) => node.id);
    expect(coursesInOrder(team1LearningPaths).map((node) => node.id)).toEqual([
      "team1-fundamentals", "team1-technical-member", "team1-advanced-technical-member",
      "team1-organizing-first-event", "team1-event-organizer-pro", "team1-soft-skills",
    ]);
    expect(team1LearningPaths.map((node) => node.id)).toEqual(before);
  });

  it("writes numbers with two digits", () => {
    expect(twoDigits(1)).toBe("01");
    expect(twoDigits(9)).toBe("09");
    expect(twoDigits(12)).toBe("12");
  });

  it("resolves course urls as the tree always has", () => {
    expect(courseUrl("team1", "team1/team1-fundamentals")).toBe("/academy/team1/team1-fundamentals");
  });
});
