import { describe, expect, it } from "vitest";
import { HackathonEvaluationPhase } from "@prisma/client";
import { parsePhaseBody } from "@/lib/hackathons/evaluation-phase";

describe("parsePhaseBody", () => {
  it("defaults to picking so a bodyless POST keeps advancing", () => {
    for (const body of [{}, undefined, null]) {
      const parsed = parsePhaseBody(body);
      expect(parsed.success && parsed.data.phase).toBe(
        HackathonEvaluationPhase.PICKING,
      );
    }
  });

  it("accepts an explicit phase in both directions", () => {
    expect(
      parsePhaseBody({ phase: "EVALUATION" }).success &&
        parsePhaseBody({ phase: "EVALUATION" }).data.phase,
    ).toBe(HackathonEvaluationPhase.EVALUATION);
    expect(
      parsePhaseBody({ phase: "PICKING" }).success &&
        parsePhaseBody({ phase: "PICKING" }).data.phase,
    ).toBe(HackathonEvaluationPhase.PICKING);
  });

  it("rejects an unknown phase", () => {
    expect(parsePhaseBody({ phase: "WINNERS" }).success).toBe(false);
    expect(parsePhaseBody({ phase: 3 }).success).toBe(false);
  });
});
