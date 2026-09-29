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
