import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {}, push: () => {} }),
  notFound: () => {
    throw new Error("notFound");
  },
  redirect: (to: string) => {
    throw new Error(`redirect ${to}`);
  },
}));
// The page's external edges: the session and the two owner reads.
vi.mock("@/lib/auth/authSession", () => ({
  getAuthSession: async () => ({ user: { id: "u1" } }),
}));
vi.mock("@/server/services/audits/visibility", () => ({
  getOwnerRequestDetail: vi.fn(),
  getOwnerFirmUsernames: vi.fn(),
}));

import AuditRequestPage from "@/app/(home)/audits/[id]/page";
import {
  getOwnerFirmUsernames,
  getOwnerRequestDetail,
  type OwnerRequestDetail,
} from "@/server/services/audits/visibility";

/**
 * The owner's request page reads the GitHub usernames of the firms its request
 * reached for the signed-in owner and hands them to the view (FDE-249 step 2).
 */

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
    repos: [{ url: "https://github.com/glacierswap/core", ref: "" }],
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
    fanout_count: 2,
    shortlist_auditor_ids: [],
    shortlist_firms: [],
    whitelist_count: 16,
    quotes: [],
    subsidy: null,
    ...over,
  }) as unknown as OwnerRequestDetail;

describe("the owner's request page", () => {
  it("reads the usernames for the signed-in owner and shows them on an open request", async () => {
    vi.mocked(getOwnerRequestDetail).mockResolvedValue(ownerDetail());
    vi.mocked(getOwnerFirmUsernames).mockResolvedValue([
      { id: "l", firm_name: "Ledgerproof Labs", github_usernames: ["ledgerproof-ops"] },
      { id: "n", firm_name: "Nordlicht Security", github_usernames: [] },
    ]);

    const page = await AuditRequestPage({
      params: Promise.resolve({ id: "req-1" }),
      searchParams: Promise.resolve({}),
    });
    const html = renderToStaticMarkup(page as React.ReactElement);

    expect(getOwnerFirmUsernames).toHaveBeenCalledWith("u1", "req-1");
    expect(html).toContain("GitHub usernames · firms this request reached");
    expect(html).toContain('href="https://github.com/ledgerproof-ops"');
  });
});
