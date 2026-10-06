import { afterEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {}, refresh: () => {} }) }));

import { PortalRequestDetail } from "@/components/audits/portal/PortalRequestDetail";
import { RequestSummary } from "@/components/audits/detail/RequestSummary";
import { AuditWizardProvider, useAuditWizard } from "@/components/audits/wizard/AuditWizardContext";
import { StepReview } from "@/components/audits/wizard/StepReview";
import { wizardDefaults } from "@/components/audits/wizard/types";
import type { AuditorRequestView, OwnerRequestDetail } from "@/server/services/audits/visibility";

/**
 * The Telegram share as each audience sees it: the notified firm (D8), the
 * builder (D9), and the wizard step where the choice is made (D6).
 */

const SHARED_AT = new Date("2026-10-01T09:00:00Z");

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
    needed_by: new Date("2026-11-02T00:00:00Z"),
    quote_deadline: new Date("2026-10-15T00:00:00Z"),
    urgency: "within_6_weeks",
    status: "collecting",
    submitted_at: new Date("2026-10-01T09:00:00Z"),
    created_at: new Date("2026-09-30T12:00:00Z"),
    own_quote: null,
    contacts: null,
    shared_handle: null,
    subsidy: null,
    window_open: true,
    ...over,
  }) as AuditorRequestView;

const renderFirmPage = (view: AuditorRequestView) =>
  text(renderToStaticMarkup(createElement(PortalRequestDetail, { view })));

describe("firm request page", () => {
  it("shows the shared handle as plain text, with the reminder and the narrower lock line", () => {
    const html = renderFirmPage(firmView({ shared_handle: "@ada_glacier" }));

    expect(html).toContain("Project Telegram");
    expect(html).toContain("@ada_glacier");
    expect(html).not.toContain("t.me");
    expect(html).toContain(
      "Send your quote here: the program can only subsidize a quote the project accepts on Builder Hub.",
    );
    expect(html).toContain(
      "The project's name and email are revealed only if your quote is accepted. Competing quotes are never visible to you.",
    );
    expect(html).not.toContain("Project contact is revealed only if your quote is accepted.");
  });

  it("stays as it was when nothing is shared", () => {
    const html = renderFirmPage(firmView());

    expect(html).not.toContain("Project Telegram");
    expect(html).not.toContain("Send your quote here");
    expect(html).toContain(
      "Project contact is revealed only if your quote is accepted. Competing quotes are never visible to you.",
    );
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
    status: "collecting",
    shortlist_auditor_ids: [],
    shortlist_firms: [],
    whitelist_count: 16,
    ...over,
  }) as unknown as OwnerRequestDetail;

const renderSummary = (detail: OwnerRequestDetail) =>
  renderToStaticMarkup(createElement(RequestSummary, { detail }));

describe("builder request page", () => {
  it("marks the handle as shared under the contact, whatever the status", () => {
    for (const status of ["pending_review", "collecting", "engaged", "withdrawn"]) {
      expect(renderSummary(ownerDetail({ status, contact_handle_shared_at: SHARED_AT }))).toContain(
        "Telegram shared with the firms that receive this request",
      );
    }
  });

  it("has no marker when the builder did not share it", () => {
    expect(renderSummary(ownerDetail())).not.toContain("Telegram shared");
  });
});

describe("wizard Review step", () => {
  const prefill = { contact_name: "Ada Stone", contact_email: "ada@glacierswap.example" };
  const renderReview = (contact_handle: string) =>
    renderToStaticMarkup(
      createElement(AuditWizardProvider, {
        initialDraft: { id: "draft-1", values: { ...wizardDefaults(prefill), contact_handle } },
        prefill,
        firms: [],
        children: createElement(StepReview),
      }),
    );
  /** The share checkbox's opening tag: Radix renders it as a button. */
  const shareBox = (html: string) =>
    html.match(/<button[^>]*aria-describedby="share-handle-hint"[^>]*>/)?.[0] ?? "";

  it("offers the share under the Telegram field, unticked", () => {
    const html = renderReview("@ada_glacier");

    expect(html).toContain("Share my Telegram handle with the firms that receive this request");
    expect(shareBox(html)).toContain('aria-checked="false"');
    expect(shareBox(html)).not.toContain('disabled=""');
  });

  it("holds the box disabled while the Telegram field is empty", () => {
    for (const handle of ["", "   "]) {
      expect(shareBox(renderReview(handle))).toContain('disabled=""');
    }
  });
});

describe("wizard submit", () => {
  afterEach(() => vi.unstubAllGlobals());

  // The context is captured from a server render: the state setters are inert
  // there, so this pins the body of an unticked submit only. The ticked path
  // is the preview click-test (design C4).
  it("sends the share choice with the consent, and no share unless ticked", async () => {
    const calls: { url: string; body: unknown }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        calls.push({ url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
        return { ok: true, json: async () => ({ success: true }) };
      }),
    );
    let wizard: ReturnType<typeof useAuditWizard> | undefined;
    const Capture = () => {
      wizard = useAuditWizard();
      return null;
    };
    const prefill = { contact_name: "Ada Stone", contact_email: "ada@glacierswap.example" };
    renderToStaticMarkup(
      createElement(AuditWizardProvider, {
        initialDraft: {
          id: "draft-1",
          values: { ...wizardDefaults(prefill), contact_handle: "@ada_glacier" },
        },
        prefill,
        firms: [],
        children: createElement(Capture),
      }),
    );

    await wizard!.submit();

    expect(calls.find((call) => call.url === "/api/audits/requests/draft-1/submit")?.body).toEqual({
      contact_consent: true,
      share_contact_handle: false,
    });
  });
});
