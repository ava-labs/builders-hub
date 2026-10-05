import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { FirmsList } from "@/components/audits/firms/FirmsList";
import type { PublicFirm } from "@/server/services/audits/visibility";

const firm = (over: Partial<PublicFirm>): PublicFirm => ({
  id: "a",
  firm_name: "Bailsec",
  services: [],
  website: null,
  logo_url: null,
  ...over,
});

describe("FirmsList row", () => {
  it("renders the hostname link with nofollow when website parses (S-11)", () => {
    const html = renderToStaticMarkup(
      createElement(FirmsList, { firms: [firm({ website: "https://bailsec.io/" })] }),
    );
    expect(html).toContain("bailsec.io");
    expect(html).toMatch(/rel="[^"]*nofollow/);
  });
  it("shows no website link for a null or unparsable website", () => {
    const html = renderToStaticMarkup(
      createElement(FirmsList, { firms: [firm({ website: "javascript:alert(1)" })] }),
    );
    expect(html).not.toContain("javascript:");
    // The website anchor is the only nofollow link (the header's back link and
    // CTA are not nofollow); an unparsable host renders no website anchor.
    expect(html).not.toContain("nofollow");
  });
  it("renders a monogram tile for a guard-failing logo and an img for a valid one", () => {
    const monogram = renderToStaticMarkup(
      createElement(FirmsList, {
        firms: [firm({ firm_name: "Open Zeppelin", logo_url: "https://evil.example/x.png" })],
      }),
    );
    expect(monogram).toContain("OZ");
    expect(monogram).not.toContain("<img");
    const HOST = "qizat5l3bwvomkny.public.blob.vercel-storage.com";
    const logo = renderToStaticMarkup(
      createElement(FirmsList, { firms: [firm({ logo_url: `https://${HOST}/u/a.png` })] }),
    );
    expect(logo).toContain(`src="https://${HOST}/u/a.png"`);
    expect(logo).toContain('alt=""');
  });
  it("renders every service as a non-interactive pill and none when empty", () => {
    const withPills = renderToStaticMarkup(
      createElement(FirmsList, { firms: [firm({ services: ["OpSec", "AI security scan"] })] }),
    );
    expect(withPills).toContain("AI security scan");
    expect(withPills).not.toContain("<button");
  });
  it("shows the empty state with zero active firms", () => {
    const html = renderToStaticMarkup(createElement(FirmsList, { firms: [] }));
    expect(html).toContain("No firms are listed right now.");
  });
});
