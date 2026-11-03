import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {}, refresh: () => {} }) }));

import { QuoteSummary } from "@/components/audits/portal/QuoteSummary";
import { QuoteComposer } from "@/components/audits/portal/QuoteComposer";
import { PortalRequestDetail } from "@/components/audits/portal/PortalRequestDetail";
import { PortalInbox } from "@/components/audits/portal/PortalInbox";
import { RequestDetailView } from "@/components/audits/detail/RequestDetailView";
import { RequestCard } from "@/components/audits/landing/RequestCard";
import { ActivityTrail } from "@/components/audits/admin/ActivityTrail";
import type {
  AdminRequestDetail,
  AuditorInboxItem,
  AuditorRequestView,
  OwnerQuote,
  OwnerRequestDetail,
  OwnerRequestSummary,
} from "@/server/services/audits/visibility";

/**
 * The week to pick (design D1.6, D1.7), as each screen shows it. Dates are
 * fixed: the window closed 2026-11-10 and the project picks by 2026-11-17.
 */

/** renderToStaticMarkup escapes the apostrophe; compare against the text. */
const text = (html: string) => html.replace(/&#x27;/g, "'");

const PICK_BY = new Date("2026-11-17T12:00:00Z");

type OwnQuote = NonNullable<AuditorRequestView["own_quote"]>;
const ownQuote = (over: Partial<OwnQuote> = {}): OwnQuote => ({
  id: "q-1",
  status: "submitted",
  display_status: "submitted",
  price_usd: 28000,
  duration: 4,
  duration_unit: "weeks",
  earliest_start: new Date("2026-12-01T00:00:00Z"),
  message: "Fixed fee, two auditors.",
  deal_doc_url: null,
  updated_at: new Date("2026-11-05T10:00:00Z"),
  ...over,
});

const summary = (quote: OwnQuote, pickBy: Date | null) =>
  text(renderToStaticMarkup(createElement(QuoteSummary, { quote, pickBy })));

describe("the firm's resting quote summary", () => {
  it("tells a firm whose window closed when the project picks", () => {
    const html = summary(ownQuote(), PICK_BY);

    expect(html).toContain(
      "The project picks a quote by 2026-11-17. If it picks none, your quote expires.",
    );
    expect(html).toContain(">Submitted<");
  });

  it("reads Expired once the project picked no quote in time", () => {
    const html = summary(ownQuote({ display_status: "expired" }), PICK_BY);

    expect(html).toContain("The project picked no quote by 2026-11-17. Your quote has expired.");
    expect(html).toContain(">Expired<");
    expect(html).not.toContain(">Submitted<");
  });

  it("promises no pick where there is no pick-by date (a withdrawn request)", () => {
    const html = summary(ownQuote({ display_status: "expired" }), null);

    expect(html).toContain(
      "Quotes can no longer be edited. The project and program admins still see it.",
    );
    expect(html).not.toContain("picks a quote by");
    expect(html).not.toContain("picked no quote");
  });

  it("keeps the settled lines for a won or a lost quote", () => {
    expect(summary(ownQuote({ status: "accepted", display_status: "accepted" }), PICK_BY)).toContain(
      "This quote was accepted. The engagement continues off-platform.",
    );
    expect(
      summary(ownQuote({ status: "not_selected", display_status: "not_selected" }), PICK_BY),
    ).toContain("The project chose another provider.");
  });

  it("names no pick-by date while the window is still open (a deactivated firm)", () => {
    const html = text(
      renderToStaticMarkup(
        createElement(QuoteComposer, {
          requestId: "req-1",
          existing: ownQuote(),
          windowOpen: true,
          deadline: new Date("2026-11-10T12:00:00Z"),
          firmActive: false,
          pickBy: PICK_BY,
        }),
      ),
    );

    expect(html).toContain("Quotes can no longer be edited.");
    expect(html).not.toContain("2026-11-17");
  });
});

// The firm's request page past the quote deadline, deciding.
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
    repos: [],
    languages: ["Solidity"],
    frameworks: ["Foundry"],
    nsloc: 4200,
    doc_links: [],
    attachments: [],
    needed_by: null,
    quote_deadline: new Date("2026-11-10T12:00:00Z"),
    urgency: null,
    status: "collecting",
    submitted_at: new Date("2026-10-31T09:00:00Z"),
    created_at: new Date("2026-10-30T12:00:00Z"),
    own_quote: ownQuote(),
    contacts: null,
    shared_handle: null,
    shared_calendar_url: null,
    subsidy: null,
    window_open: false,
    pick_by: PICK_BY,
    ...over,
  }) as AuditorRequestView;

describe("the firm's request page", () => {
  it("hands the pick-by date to the resting summary once the window closed", () => {
    const html = text(renderToStaticMarkup(createElement(PortalRequestDetail, { view: firmView() })));

    expect(html).toContain("The project picks a quote by 2026-11-17.");
  });
});

const inboxItem = (ownQuoteStatus: { status: string; display_status: string }): AuditorInboxItem =>
  ({
    request: {
      id: "req-1",
      project_name: "Glacierswap",
      description: "A concentrated-liquidity DEX on C-Chain.",
      services: ["Smart contract audit (Solidity / Vyper)"],
      nsloc: 4200,
      languages: ["Solidity"],
      frameworks: ["Foundry"],
      repos: [],
      needed_by: null,
      quote_deadline: new Date("2026-11-10T12:00:00Z"),
      urgency: null,
      status: "collecting",
      submitted_at: new Date("2026-10-31T09:00:00Z"),
      closed_at: null,
    },
    own_quote: {
      id: "q-1",
      ...ownQuoteStatus,
      price_usd: 28000,
      updated_at: new Date("2026-11-05T10:00:00Z"),
    },
    window_open: false,
  }) as AuditorInboxItem;

describe("the firm's inbox card", () => {
  const inbox = (item: AuditorInboxItem) =>
    renderToStaticMarkup(
      createElement(PortalInbox, { items: [item], notifyEmail: "quotes@nordlicht.example" }),
    );

  it("labels a quote the project picked no one for Quote expired, outside the Quoted tab", () => {
    const html = inbox(inboxItem({ status: "submitted", display_status: "expired" }));

    expect(html).toContain("Quote expired");
    expect(html).not.toContain("You quoted");
    expect(html).toMatch(/Quoted <span[^>]*>0<\/span>/);
  });

  it("keeps a deciding quote under Quoted with its price", () => {
    const html = inbox(inboxItem({ status: "submitted", display_status: "submitted" }));

    expect(html).toContain("You quoted $28,000");
    expect(html).toMatch(/Quoted <span[^>]*>1<\/span>/);
  });
});

const ownerQuote = (over: Partial<OwnerQuote> = {}): OwnerQuote => ({
  id: "q-1",
  price_usd: 28000,
  duration: 4,
  duration_unit: "weeks",
  earliest_start: new Date("2026-12-01T00:00:00Z"),
  message: "Fixed fee, two auditors.",
  deal_doc_url: null,
  status: "submitted",
  display_status: "submitted",
  firm_name: "Nordlicht Security",
  services: [],
  ...over,
});

// A complete-enough OwnerRequestDetail past its quote deadline.
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
    repos: [],
    languages: [],
    frameworks: [],
    nsloc: null,
    doc_links: [],
    attachments: [],
    needed_by: null,
    quote_deadline: new Date("2026-11-10T12:00:00Z"),
    urgency: null,
    contact_name: "Ada Stone",
    contact_email: "ada@glacierswap.example",
    contact_handle: null,
    status: "collecting",
    display_status: "deciding",
    pick_by: PICK_BY,
    submitted_at: new Date("2026-10-31T09:00:00Z"),
    created_at: new Date("2026-10-30T12:00:00Z"),
    updated_at: new Date("2026-10-31T09:00:00Z"),
    quote_count: 1,
    fanout_count: 3,
    shortlist_auditor_ids: [],
    shortlist_firms: [],
    whitelist_count: 16,
    quotes: [ownerQuote()],
    subsidy: null,
    ...over,
  }) as unknown as OwnerRequestDetail;

const detailPage = (detail: OwnerRequestDetail) =>
  text(renderToStaticMarkup(createElement(RequestDetailView, { detail, userId: "u1" })));

describe("the project's request page", () => {
  it("names the pick-by date on the deciding banner", () => {
    const html = detailPage(ownerDetail());

    expect(html).toContain("Pick one by 2026-11-17");
    expect(html).not.toContain("Pick one to reveal contacts");
  });

  it("names the moment the window closed, as stored", () => {
    // The fixture's 12:00 UTC is an instant from before the 23:59 rule: the
    // page prints it as it is, never a 23:59 it does not hold.
    const html = detailPage(ownerDetail()).replace(/<!-- -->/g, "");

    expect(html).toContain("Window closed 2026-11-10 12:00 UTC");
    expect(html).toContain("quotes close 2026-11-10 12:00 UTC");
  });

  it("offers Start again on a lapsed request, its quotes read-only", () => {
    const html = detailPage(
      ownerDetail({ display_status: "expired", quotes: [ownerQuote({ display_status: "expired" })] }),
    );

    expect(html).toContain("No quote was picked in time.");
    expect(html).toContain(
      "The quotes expired on 2026-11-17. Start again from a copy of this request: it goes back through review and a fresh quote window. Files are not copied.",
    );
    expect(html).toContain(">Start again<");
    expect(html).toContain("Expired quotes · read-only");
    expect(html).toContain("Nordlicht Security");
    expect(html).not.toContain("Accepting reveals contact details");
    expect(html).not.toContain("Reopen for one more round");
  });

  it("keeps Reopen, and no Start again, on a window that closed without quotes", () => {
    const html = detailPage(
      ownerDetail({ display_status: "expired", quotes: [], quote_count: 0 }),
    );

    expect(html).toContain("The quote window closed without quotes.");
    expect(html).toContain("Reopen for one more round");
    expect(html).not.toContain("Start again");
  });
});

const listCard = (over: Partial<OwnerRequestSummary>) => {
  const request: OwnerRequestSummary = {
    id: "req-1",
    project_name: "Glacierswap",
    description: "A concentrated-liquidity DEX on C-Chain.",
    services: [],
    nsloc: null,
    status: "collecting",
    display_status: "deciding",
    quote_count: 2,
    quote_price_range: { min: 24000, max: 32000 },
    quote_deadline: new Date("2026-11-10T12:00:00Z"),
    pick_by: PICK_BY,
    needed_by: null,
    submitted_at: new Date("2026-10-31T09:00:00Z"),
    created_at: new Date("2026-10-30T12:00:00Z"),
    updated_at: new Date("2026-10-31T09:00:00Z"),
    ...over,
  };
  return renderToStaticMarkup(
    createElement(RequestCard, { request, index: 0, onDeleteDraft: () => {} }),
  );
};

describe("the project's list card", () => {
  // The countdown text itself mounts client-side only; the row and its date render.
  it("gives a deciding card the pick-by row: clock and date", () => {
    const html = listCard({});

    expect(html).toContain("lucide-clock");
    expect(html).toContain("2026-11-17");
  });

  it("gives a closed card no pick-by row", () => {
    const html = listCard({ status: "engaged", display_status: "engaged", pick_by: null });

    expect(html).not.toContain("lucide-clock");
    expect(html).not.toContain("2026-11-17");
  });
});

describe("the admin trail", () => {
  it("shows a restart through its default line, with no admin change", () => {
    const events = [
      {
        id: "e-1",
        request_id: "req-1",
        actor_type: "project_user",
        actor_id: "u1",
        action: "request_restarted",
        meta: { new_request_id: "req-new" },
        created_at: new Date("2026-11-20T10:00:00Z"),
      },
    ] as unknown as AdminRequestDetail["events"];

    const html = renderToStaticMarkup(createElement(ActivityTrail, { events }));

    expect(html).toContain("request restarted");
  });
});
