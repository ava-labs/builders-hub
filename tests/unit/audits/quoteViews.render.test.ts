import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {}, refresh: () => {} }) }));

import type {
  AdminRequestDetail,
  AuditorRequestView,
  OwnerQuote,
} from "@/server/services/audits/visibility";
import { QuoteRows } from "@/components/audits/quotes/QuoteRows";
import { QuoteTable } from "@/components/audits/quotes/QuoteTable";
import { QuoteCards } from "@/components/audits/quotes/QuoteCards";
import { QuoteComparison } from "@/components/audits/admin/QuoteComparison";
import { QuoteComposer } from "@/components/audits/portal/QuoteComposer";

/**
 * Round-5 tripwire. A field once shipped with its state and payload wired
 * while the JSX never rendered, so each view is server-rendered here and the
 * round's facts are asserted IN THE MARKUP: the proposal link with its host,
 * the honest absent state, the promoted message block, the out-of-window
 * warning and the price delta. Rendering also fails loudly if a view ever
 * imports something that cannot run outside the browser.
 */

const quote = (over: Partial<OwnerQuote>): OwnerQuote => ({
  id: "q-1",
  price_usd: 34500,
  duration: 4,
  duration_unit: "weeks",
  earliest_start: new Date("2026-08-12T00:00:00.000Z"),
  message: "Fixed fee including a re-audit of fixes within 30 days.",
  deal_doc_url: null,
  status: "submitted",
  display_status: "submitted",
  firm_name: "Ledgerproof Labs",
  services: [],
  ...over,
});

const QUOTES: OwnerQuote[] = [
  quote({ deal_doc_url: "https://docs.google.com/document/d/abc" }),
  quote({
    id: "q-2",
    firm_name: "Bastionward",
    price_usd: 39000,
    earliest_start: new Date("2026-08-19T00:00:00.000Z"),
    message: "Five weeks, two auditors, invariant suite included.",
  }),
];

const NEEDED_BY = new Date("2026-08-17T00:00:00.000Z");

describe("quote views render the round-5 facts", () => {
  it("rows: proposal action + host, absent state, message block, warning, delta", () => {
    const html = renderToStaticMarkup(
      createElement(QuoteRows, { quotes: QUOTES, neededBy: NEEDED_BY }),
    );
    expect(html).toContain("Read the proposal ↗");
    expect(html).toContain("docs.google.com");
    expect(html).toContain("No proposal attached");
    expect(html).toContain("Their message");
    expect(html).toContain("outside your window");
    expect(html).toContain("+$4,500 vs lowest");
  });

  it("table: proposal column, warning no longer replaces the message, title attr", () => {
    const html = renderToStaticMarkup(
      createElement(QuoteTable, { quotes: QUOTES, neededBy: NEEDED_BY }),
    );
    expect(html).toContain("Proposal");
    expect(html).toContain("doc ↗");
    // Bastionward is outside the window AND its message still renders.
    expect(html).toContain("start outside your window");
    expect(html).toContain("Five weeks, two auditors, invariant suite included.");
    expect(html).toContain('title="Five weeks, two auditors, invariant suite included."');
  });

  it("cards: proposal action, warning and delta reach the forced mobile view", () => {
    const html = renderToStaticMarkup(
      createElement(QuoteCards, { quotes: QUOTES, neededBy: NEEDED_BY }),
    );
    expect(html).toContain("Read the proposal ↗");
    expect(html).toContain("No proposal attached");
    expect(html).toContain("Their message");
    expect(html).toContain("outside your window");
    expect(html).toContain("+$4,500 vs lowest");
  });
});

describe("durations read the way the firm typed them", () => {
  // Joey, 2026-09-30: a firm can now quote days as well as weeks.
  const MIXED: OwnerQuote[] = [
    quote({ duration: 10, duration_unit: "days" }),
    quote({ id: "q-2", firm_name: "Bastionward", price_usd: 39000, duration: 4 }),
  ];

  it("rows, table and cards show days and weeks as typed", () => {
    for (const html of [
      renderToStaticMarkup(createElement(QuoteRows, { quotes: MIXED, neededBy: NEEDED_BY })),
      renderToStaticMarkup(createElement(QuoteTable, { quotes: MIXED, neededBy: NEEDED_BY })),
      renderToStaticMarkup(createElement(QuoteCards, { quotes: MIXED, neededBy: NEEDED_BY })),
    ]) {
      expect(html).toContain("10 days");
      expect(html).toContain("4 weeks");
    }
  });

  it("heads the project's table column Duration, since a cell can hold days", () => {
    const html = renderToStaticMarkup(
      createElement(QuoteTable, { quotes: MIXED, neededBy: NEEDED_BY }),
    );
    expect(html).toContain(">Duration<");
  });

  it("the admin comparison shows the unit and heads the column Duration", () => {
    const quotes: AdminRequestDetail["quotes"] = MIXED.map((q) => ({
      ...q,
      quote_email: "quotes@firm.example",
    }));
    const html = renderToStaticMarkup(
      createElement(QuoteComparison, {
        quotes,
        fanoutCount: 3,
        submittedAt: new Date("2026-08-01T00:00:00.000Z"),
        quoteDeadline: new Date("2026-08-11T00:00:00.000Z"),
        displayStatus: "deciding",
        neededBy: NEEDED_BY,
      }),
    );
    expect(html).toContain("10 days");
    expect(html).toContain("4 weeks");
    expect(html).toContain(">Duration<");
  });
});

describe("the firm's quote composer keeps the unit on file", () => {
  type OwnQuote = NonNullable<AuditorRequestView["own_quote"]>;
  const ownQuote = (over: Partial<OwnQuote> = {}): OwnQuote => ({
    id: "q-1",
    status: "submitted",
    price_usd: 12500,
    duration: 10,
    duration_unit: "days",
    earliest_start: new Date("2026-10-12T00:00:00.000Z"),
    message: "Two auditors, fixed fee.",
    deal_doc_url: null,
    updated_at: new Date("2026-10-01T00:00:00.000Z"),
    ...over,
  });
  const composer = (existing: OwnQuote | null, windowOpen = true) =>
    renderToStaticMarkup(
      createElement(QuoteComposer, { requestId: "req-1", existing, windowOpen, deadline: null }),
    );
  // The unit picker's own markup: from its label to the end of its button.
  const unitShown = (html: string) =>
    html.split('aria-label="Duration unit"')[1]?.split("</button>")[0] ?? "";

  it("reopens a quote typed in days in days, so an edit cannot turn it into weeks", () => {
    const html = composer(ownQuote());
    expect(html).toContain('value="10"');
    expect(unitShown(html)).toContain(">days<");
  });

  it("offers weeks first on a new quote, the unit every quote had so far", () => {
    expect(unitShown(composer(null))).toContain(">weeks<");
  });

  it("the resting summary reads the stored unit", () => {
    expect(composer(ownQuote(), false)).toContain("10 days");
  });
});
