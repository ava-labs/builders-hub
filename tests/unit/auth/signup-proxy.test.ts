import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { proxy } from "@/proxy";

vi.mock("next-auth/jwt", () => ({ getToken: vi.fn() }));
vi.mock("next-auth/middleware", () => ({ withAuth: vi.fn() }));

describe("signup proxy", () => {
  beforeEach(() => vi.mocked(getToken).mockResolvedValue({ custom_attributes: [] }));

  it("redirects an authenticated visitor to their local callback", async () => {
    const response = await proxy(new NextRequest("https://build.avax.network/signup?callbackUrl=%2Fevents%2FX&ref=TEAM1&utm_source=qr"));
    expect(response?.headers.get("location")).toBe("https://build.avax.network/events/X?ref=TEAM1&utm_source=qr");
  });

  it.each(["login", "signup"])("preserves the Team1 OAuth callback on authenticated /%s", async (page) => {
    const origin = "https://builder-hub-preview.vercel.app";
    const callback = `${origin}/api/oauth/authorize?client_id=team1&state=original-state`;
    const response = await proxy(new NextRequest(`${origin}/${page}?${new URLSearchParams({ callbackUrl: callback, ref: "TEAM1", utm_source: "qr" })}`));
    expect(response?.headers.get("location")).toBe(`${callback}&ref=TEAM1&utm_source=qr`);
  });

  it("rejects callbacks on a different deployment origin", async () => {
    const response = await proxy(new NextRequest("https://builder-hub-preview.vercel.app/login?callbackUrl=https%3A%2F%2Fbuild.avax.network%2Fapi%2Foauth%2Fauthorize"));
    expect(response?.headers.get("location")).toBe("https://builder-hub-preview.vercel.app/");
  });

  it("rejects external callback redirects", async () => {
    const response = await proxy(new NextRequest("https://build.avax.network/signup?callbackUrl=https%3A%2F%2Fexample.com"));
    expect(response?.headers.get("location")).toBe("https://build.avax.network/");
  });

  it("lets anonymous visitors use the signup page without opening a protected-path modal", async () => {
    vi.mocked(getToken).mockResolvedValue(null);
    const response = await proxy(new NextRequest("https://build.avax.network/signup?ref=TEAM1"));
    expect(response?.headers.get("location")).toBeNull();
    expect(response?.headers.get("x-auth-required")).toBeNull();
  });
});
