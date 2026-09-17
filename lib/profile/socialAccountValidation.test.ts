import { describe, expect, it } from "vitest";
import { LINKEDIN_ACCOUNT_PATTERN } from "./socialAccountValidation";

describe("LINKEDIN_ACCOUNT_PATTERN", () => {
  it.each([
    "https://www.linkedin.com/in/john-doe/",
    "https://linkedin.com/in/jörg-müller",
    "https://linkedin.com/in/j%C3%B6rg",
    "https://linkedin.com/company/übercorp",
  ])("accepts %s", (url) => {
    expect(LINKEDIN_ACCOUNT_PATTERN.test(url)).toBe(true);
  });

  it.each([
    "https://linkedin.com/in/",
    "https://evil.com/in/someone",
    "https://linkedin.com/feed/",
  ])("rejects %s", (url) => {
    expect(LINKEDIN_ACCOUNT_PATTERN.test(url)).toBe(false);
  });
});
