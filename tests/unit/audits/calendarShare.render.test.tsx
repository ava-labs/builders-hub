import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {}, refresh: () => {} }) }));

import { PortalRequestDetail } from "@/components/audits/portal/PortalRequestDetail";
import { RequestSummary } from "@/components/audits/detail/RequestSummary";
import { AuditWizardProvider } from "@/components/audits/wizard/AuditWizardContext";
import { StepReview } from "@/components/audits/wizard/StepReview";
import { wizardDefaults } from "@/components/audits/wizard/types";
import type { AuditorRequestView, OwnerRequestDetail } from "@/server/services/audits/visibility";

/**
 * The calendar share as the project and the firms see it: the wizard step
 * where the choice is made (D3.4), the notified firm's page (D3.5) and the
 * builder's own page (D3.6). The admin tag is pinned with the rest of the
 * admin card in submissionDetails.render.test.tsx.
 */

const LINK = "https://cal.com/ada-glacierswap";

const count = (html: string, part: string) => html.split(part).length - 1;

/** renderToStaticMarkup escapes the apostrophe; compare against the text. */
const text = (html: string) => html.replace(/&#x27;/g, "'");

// The firm's view while the request collects quotes, before any quote.
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
    needed_by: new Date("2026-11-20T00:00:00Z"),
    quote_deadline: new Date("2026-10-26T00:00:00Z"),
    urgency: "within_6_weeks",
    status: "collecting",
    submitted_at: new Date("2026-10-14T09:00:00Z"),
    created_at: new Date("2026-10-13T12:00:00Z"),
    own_quote: null,
    contacts: null,
    shared_handle: null,
    shared_calendar_url: null,
    subsidy: null,
    window_open: true,
    pick_by: new Date("2026-11-02T00:00:00Z"),
    ...over,
  }) as AuditorRequestView;

const renderFirmPage = (view: AuditorRequestView) =>
  text(renderToStaticMarkup(createElement(PortalRequestDetail, { view })));

/** The opening tag of the anchor whose whole text is `label`. */
const anchorTo = (html: string, label: string) =>
  html.match(new RegExp(`<a [^>]*>${label}</a>`))?.[0] ?? "";

const REMINDER = "Send your quote here: the project compares and accepts quotes on Builder Hub.";

describe("firm request page", () => {
  it("shows the shared calendar link in the shared box, opening in a new tab", () => {
    const html = renderFirmPage(firmView({ shared_calendar_url: LINK }));

    expect(html).toContain("Project calendar");
    const link = anchorTo(html, "Schedule a meeting");
    expect(link).toContain(`href="${LINK}"`);
    expect(link).toContain('target="_blank"');
    expect(link).toContain('rel="noreferrer"');
    expect(count(html, REMINDER)).toBe(1);
    expect(html).toContain(
      "The project's name and email are revealed only if your quote is accepted. Competing quotes are never visible to you.",
    );
    expect(html).not.toContain("Project contact is revealed only if your quote is accepted.");
    expect(html).not.toContain("Project Telegram");
  });

  it("says what the call is for, right after the link", () => {
    const html = renderFirmPage(firmView({ shared_calendar_url: LINK }));

    expect(html).toMatch(
      />Schedule a meeting<\/a> if you need to talk with the team to understand or discuss any details\./,
    );
  });

  it("lists the calendar under the Telegram row when both are shared, with one reminder", () => {
    const html = renderFirmPage(
      firmView({ shared_handle: "@ada_glacier", shared_calendar_url: LINK }),
    );

    expect(html.indexOf("Project Telegram")).toBeGreaterThan(-1);
    expect(html.indexOf("Project calendar")).toBeGreaterThan(html.indexOf("Project Telegram"));
    expect(count(html, REMINDER)).toBe(1);
  });

  it("shows no calendar row when nothing is shared", () => {
    const html = renderFirmPage(firmView());

    expect(html).not.toContain("Project calendar");
    expect(html).not.toContain("Schedule a meeting");
  });
});

// Complete enough for RequestSummary, which reads only these fields.
const ownerDetail = (over: Partial<OwnerRequestDetail> = {}): OwnerRequestDetail =>
  ({
    id: "req-1",
    description: "A concentrated-liquidity DEX on C-Chain.",
    scope: "Router and pool factory contracts.",
    services: ["Smart contract audit (Solidity / Vyper)"],
    deployment_target: "c_chain",
    multichain: false,
    repos: [],
    doc_links: [],
    attachments: [],
    needed_by: null,
    quote_deadline: null,
    urgency: null,
    contact_name: "Ada Stone",
    contact_email: "ada@glacierswap.example",
    contact_handle: "@ada_glacier",
    contact_handle_shared_at: null,
    contact_calendar_url: LINK,
    contact_calendar_shared_at: null,
    status: "collecting",
    shortlist_auditor_ids: [],
    shortlist_firms: [],
    whitelist_count: 16,
    ...over,
  }) as unknown as OwnerRequestDetail;

const renderSummary = (detail: OwnerRequestDetail) =>
  renderToStaticMarkup(createElement(RequestSummary, { detail }));

const SHARED_AT = new Date("2026-10-14T09:00:00Z");
const CALENDAR_MARKER = "Calendar link shared with the firms that receive this request";
const TELEGRAM_MARKER = "Telegram shared with the firms that receive this request";
const BOTH_MARKER = "Telegram and calendar link shared with the firms that receive this request";

describe("builder request page", () => {
  it("marks the calendar link as shared under the contact, whatever the status", () => {
    for (const status of ["pending_review", "collecting", "engaged", "withdrawn"]) {
      const html = renderSummary(ownerDetail({ status, contact_calendar_shared_at: SHARED_AT }));
      expect(html).toContain(CALENDAR_MARKER);
      expect(html).not.toContain(TELEGRAM_MARKER);
      expect(html).not.toContain(BOTH_MARKER);
    }
  });

  it("names both in one line when both are shared", () => {
    const html = renderSummary(
      ownerDetail({ contact_handle_shared_at: SHARED_AT, contact_calendar_shared_at: SHARED_AT }),
    );

    expect(count(html, BOTH_MARKER)).toBe(1);
    expect(html).not.toContain(TELEGRAM_MARKER);
    expect(html).not.toContain(CALENDAR_MARKER);
  });

  it("names only a share that still holds its value", () => {
    const calendarOnly = renderSummary(
      ownerDetail({
        contact_handle: null,
        contact_handle_shared_at: SHARED_AT,
        contact_calendar_shared_at: SHARED_AT,
      }),
    );
    expect(calendarOnly).toContain(CALENDAR_MARKER);
    expect(calendarOnly).not.toContain("Telegram");

    const handleOnly = renderSummary(
      ownerDetail({
        contact_calendar_url: null,
        contact_handle_shared_at: SHARED_AT,
        contact_calendar_shared_at: SHARED_AT,
      }),
    );
    expect(handleOnly).toContain(TELEGRAM_MARKER);
    expect(handleOnly).not.toContain("alendar link shared");
  });

  it("has no calendar marker when the builder did not share it", () => {
    expect(renderSummary(ownerDetail())).not.toContain("alendar link shared");
  });
});

describe("wizard Review step", () => {
  const prefill = { contact_name: "Ada Stone", contact_email: "ada@glacierswap.example" };
  const renderReview = (values: { contact_handle?: string; contact_calendar_url?: string }) =>
    renderToStaticMarkup(
      createElement(AuditWizardProvider, {
        initialDraft: { id: "draft-1", values: { ...wizardDefaults(prefill), ...values } },
        prefill,
        firms: [],
        children: createElement(StepReview),
      }),
    );
  /** A share checkbox's opening tag, found by its hint: Radix renders it as a button. */
  const box = (html: string, hintId: string) =>
    html.match(new RegExp(`<button[^>]*aria-describedby="${hintId}"[^>]*>`))?.[0] ?? "";
  const calendarBox = (html: string) => box(html, "share-calendar-hint");
  const handleBox = (html: string) => box(html, "share-handle-hint");

  it("offers the share under the calendar field, unticked", () => {
    const html = renderReview({ contact_calendar_url: LINK });

    expect(count(html, "Share my calendar link with the firms that receive this request")).toBe(1);
    expect(calendarBox(html)).toContain('aria-checked="false"');
    expect(calendarBox(html)).not.toContain('disabled=""');
    const fieldHint = html.indexOf("For a kickoff call once you pick a firm.");
    const label = html.indexOf("Share my calendar link");
    expect(fieldHint).toBeGreaterThan(-1);
    expect(label).toBeGreaterThan(fieldHint);
    expect(html.indexOf("01 · Project")).toBeGreaterThan(label);
  });

  it("holds the box disabled while the calendar field is empty", () => {
    for (const contact_calendar_url of ["", "   "]) {
      expect(calendarBox(renderReview({ contact_calendar_url }))).toContain('disabled=""');
    }
  });

  it("arms each share box from its own field", () => {
    const linkOnly = renderReview({ contact_handle: "", contact_calendar_url: LINK });
    expect(handleBox(linkOnly)).toContain('disabled=""');
    expect(calendarBox(linkOnly)).not.toContain('disabled=""');

    const handleOnly = renderReview({ contact_handle: "@ada_glacier", contact_calendar_url: "" });
    expect(handleBox(handleOnly)).not.toContain('disabled=""');
    expect(calendarBox(handleOnly)).toContain('disabled=""');
  });

  it("wires each box to its own label and hint", () => {
    const html = renderReview({ contact_handle: "@ada_glacier", contact_calendar_url: LINK });

    for (const id of [
      "share-calendar-label",
      "share-calendar-hint",
      "share-handle-label",
      "share-handle-hint",
    ]) {
      expect(count(html, `id="${id}"`)).toBe(1);
    }
    expect(calendarBox(html)).toContain('aria-labelledby="share-calendar-label"');
  });

  it("says what a booking page may show, and when the winning firm uses the link", () => {
    const html = renderReview({ contact_calendar_url: LINK });

    expect(html).toContain(
      "They can book a call with you before they quote. Your booking page may show them your name and email.",
    );
    expect(html).toContain("For a kickoff call once you pick a firm.");
    expect(html).not.toContain("Lets the winning firm book a kickoff call directly.");
  });

  it("names both shares in the consent", () => {
    const html = renderReview({});

    expect(html).toContain(
      "I understand that the firm whose quote I accept receives my contact details. If I share my Telegram handle or calendar link above, every firm that receives this request can see it.",
    );
    expect(html).not.toContain("If I share my Telegram handle above");
  });
});
