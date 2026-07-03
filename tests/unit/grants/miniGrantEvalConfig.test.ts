import { describe, it, expect } from "vitest";
import { miniGrantFormSchema } from "@/types/miniGrantForm";
import { EVENT_CONFIGS } from "@/components/evaluate/event-configs";
import { MINI_GRANT_KEY } from "@/lib/grants/programs";

describe("mini grant evaluation config", () => {
  it("renders every applicant-entered field in the evaluation detail view", () => {
    const sections = EVENT_CONFIGS[MINI_GRANT_KEY].applicationDetailSections ?? [];
    const configuredKeys = new Set(sections.flatMap((s) => s.fields.map((f) => f.key)));
    const formKeys = Object.keys(miniGrantFormSchema.shape);
    const missing = formKeys.filter((k) => !configuredKeys.has(k));
    expect(missing).toEqual([]);
  });
});
