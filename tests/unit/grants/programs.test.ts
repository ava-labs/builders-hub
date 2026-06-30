import { describe, it, expect } from "vitest";
import { GRANT_PROGRAMS, isKnownGrantProgram, MINI_GRANT_KEY, MINI_GRANT_HACKATHON_ID, MINI_GRANT_SLUG } from "@/lib/grants/programs";
import { EVENT_CONFIGS } from "@/components/evaluate/event-configs";

describe("grant program registry", () => {
  it("registers Team1 Mini Grants", () => {
    expect(MINI_GRANT_KEY).toBe("grant_minigrant");
    expect(MINI_GRANT_SLUG).toBe("team1-mini-grants");
    expect(MINI_GRANT_HACKATHON_ID).toMatch(/^[0-9a-f-]{36}$/);
    expect(GRANT_PROGRAMS[MINI_GRANT_KEY]).toEqual({
      key: "grant_minigrant", title: "Team1 Mini Grants", slug: "team1-mini-grants", hackathonId: MINI_GRANT_HACKATHON_ID,
    });
  });
  it("recognises known keys", () => {
    expect(isKnownGrantProgram("grant_minigrant")).toBe(true);
    expect(isKnownGrantProgram("build_games")).toBe(false);
  });
  it("has eval config with four criteria", () => {
    expect(EVENT_CONFIGS[MINI_GRANT_KEY].scoreCriteria.map((c) => c.key)).toEqual(["impact","feasibility","team","innovation"]);
  });
});
