import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {}, push: () => {} }),
  notFound: () => {
    throw new Error("notFound");
  },
}));
// The page's two external edges: the session check and the database read.
vi.mock("@/app/(home)/audits/admin/require-admin", () => ({
  denyIfNotAuditAdmin: async () => null,
}));
vi.mock("@/server/services/audits/visibility", () => ({ getAdminRequestDetail: vi.fn() }));

import { SubmissionDetails } from "@/components/audits/admin/SubmissionDetails";
import AuditAdminDrilldownPage from "@/app/(home)/audits/admin/requests/[id]/page";
import { getAdminRequestDetail, type AdminRequestDetail } from "@/server/services/audits/visibility";

// The full shape getAdminRequestDetail returns: every AuditRequest column plus
// the admin includes and the derived fields. Hand-written values, so every
// expectation below is a literal.
const adminDetail = (over: Partial<AdminRequestDetail> = {}): AdminRequestDetail =>
  ({
    id: "req-1",
    user_id: "u1",
    source_project_id: null,
    project_name: "Glacierswap",
    website: "https://glacierswap.example",
    description: "A concentrated-liquidity DEX on C-Chain.",
    scope: "Router and pool factory contracts.",
    project_types: ["DeFi protocol", "Yield / staking"],
    deployment_target: "own_l1",
    multichain: true,
    services: ["Smart contract audit (Solidity / Vyper)", "AI security scan"],
    shortlist_auditor_ids: [],
    repos: [{ url: "https://github.com/glacierswap/core", ref: "v1.2.0" }],
    languages: ["Solidity"],
    frameworks: ["Foundry"],
    nsloc: 12400,
    doc_links: ["https://docs.glacierswap.example/spec"],
    attachments: [
      {
        name: "whitepaper.pdf",
        url: "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/audits/requests/req-1/whitepaper.pdf",
        size: 1024,
      },
    ],
    needed_by: new Date("2026-11-02T00:00:00Z"),
    quote_deadline: null,
    urgency: "within_6_weeks",
    contact_name: "Ada Lovelace",
    contact_email: "ada@glacierswap.example",
    contact_handle: "@ada_glacier",
    contact_calendar_url: "https://cal.com/ada-glacierswap",
    contact_consent_at: new Date("2026-09-28T09:00:00Z"),
    contact_handle_shared_at: null,
    status: "pending_review",
    accepted_quote_id: null,
    submitted_at: new Date("2026-09-28T09:00:00Z"),
    closed_at: null,
    created_at: new Date("2026-09-27T12:00:00Z"),
    updated_at: new Date("2026-09-28T09:00:00Z"),
    user: { name: "Ada Lovelace", email: "ada@glacierswap.example" },
    quotes: [],
    subsidy_decisions: [],
    events: [],
    fanout_deliveries: [],
    display_status: "pending_review",
    shortlist_firms: [],
    whitelist_count: 16,
    ...over,
  }) as unknown as AdminRequestDetail;

const render = (detail: AdminRequestDetail) =>
  renderToStaticMarkup(createElement(SubmissionDetails, { detail }));

/** Every <a> tag in the markup, as its raw opening tag. */
const anchors = (html: string) => html.match(/<a\s[^>]*>/g) ?? [];

describe("SubmissionDetails", () => {
  it("shows every field the project submitted", () => {
    const html = render(adminDetail());
    for (const text of [
      "A concentrated-liquidity DEX on C-Chain.",
      "Router and pool factory contracts.",
      "https://glacierswap.example",
      "DeFi protocol · Yield / staking",
      "Own L1 · multi-chain",
      "Smart contract audit (Solidity / Vyper) · AI security scan",
      "https://github.com/glacierswap/core",
      "v1.2.0",
      "~12,400 nSLOC · Solidity · Foundry",
      "https://docs.glacierswap.example/spec",
      "whitepaper.pdf",
      "needed by 2026-11-02",
      "within 6 weeks",
      "Ada Lovelace",
      'href="mailto:ada@glacierswap.example"',
      "@ada_glacier",
      ">Calendar<",
      "https://cal.com/ada-glacierswap",
    ]) {
      expect(html).toContain(text);
    }
  });

  it("links attachments through the program route, never the storage URL", () => {
    const html = render(adminDetail());
    expect(html).toContain('href="/api/audits/attachments/req-1/0"');
    expect(html).not.toContain("blob.vercel-storage.com");
  });

  it("opens every project-entered link in a new tab, without referrer or ranking credit", () => {
    const external = anchors(render(adminDetail())).filter((tag) => /href="https?:/.test(tag));
    // website, repo, doc link, calendar
    expect(external).toHaveLength(4);
    for (const tag of external) {
      expect(tag).toContain('target="_blank"');
      expect(tag).toContain('rel="noopener noreferrer nofollow"');
    }
  });

  it("links only http(s) URLs and renders any other stored value as text", () => {
    for (const website of [
      "https://javascript:alert(1)", // does not parse
      "javascript://evil.example/%0aalert(1)", // parses, with a host
      "data://evil.example/x",
    ]) {
      const html = render(adminDetail({ website }));
      expect(html).toContain(website);
      for (const tag of anchors(html)) {
        expect(tag).toMatch(/href="(https?:\/\/|mailto:|\/api\/audits\/attachments\/)/);
      }
    }
  });

  it("leaves out the rows the project left empty", () => {
    const html = render(
      adminDetail({
        project_types: [],
        repos: [],
        doc_links: [],
        attachments: [],
        contact_handle: null,
        contact_calendar_url: null,
      }),
    );
    expect(html).not.toContain(">Project type<");
    expect(html).not.toContain(">Repositories<");
    expect(html).not.toContain(">Docs<");
    expect(html).not.toContain("Telegram");
    expect(html).not.toContain(">Calendar<");
    expect(html).not.toContain("cal.com");
  });

  it("shows the quote window only while the request waits for approval", () => {
    expect(render(adminDetail({ quote_deadline: null }))).toMatch(
      /quotes close \d+ days after approval/,
    );
    expect(render(adminDetail({ quote_deadline: new Date("2026-10-12T00:00:00Z") }))).toContain(
      "quotes close 2026-10-12",
    );
    // Once approved, the quotes card header carries the window.
    const collecting = render(
      adminDetail({
        status: "collecting",
        display_status: "collecting",
        quote_deadline: new Date("2026-10-12T00:00:00Z"),
      }),
    );
    expect(collecting).not.toContain("quotes close");
  });

  it("tags the Telegram handle the project shared with the firms, in any status", () => {
    const sharedAt = new Date("2026-09-28T09:00:00Z");
    expect(render(adminDetail({ contact_handle_shared_at: sharedAt }))).toContain(
      "shared with firms",
    );
    expect(
      render(
        adminDetail({
          contact_handle_shared_at: sharedAt,
          status: "engaged",
          display_status: "engaged",
        }),
      ),
    ).toContain("shared with firms");
    expect(render(adminDetail())).not.toContain("shared with firms");
  });

  it("names the Builder Hub account only when it differs from the contact", () => {
    expect(render(adminDetail())).toContain("Same as the contact");
    const other = render(
      adminDetail({ user: { name: "Grace Hopper", email: "grace@other.example" } }),
    );
    expect(other).toContain("Grace Hopper · grace@other.example");
    expect(other).not.toContain("Same as the contact");
    // Same person, second address: the name is already on the Contact row.
    const sameName = render(
      adminDetail({ user: { name: "Ada Lovelace", email: "ada@other.example" } }),
    );
    expect(sameName).toContain("ada@other.example");
    expect(sameName.split("Ada Lovelace").length - 1).toBe(1);
  });
});

describe("admin request page", () => {
  it("shows the project's submission on a request waiting for approval", async () => {
    vi.mocked(getAdminRequestDetail).mockResolvedValue(adminDetail());
    const page = await AuditAdminDrilldownPage({ params: Promise.resolve({ id: "req-1" }) });
    const html = renderToStaticMarkup(page as React.ReactElement);
    expect(html).toContain("A concentrated-liquidity DEX on C-Chain.");
    expect(html).toContain("https://github.com/glacierswap/core");
    expect(html).toContain("Nothing is sent");
  });

  // The gate reads the STORED status: a collecting request past its deadline
  // displays as deciding (or expired) and is still deletable.
  it("offers the delete on a request whose quote window has closed", async () => {
    vi.mocked(getAdminRequestDetail).mockResolvedValue(
      adminDetail({ status: "collecting", display_status: "deciding" }),
    );
    const page = await AuditAdminDrilldownPage({ params: Promise.resolve({ id: "req-1" }) });
    expect(renderToStaticMarkup(page as React.ReactElement)).toContain("Delete request");
  });

  it("never offers the delete on an engaged request", async () => {
    vi.mocked(getAdminRequestDetail).mockResolvedValue(
      adminDetail({ status: "engaged", display_status: "engaged" }),
    );
    const page = await AuditAdminDrilldownPage({ params: Promise.resolve({ id: "req-1" }) });
    expect(renderToStaticMarkup(page as React.ReactElement)).not.toContain("Delete request");
  });
});
