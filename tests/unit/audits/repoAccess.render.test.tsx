import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {}, refresh: () => {} }) }));

import { FirmUsernamesCard } from "@/components/audits/detail/FirmUsernamesCard";
import { RequestDetailView } from "@/components/audits/detail/RequestDetailView";
import { EngagedPanel } from "@/components/audits/detail/EngagedPanel";
import { SubmissionReceipt } from "@/components/audits/detail/SubmissionReceipt";
import { PortalRequestDetail } from "@/components/audits/portal/PortalRequestDetail";
import { AuditWizardProvider } from "@/components/audits/wizard/AuditWizardContext";
import { RepoRepeater } from "@/components/audits/wizard/RepoRepeater";
import { wizardDefaults } from "@/components/audits/wizard/types";
import type {
  AuditorRequestView,
  FirmUsernames,
  OwnerRequestDetail,
} from "@/server/services/audits/visibility";

/**
 * FDE-249 step 2 on the project's own request page: the GitHub usernames of
 * the firms its request reached, while quotes are open (design D4), and the
 * winner's once a quote is accepted (D5).
 */

type OwnerQuote = OwnerRequestDetail["quotes"][number];

/** renderToStaticMarkup escapes the apostrophe; compare against the text. */
const text = (html: string) => html.replace(/&#x27;/g, "'");

const count = (html: string, part: string) => html.split(part).length - 1;

/** The opening tag of the anchor whose whole text is `label`. */
const anchorTo = (html: string, label: string) =>
  html.match(new RegExp(`<a [^>]*>${label}</a>`))?.[0] ?? "";

const LABEL = "GitHub usernames · firms this request reached";
const LEAD =
  "Private repo? Add the firms you want quotes from as collaborators, so they can read the code before they quote.";
const WARNING =
  "Open each profile before you invite it: each person types their own username, and a typo would give a stranger access.";
const LIMITS =
  "On a repository owned by your personal account, GitHub gives every collaborator write access. Read-only access needs a repository owned by an organization, where each outside collaborator takes a paid seat unless the organization is on the free plan. Invitations expire after 7 days.";

// Sorted by name, as getOwnerFirmUsernames returns them.
const FIRMS: FirmUsernames[] = [
  { id: "f", firm_name: "Foxline Security", github_usernames: [] },
  { id: "l", firm_name: "Ledgerproof Labs", github_usernames: ["ledgerproof-ops", "mira-lp"] },
  { id: "n", firm_name: "Nordlicht Security", github_usernames: ["nordlicht-sec", "alice-kv"] },
];

const card = (firms: FirmUsernames[]) =>
  text(renderToStaticMarkup(createElement(FirmUsernamesCard, { firms })));

const ownerQuote = (over: Partial<OwnerQuote> = {}): OwnerQuote => ({
  id: "q-1",
  price_usd: 34500,
  duration: 4,
  duration_unit: "weeks",
  earliest_start: new Date("2026-11-02T00:00:00Z"),
  message: "Fixed fee, two auditors.",
  deal_doc_url: null,
  status: "submitted",
  display_status: "submitted",
  firm_name: "Ledgerproof Labs",
  services: [],
  ...over,
});

// A collecting request, quote window open, that pins one repository.
const ownerDetail = (over: Partial<OwnerRequestDetail> = {}): OwnerRequestDetail =>
  ({
    id: "req-1",
    user_id: "u1",
    project_name: "Glacierswap",
    description: "A concentrated-liquidity DEX on C-Chain.",
    scope: "Router and pool factory contracts.",
    services: ["Smart contract audit (Solidity / Vyper)"],
    project_types: [],
    deployment_target: "c_chain",
    multichain: false,
    repos: [{ url: "https://github.com/glacierswap/core", ref: "v1.2.0" }],
    languages: [],
    frameworks: [],
    nsloc: null,
    doc_links: [],
    attachments: [],
    needed_by: null,
    quote_deadline: new Date("2026-10-29T12:00:00Z"),
    urgency: null,
    contact_name: "Ada Stone",
    contact_email: "ada@glacierswap.example",
    contact_handle: null,
    contact_calendar_url: null,
    status: "collecting",
    display_status: "collecting",
    pick_by: null,
    submitted_at: new Date("2026-10-18T09:00:00Z"),
    created_at: new Date("2026-10-17T12:00:00Z"),
    updated_at: new Date("2026-10-18T09:00:00Z"),
    closed_at: null,
    quote_count: 0,
    fanout_count: 5,
    shortlist_auditor_ids: [],
    shortlist_firms: [],
    whitelist_count: 16,
    quotes: [],
    subsidy: null,
    ...over,
  }) as unknown as OwnerRequestDetail;

const detailPage = (detail: OwnerRequestDetail, firmUsernames: FirmUsernames[]) =>
  text(
    renderToStaticMarkup(
      createElement(RequestDetailView, { detail, userId: "u1", firmUsernames }),
    ),
  );

describe("FirmUsernamesCard", () => {
  it("lists the firms with usernames first, then the ones without", () => {
    const html = card(FIRMS);

    expect(html).toContain(LABEL);
    expect(html).toContain(LEAD);
    const order = ["Ledgerproof Labs", "Nordlicht Security", "No username yet", "Foxline Security"].map(
      (part) => html.indexOf(part),
    );
    expect(order.every((index) => index > -1)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(count(html, WARNING)).toBe(1);
    expect(count(html, LIMITS)).toBe(1);
  });

  it("links every username to its profile in a new tab, splitting one only when it cannot fit a line", () => {
    const link = anchorTo(card(FIRMS), "mira-lp");

    expect(link).toContain('href="https://github.com/mira-lp"');
    expect(link).toContain('target="_blank"');
    expect(link).toContain('rel="noopener noreferrer"');
    // Whole on its line, so no break at the hyphen; a valid 39-character
    // username still fits a 375 screen instead of widening the page.
    expect(link).toMatch(/class="[^"]*\binline-block\b[^"]*"/);
    expect(link).toContain("max-w-full");
    expect(link).toContain("[overflow-wrap:anywhere]");
    expect(link).not.toContain("whitespace-nowrap");
  });

  it("says so when no firm has a username yet, and still names the firms", () => {
    const html = card(FIRMS.map((firm) => ({ ...firm, github_usernames: [] })));

    expect(html).toContain(
      "None of these firms has added a GitHub username yet. Any they add while quotes are open appear here.",
    );
    expect(html).toMatch(/>Firms<\/p><p[^>]*>Foxline Security · Ledgerproof Labs · Nordlicht Security</);
    expect(html).not.toContain(WARNING);
    expect(html).not.toContain("github.com/");
    expect(html).toContain(LIMITS);
  });
});

describe("the project's request page · GitHub usernames", () => {
  it("shows the card right under the banner while quotes are open", () => {
    const html = detailPage(ownerDetail(), FIRMS);

    const card = html.indexOf(LABEL);
    expect(card).toBeGreaterThan(html.indexOf("firms have quoted"));
    expect(card).toBeLessThan(html.indexOf("No quotes yet."));
  });

  it("shows no card without firms, or once the window has closed", () => {
    expect(detailPage(ownerDetail(), [])).not.toContain(LABEL);
    expect(
      detailPage(ownerDetail({ display_status: "deciding", quotes: [ownerQuote()] }), FIRMS),
    ).not.toContain(LABEL);
  });

  it("puts the winner's usernames next to its contact once a quote is accepted", () => {
    const accepted = ownerQuote({
      status: "accepted",
      display_status: "accepted",
      quote_email: "mira@ledgerproof.example",
    });
    const html = detailPage(
      ownerDetail({ status: "engaged", display_status: "engaged", quotes: [accepted] }),
      [{ id: "l", firm_name: "Ledgerproof Labs", github_usernames: ["lp-ops", "mira-lp"] }],
    );

    expect(html).not.toContain(LABEL);
    expect(html.indexOf("GitHub · ")).toBeGreaterThan(html.indexOf("mira@ledgerproof.example"));
    for (const name of ["lp-ops", "mira-lp"]) {
      const link = anchorTo(html, name);
      expect(link).toContain(`href="https://github.com/${name}"`);
      expect(link).toContain('target="_blank"');
      expect(link).toContain('rel="noopener noreferrer"');
    }
  });

  it("shows no GitHub line when the winner has no username", () => {
    const accepted = ownerQuote({
      status: "accepted",
      display_status: "accepted",
      quote_email: "mira@ledgerproof.example",
    });
    const html = text(
      renderToStaticMarkup(
        createElement(EngagedPanel, {
          detail: ownerDetail({ status: "engaged", display_status: "engaged", quotes: [accepted] }),
          acceptedQuote: accepted,
          githubUsernames: [],
        }),
      ),
    );

    expect(html).toContain("mira@ledgerproof.example");
    expect(html).not.toContain("GitHub · ");
  });
});

// The firm's view while the request collects quotes, with one repository.
const firmView = (over: Partial<AuditorRequestView> = {}): AuditorRequestView =>
  ({
    id: "req-1",
    project_name: "Glacierswap",
    description: "A concentrated-liquidity DEX on C-Chain.",
    scope: "Router and pool factory contracts.",
    project_types: ["DeFi protocol"],
    deployment_target: "c_chain",
    multichain: false,
    services: ["Smart contract audit (Solidity / Vyper)"],
    repos: [{ url: "https://github.com/glacierswap/core", ref: "v1.2.0" }],
    languages: ["Solidity"],
    frameworks: ["Foundry"],
    nsloc: 4200,
    doc_links: [],
    attachments: [],
    needed_by: new Date("2026-11-20T00:00:00Z"),
    quote_deadline: new Date("2026-10-29T12:00:00Z"),
    urgency: "within_6_weeks",
    status: "collecting",
    submitted_at: new Date("2026-10-18T09:00:00Z"),
    created_at: new Date("2026-10-17T12:00:00Z"),
    own_quote: null,
    contacts: null,
    shared_handle: null,
    shared_calendar_url: null,
    subsidy: null,
    window_open: true,
    pick_by: new Date("2026-11-05T12:00:00Z"),
    ...over,
  }) as AuditorRequestView;

describe("access before quoting, in the copy (the 10-08 fix)", () => {
  it("the wizard hint says the usernames come at approval, without the GitHub limits", () => {
    const prefill = { contact_name: "Ada Stone", contact_email: "ada@glacierswap.example" };
    const html = text(
      renderToStaticMarkup(
        createElement(AuditWizardProvider, {
          initialDraft: { id: "draft-1", values: wizardDefaults(prefill) },
          prefill,
          firms: [],
          children: createElement(RepoRepeater),
        }),
      ),
    );

    expect(html).toContain(
      "Pin a branch or commit per repo. Private repo? Once your request is approved, you get the GitHub usernames of the firms it reaches, by email and on your request page, so you can add them before they quote. Choosing firms above keeps that list short.",
    );
    expect(html).not.toContain("after you accept a quote");
    expect(html).not.toContain("Read-only access needs");
  });

  it("the firm page says the project sees the team's usernames, and where each person sets theirs", () => {
    const html = text(renderToStaticMarkup(createElement(PortalRequestDetail, { view: firmView() })));

    expect(html).toContain(
      "Private repos: the project sees your team's GitHub usernames and may add them before you quote. Each person sets theirs on",
    );
    expect(anchorTo(html, "Firm details")).toContain('href="/audits/portal/firm"');
    expect(html).not.toContain("read access granted if your quote is accepted");
  });

  it("the accepted-quote panel asks for the winner's access and for removing the others", () => {
    const accepted = ownerQuote({
      status: "accepted",
      display_status: "accepted",
      quote_email: "mira@ledgerproof.example",
    });
    const panel = (repos: unknown[]) =>
      text(
        renderToStaticMarkup(
          createElement(EngagedPanel, {
            detail: ownerDetail({ status: "engaged", display_status: "engaged", repos, quotes: [accepted] }),
            acceptedQuote: accepted,
          }),
        ),
      );

    const withRepo = panel([{ url: "https://github.com/glacierswap/core", ref: "" }]);
    expect(withRepo).toContain(
      "Private repos: make sure the firm has access, and remove any other firm you added.",
    );
    expect(withRepo).not.toContain("Grant private-repo read access");
    expect(panel([])).not.toContain("Private repos:");
  });

  it("the receipt says the project hears by email once firms receive it", () => {
    const html = text(
      renderToStaticMarkup(
        createElement(SubmissionReceipt, {
          requestId: "req-1",
          projectName: "Glacierswap",
          submittedAt: new Date("2026-10-18T09:00:00Z"),
          quoteDeadline: null,
        }),
      ),
    );

    expect(html).toContain("We email you once firms receive it · quotes arrive here");
    expect(html).not.toContain("No emails to you");
  });
});
