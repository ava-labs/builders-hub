import { describe, expect, it } from "vitest";
import { inviteSchema, inviteErrorMessage, MAX_EMAILS_PER_REQUEST } from "@/lib/invitations/inviteSchema";

// Ids observed in a real (development) database. Both columns are plain String
// with a uuid() default, so hand-seeded and restored rows can hold anything; a
// `.uuid()` check on either field 400s the invite for those rows.
const MALFORMED_UUID_HACKATHON = "12fce9b-4d44-4d40-8fbe-7903e76d48fa"; // 7 hex chars, not 8
const CUID_PROJECT = "cmlj6kn6a0000l804y2r9q9s1";
const UUID_HACKATHON = "249d2911-7931-4aa0-a696-37d8370b79f9";

const parse = (body: unknown) => inviteSchema.safeParse(body);

describe("inviteSchema accepts every id shape the database actually holds", () => {
  it("accepts a hackathon id that is not a well-formed uuid", () => {
    expect(parse({ hackathon_id: MALFORMED_UUID_HACKATHON, emails: ["a@b.com"] }).success).toBe(true);
  });

  it("accepts a project id that is a cuid", () => {
    const r = parse({ hackathon_id: UUID_HACKATHON, project_id: CUID_PROJECT, emails: ["a@b.com"] });
    expect(r.success).toBe(true);
  });

  it("accepts an omitted or empty project_id (invite before the project exists)", () => {
    expect(parse({ hackathon_id: UUID_HACKATHON, emails: ["a@b.com"] }).success).toBe(true);
    expect(parse({ hackathon_id: UUID_HACKATHON, project_id: "", emails: ["a@b.com"] }).success).toBe(true);
  });

  it("accepts the optional stage / user_id / lang the hackathon form sends", () => {
    const r = parse({
      hackathon_id: UUID_HACKATHON,
      project_id: "",
      emails: ["a@b.com"],
      user_id: "user-1",
      stage: 2,
      lang: "es",
    });
    expect(r.success).toBe(true);
  });
});

describe("inviteSchema still rejects what it must", () => {
  it("requires a hackathon id", () => {
    expect(parse({ hackathon_id: "", emails: ["a@b.com"] }).success).toBe(false);
  });

  it("requires at least one email and caps the batch", () => {
    expect(parse({ hackathon_id: UUID_HACKATHON, emails: [] }).success).toBe(false);
    const tooMany = { hackathon_id: UUID_HACKATHON, emails: Array(MAX_EMAILS_PER_REQUEST + 1).fill("a@b.com") };
    expect(parse(tooMany).success).toBe(false);
  });

  it("rejects malformed addresses", () => {
    expect(parse({ hackathon_id: UUID_HACKATHON, emails: ["notanemail"] }).success).toBe(false);
  });
});

describe("inviteErrorMessage", () => {
  const failOf = (body: unknown) => {
    const r = parse(body);
    if (r.success) throw new Error("expected a parse failure");
    return inviteErrorMessage(body, r.error);
  };

  it("names the offending addresses", () => {
    expect(failOf({ hackathon_id: UUID_HACKATHON, emails: ["ok@x.com", "notanemail"] })).toBe(
      "These addresses are not valid: notanemail",
    );
  });

  it("explains the batch cap", () => {
    const body = { hackathon_id: UUID_HACKATHON, emails: Array(MAX_EMAILS_PER_REQUEST + 1).fill("a@b.com") };
    expect(failOf(body)).toContain(`limited to ${MAX_EMAILS_PER_REQUEST}`);
  });

  it("falls back for non-email problems and survives a null body", () => {
    expect(failOf({ hackathon_id: "", emails: ["a@b.com"] })).toBe("Invalid invitation request.");
    expect(failOf(null)).toBe("Invalid invitation request.");
  });
});
