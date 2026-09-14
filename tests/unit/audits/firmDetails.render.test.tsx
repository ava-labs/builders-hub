import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }) }));

import { FirmDetails } from "@/components/audits/portal/FirmDetails";
import type { OwnFirm } from "@/server/services/audits/visibility";

const firm = (over: Partial<OwnFirm> = {}): OwnFirm => ({
  id: "aud-1",
  firm_name: "Nordlicht Security",
  quote_email: "quotes@nordlicht.example",
  services: ["OpSec"],
  website: "https://nordlicht.example",
  logo_url: null,
  active: true,
  invited_at: new Date("2026-09-04"),
  first_login_at: new Date("2026-09-05"),
  deactivated_at: null,
  members: [
    {
      id: "mem-1",
      email: "alice@nordlicht.example",
      invited_at: new Date("2026-09-06"),
      first_login_at: null,
    },
  ],
  ...over,
});

const render = (props: { isOwner: boolean; readOnly: boolean; firm?: OwnFirm }) =>
  renderToStaticMarkup(
    createElement(FirmDetails, {
      firm: props.firm ?? firm(),
      isOwner: props.isOwner,
      readOnly: props.readOnly,
    }),
  );

describe("FirmDetails", () => {
  it("the owner sees the add form and a Remove control", () => {
    const html = render({ isOwner: true, readOnly: false });
    expect(html).toContain("Add and invite");
    expect(html).toContain("Remove");
    expect(html).not.toContain("can add or remove teammates");
  });

  it("a teammate sees neither, and the pointer names the quote email", () => {
    const html = render({ isOwner: false, readOnly: false });
    expect(html).not.toContain("Add and invite");
    expect(html).toContain("Only quotes@nordlicht.example can add or remove teammates.");
  });

  it("a deactivated firm shows the banner and disables the controls", () => {
    const html = render({ isOwner: true, readOnly: true });
    expect(html).toContain("Deactivated · read-only");
    const disabledCount = (html.match(/disabled=""/g) ?? []).length;
    expect(disabledCount).toBeGreaterThanOrEqual(2);
  });

  const LOGO = "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/audits/firms/aud-1/mark.png";

  it("shows the stored logo and the replace control when the URL is on our store", () => {
    const html = render({ isOwner: true, readOnly: false, firm: firm({ logo_url: LOGO }) });
    expect(html).toContain(`src="${LOGO}"`);
    expect(html).toContain("Replace");
    expect(html).not.toContain("Choose file");
  });

  it("falls back to the monogram and offers Choose file when there is no logo", () => {
    const html = render({ isOwner: true, readOnly: false });
    expect(html).toContain(">NS<");
    expect(html).toContain("Choose file");
    expect(html).not.toContain("<img");
  });

  it("a deactivated firm sees the logo tile read-only", () => {
    const html = render({ isOwner: true, readOnly: true, firm: firm({ logo_url: LOGO }) });
    expect(html).toContain(`src="${LOGO}"`);
    expect(html).not.toContain("Replace");
    expect(html).not.toContain("Choose file");
  });

  it("a logo off our store never renders as an image", () => {
    const html = render({
      isOwner: true,
      readOnly: false,
      firm: firm({ logo_url: "https://evil.example/x.png" }),
    });
    expect(html).not.toContain("evil.example");
    expect(html).toContain(">NS<");
  });

  it("renders the services and website helpers and the teammate-grant sentence (S-12)", () => {
    const html = render({ isOwner: true, readOnly: false });
    expect(html).toContain("Shown on the vetted firms page and on your quotes.");
    expect(html).toContain("Shown on the vetted firms page");
    expect(html).toContain(
      "Teammates receive every request this firm receives and can read its full history",
    );
  });
});
