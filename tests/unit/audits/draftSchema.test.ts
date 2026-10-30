import { describe, expect, it } from "vitest";
import {
  auditDraftSchema,
  auditorGithubUpdateSchema,
  auditSubmitSchema,
  githubProfileUrl,
  isGithubUsername,
  submitRequestSchema,
} from "@/types/audits";
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

describe("submitRequestSchema · calendar share", () => {
  it("reads consent alone as sharing nothing", () => {
    expect(submitRequestSchema.safeParse({ contact_consent: true })).toMatchObject({
      success: true,
      data: { share_contact_handle: false, share_calendar: false },
    });
  });

  it("carries the calendar choice next to the consent", () => {
    for (const share of [true, false]) {
      expect(
        submitRequestSchema.safeParse({ contact_consent: true, share_calendar: share }),
      ).toMatchObject({
        success: true,
        data: { share_contact_handle: false, share_calendar: share },
      });
    }
  });

  it("carries both choices when the project shares both", () => {
    expect(
      submitRequestSchema.safeParse({
        contact_consent: true,
        share_contact_handle: true,
        share_calendar: true,
      }),
    ).toMatchObject({ success: true, data: { share_contact_handle: true, share_calendar: true } });
  });

  it("rejects a calendar choice that is not a boolean", () => {
    for (const share of ["true", 1, null]) {
      expect(
        submitRequestSchema.safeParse({ contact_consent: true, share_calendar: share }).success,
      ).toBe(false);
    }
  });
});

describe("auditorGithubUpdateSchema · one person's GitHub username", () => {
  const parse = (value: unknown) => auditorGithubUpdateSchema.safeParse({ github_username: value });
  const stored = (value: unknown) => {
    const parsed = parse(value);
    return parsed.success ? parsed.data.github_username : "REJECTED";
  };

  it("takes a pasted @name or profile link down to the username", () => {
    for (const input of [
      "octocat",
      "@octocat",
      " octocat ",
      "https://github.com/octocat",
      "http://github.com/octocat/",
      "https://www.github.com/octocat",
      "github.com/octocat",
      "www.github.com/octocat/",
    ]) {
      expect(stored(input)).toBe("octocat");
    }
  });

  it("stores the name as typed, case and all", () => {
    expect(stored("GitHub.com/OctoCat")).toBe("OctoCat");
  });

  it("follows GitHub's rule: 1 to 39 letters, digits and single inner hyphens", () => {
    for (const ok of ["a", "0", "a-b-c", "a".repeat(39)]) expect(stored(ok)).toBe(ok);
    for (const bad of [
      "a".repeat(40),
      "-octocat",
      "octocat-",
      "octo--cat",
      "octo_cat",
      "octo.cat",
    ]) {
      expect(stored(bad)).toBe("REJECTED");
    }
  });

  it("refuses a link to anything but a profile and says what a username is", () => {
    for (const bad of [
      "https://github.com/octocat?tab=repositories",
      "github.com/octocat/hello-world",
      "https://gist.github.com/octocat",
    ]) {
      const parsed = parse(bad);
      expect(parsed.success).toBe(false);
      if (!parsed.success) expect(parsed.error.issues[0].message).toContain("GitHub username");
    }
  });

  it("clears on an empty value", () => {
    for (const empty of ["", "   ", null]) expect(stored(empty)).toBeNull();
  });

  it("names the value and nothing else, so a body cannot pick another person", () => {
    expect(auditorGithubUpdateSchema.safeParse({}).success).toBe(false);
    expect(
      auditorGithubUpdateSchema.safeParse({
        github_username: "octocat",
        email: "quotes@nordlicht.example",
      }).success,
    ).toBe(false);
    expect(parse(7).success).toBe(false);
  });
});

describe("GitHub username rule (step 2)", () => {
  // One rule for the portal write and for the reads that turn a stored value
  // into a profile link: what the schema refuses can never become a link.
  const cases: [string, boolean][] = [
    ["a", true],
    ["alice-kv", true],
    ["A1b2", true],
    ["a".repeat(39), true],
    ["-a", false],
    ["a-", false],
    ["a--b", false],
    ["a".repeat(40), false],
    ["a_b", false],
    ["a b", false],
  ];

  it("isGithubUsername accepts exactly what the schema accepts", () => {
    for (const [value, want] of cases) {
      expect(isGithubUsername(value)).toBe(want);
      expect(auditorGithubUpdateSchema.safeParse({ github_username: value }).success).toBe(want);
    }
  });

  it("githubProfileUrl builds the profile link", () => {
    expect(githubProfileUrl("alice-kv")).toBe("https://github.com/alice-kv");
  });
});
