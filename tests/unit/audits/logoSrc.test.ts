import { describe, expect, it } from "vitest";
import { isAllowedLogoSrc } from "@/lib/audits/logoSrc";

const HOST = "qizat5l3bwvomkny.public.blob.vercel-storage.com";

describe("isAllowedLogoSrc", () => {
  it("accepts an https URL on our own blob store with a path", () => {
    expect(isAllowedLogoSrc(`https://${HOST}/userid/abc.png`)).toBe(true);
  });
  it("rejects everything else (S-9, S-10)", () => {
    for (const bad of [
      "javascript:alert(1)",
      "data:image/png;base64,AAAA",
      `http://${HOST}/a`,
      "https://evil.example/logo.png",
      `https://${HOST}.evil.example/a`,
      "/images/bailsec.svg",
      "../secret.png",
      `https://evil.example/#.${HOST}/a.png`,
      `https://evil.example/?x=.${HOST}/a.png`,
      `https://${HOST}`,
      "https://other.public.blob.vercel-storage.com/a.png",
    ]) {
      expect(isAllowedLogoSrc(bad)).toBe(false);
    }
  });
});
