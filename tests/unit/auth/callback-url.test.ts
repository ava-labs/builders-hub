import { describe, expect, it } from "vitest";
import { getAuthCallbackUrl } from "@/lib/auth/callback-url";

describe("auth page callback destinations", () => {
  it("preserves local paths, query parameters and fragments", () => {
    expect(getAuthCallbackUrl("/events/X?ref=TEAM1&utm_source=qr#register")).toBe("/events/X?ref=TEAM1&utm_source=qr#register");
  });

  it.each(["https://build.avax.network", "https://builder-hub-preview.vercel.app", "http://localhost:3217"])("normalizes same-origin absolute OAuth callbacks on %s", (origin) => {
    const path = "/api/oauth/authorize?client_id=team1&redirect_uri=https%3A%2F%2Fdao.team1.network%2Fcallback&state=original-state#continue";
    expect(getAuthCallbackUrl(`${origin}${path}`, new URLSearchParams("ref=TEAM1&utm_source=qr"), origin)).toBe(`${path.split('#')[0]}&ref=TEAM1&utm_source=qr#continue`);
  });

  it.each([
    "https://build.avax.network/events",
    "https://preview.vercel.app.evil.example/events",
    "http://preview.vercel.app/events",
    "https://preview.vercel.app:8443/events",
    "https://user:password@preview.vercel.app/events",
    "https://preview.vercel.app/signup",
    "https://preview.vercel.app/events/../login",
  ])("rejects unsafe absolute callback %s on a preview origin", (value) => {
    expect(getAuthCallbackUrl(value, undefined, "https://preview.vercel.app")).toBe("/");
  });

  it("forwards referral and campaign parameters without replacing callback parameters", () => {
    expect(getAuthCallbackUrl("/events/X?ref=EXISTING", new URLSearchParams("ref=TEAM1&utm_source=qr&other=ignored"))).toBe("/events/X?ref=EXISTING&utm_source=qr");
  });

  it.each([undefined, ["/events/X"], "https://example.com", "//example.com", "/events/..//example.com", "/\\example.com", "/\n/example.com", "/signup", "/login?callbackUrl=/signup", "/events/../signup"])("rejects unsafe or looping destination %s", (value) => {
    expect(getAuthCallbackUrl(value)).toBe("/");
  });
});
