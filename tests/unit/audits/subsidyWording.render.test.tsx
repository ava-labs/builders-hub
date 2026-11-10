import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {}, refresh: () => {} }) }));
// The user button pulls in the auth client; the site menu under test never
// renders it (as in tests/unit/navigation/ecosystem-page.test.ts).
vi.mock("@/components/login/user-button/UserButtonWrapper", () => ({
  UserButtonWrapper: () => null,
}));
// The request form's step lives in its context and starts at step 1; these
// tests read the footer beside Submit on step 4, not the forms above it.
vi.mock("@/components/audits/wizard/AuditWizardContext", () => ({
  AuditWizardProvider: ({ children }: { children: unknown }) => children,
  useAuditWizard: () => ({
    step: 3,
    setStep: () => {},
    goNext: async () => {},
    goBack: () => {},
    saveDraftNow: async () => {},
    submit: async () => {},
    submitting: false,
    consent: true,
  }),
}));
vi.mock("@/components/audits/wizard/WizardHeader", () => ({ WizardHeader: () => null }));
vi.mock("@/components/audits/wizard/StepProject", () => ({ StepProject: () => null }));
vi.mock("@/components/audits/wizard/StepScope", () => ({ StepScope: () => null }));
vi.mock("@/components/audits/wizard/StepTimeline", () => ({ StepTimeline: () => null }));
vi.mock("@/components/audits/wizard/StepReview", () => ({ StepReview: () => null }));
// Radix mounts a dialog through a portal, which static markup never renders.
vi.mock("@/components/ui/alert-dialog", () => {
  const Pass = ({ children }: { children?: unknown }) => children;
  return {
    AlertDialog: Pass,
    AlertDialogCancel: Pass,
    AlertDialogContent: Pass,
    AlertDialogDescription: Pass,
    AlertDialogFooter: Pass,
    AlertDialogHeader: Pass,
    AlertDialogTitle: Pass,
  };
});

import { ecosystemMenu } from "@/app/layout.config";
import BuildChapter from "@/components/landing-v2/story/BuildChapter";
import { AuditsLanding } from "@/components/audits/landing/AuditsLanding";
import { EngagedPanel } from "@/components/audits/detail/EngagedPanel";
import { AuditWizard } from "@/components/audits/wizard/WizardShell";
import { AcceptQuoteDialog } from "@/components/audits/quotes/AcceptQuoteDialog";
import { SubsidyWorksheet } from "@/components/audits/admin/SubsidyWorksheet";
import type { OwnerRequestDetail } from "@/server/services/audits/visibility";

/**
 * The subsidy stops being advertised, and only money the program pays ever
 * shows to a project (2026-10-20, Part 1 of .scratch/audits-subsidy-timer).
 */

/** renderToStaticMarkup escapes the apostrophe; compare against the text. */
const text = (html: string) => html.replace(/&#x27;/g, "'");

/** What a reader sees: no tags, no React text separators. */
const words = (html: string) => text(html).replace(/<!-- -->/g, "").replace(/<[^>]+>/g, "");

const ADVERTISED_SUBSIDY = /subsid|75%/i;

describe("public pages", () => {
  it("the audits page offers quotes, free and private, and says a request carries no funding", () => {
    const html = text(renderToStaticMarkup(createElement(AuditsLanding, { firmCount: 16 })));
    const seen = words(html);

    expect(seen).toContain(
      "Describe your scope once. Every security firm on the Ava Labs whitelist, or just the ones you choose, quotes it privately. You compare the quotes and pick one.",
    );
    expect(seen).toContain("16 vetted firms · quotes private to you · $0 fees");
    expect(seen).toContain("Pick one, start the audit");
    expect(seen).toContain("Contacts revealed on acceptance; you work with the firm directly.");
    const finePrint =
      '<p class="mt-3 pl-4 text-xs text-zinc-500 dark:text-zinc-400">A request gets you quotes to compare. It does not include funding.</p>';
    expect(html).toContain(finePrint);
    // Under the How it works plate, after its last step.
    expect(html.indexOf(finePrint)).toBeGreaterThan(html.indexOf("Pick one, start the audit"));
    expect(seen).not.toMatch(ADVERTISED_SUBSIDY);
  });

  it("the site menu describes Security Audits without the subsidy", () => {
    const items = (ecosystemMenu as { items: { url?: string; description?: unknown }[] }).items;

    expect(items.find((item) => item.url === "/audits")?.description).toBe(
      "Quotes from every vetted firm, free.",
    );
  });

  it("the home page's Audits link promises free quotes, not a subsidy", () => {
    const seen = words(renderToStaticMarkup(createElement(BuildChapter, { academyLine: null })));

    expect(seen).toContain("Free quotes from vetted firms");
    expect(seen).not.toMatch(ADVERTISED_SUBSIDY);
  });
});

type OwnerQuote = OwnerRequestDetail["quotes"][number];

const acceptedQuote: OwnerQuote = {
  id: "q-1",
  price_usd: 24000,
  duration: 3,
  duration_unit: "weeks",
  earliest_start: new Date("2026-11-09T00:00:00Z"),
  message: "Fixed fee, two auditors.",
  deal_doc_url: null,
  status: "accepted",
  display_status: "accepted",
  firm_name: "Quartzpoint Labs",
  services: [],
  quote_email: "audits@quartzpoint.example",
};

const otherQuote: OwnerQuote = {
  ...acceptedQuote,
  id: "q-2",
  price_usd: 31000,
  status: "not_selected",
  display_status: "not_selected",
  firm_name: "Harborline Audits",
  quote_email: undefined,
};

// An engaged request: one accepted quote, one archived.
const engagedDetail = (subsidy: OwnerRequestDetail["subsidy"]): OwnerRequestDetail =>
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
    quote_deadline: new Date("2026-10-29T12:00:00Z"),
    urgency: null,
    contact_name: "Ada Stone",
    contact_email: "ada@glacierswap.example",
    contact_handle: null,
    contact_calendar_url: null,
    status: "engaged",
    display_status: "engaged",
    pick_by: null,
    submitted_at: new Date("2026-10-18T09:00:00Z"),
    created_at: new Date("2026-10-17T12:00:00Z"),
    updated_at: new Date("2026-11-01T09:00:00Z"),
    closed_at: new Date("2026-11-01T09:00:00Z"),
    quote_count: 2,
    fanout_count: 5,
    shortlist_auditor_ids: [],
    shortlist_firms: [],
    whitelist_count: 16,
    quotes: [acceptedQuote, otherQuote],
    subsidy,
  }) as unknown as OwnerRequestDetail;

const engagedPanel = (subsidy: OwnerRequestDetail["subsidy"]) =>
  text(
    renderToStaticMarkup(
      createElement(EngagedPanel, { detail: engagedDetail(subsidy), acceptedQuote }),
    ),
  );

describe("the project's Subsidy card", () => {
  it("shows no card and no refusal for a declined decision", () => {
    const html = engagedPanel({
      state: "declined",
      pct: 0,
      program_amount_usd: 0,
      project_amount_usd: 24000,
    });

    expect(html).not.toContain(">Subsidy<");
    expect(html).not.toContain("not approved");
    // The rail keeps the archive card on its own.
    expect(html).toContain("The other quote");
  });

  it("shows no card for a $0 approval", () => {
    const html = engagedPanel({
      state: "approved",
      pct: 0,
      program_amount_usd: 0,
      project_amount_usd: 24000,
    });

    expect(html).not.toContain(">Subsidy<");
    expect(html).not.toContain("Program pays");
  });

  it("shows the amounts for an approval above $0", () => {
    const html = engagedPanel({
      state: "approved",
      pct: 50,
      program_amount_usd: 12000,
      project_amount_usd: 12000,
    });

    expect(html).toContain(">Subsidy<");
    expect(html).toContain("Program pays");
    expect(html).toContain("$12,000");
    expect(html).toContain("50% of $24,000");
    expect(html).toContain(
      "Approved by the audit program. Payment is handled off-platform with the firm.",
    );
  });
});

describe("signed-in surfaces", () => {
  it("the request form's last step says free with no fees, at every width", () => {
    const html = text(
      renderToStaticMarkup(
        createElement(AuditWizard, {
          initialDraft: null,
          prefill: { contact_name: "Ada Stone", contact_email: "ada@glacierswap.example" },
          importProjectId: null,
          firms: [],
        }),
      ),
    );

    expect(html).toContain("Submit request");
    expect(html.split("Free · no fees").length - 1).toBe(1);
    expect(html).not.toMatch(ADVERTISED_SUBSIDY);
  });

  it("the accept dialog lists three consequences, none about a subsidy", () => {
    const quote: OwnerQuote = {
      ...acceptedQuote,
      status: "submitted",
      display_status: "submitted",
      quote_email: undefined,
    };
    const html = text(
      renderToStaticMarkup(
        createElement(AcceptQuoteDialog, { requestId: "req-1", quote, otherCount: 3, onClose: () => {} }),
      ),
    );

    expect([...html.matchAll(/<li[^>]*>.*?<\/li>/g)].map((match) => words(match[0]))).toEqual([
      "Contact details are revealed both ways · you and Quartzpoint Labs connect directly.",
      "This request closes; the 3 other firms are notified they weren't selected.",
      "The engagement itself continues off-platform under standardized terms.",
    ]);
    expect(html).not.toMatch(ADVERTISED_SUBSIDY);
  });

  it("the admin worksheet says, under its buttons, that a decline or $0 sends no email", () => {
    const html = text(
      renderToStaticMarkup(
        createElement(SubsidyWorksheet, {
          requestId: "req-1",
          firmName: "Quartzpoint Labs",
          priceUsd: 24000,
          latest: null,
        }),
      ),
    );
    const note =
      '<p class="mt-4 text-xs text-zinc-500 dark:text-zinc-400">A decline or $0 sends no email; only an approval reaches the project and the firm.</p>';

    expect(html).toContain(note);
    expect(html.indexOf(note)).toBeGreaterThan(html.indexOf("Decline subsidy"));
    expect(html.indexOf(note)).toBeLessThan(html.indexOf("Logged with your name"));
  });
});
