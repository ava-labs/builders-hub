import { describe, expect, it, vi } from "vitest";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }) }));
// Radix portals render nothing on the server; the sheet's parts render in place.
vi.mock("@/components/ui/sheet", async () => {
  const { createElement: h } = await import("react");
  const inline =
    (tag: string) =>
    ({ children }: { children?: ReactNode }) =>
      h(tag, null, children);
  return {
    Sheet: inline("div"),
    SheetContent: inline("div"),
    SheetHeader: inline("div"),
    SheetTitle: inline("h2"),
    SheetDescription: inline("p"),
  };
});

import { AuditorDetailPanel } from "@/components/audits/admin/AuditorDetailPanel";
import type { AdminAuditorRow } from "@/server/services/audits/visibility";

const ALICE = "alice@nordlicht.example";
const BOB = "bob@nordlicht.example";

const row = (over: Partial<AdminAuditorRow> = {}): AdminAuditorRow => ({
  id: "aud-1",
  firm_name: "Nordlicht Security",
  quote_email: "quotes@nordlicht.example",
  github_username: "nordlicht-sec",
  services: ["OpSec"],
  active: true,
  invited_at: new Date("2026-09-04"),
  first_login_at: new Date("2026-09-05"),
  deactivated_at: null,
  attio_ref: null,
  website: null,
  logo_url: null,
  sent: 9,
  quoted: 3,
  won: 1,
  last_quote_at: null,
  members: [
    {
      id: "mem-1",
      email: ALICE,
      invited_at: new Date("2026-09-06"),
      first_login_at: new Date("2026-09-07"),
      github_username: "alice-audits",
    },
    {
      id: "mem-2",
      email: BOB,
      invited_at: new Date("2026-09-08"),
      first_login_at: null,
      github_username: null,
    },
  ],
  ...over,
});

const render = (auditor: AdminAuditorRow) =>
  renderToStaticMarkup(
    createElement(AuditorDetailPanel, { state: { mode: "edit", auditor }, onClose: () => {} }),
  );

describe("AuditorDetailPanel · GitHub usernames (D2.6)", () => {
  it("shows the quote-email person's username in the header", () => {
    const html = render(row());

    expect(html.indexOf("nordlicht-sec")).toBeGreaterThan(-1);
    expect(html.indexOf("nordlicht-sec")).toBeLessThan(html.indexOf("requests received"));
  });

  it("says so in the header when the quote-email person has none", () => {
    const html = render(row({ github_username: null }));

    expect(html.indexOf("No GitHub username yet")).toBeGreaterThan(-1);
    expect(html.indexOf("No GitHub username yet")).toBeLessThan(html.indexOf("requests received"));
  });

  it("shows each teammate's username under that teammate's address", () => {
    const html = render(row());

    expect(html.indexOf(ALICE)).toBeLessThan(html.indexOf("alice-audits"));
    expect(html.indexOf("alice-audits")).toBeLessThan(html.indexOf(BOB));
    expect(html.indexOf(BOB)).toBeLessThan(html.indexOf("No GitHub username yet"));
  });

  it("gives admins no way to edit a username", () => {
    const html = render(row({ github_username: null }));

    expect(html).not.toContain(">Edit<");
    expect(html).not.toContain("Add your GitHub username");
    expect(html).not.toContain("Your GitHub username");
  });
});
