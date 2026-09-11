import { describe, expect, it } from "vitest";
import { auditDraftSchema, auditSubmitSchema } from "@/types/audits";

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

describe("auditDraftSchema · shortlist_auditor_ids", () => {
  it("accepts an empty array", () => {
    expect(auditDraftSchema.safeParse({ shortlist_auditor_ids: [] }).success).toBe(true);
  });

  it("accepts 50 uuids and rejects 51", () => {
    expect(
      auditDraftSchema.safeParse({ shortlist_auditor_ids: Array.from({ length: 50 }, (_, i) => uuid(i)) }).success,
    ).toBe(true);
    expect(
      auditDraftSchema.safeParse({ shortlist_auditor_ids: Array.from({ length: 51 }, (_, i) => uuid(i)) }).success,
    ).toBe(false);
  });

  it("rejects a non-uuid and rejects duplicates", () => {
    expect(auditDraftSchema.safeParse({ shortlist_auditor_ids: ["not-a-uuid"] }).success).toBe(false);
    expect(auditDraftSchema.safeParse({ shortlist_auditor_ids: [uuid(1), uuid(1)] }).success).toBe(false);
  });

  it("lowercases an uppercase uuid so the case-sensitive `in` clause still matches (S-28)", () => {
    const parsed = auditDraftSchema.safeParse({ shortlist_auditor_ids: [uuid(1).toUpperCase()] });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.shortlist_auditor_ids).toEqual([uuid(1)]);
  });

  it("is absent from the submit schema, so an empty shortlist stays submittable (fanout.test.ts:117)", () => {
    // auditSubmitSchema neither requires nor rejects the key: unknown keys are stripped.
    const parsed = auditSubmitSchema.safeParse({
      project_name: "X",
      website: "https://x.example",
      description: "0123456789",
      scope: "0123456789",
      deployment_target: "c_chain",
      services: ["OpSec"],
      needed_by: new Date(),
      contact_name: "A",
      contact_email: "a@b.example",
      shortlist_auditor_ids: [uuid(1)],
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect("shortlist_auditor_ids" in parsed.data).toBe(false);
  });

  it("rejects reserved columns through the strictObject (S-18)", () => {
    expect(auditDraftSchema.safeParse({ status: "collecting" }).success).toBe(false);
    expect(auditDraftSchema.safeParse({ user_id: "u1" }).success).toBe(false);
    expect(auditDraftSchema.safeParse({ id: "r1" }).success).toBe(false);
  });
});
