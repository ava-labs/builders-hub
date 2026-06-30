import { describe, it, expect } from "vitest";
import { miniGrantFormSchema } from "@/types/miniGrantForm";

const valid = { project_url: "https://example.com", requested_amount_usd: 5000, summary: "A useful summary.", milestones: "M1; M2; M3", why_grant: "We have real impact and the funding helps us ship.", x_profile: "@builder" };

describe("miniGrantFormSchema", () => {
  it("accepts valid (optional omitted)", () => { expect(miniGrantFormSchema.safeParse(valid).success).toBe(true); });
  it("rejects bad URL", () => { expect(miniGrantFormSchema.safeParse({ ...valid, project_url: "nope" }).success).toBe(false); });
  it("rejects budget out of range (max 10000)", () => {
    expect(miniGrantFormSchema.safeParse({ ...valid, requested_amount_usd: 10001 }).success).toBe(false);
    expect(miniGrantFormSchema.safeParse({ ...valid, requested_amount_usd: 0 }).success).toBe(false);
    expect(miniGrantFormSchema.safeParse({ ...valid, requested_amount_usd: 10000 }).success).toBe(true);
  });
  it("treats empty optional url as omitted", () => {
    const r = miniGrantFormSchema.safeParse({ ...valid, additional_url: "" });
    expect(r.success && r.data.additional_url === undefined).toBe(true);
  });
  it("requires x_profile (handle or URL accepted)", () => {
    expect(miniGrantFormSchema.safeParse({ ...valid, x_profile: "" }).success).toBe(false);
    const { x_profile, ...withoutX } = valid;
    expect(miniGrantFormSchema.safeParse(withoutX).success).toBe(false);
    expect(miniGrantFormSchema.safeParse({ ...valid, x_profile: "https://x.com/builder" }).success).toBe(true);
  });
  it("treats empty telegram as omitted, accepts a handle", () => {
    const empty = miniGrantFormSchema.safeParse({ ...valid, telegram: "" });
    expect(empty.success && empty.data.telegram === undefined).toBe(true);
    const set = miniGrantFormSchema.safeParse({ ...valid, telegram: "@builder" });
    expect(set.success && set.data.telegram === "@builder").toBe(true);
  });
});
