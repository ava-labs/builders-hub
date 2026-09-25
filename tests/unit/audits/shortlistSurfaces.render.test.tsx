import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {}, push: () => {} }) }));

import { FanoutNoticeCard } from "@/components/audits/shared/FanoutNoticeCard";
import { SubmissionReceipt } from "@/components/audits/detail/SubmissionReceipt";
import { RequestSummary } from "@/components/audits/detail/RequestSummary";
import { CollectingBanner } from "@/components/audits/detail/CollectingBanner";
import { RequestDetailView } from "@/components/audits/detail/RequestDetailView";
import { ReviewDecision } from "@/components/audits/admin/ReviewDecision";
import { ActivityTrail } from "@/components/audits/admin/ActivityTrail";
import type { OwnerRequestDetail } from "@/server/services/audits/visibility";

const el = (c: Parameters<typeof createElement>[0], p: Record<string, unknown>) =>
  renderToStaticMarkup(createElement(c as never, p as never));

// A complete-enough OwnerRequestDetail; extra fields are harmless, missing ones
// are only read on branches these cases do not hit.
const ownerDetail = (over: Partial<OwnerRequestDetail> = {}): OwnerRequestDetail =>
  ({
    id: "req-1",
    user_id: "u1",
    project_name: "Glacierswap",
    description: "A DEX",
    scope: "The router",
    services: ["OpSec"],
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
    quote_deadline: new Date("2026-09-20"),
    urgency: null,
    contact_name: "Ada",
    contact_email: "ada@x.example",
    contact_handle: null,
    status: "collecting",
    display_status: "collecting",
    submitted_at: new Date("2026-09-04"),
    created_at: new Date("2026-09-04"),
    updated_at: new Date("2026-09-04"),
    quote_count: 0,
    fanout_count: 3,
    shortlist_auditor_ids: [],
    shortlist_firms: [],
    whitelist_count: 16,
    quotes: [],
    subsidy: null,
    ...over,
  }) as unknown as OwnerRequestDetail;

describe("FanoutNoticeCard", () => {
  it("default and narrowed", () => {
    expect(el(FanoutNoticeCard, {})).toContain("Sent to all whitelisted auditors.");
    const n = el(FanoutNoticeCard, { chosenCount: 7, whitelistCount: 16 });
    expect(n).toContain("Sent to 7 of 16 whitelisted auditors.");
    expect(n).toContain("Your request reaches the 7 firms you chose at once.");
  });
});

describe("SubmissionReceipt", () => {
  const base = { requestId: "req-1", projectName: "Glacierswap", submittedAt: null, quoteDeadline: null };
  it("default and narrowed", () => {
    expect(el(SubmissionReceipt, base)).toContain(
      "Once approved, every whitelisted firm is notified",
    );
    const n = el(SubmissionReceipt, { ...base, chosenCount: 7, whitelistCount: 16 });
    expect(n).toContain("Once approved, the 7 firms you chose are notified");
    expect(n).toContain("The 7 firms you chose are notified the moment the program team approves it");
  });
});

describe("RequestSummary", () => {
  it("pre-approval Firms row and narrowed header after approval", () => {
    const pre = el(RequestSummary, {
      detail: ownerDetail({
        status: "pending_review",
        shortlist_auditor_ids: ["a", "b"],
        shortlist_firms: [
          { id: "a", firm_name: "Nordlicht Security" },
          { id: "b", firm_name: "Cipherline" },
        ],
      }),
    });
    expect(pre).toContain("Nordlicht Security · Cipherline");
    expect(pre).toContain("2 of 16 whitelisted firms");

    const gone = el(RequestSummary, {
      detail: ownerDetail({ status: "pending_review", shortlist_auditor_ids: ["a"], shortlist_firms: [] }),
    });
    expect(gone).toContain("None of the firms you chose is still listed.");

    const post = el(RequestSummary, {
      detail: ownerDetail({ status: "collecting", shortlist_auditor_ids: ["a"], shortlist_firms: [] }),
    });
    expect(post).toContain("Your request · what the firms you chose received");
    expect(post).not.toContain("whitelisted firms");
  });
});

describe("CollectingBanner", () => {
  it("narrowed zero line and label", () => {
    const html = el(CollectingBanner, {
      detail: ownerDetail({ fanout_count: 0, shortlist_auditor_ids: ["a"] }),
    });
    expect(html).toContain("none of the firms you chose was still listed at approval");
    expect(html).toContain("Reopen after expiry re-notifies the firms you chose");
  });
});

describe("RequestDetailView expired card", () => {
  it("default and narrowed", () => {
    const def = el(RequestDetailView, {
      detail: ownerDetail({ status: "expired", display_status: "expired" }),
      userId: "u1",
    });
    expect(def).toContain("every active firm is notified again");
    const narrowed = el(RequestDetailView, {
      detail: ownerDetail({ status: "expired", display_status: "expired", shortlist_auditor_ids: ["a"] }),
      userId: "u1",
    });
    expect(narrowed).toContain("the firms you chose are notified again");
  });
});

describe("ReviewDecision", () => {
  const base = { requestId: "req-1", fanoutTarget: 16 };
  it("three panel states", () => {
    expect(el(ReviewDecision, base)).toContain("Approving notifies 16 active firms");
    const some = el(ReviewDecision, {
      ...base,
      shortlistFirms: [
        { id: "a", firm_name: "Nordlicht Security", active: true },
        { id: "b", firm_name: "Halborn", active: false },
      ],
      whitelistCount: 16,
    });
    expect(some).toContain("Approving notifies 1 of the 2 firms this project chose");
    expect(some).toContain("Halborn (deactivated)");
    const none = el(ReviewDecision, {
      ...base,
      shortlistFirms: [{ id: "b", firm_name: "Halborn", active: false }],
      whitelistCount: 16,
    });
    expect(none).toContain("None of the 1 firms this project chose is still active.");
  });
});

const event = (action: string, meta: Record<string, unknown>) => ({
  id: `e-${action}`,
  request_id: "req-1",
  actor_type: "system",
  actor_id: null,
  action,
  meta,
  created_at: new Date("2026-09-04T10:00:00Z"),
});

describe("ActivityTrail", () => {
  it("fan-out and reopen with and without a shortlist, and a pre-v1.1 event", () => {
    const noShortlist = el(ActivityTrail, {
      events: [event("fanout_created", { auditor_count: 16, whitelist_count: 16, shortlist_count: 0 })],
      fanoutFirms: [],
    });
    expect(noShortlist).toContain("Fanned out to 16 whitelisted firms");

    const shortlisted = el(ActivityTrail, {
      events: [event("fanout_created", { auditor_count: 4, whitelist_count: 15, shortlist_count: 5 })],
      fanoutFirms: [],
    });
    expect(shortlisted).toContain("Fanned out to 4 of 15 whitelisted firms · project chose 5");

    const reopened = el(ActivityTrail, {
      events: [event("request_reopened", { auditor_count: 4, whitelist_count: 15, shortlist_count: 5 })],
      fanoutFirms: [],
    });
    expect(reopened).toContain(
      "Request reopened for one more round · 4 of 15 whitelisted firms notified again · project chose 5",
    );

    const legacy = el(ActivityTrail, {
      events: [event("fanout_created", { auditor_count: 12 })],
      fanoutFirms: [],
    });
    expect(legacy).toContain("Fanned out to 12 whitelisted firms");
  });
});
