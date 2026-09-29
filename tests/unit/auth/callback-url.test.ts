import { describe, expect, it } from "vitest";
import { getAuthCallbackUrl } from "@/lib/auth/callback-url";

describe("auth page callback destinations", () => {
  it("preserves local paths, query parameters and fragments", () => {
    expect(getAuthCallbackUrl("/events/X?ref=TEAM1&utm_source=qr#register")).toBe("/events/X?ref=TEAM1&utm_source=qr#register");
  });

  it("forwards referral and campaign parameters without replacing callback parameters", () => {
    expect(getAuthCallbackUrl("/events/X?ref=EXISTING", new URLSearchParams("ref=TEAM1&utm_source=qr&other=ignored"))).toBe("/events/X?ref=EXISTING&utm_source=qr");
  });

  it.each([undefined, ["/events/X"], "https://example.com", "//example.com", "/\\example.com", "/\n/example.com", "/signup", "/login?callbackUrl=/signup", "/events/../signup"])("rejects unsafe or looping destination %s", (value) => {
    expect(getAuthCallbackUrl(value)).toBe("/");
  });
});
