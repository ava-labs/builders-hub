import { describe, expect, it } from "vitest";
import { auditDraftSchema, auditSubmitSchema, submitRequestSchema } from "@/types/audits";
import {
  STEP_FIELDS,
  wizardDefaults,
  type AuditWizardValues,
} from "@/components/audits/wizard/types";

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

// A complete submission, so each test varies only the field it is about.
const submittable = (over: Record<string, unknown> = {}) => ({
  project_name: "X",
  website: "https://x.example",
  description: "0123456789",
  scope: "0123456789",
  deployment_target: "c_chain",
  services: ["OpSec"],
  needed_by: new Date(),
  contact_name: "A",
  contact_email: "a@b.example",
  nsloc: 4200,
  ...over,
});

const nslocErrors = (value: unknown) => {
  const parsed = auditSubmitSchema.safeParse(submittable({ nsloc: value }));
  return parsed.success ? undefined : parsed.error.flatten().fieldErrors.nsloc;
};

describe("auditSubmitSchema · nsloc", () => {
  // Joey, 2026-09-30: two firms could not quote a request that left it blank.
  it("refuses a request with no lines of code, stored or typed", () => {
    expect(nslocErrors(null)).toBeDefined();
    expect(nslocErrors(undefined)).toBeDefined();
    expect(nslocErrors("")).toBeDefined();
  });

  it("refuses zero and anything that is not a whole number", () => {
    for (const value of [0, "0", -5, 4.5, "4k", "about 4000"]) {
      expect(nslocErrors(value)).toBeDefined();
    }
  });

  it("reads the number as the wizard holds it and as the row stores it", () => {
    const typed = auditSubmitSchema.safeParse(submittable({ nsloc: "4,200" }));
    const stored = auditSubmitSchema.safeParse(submittable({ nsloc: 4200 }));
    expect(typed.success && typed.data.nsloc).toBe(4200);
    expect(stored.success && stored.data.nsloc).toBe(4200);
  });
});

describe("wizard Scope step", () => {
  const values = (over: Partial<AuditWizardValues> = {}): AuditWizardValues => ({
    ...wizardDefaults({ contact_name: "A", contact_email: "a@b.example" }),
    services: ["OpSec"],
    scope: "Pool factory, router and incentives module.",
    ...over,
  });
  // What form.trigger(STEP_FIELDS[step]) surfaces: the whole form runs
  // through the resolver, only that step's fields report.
  const stepErrors = (step: number, form: AuditWizardValues) => {
    const parsed = auditSubmitSchema.safeParse(form);
    const errors = parsed.success ? {} : parsed.error.flatten().fieldErrors;
    return STEP_FIELDS[step].filter((field) => field in errors);
  };

  it("holds Continue until the lines of code are filled in", () => {
    expect(stepErrors(1, values())).toEqual(["nsloc"]);
    expect(stepErrors(1, values({ nsloc: "4,200" }))).toEqual([]);
  });
});

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
    const parsed = auditSubmitSchema.safeParse(submittable({ shortlist_auditor_ids: [uuid(1)] }));
    expect(parsed.success).toBe(true);
    if (parsed.success) expect("shortlist_auditor_ids" in parsed.data).toBe(false);
  });

  it("rejects reserved columns through the strictObject (S-18)", () => {
    expect(auditDraftSchema.safeParse({ status: "collecting" }).success).toBe(false);
    expect(auditDraftSchema.safeParse({ user_id: "u1" }).success).toBe(false);
    expect(auditDraftSchema.safeParse({ id: "r1" }).success).toBe(false);
  });
});

describe("submitRequestSchema · Telegram share", () => {
  it("passes consent alone and reads it as not sharing", () => {
    expect(submitRequestSchema.safeParse({ contact_consent: true })).toMatchObject({
      success: true,
      data: { share_contact_handle: false },
    });
  });

  it("carries the share choice next to the consent", () => {
    for (const share of [true, false]) {
      expect(
        submitRequestSchema.safeParse({ contact_consent: true, share_contact_handle: share }),
      ).toMatchObject({ success: true, data: { share_contact_handle: share } });
    }
  });

  it("rejects a share choice that is not a boolean", () => {
    for (const share of ["true", 1, null]) {
      expect(
        submitRequestSchema.safeParse({ contact_consent: true, share_contact_handle: share }).success,
      ).toBe(false);
    }
  });
});
