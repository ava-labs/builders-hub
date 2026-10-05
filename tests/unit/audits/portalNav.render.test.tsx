import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const nav = vi.hoisted(() => ({ pathname: "/audits/portal" }));
vi.mock("next/navigation", () => ({ usePathname: () => nav.pathname }));

import { PortalShell } from "@/components/audits/portal/PortalShell";

const render = (props: { firmName: string | null; awaitingCount: number | null }) =>
  renderToStaticMarkup(createElement(PortalShell, props));

/** The markup of the anchor whose text starts with `label`, up to the next anchor. */
const anchorFor = (html: string, label: string) =>
  html
    .split("<a ")
    .map((segment) => `<a ${segment}`)
    .find((segment) => segment.includes(`>${label}<`)) ?? "";

describe("PortalShell navigation row", () => {
  it("renders Inbox and Firm details tabs pointing at the two portal pages", () => {
    nav.pathname = "/audits/portal";
    const html = render({ firmName: "Foxline Security", awaitingCount: 0 });
    expect(anchorFor(html, "Inbox")).toContain('href="/audits/portal"');
    expect(anchorFor(html, "Firm details")).toContain('href="/audits/portal/firm"');
  });

  it("marks Inbox current on the inbox and on a request page", () => {
    nav.pathname = "/audits/portal";
    let html = render({ firmName: "Foxline Security", awaitingCount: 0 });
    expect(anchorFor(html, "Inbox")).toContain('aria-current="page"');
    expect(anchorFor(html, "Firm details")).not.toContain('aria-current="page"');

    nav.pathname = "/audits/portal/requests/req-1";
    html = render({ firmName: "Foxline Security", awaitingCount: 0 });
    expect(anchorFor(html, "Inbox")).toContain('aria-current="page"');
    expect(anchorFor(html, "Firm details")).not.toContain('aria-current="page"');
  });

  it("marks Firm details current on the firm details page", () => {
    nav.pathname = "/audits/portal/firm";
    const html = render({ firmName: "Foxline Security", awaitingCount: 0 });
    expect(anchorFor(html, "Firm details")).toContain('aria-current="page"');
    expect(anchorFor(html, "Inbox")).not.toContain('aria-current="page"');
  });

  it("shows the awaiting count on Inbox with a plural-aware title", () => {
    nav.pathname = "/audits/portal";
    const two = anchorFor(render({ firmName: "Foxline Security", awaitingCount: 2 }), "Inbox");
    expect(two).toContain(">2<");
    expect(two).toContain('title="2 requests awaiting your quote"');

    const one = anchorFor(render({ firmName: "Foxline Security", awaitingCount: 1 }), "Inbox");
    expect(one).toContain('title="1 request awaiting your quote"');
  });

  it("shows no badge when nothing is awaiting", () => {
    nav.pathname = "/audits/portal";
    const inbox = anchorFor(render({ firmName: "Foxline Security", awaitingCount: 0 }), "Inbox");
    expect(inbox).toContain('href="/audits/portal"');
    expect(inbox).not.toContain(">0<");
    expect(inbox).not.toContain("awaiting your quote");
  });

  it("renders no navigation row when no firm is resolved", () => {
    nav.pathname = "/audits/portal/sign-in";
    const html = render({ firmName: null, awaitingCount: null });
    expect(html).not.toContain("<nav");
    expect(html).not.toContain(">Inbox<");
    expect(html).toContain("Exit portal");
  });

  it("keeps the firm pill as the named link to Firm details", () => {
    nav.pathname = "/audits/portal";
    const html = render({ firmName: "Foxline Security", awaitingCount: 0 });
    const pill = html
      .split("<a ")
      .map((segment) => `<a ${segment}`)
      .find((segment) => segment.includes("Foxline Security")) ?? "";
    expect(pill).toContain('href="/audits/portal/firm"');
    expect(pill).toContain('title="Firm details"');
  });
});
