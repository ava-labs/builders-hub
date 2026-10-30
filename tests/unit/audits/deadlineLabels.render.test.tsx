import { describe, expect, it, vi } from "vitest";
import { createElement, type FunctionComponent } from "react";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {}, refresh: () => {} }) }));

import { LocalDeadline, localDeadlineText } from "@/components/audits/shared/LocalDeadline";
import { QuoteComposer } from "@/components/audits/portal/QuoteComposer";
import { CollectingBanner } from "@/components/audits/detail/CollectingBanner";
import { QuoteComparison } from "@/components/audits/admin/QuoteComparison";
import { AuditWizardProvider } from "@/components/audits/wizard/AuditWizardContext";
import { StepReview } from "@/components/audits/wizard/StepReview";
import { StepTimeline } from "@/components/audits/wizard/StepTimeline";
import { wizardDefaults } from "@/components/audits/wizard/types";
import type { OwnerRequestDetail } from "@/server/services/audits/visibility";

/**
 * Every printed quote deadline carries its time (2026-10-20, .scratch/
 * audits-subsidy-timer Part 3): the reader's own clock in the browser, UTC in
 * emails and on the server.
 */

const END_OF_29TH = new Date("2026-10-29T23:59:59.999Z");
// ICU separates the time from AM/PM with a narrow no-break space.
const spaced = (text: string) => text.replace(/\s/g, " ");

describe("the reader's own clock", () => {
  it("names the zone and the UTC time on the firm's quote form", () => {
    const newYork = { locale: "en-US", timeZone: "America/New_York" };
    expect(spaced(localDeadlineText(END_OF_29TH, "zone", newYork))).toBe(
      "Thu, Oct 29, 7:59 PM EDT (23:59 UTC)",
    );
  });

  it("says 'your time' on the project's banner, and rolls to the next morning east of UTC", () => {
    expect(
      spaced(localDeadlineText(END_OF_29TH, "your-time", { locale: "en-US", timeZone: "America/New_York" })),
    ).toBe("Thu, Oct 29, 7:59 PM your time");
    expect(
      spaced(localDeadlineText(END_OF_29TH, "your-time", { locale: "en-US", timeZone: "Europe/Rome" })),
    ).toBe("Fri, Oct 30, 12:59 AM your time");
  });

  it("prints the UTC label until mounted, so the server and the first paint agree", () => {
    for (const variant of ["zone", "your-time"] as const) {
      expect(renderToStaticMarkup(createElement(LocalDeadline, { deadline: END_OF_29TH, variant }))).toBe(
        "2026-10-29 23:59 UTC",
      );
    }
  });
});

/** What a reader sees: no tags, no React text separators. */
const words = (html: string) =>
  html.replace(/&#x27;/g, "'").replace(/<!-- -->/g, "").replace(/<[^>]+>/g, "");

describe("every printed deadline carries its time", () => {
  it("the firm's quote form says until when, to the minute", () => {
    const html = words(
      renderToStaticMarkup(
        createElement(QuoteComposer, {
          requestId: "req-1",
          existing: null,
          windowOpen: true,
          deadline: END_OF_29TH,
        }),
      ),
    );

    expect(html).toContain(
      "Editable until 2026-10-29 23:59 UTC. Your quote is private to the requesting project and the program team.",
    );
  });

  it("the firm's closed form says when the window closed", () => {
    const html = words(
      renderToStaticMarkup(
        createElement(QuoteComposer, {
          requestId: "req-1",
          existing: null,
          windowOpen: false,
          deadline: END_OF_29TH,
        }),
      ),
    );

    expect(html).toContain(
      "The quote window closed 2026-10-29 23:59 UTC without a quote from your firm. New requests keep arriving in your inbox.",
    );
  });

  it("the project's banner prints the moment, in UTC until the browser shows its own clock", () => {
    const detail = {
      quote_deadline: END_OF_29TH,
      shortlist_auditor_ids: [],
      fanout_count: 26,
      quote_count: 4,
    } as unknown as OwnerRequestDetail;
    const html = words(renderToStaticMarkup(createElement(CollectingBanner, { detail })));

    expect(html).toContain(" · 2026-10-29 23:59 UTC");
    expect(html).toContain("4 of 26 firms have quoted");
  });

  it("the admin's quote comparison says when the window closes, and when it closed", () => {
    const header = (displayStatus: string) =>
      words(
        renderToStaticMarkup(
          createElement(QuoteComparison, {
            quotes: [],
            fanoutCount: 3,
            submittedAt: new Date("2026-10-19T09:00:00Z"),
            quoteDeadline: END_OF_29TH,
            displayStatus,
            neededBy: null,
          } as never),
        ),
      );

    expect(header("collecting")).toContain("fan-out 2026-10-19 · window closes 2026-10-29 23:59 UTC");
    expect(header("deciding")).toContain("window closed 2026-10-29 23:59 UTC");
  });

  it("the request form's review line and deadline hint say 23:59 UTC", () => {
    const prefill = { contact_name: "Ada Stone", contact_email: "ada@nimbus.example" };
    const values = { ...wizardDefaults(prefill), quote_deadline: END_OF_29TH };
    const inWizard = (step: FunctionComponent) =>
      words(
        renderToStaticMarkup(
          createElement(
            AuditWizardProvider,
            { initialDraft: { id: "draft-1", values }, prefill, firms: [] },
            createElement(step),
          ),
        ),
      );

    expect(inWizard(StepReview)).toContain("quotes close 2026-10-29 23:59 UTC");
    expect(inWizard(StepTimeline)).toContain(
      "Closes at 23:59 UTC that day · defaulted to +10 days, the recommended window.",
    );
  });
});
