import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { OwnerQuote } from "@/server/services/audits/visibility";
import { QuoteRows } from "@/components/audits/quotes/QuoteRows";
import { QuoteTable } from "@/components/audits/quotes/QuoteTable";
import { QuoteCards } from "@/components/audits/quotes/QuoteCards";

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
  duration_weeks: 4,
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
