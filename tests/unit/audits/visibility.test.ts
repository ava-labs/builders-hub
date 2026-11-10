import { afterEach, describe, expect, it, vi, beforeEach } from "vitest";

const {
  requestFindManyMock,
  requestFindFirstMock,
  requestFindUniqueMock,
  auditorFindManyMock,
  auditorFindUniqueMock,
  auditorCountMock,
  deliveryFindManyMock,
  deliveryFindUniqueMock,
  quoteFindManyMock,
  quoteFindUniqueMock,
  quoteFindFirstMock,
  subsidyFindFirstMock,
} = vi.hoisted(() => ({
  requestFindManyMock: vi.fn(),
  requestFindFirstMock: vi.fn(),
  requestFindUniqueMock: vi.fn(),
  auditorFindManyMock: vi.fn(),
  auditorFindUniqueMock: vi.fn(),
  auditorCountMock: vi.fn(),
  deliveryFindManyMock: vi.fn(),
  deliveryFindUniqueMock: vi.fn(),
  quoteFindManyMock: vi.fn(),
  quoteFindUniqueMock: vi.fn(),
  quoteFindFirstMock: vi.fn(),
  subsidyFindFirstMock: vi.fn(),
}));

vi.mock("@/prisma/prisma", () => ({
  prisma: {
    auditRequest: {
      findMany: requestFindManyMock,
      findFirst: requestFindFirstMock,
      findUnique: requestFindUniqueMock,
    },
    auditor: {
      findMany: auditorFindManyMock,
      findUnique: auditorFindUniqueMock,
      count: auditorCountMock,
    },
    auditSubsidyDecision: {
      findFirst: subsidyFindFirstMock,
    },
    auditFanoutDelivery: {
      findMany: deliveryFindManyMock,
      findUnique: deliveryFindUniqueMock,
    },
    auditQuote: {
      findMany: quoteFindManyMock,
      findUnique: quoteFindUniqueMock,
      findFirst: quoteFindFirstMock,
    },
  },
}));

import {
  countActiveFirms,
  getAcceptanceParticipants,
  getAcceptedQuoteForAdmin,
  getAdminAuditors,
  getAdminOverview,
  getAdminRequestDetail,
  getAdminRequests,
  getApprovalNotice,
  getAuditorInbox,
  getOwnFirm,
  getOwnerFirmUsernames,
  getOwnerRequests,
  getOwnerRequestDetail,
  getPublicFirms,
  getRequestForAuditor,
} from "@/server/services/audits/visibility";

const OWNER = "user-owner";
const DAY = 24 * 60 * 60 * 1000;
const FUTURE = new Date(Date.now() + 6 * DAY);
const PAST = new Date(Date.now() - 2 * DAY);

const baseRequest = {
  id: "req-1",
  user_id: OWNER,
  project_name: "Glacierswap",
  status: "collecting",
  quote_deadline: FUTURE,
  services: ["Smart contract audit (Solidity / Vyper)"],
  shortlist_auditor_ids: [],
  created_at: new Date(),
  submitted_at: new Date(),
};

beforeEach(() => {
  vi.clearAllMocks();
  auditorCountMock.mockResolvedValue(16);
});

describe("getOwnerRequests", () => {
  it("always pins the owner's user_id in the where clause", async () => {
    requestFindManyMock.mockResolvedValue([]);

    await getOwnerRequests(OWNER);

    expect(requestFindManyMock.mock.calls[0][0].where).toMatchObject({ user_id: OWNER });
  });

  it("returns derived display status, quote counts and price ranges", async () => {
    requestFindManyMock.mockResolvedValue([
      {
        ...baseRequest,
        quotes: [
          { price_usd: 28000 },
          { price_usd: 18000 },
          { price_usd: 44000 },
          { price_usd: 34500 },
        ],
      },
      {
        ...baseRequest,
        id: "req-2",
        quote_deadline: PAST,
        quotes: [{ price_usd: 20000 }, { price_usd: 30000 }],
      },
      { ...baseRequest, id: "req-3", status: "draft", quote_deadline: null, quotes: [] },
    ]);

    const rows = await getOwnerRequests(OWNER);

    expect(rows.map((r) => r.display_status)).toEqual(["collecting", "deciding", "draft"]);
    expect(rows.map((r) => r.quote_count)).toEqual([4, 2, 0]);
    expect(rows[0].quote_price_range).toEqual({ min: 18000, max: 44000 });
    expect(rows[2].quote_price_range).toBeNull();
  });
});

describe("getOwnerRequestDetail", () => {
  it("pins both the request id and the owner's user_id", async () => {
    requestFindFirstMock.mockResolvedValue(null);

    const detail = await getOwnerRequestDetail(OWNER, "req-1");

    expect(detail).toBeNull();
    expect(requestFindFirstMock.mock.calls[0][0].where).toMatchObject({
      id: "req-1",
      user_id: OWNER,
    });
  });

  it("reveals an auditor's contact email only on the accepted quote", async () => {
    requestFindFirstMock.mockResolvedValue({
      ...baseRequest,
      status: "engaged",
      accepted_quote_id: "q-2",
      _count: { fanout_deliveries: 12 },
      quotes: [
        {
          id: "q-1",
          status: "not_selected",
          price_usd: 36000,
          duration: 3,
          duration_unit: "weeks",
          earliest_start: FUTURE,
          message: "Three weeks.",
          reaudit_included: false,
          auditor: {
            firm_name: "Harborline",
            services: [],
            quote_email: "quotes@harborline.example",
          },
        },
        {
          id: "q-2",
          status: "accepted",
          price_usd: 34500,
          duration: 4,
          duration_unit: "weeks",
          earliest_start: FUTURE,
          message: "Fixed fee.",
          reaudit_included: true,
          auditor: {
            firm_name: "Ledgerproof Labs",
            services: [],
            quote_email: "audits@ledgerproof.example",
          },
        },
      ],
      subsidy_decisions: [],
    });

    const detail = await getOwnerRequestDetail(OWNER, "req-1");

    const bySelection = Object.fromEntries(detail!.quotes.map((q) => [q.id, q]));
    expect(bySelection["q-2"].quote_email).toBe("audits@ledgerproof.example");
    expect(bySelection["q-1"].quote_email).toBeUndefined();
    expect(bySelection["q-1"].firm_name).toBe("Harborline");
    expect(detail!.fanout_count).toBe(12);
  });

  it("reveals the teammate who saved the winning quote, falling back to the firm's quote email", async () => {
    const quote = (submitted_by_email: string | null, members: { email: string }[] = []) => ({
      id: "q-2",
      status: "accepted",
      price_usd: 30000,
      duration: 3,
      duration_unit: "weeks",
      earliest_start: FUTURE,
      message: "m",
      reaudit_included: false,
      submitted_by_email,
      auditor: {
        firm_name: "Ledgerproof Labs",
        services: [],
        quote_email: "audits@ledgerproof.example",
        members,
      },
    });
    const engaged = {
      ...baseRequest,
      status: "engaged",
      accepted_quote_id: "q-2",
      _count: { fanout_deliveries: 3 },
      subsidy_decisions: [],
    };

    requestFindFirstMock.mockResolvedValue({
      ...engaged,
      quotes: [quote("bob@ledgerproof.example", [{ email: "bob@ledgerproof.example" }])],
    });
    const withSubmitter = await getOwnerRequestDetail(OWNER, "req-1");
    expect(withSubmitter!.quotes[0].quote_email).toBe("bob@ledgerproof.example");

    requestFindFirstMock.mockResolvedValue({ ...engaged, quotes: [quote(null)] });
    const legacy = await getOwnerRequestDetail(OWNER, "req-1");
    expect(legacy!.quotes[0].quote_email).toBe("audits@ledgerproof.example");

    // The teammate who quoted has since been removed: never hand the project
    // an address that can no longer sign in or receive the firm's notices.
    requestFindFirstMock.mockResolvedValue({
      ...engaged,
      quotes: [quote("gone@ledgerproof.example", [{ email: "bob@ledgerproof.example" }])],
    });
    const removed = await getOwnerRequestDetail(OWNER, "req-1");
    expect(removed!.quotes[0].quote_email).toBe("audits@ledgerproof.example");
  });

  it("exposes the subsidy outcome without the deciding admin", async () => {
    requestFindFirstMock.mockResolvedValue({
      ...baseRequest,
      status: "engaged",
      _count: { fanout_deliveries: 12 },
      quotes: [],
      subsidy_decisions: [
        {
          state: "approved",
          pct: 75,
          program_amount_usd: 25875,
          project_amount_usd: 8625,
          decided_by: "admin-1",
          note: "Board approved",
          decided_at: new Date(),
        },
      ],
    });

    const detail = await getOwnerRequestDetail(OWNER, "req-1");

    expect(detail!.subsidy).toEqual({
      state: "approved",
      pct: 75,
      program_amount_usd: 25875,
      project_amount_usd: 8625,
    });
    expect(JSON.stringify(detail!.subsidy)).not.toContain("admin-1");
    expect(JSON.stringify(detail!.subsidy)).not.toContain("Board approved");
  });

  // Good news only (2026-10-20): the latest decision reaches the project's
  // browser only when the program pays something.
  const engagedWithLatest = (latest: Record<string, unknown>) => ({
    ...baseRequest,
    status: "engaged",
    _count: { fanout_deliveries: 12 },
    quotes: [],
    subsidy_decisions: [
      { decided_by: "admin-1", note: null, decided_at: new Date(), ...latest },
    ],
  });

  it("never hands the project a declined decision", async () => {
    requestFindFirstMock.mockResolvedValue(
      engagedWithLatest({ state: "declined", pct: 0, program_amount_usd: 0, project_amount_usd: 24000 }),
    );

    const detail = await getOwnerRequestDetail(OWNER, "req-1");

    expect(detail!.subsidy).toBeNull();
    // Nor the raw row: the whole detail reaches the browser.
    expect(detail).not.toHaveProperty("subsidy_decisions");
    expect(JSON.stringify(detail)).not.toContain("admin-1");
    // The latest decision is the one that counts, so a decline that
    // supersedes an approval hides it.
    expect(requestFindFirstMock.mock.calls[0][0].include.subsidy_decisions).toEqual({
      orderBy: { decided_at: "desc" },
      take: 1,
    });
  });

  it("never hands the project a $0 approval", async () => {
    requestFindFirstMock.mockResolvedValue(
      engagedWithLatest({ state: "approved", pct: 0, program_amount_usd: 0, project_amount_usd: 24000 }),
    );

    const detail = await getOwnerRequestDetail(OWNER, "req-1");

    expect(detail!.subsidy).toBeNull();
  });
});

describe("admin scope", () => {
  const adminFixtures = [
    {
      // collecting, deadline ahead -> open
      ...baseRequest,
      id: "req-a",
      user: { name: "Alex", email: "alex@example.com" },
      quotes: [
        { price_usd: 20000, status: "submitted" },
        { price_usd: 30000, status: "submitted" },
      ],
      subsidy_decisions: [],
      _count: { fanout_deliveries: 6 },
    },
    {
      // collecting, past deadline, one quote -> deciding (open)
      ...baseRequest,
      id: "req-b",
      quote_deadline: PAST,
      user: { name: "Alex", email: "alex@example.com" },
      quotes: [{ price_usd: 18000, status: "submitted" }],
      subsidy_decisions: [],
      _count: { fanout_deliveries: 6 },
    },
    {
      // engaged with an accepted quote and no decision -> needs approval
      ...baseRequest,
      id: "req-c",
      status: "engaged",
      accepted_quote_id: "q-x",
      user: { name: "Alex", email: "alex@example.com" },
      quotes: [
        { price_usd: 28000, status: "accepted" },
        { price_usd: 36000, status: "not_selected" },
      ],
      subsidy_decisions: [],
      _count: { fanout_deliveries: 6 },
    },
  ];

  it("derives every overview number at read time", async () => {
    requestFindManyMock.mockResolvedValue(adminFixtures);

    const overview = await getAdminOverview();

    expect(overview.open_requests).toBe(2);
    expect(overview.quotes_collected).toBe(5);
    // "across open requests" (design tile): open quotes 18k 20k 30k -> 20k
    expect(overview.median_quote_usd).toBe(20000);
    expect(overview.engaged_count).toBe(1);
    // 10% of accepted volume over engaged requests (28k -> 2.8k)
    expect(overview.fees_not_paid_usd).toBe(2800);
    // engaged with no decision on file -> the "Decide subsidy" tile
    expect(overview.needs_subsidy_count).toBe(1);
    // the approval gate's own queue is a separate number
    expect(overview.pending_review_count).toBe(0);
  });

  it("filters by derived status and flags needs_approval", async () => {
    requestFindManyMock.mockResolvedValue(adminFixtures);

    const deciding = await getAdminRequests({ status: "deciding", take: 50, skip: 0 });
    expect(deciding.map((row) => row.id)).toEqual(["req-b"]);

    const all = await getAdminRequests({ take: 50, skip: 0 });
    const engaged = all.find((row) => row.id === "req-c");
    expect(engaged?.subsidy_state).toBe("needs_approval");
    expect(engaged?.accepted_firm_price_usd).toBe(28000);
  });

  it("derives whitelist stats per firm (see bottom of file for the source guard)", async () => {
    auditorFindManyMock.mockResolvedValue([
      {
        id: "aud-1",
        firm_name: "Nordlicht Security",
        quote_email: "quotes@nordlicht.example",
        services: [],
        active: true,
        invited_at: new Date("2026-05-02"),
        first_login_at: new Date("2026-05-12"),
        deactivated_at: null,
        attio_ref: "NL-114",
        github_username: "nordlicht-sec",
        members: [
          {
            id: "mem-1",
            email: "alice@nordlicht.example",
            invited_at: new Date("2026-09-01"),
            first_login_at: null,
            github_username: "alice-audits",
          },
        ],
        _count: { fanout_deliveries: 9 },
        quotes: [
          { status: "accepted", created_at: new Date("2026-07-25") },
          { status: "submitted", created_at: new Date("2026-07-10") },
          { status: "not_selected", created_at: new Date("2026-06-01") },
        ],
      },
    ]);

    const rows = await getAdminAuditors();

    expect(rows[0]).toMatchObject({
      firm_name: "Nordlicht Security",
      sent: 9,
      quoted: 3,
      won: 1,
    });
    expect(rows[0].last_quote_at).toEqual(new Date("2026-07-25"));
    // Teammates ride on the row so the whitelist panel can list them.
    expect(rows[0].members).toEqual([
      expect.objectContaining({ id: "mem-1", email: "alice@nordlicht.example", first_login_at: null }),
    ]);
  });

  it("hands the whitelist each person's GitHub username, read-only (D2.6)", async () => {
    auditorFindManyMock.mockResolvedValue([
      {
        id: "aud-1",
        firm_name: "Nordlicht Security",
        quote_email: "quotes@nordlicht.example",
        services: [],
        active: true,
        invited_at: new Date("2026-05-02"),
        first_login_at: new Date("2026-05-12"),
        deactivated_at: null,
        attio_ref: null,
        website: null,
        logo_url: null,
        github_username: "nordlicht-sec",
        members: [
          {
            id: "mem-1",
            email: "alice@nordlicht.example",
            invited_at: new Date("2026-09-01"),
            first_login_at: null,
            github_username: "alice-audits",
          },
        ],
        _count: { fanout_deliveries: 0 },
        quotes: [],
      },
    ]);

    const rows = await getAdminAuditors();

    expect(auditorFindManyMock.mock.calls[0][0].include.members.select.github_username).toBe(true);
    expect(rows[0].github_username).toBe("nordlicht-sec");
    expect(rows[0].members[0].github_username).toBe("alice-audits");
  });
});

describe("auditor scope", () => {
  it("pins the auditor id in every inbox query and strips contacts from the projection", async () => {
    deliveryFindManyMock.mockResolvedValue([]);
    quoteFindManyMock.mockResolvedValue([]);

    await getAuditorInbox("aud-1");

    expect(deliveryFindManyMock.mock.calls[0][0].where).toMatchObject({ auditor_id: "aud-1" });
    expect(quoteFindManyMock.mock.calls[0][0].where).toMatchObject({ auditor_id: "aud-1" });
    const requestSelect = deliveryFindManyMock.mock.calls[0][0].include.request.select;
    expect(requestSelect.contact_name).toBeUndefined();
    expect(requestSelect.contact_email).toBeUndefined();
    expect(requestSelect.contact_handle).toBeUndefined();
    expect(requestSelect.contact_calendar_url).toBeUndefined();
    expect(requestSelect.user).toBeUndefined();
    // The shortlist never reaches an auditor's inbox projection (S-3).
    expect(requestSelect.shortlist_auditor_ids).toBeUndefined();
  });

  it("hides a request without this auditor's fan-out row", async () => {
    deliveryFindUniqueMock.mockResolvedValue(null);

    const result = await getRequestForAuditor("aud-1", "req-1");

    expect(result).toBeNull();
    expect(deliveryFindUniqueMock.mock.calls[0][0].where).toEqual({
      request_id_auditor_id: { request_id: "req-1", auditor_id: "aud-1" },
    });
    expect(requestFindFirstMock).not.toHaveBeenCalled();
  });

  it("reveals project contacts only when the own quote is accepted", async () => {
    deliveryFindUniqueMock.mockResolvedValue({ request_id: "req-1", auditor_id: "aud-1" });
    requestFindFirstMock.mockResolvedValue({
      id: "req-1",
      project_name: "Glacierswap",
      status: "engaged",
      quote_deadline: PAST,
      services: [],
    });
    quoteFindUniqueMock.mockResolvedValue({ id: "q-1", status: "accepted", price_usd: 28000 });
    requestFindUniqueMock.mockResolvedValue({
      contact_name: "Ada Stone",
      contact_email: "ada@glacierswap.example",
      contact_handle: null,
      contact_calendar_url: null,
    });

    const won = await getRequestForAuditor("aud-1", "req-1");
    expect(won!.contacts?.contact_email).toBe("ada@glacierswap.example");

    quoteFindUniqueMock.mockResolvedValue({ id: "q-1", status: "submitted", price_usd: 28000 });
    requestFindUniqueMock.mockClear();

    const pending = await getRequestForAuditor("aud-1", "req-1");
    expect(pending!.contacts).toBeNull();
    expect(requestFindUniqueMock).not.toHaveBeenCalled();
  });
});

describe("auditor scope · subsidy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    deliveryFindUniqueMock.mockResolvedValue({ request_id: "req-1" });
    requestFindFirstMock.mockResolvedValue({
      id: "req-1",
      status: "engaged",
      quote_deadline: new Date("2026-08-09T12:00:00Z"),
      quotes: [],
    });
    requestFindUniqueMock.mockResolvedValue({
      contact_name: "Ada Stone",
      contact_email: "ada@glacierswap.example",
      contact_handle: null,
      contact_calendar_url: null,
    });
  });

  it("shows the winning firm an APPROVED subsidy", async () => {
    quoteFindUniqueMock.mockResolvedValue({ id: "q-1", status: "accepted", price_usd: 12500 });
    subsidyFindFirstMock.mockResolvedValue({ state: "approved", program_amount_usd: 3000, pct: 24 });

    const view = await getRequestForAuditor("aud-1", "req-1");

    expect(view!.subsidy).toMatchObject({ program_amount_usd: 3000, pct: 24 });
  });

  it("hides a DECLINED subsidy: that is the program's business, not the firm's", async () => {
    quoteFindUniqueMock.mockResolvedValue({ id: "q-1", status: "accepted", price_usd: 12500 });
    subsidyFindFirstMock.mockResolvedValue({ state: "declined", program_amount_usd: 0, pct: 0 });

    const view = await getRequestForAuditor("aud-1", "req-1");

    expect(view!.subsidy).toBeNull();
  });

  it("hides a $0 approval from the winning firm", async () => {
    quoteFindUniqueMock.mockResolvedValue({ id: "q-1", status: "accepted", price_usd: 12500 });
    subsidyFindFirstMock.mockResolvedValue({ state: "approved", program_amount_usd: 0, pct: 0 });

    const view = await getRequestForAuditor("aud-1", "req-1");

    expect(view!.subsidy).toBeNull();
    // The latest decision is the one the firm reads.
    expect(subsidyFindFirstMock.mock.calls[0][0]).toMatchObject({
      where: { request_id: "req-1" },
      orderBy: { decided_at: "desc" },
    });
  });

  it("never looks up a subsidy for a firm that did not win", async () => {
    quoteFindUniqueMock.mockResolvedValue({ id: "q-1", status: "not_selected", price_usd: 12500 });

    const view = await getRequestForAuditor("aud-1", "req-1");

    expect(view!.subsidy).toBeNull();
    expect(subsidyFindFirstMock).not.toHaveBeenCalled();
  });
});

describe("auditor scope · Telegram share", () => {
  // What AUDITOR_SAFE_REQUEST_SELECT returns for a request open to quotes.
  const collectingRow = {
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
    needed_by: FUTURE,
    quote_deadline: FUTURE,
    urgency: "within_6_weeks",
    status: "collecting",
    submitted_at: new Date("2026-10-01T09:00:00Z"),
    created_at: new Date("2026-09-30T12:00:00Z"),
  };
  // The guarded read: the handle and its stamp, as the row stores them.
  const shareRow = (over: Record<string, unknown> = {}) => ({
    contact_handle: "@ada_glacier",
    contact_handle_shared_at: new Date("2026-10-01T09:00:00Z"),
    contact_calendar_url: null,
    contact_calendar_shared_at: null,
    ...over,
  });
  const submittedQuote = { id: "q-1", status: "submitted", price_usd: 28000 };

  beforeEach(() => {
    vi.clearAllMocks();
    deliveryFindUniqueMock.mockResolvedValue({ auditor: { active: true } });
    requestFindFirstMock.mockResolvedValue(collectingRow);
    quoteFindUniqueMock.mockResolvedValue(null);
    requestFindUniqueMock.mockResolvedValue(shareRow());
  });

  it("shows an active notified firm the handle the project shared, while the request collects", async () => {
    const view = await getRequestForAuditor("aud-1", "req-1");

    expect(view!.shared_handle).toBe("@ada_glacier");
    expect(view!.contacts).toBeNull();
  });

  it("reads the shared contact fields alone, apart from the contact-free request select", async () => {
    await getRequestForAuditor("aud-1", "req-1");

    expect(requestFindUniqueMock.mock.calls[0][0]).toEqual({
      where: { id: "req-1" },
      select: {
        contact_handle: true,
        contact_handle_shared_at: true,
        contact_calendar_url: true,
        contact_calendar_shared_at: true,
      },
    });
    const safeSelect = requestFindFirstMock.mock.calls[0][0].select;
    for (const column of [
      "contact_name",
      "contact_email",
      "contact_handle",
      "contact_calendar_url",
      "contact_handle_shared_at",
      "contact_calendar_shared_at",
    ]) {
      expect(safeSelect[column]).toBeUndefined();
    }
  });

  it("keeps it past the deadline, where the stored status is still collecting", async () => {
    requestFindFirstMock.mockResolvedValue({ ...collectingRow, quote_deadline: PAST });
    quoteFindUniqueMock.mockResolvedValue(submittedQuote);

    const view = await getRequestForAuditor("aud-1", "req-1");

    expect(view!.window_open).toBe(false);
    expect(view!.shared_handle).toBe("@ada_glacier");
  });

  const hidden: [string, { share?: object; status?: string; quote?: object; active?: boolean }][] = [
    ["the project did not share it", { share: shareRow({ contact_handle_shared_at: null }) }],
    ["the stored handle is null", { share: shareRow({ contact_handle: null }) }],
    ["the stored handle is blank", { share: shareRow({ contact_handle: "   " }) }],
    ["the firm lost to an accepted quote", { status: "engaged", quote: { ...submittedQuote, status: "not_selected" } }],
    ["the project withdrew the request", { status: "withdrawn", quote: submittedQuote }],
    ["the request waits for approval", { status: "pending_review" }],
    ["the request was rejected", { status: "rejected" }],
    ["the request went back to draft", { status: "draft" }],
    ["the firm is deactivated", { active: false }],
  ];

  it.each(hidden)("hides it when %s", async (_case, setup) => {
    if (setup.share) requestFindUniqueMock.mockResolvedValue(setup.share);
    if (setup.status) requestFindFirstMock.mockResolvedValue({ ...collectingRow, status: setup.status });
    if (setup.quote) quoteFindUniqueMock.mockResolvedValue(setup.quote);
    if (setup.active === false) deliveryFindUniqueMock.mockResolvedValue({ auditor: { active: false } });

    const view = await getRequestForAuditor("aud-1", "req-1");

    expect(view!.shared_handle).toBeNull();
  });

  it("gives the winner the full contact block instead, never both", async () => {
    const contacts = {
      contact_name: "Ada Stone",
      contact_email: "ada@glacierswap.example",
      contact_handle: "@ada_glacier",
      contact_calendar_url: "https://cal.com/ada-glacierswap",
    };
    requestFindFirstMock.mockResolvedValue({ ...collectingRow, status: "engaged" });
    quoteFindUniqueMock.mockResolvedValue({ ...submittedQuote, status: "accepted" });
    requestFindUniqueMock.mockResolvedValue(contacts);
    subsidyFindFirstMock.mockResolvedValue(null);

    const view = await getRequestForAuditor("aud-1", "req-1");

    expect(view!.contacts).toEqual(contacts);
    expect(view!.shared_handle).toBeNull();
  });

  it("reads nothing for a firm the request never reached", async () => {
    deliveryFindUniqueMock.mockResolvedValue(null);

    expect(await getRequestForAuditor("aud-1", "req-1")).toBeNull();
    expect(requestFindUniqueMock).not.toHaveBeenCalled();
  });
});

describe("auditor scope · calendar share", () => {
  const LINK = "https://cal.com/ada-glacierswap";
  // What AUDITOR_SAFE_REQUEST_SELECT returns for a request open to quotes.
  const collectingRow = {
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
    needed_by: FUTURE,
    quote_deadline: FUTURE,
    urgency: "within_6_weeks",
    status: "collecting",
    submitted_at: new Date("2026-10-01T09:00:00Z"),
    created_at: new Date("2026-09-30T12:00:00Z"),
  };
  // The guarded read, with only the calendar link shared.
  const shareRow = (over: Record<string, unknown> = {}) => ({
    contact_handle: null,
    contact_handle_shared_at: null,
    contact_calendar_url: LINK,
    contact_calendar_shared_at: new Date("2026-10-01T09:00:00Z"),
    ...over,
  });
  const submittedQuote = { id: "q-1", status: "submitted", price_usd: 28000 };

  beforeEach(() => {
    vi.clearAllMocks();
    deliveryFindUniqueMock.mockResolvedValue({ auditor: { active: true } });
    requestFindFirstMock.mockResolvedValue(collectingRow);
    quoteFindUniqueMock.mockResolvedValue(null);
    requestFindUniqueMock.mockResolvedValue(shareRow());
  });

  it("shows an active notified firm the link the project shared, and only the link", async () => {
    const view = await getRequestForAuditor("aud-1", "req-1");

    expect(view!.shared_calendar_url).toBe(LINK);
    expect(view!.shared_handle).toBeNull();
    expect(view!.contacts).toBeNull();
  });

  describe("past the quote deadline, where the stored status is still collecting", () => {
    // At 2026-12-01 12:00: a window closed 2026-11-28 picks by 2026-12-05;
    // one closed 2026-11-10 12:00 had to pick by 2026-11-17.
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date("2026-12-01T12:00:00Z"));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it.each([
      ["while the project decides", new Date("2026-11-28T00:00:00Z"), submittedQuote, "submitted"],
      ["once the pick-by date passed", new Date("2026-11-10T12:00:00Z"), submittedQuote, "expired"],
      ["when the window closed without quotes", new Date("2026-11-28T00:00:00Z"), null, undefined],
    ])("keeps it %s", async (_case, quote_deadline, quote, quoteStatus) => {
      requestFindFirstMock.mockResolvedValue({ ...collectingRow, quote_deadline });
      quoteFindUniqueMock.mockResolvedValue(quote);

      const view = await getRequestForAuditor("aud-1", "req-1");

      expect(view!.window_open).toBe(false);
      expect(view!.own_quote?.display_status).toBe(quoteStatus);
      expect(view!.shared_calendar_url).toBe(LINK);
    });
  });

  const hidden: [string, { share?: object; status?: string; quote?: object; active?: boolean }][] = [
    ["the project did not share it", { share: shareRow({ contact_calendar_shared_at: null }) }],
    ["the stored link is null", { share: shareRow({ contact_calendar_url: null }) }],
    ["the stored link is blank", { share: shareRow({ contact_calendar_url: "   " }) }],
    ["the firm lost to an accepted quote", { status: "engaged", quote: { ...submittedQuote, status: "not_selected" } }],
    ["the project withdrew the request", { status: "withdrawn", quote: submittedQuote }],
    ["the request waits for approval", { status: "pending_review" }],
    ["the request was rejected", { status: "rejected" }],
    ["the request went back to draft", { status: "draft" }],
    ["the firm is deactivated", { active: false }],
  ];

  it.each(hidden)("hides it when %s", async (_case, setup) => {
    if (setup.share) requestFindUniqueMock.mockResolvedValue(setup.share);
    if (setup.status) requestFindFirstMock.mockResolvedValue({ ...collectingRow, status: setup.status });
    if (setup.quote) quoteFindUniqueMock.mockResolvedValue(setup.quote);
    if (setup.active === false) deliveryFindUniqueMock.mockResolvedValue({ auditor: { active: false } });

    const view = await getRequestForAuditor("aud-1", "req-1");

    expect(view!.shared_calendar_url).toBeNull();
  });

  it("leaves the link out when the project shared only its handle", async () => {
    requestFindUniqueMock.mockResolvedValue(
      shareRow({
        contact_handle: "@ada_glacier",
        contact_handle_shared_at: new Date("2026-10-01T09:00:00Z"),
        contact_calendar_shared_at: null,
      }),
    );

    const view = await getRequestForAuditor("aud-1", "req-1");

    expect(view!.shared_handle).toBe("@ada_glacier");
    expect(view!.shared_calendar_url).toBeNull();
  });

  it("gives the winner the full contact block instead, never both", async () => {
    const contacts = {
      contact_name: "Ada Stone",
      contact_email: "ada@glacierswap.example",
      contact_handle: null,
      contact_calendar_url: LINK,
    };
    requestFindFirstMock.mockResolvedValue({ ...collectingRow, status: "engaged" });
    quoteFindUniqueMock.mockResolvedValue({ ...submittedQuote, status: "accepted" });
    requestFindUniqueMock.mockResolvedValue(contacts);
    subsidyFindFirstMock.mockResolvedValue(null);

    const view = await getRequestForAuditor("aud-1", "req-1");

    expect(view!.contacts).toEqual(contacts);
    expect(view!.shared_calendar_url).toBeNull();
  });

  it("reads nothing for a firm the request never reached", async () => {
    deliveryFindUniqueMock.mockResolvedValue(null);

    expect(await getRequestForAuditor("aud-1", "req-1")).toBeNull();
    expect(requestFindUniqueMock).not.toHaveBeenCalled();
  });
});

describe("the week to pick, as each audience reads it", () => {
  // At 2026-12-01 12:00: DECIDING closed 2026-11-28 and picks by 2026-12-05;
  // LAPSED closed 2026-11-10, its pick-by 2026-11-17 has passed.
  const DECIDING = new Date("2026-11-28T00:00:00Z");
  const LAPSED = new Date("2026-11-10T12:00:00Z");

  const ownerQuoteRow = {
    id: "q-1",
    status: "submitted",
    price_usd: 20000,
    duration: 4,
    duration_unit: "weeks",
    earliest_start: new Date("2026-12-15T00:00:00Z"),
    message: "Four weeks, two auditors.",
    deal_doc_url: null,
    submitted_by_email: null,
    auditor: {
      firm_name: "Nordlicht Security",
      services: [],
      quote_email: "quotes@nordlicht.example",
      members: [],
    },
  };
  // What AUDITOR_SAFE_REQUEST_SELECT returns, past the quote deadline.
  const firmRow = {
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
    quote_deadline: DECIDING,
    urgency: null,
    status: "collecting",
    submitted_at: new Date("2026-11-18T09:00:00Z"),
    created_at: new Date("2026-11-17T12:00:00Z"),
  };
  const ownQuoteRow = {
    id: "q-1",
    request_id: "req-1",
    auditor_id: "aud-1",
    status: "submitted",
    price_usd: 28000,
    duration: 4,
    duration_unit: "weeks",
    earliest_start: new Date("2026-12-15T00:00:00Z"),
    message: "Fixed fee.",
    deal_doc_url: null,
    submitted_by_email: null,
    updated_at: new Date("2026-11-25T10:00:00Z"),
  };

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-12-01T12:00:00Z"));
    deliveryFindUniqueMock.mockResolvedValue({ auditor: { active: true } });
    quoteFindUniqueMock.mockResolvedValue(ownQuoteRow);
    requestFindUniqueMock.mockResolvedValue({
      contact_handle: null,
      contact_handle_shared_at: null,
      contact_calendar_url: null,
      contact_calendar_shared_at: null,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("gives the owner's list the pick-by date of a collecting request, and none to a draft", async () => {
    requestFindManyMock.mockResolvedValue([
      { ...baseRequest, quote_deadline: DECIDING, quotes: [{ price_usd: 20000 }] },
      { ...baseRequest, id: "req-2", quote_deadline: LAPSED, quotes: [{ price_usd: 20000 }] },
      // The wizard stores a deadline on a draft too; it means nothing yet.
      { ...baseRequest, id: "req-3", status: "draft", quote_deadline: DECIDING, quotes: [] },
    ]);

    const rows = await getOwnerRequests(OWNER);

    expect(rows.map((row) => row.display_status)).toEqual(["deciding", "expired", "draft"]);
    expect(rows.map((row) => row.pick_by)).toEqual([
      new Date("2026-12-05T00:00:00Z"),
      new Date("2026-11-17T12:00:00Z"),
      null,
    ]);
  });

  it("gives the owner's lapsed request its pick-by date and expired quotes", async () => {
    requestFindFirstMock.mockResolvedValue({
      ...baseRequest,
      quote_deadline: LAPSED,
      _count: { fanout_deliveries: 3 },
      quotes: [ownerQuoteRow],
      subsidy_decisions: [],
    });

    const detail = await getOwnerRequestDetail(OWNER, "req-1");

    expect(detail!.display_status).toBe("expired");
    expect(detail!.pick_by).toEqual(new Date("2026-11-17T12:00:00Z"));
    expect(detail!.quotes[0].display_status).toBe("expired");
  });

  it("tells a firm that quoted when the project picks by, while the request is deciding", async () => {
    requestFindFirstMock.mockResolvedValue(firmRow);

    const view = await getRequestForAuditor("aud-1", "req-1");

    expect(view!.window_open).toBe(false);
    expect(view!.pick_by).toEqual(new Date("2026-12-05T00:00:00Z"));
    expect(view!.own_quote!.display_status).toBe("submitted");
  });

  it("shows the firm its quote expired once the pick-by date passed with none picked", async () => {
    requestFindFirstMock.mockResolvedValue({ ...firmRow, quote_deadline: LAPSED });

    const view = await getRequestForAuditor("aud-1", "req-1");

    expect(view!.pick_by).toEqual(new Date("2026-11-17T12:00:00Z"));
    expect(view!.own_quote!.display_status).toBe("expired");
  });

  it("gives a withdrawn request no pick-by date, so no screen can promise a pick", async () => {
    requestFindFirstMock.mockResolvedValue({ ...firmRow, status: "withdrawn" });

    const view = await getRequestForAuditor("aud-1", "req-1");

    expect(view!.pick_by).toBeNull();
    // A submitted quote on a withdrawn request reads expired, as owners and admins see it.
    expect(view!.own_quote!.display_status).toBe("expired");
  });

  it("derives a firm's inbox quote status from its own quote alone, never the quote count", async () => {
    deliveryFindManyMock.mockResolvedValue([
      { request_id: "req-1", request: { ...firmRow, quote_deadline: LAPSED } },
      { request_id: "req-2", request: { ...firmRow, id: "req-2", quote_deadline: LAPSED } },
    ]);
    quoteFindManyMock.mockResolvedValue([
      {
        id: "q-1",
        request_id: "req-1",
        status: "submitted",
        price_usd: 28000,
        updated_at: new Date("2026-11-08T10:00:00Z"),
      },
    ]);

    const items = await getAuditorInbox("aud-1");

    expect(items[0].own_quote!.display_status).toBe("expired");
    // A firm that did not quote reads the same whether or not others quoted.
    expect(items[1].own_quote).toBeNull();
    expect(quoteFindManyMock.mock.calls[0][0].where).toEqual({ auditor_id: "aud-1" });
    expect(deliveryFindManyMock.mock.calls[0][0].include.request.select._count).toBeUndefined();
  });
});

describe("getPublicFirms", () => {
  it("selects exactly the five public fields of active firms, sorted case-insensitively (S-8)", async () => {
    auditorFindManyMock.mockResolvedValue([
      { id: "b", firm_name: "zellic", services: [], website: null, logo_url: null },
      {
        id: "a",
        firm_name: "Bailsec",
        services: ["OpSec"],
        website: "https://bailsec.io/",
        logo_url: null,
      },
    ]);

    const rows = await getPublicFirms();

    expect(auditorFindManyMock.mock.calls[0][0].where).toEqual({ active: true });
    expect(auditorFindManyMock.mock.calls[0][0].select).toEqual({
      id: true,
      firm_name: true,
      services: true,
      website: true,
      logo_url: true,
    });
    expect(Object.keys(rows[0]).sort()).toEqual([
      "firm_name",
      "id",
      "logo_url",
      "services",
      "website",
    ]);
    expect(rows.map((r) => r.firm_name)).toEqual(["Bailsec", "zellic"]);
    expect(JSON.stringify(rows)).not.toContain("quote_email");
  });
});

describe("countActiveFirms", () => {
  it("counts active firms only", async () => {
    auditorCountMock.mockResolvedValue(16);
    expect(await countActiveFirms()).toBe(16);
    expect(auditorCountMock.mock.calls[0][0]).toEqual({ where: { active: true } });
  });
});

describe("getOwnFirm", () => {
  it("pins the firm id, selects logo_url for the firm page, never attio_ref or created_by", async () => {
    auditorFindUniqueMock.mockResolvedValue({
      id: "aud-1",
      firm_name: "Nordlicht Security",
      members: [],
    });

    await getOwnFirm("aud-1");

    const call = auditorFindUniqueMock.mock.calls[0][0];
    expect(call.where).toEqual({ id: "aud-1" });
    expect(call.select.attio_ref).toBeUndefined();
    expect(call.select.created_by).toBeUndefined();
    expect(call.select.logo_url).toBe(true);
    expect(call.select.members.select).toEqual({
      id: true,
      email: true,
      invited_at: true,
      first_login_at: true,
      github_username: true,
    });
  });

  it("carries the quote-email person's GitHub username for the firm page", async () => {
    auditorFindUniqueMock.mockResolvedValue(null);

    await getOwnFirm("aud-1");

    expect(auditorFindUniqueMock.mock.calls[0][0].select.github_username).toBe(true);
  });
});

describe("GitHub usernames stay between the firm and the program (D2.7)", () => {
  // Each read below feeds a project, a firm's request view or an email; its
  // auditor select is pinned whole so a username can never ride along.
  const NOTICE_AUDITOR = {
    select: { firm_name: true, quote_email: true, members: { select: { email: true } } },
  };

  it("the owner's quote list reads no username", async () => {
    requestFindFirstMock.mockResolvedValue(null);

    await getOwnerRequestDetail(OWNER, "req-1");

    expect(requestFindFirstMock.mock.calls[0][0].include.quotes.include.auditor).toEqual({
      select: {
        firm_name: true,
        services: true,
        quote_email: true,
        members: { select: { email: true } },
      },
    });
  });

  it("a firm's request view reads no firm field but its active flag", async () => {
    deliveryFindUniqueMock.mockResolvedValue(null);

    await getRequestForAuditor("aud-1", "req-1");

    expect(deliveryFindUniqueMock.mock.calls[0][0].select).toEqual({
      auditor: { select: { active: true } },
    });
  });

  it("the acceptance and subsidy notices read no username", async () => {
    requestFindUniqueMock.mockResolvedValue(null);
    quoteFindFirstMock.mockResolvedValue(null);

    await getAcceptanceParticipants("req-1");
    await getAcceptedQuoteForAdmin("req-1");

    expect(requestFindUniqueMock.mock.calls[0][0].select.quotes.select.auditor).toEqual(
      NOTICE_AUDITOR,
    );
    expect(quoteFindFirstMock.mock.calls[0][0].include.auditor).toEqual(NOTICE_AUDITOR);
  });
});

describe("shortlist projections", () => {
  it("owner detail resolves active chosen firms with id+firm_name only and a whitelist_count", async () => {
    requestFindFirstMock.mockResolvedValue({
      ...baseRequest,
      shortlist_auditor_ids: ["aud-1", "aud-2"],
      _count: { fanout_deliveries: 3 },
      quotes: [],
      subsidy_decisions: [],
    });
    auditorFindManyMock.mockResolvedValue([{ id: "aud-1", firm_name: "Nordlicht Security" }]);
    auditorCountMock.mockResolvedValue(16);

    const detail = await getOwnerRequestDetail(OWNER, "req-1");

    expect(auditorFindManyMock.mock.calls[0][0].where).toEqual({
      id: { in: ["aud-1", "aud-2"] },
      active: true,
    });
    expect(auditorFindManyMock.mock.calls[0][0].select).toEqual({ id: true, firm_name: true });
    expect(detail!.shortlist_firms).toEqual([{ id: "aud-1", firm_name: "Nordlicht Security" }]);
    expect(detail!.whitelist_count).toBe(16);
  });

  it("owner detail leaves shortlist_firms empty for an empty shortlist (no firm read)", async () => {
    requestFindFirstMock.mockResolvedValue({
      ...baseRequest,
      shortlist_auditor_ids: [],
      _count: { fanout_deliveries: 3 },
      quotes: [],
      subsidy_decisions: [],
    });

    const detail = await getOwnerRequestDetail(OWNER, "req-1");

    expect(detail!.shortlist_firms).toEqual([]);
    expect(auditorFindManyMock).not.toHaveBeenCalled();
  });

  it("admin detail resolves every stored firm carrying active, no active filter", async () => {
    requestFindFirstMock.mockResolvedValue({
      ...baseRequest,
      shortlist_auditor_ids: ["aud-1", "aud-2"],
      user: { name: "Alex", email: "alex@example.com" },
      quotes: [],
      subsidy_decisions: [],
      events: [],
      fanout_deliveries: [],
    });
    auditorFindManyMock.mockResolvedValue([
      { id: "aud-1", firm_name: "Nordlicht Security", active: true },
      { id: "aud-2", firm_name: "Halborn", active: false },
    ]);
    auditorCountMock.mockResolvedValue(15);

    const detail = await getAdminRequestDetail("req-1");

    expect(auditorFindManyMock.mock.calls[0][0].where).toEqual({ id: { in: ["aud-1", "aud-2"] } });
    expect(auditorFindManyMock.mock.calls[0][0].select).toEqual({
      id: true,
      firm_name: true,
      active: true,
    });
    expect(detail!.shortlist_firms.map((f) => f.firm_name)).toEqual(["Halborn", "Nordlicht Security"]);
    expect(detail!.whitelist_count).toBe(15);
  });
});

// Step 2: the project reads the GitHub usernames of the firms its request
// reached. Names and usernames only, so no address can ride along.
const FIRM_USERNAMES = {
  select: {
    id: true,
    firm_name: true,
    github_username: true,
    members: { orderBy: { created_at: "asc" }, select: { github_username: true } },
  },
};
const NOTIFIED_ACTIVE = { active: true, fanout_deliveries: { some: { request_id: "req-1" } } };
const REPOS = [{ url: "https://github.com/glacierswap/core", ref: "" }];

describe("getOwnerFirmUsernames (step 2)", () => {
  const ownerRow = (over: Record<string, unknown> = {}) => ({
    status: "collecting",
    quote_deadline: FUTURE,
    repos: REPOS,
    ...over,
  });

  it("pins the request id and the owner, and reads no firm for anyone else", async () => {
    requestFindFirstMock.mockResolvedValue(null);

    expect(await getOwnerFirmUsernames(OWNER, "req-1")).toEqual([]);
    expect(requestFindFirstMock.mock.calls[0][0].where).toEqual({ id: "req-1", user_id: OWNER });
    expect(auditorFindManyMock).not.toHaveBeenCalled();
  });

  it("while the window is open, reads the active firms the request reached, names and usernames only", async () => {
    requestFindFirstMock.mockResolvedValue(ownerRow());
    auditorFindManyMock.mockResolvedValue([]);

    await getOwnerFirmUsernames(OWNER, "req-1");

    expect(auditorFindManyMock.mock.calls[0][0]).toEqual({
      where: NOTIFIED_ACTIVE,
      ...FIRM_USERNAMES,
    });
  });

  it("orders firms by name, puts the quote-email person first, drops duplicates and invalid values", async () => {
    requestFindFirstMock.mockResolvedValue(ownerRow());
    auditorFindManyMock.mockResolvedValue([
      {
        id: "z",
        firm_name: "zeta",
        github_username: "z1",
        members: [{ github_username: "Z1" }, { github_username: "-bad" }],
      },
      {
        id: "m",
        firm_name: "Mid",
        github_username: "lead",
        members: [{ github_username: "mate" }],
      },
      {
        id: "a",
        firm_name: "Alpha",
        github_username: null,
        members: [
          { github_username: null },
          { github_username: "a".repeat(40) },
          { github_username: "alpha-sec" },
        ],
      },
    ]);

    const firms = await getOwnerFirmUsernames(OWNER, "req-1");

    expect(firms).toEqual([
      { id: "a", firm_name: "Alpha", github_usernames: ["alpha-sec"] },
      { id: "m", firm_name: "Mid", github_usernames: ["lead", "mate"] },
      { id: "z", firm_name: "zeta", github_usernames: ["z1"] },
    ]);
    expect(Object.keys(firms[0]).sort()).toEqual(["firm_name", "github_usernames", "id"]);
  });

  it("keeps a firm that has no username yet, with an empty list", async () => {
    requestFindFirstMock.mockResolvedValue(ownerRow());
    auditorFindManyMock.mockResolvedValue([
      { id: "f", firm_name: "Foxline Security", github_username: null, members: [] },
    ]);

    expect(await getOwnerFirmUsernames(OWNER, "req-1")).toEqual([
      { id: "f", firm_name: "Foxline Security", github_usernames: [] },
    ]);
  });

  it("returns nothing outside the open window", async () => {
    for (const row of [
      ownerRow({ quote_deadline: PAST }),
      ownerRow({ status: "withdrawn" }),
      ownerRow({ status: "pending_review", quote_deadline: null }),
      ownerRow({ status: "rejected", quote_deadline: null }),
      ownerRow({ status: "draft", quote_deadline: null }),
    ]) {
      requestFindFirstMock.mockResolvedValueOnce(row);
      expect(await getOwnerFirmUsernames(OWNER, "req-1")).toEqual([]);
    }
    expect(auditorFindManyMock).not.toHaveBeenCalled();
    expect(quoteFindFirstMock).not.toHaveBeenCalled();
  });

  it("once engaged, returns the winning firm only, even if it was deactivated since", async () => {
    requestFindFirstMock.mockResolvedValue(ownerRow({ status: "engaged", quote_deadline: PAST }));
    quoteFindFirstMock.mockResolvedValue({
      auditor: { id: "w", firm_name: "Ledgerproof Labs", github_username: "lp-ops", members: [] },
    });

    const firms = await getOwnerFirmUsernames(OWNER, "req-1");

    expect(firms).toEqual([{ id: "w", firm_name: "Ledgerproof Labs", github_usernames: ["lp-ops"] }]);
    expect(quoteFindFirstMock.mock.calls[0][0]).toEqual({
      where: { request_id: "req-1", status: "accepted" },
      select: { auditor: FIRM_USERNAMES },
    });
    expect(auditorFindManyMock).not.toHaveBeenCalled();
  });

  it("treats a request without a usable repository list as none, in every status", async () => {
    for (const repos of [[], null, {}]) {
      for (const status of ["collecting", "engaged"]) {
        requestFindFirstMock.mockResolvedValueOnce(ownerRow({ repos, status }));
        expect(await getOwnerFirmUsernames(OWNER, "req-1")).toEqual([]);
      }
    }
    expect(auditorFindManyMock).not.toHaveBeenCalled();
    expect(quoteFindFirstMock).not.toHaveBeenCalled();
  });
});

describe("getApprovalNotice (step 2)", () => {
  const STAMP = new Date("2026-10-18T14:02:00Z");
  const noticeRow = (over: Record<string, unknown> = {}) => ({
    id: "req-1",
    project_name: "Glacierswap",
    quote_deadline: FUTURE,
    repos: REPOS,
    contact_handle: null,
    contact_handle_shared_at: null,
    contact_calendar_url: null,
    contact_calendar_shared_at: null,
    user: { email: "owner@glacierswap.example" },
    ...over,
  });

  it("reads the collecting request with the account email, never the contact field", async () => {
    requestFindFirstMock.mockResolvedValue(noticeRow());
    auditorFindManyMock.mockResolvedValue([]);

    const notice = await getApprovalNotice("req-1");

    const call = requestFindFirstMock.mock.calls[0][0];
    expect(call.where).toEqual({ id: "req-1", status: "collecting" });
    expect(call.select.user).toEqual({ select: { email: true } });
    expect(call.select.contact_email).toBeUndefined();
    expect(notice?.email).toBe("owner@glacierswap.example");
  });

  it("returns null when the request is not collecting", async () => {
    requestFindFirstMock.mockResolvedValue(null);

    expect(await getApprovalNotice("req-1")).toBeNull();
    expect(auditorFindManyMock).not.toHaveBeenCalled();
  });

  it("reports a share only with its stamp and a value", async () => {
    const cases: [Record<string, unknown>, "shared_handle" | "shared_calendar", boolean][] = [
      [{ contact_handle: "@ada", contact_handle_shared_at: STAMP }, "shared_handle", true],
      [{ contact_handle: "   ", contact_handle_shared_at: STAMP }, "shared_handle", false],
      [{ contact_handle: "@ada", contact_handle_shared_at: null }, "shared_handle", false],
      [
        { contact_calendar_url: "https://cal.com/ada", contact_calendar_shared_at: STAMP },
        "shared_calendar",
        true,
      ],
      [{ contact_calendar_url: null, contact_calendar_shared_at: STAMP }, "shared_calendar", false],
      [
        { contact_calendar_url: "https://cal.com/ada", contact_calendar_shared_at: null },
        "shared_calendar",
        false,
      ],
    ];
    for (const [over, key, want] of cases) {
      requestFindFirstMock.mockResolvedValueOnce(noticeRow(over));
      auditorFindManyMock.mockResolvedValueOnce([]);
      expect((await getApprovalNotice("req-1"))?.[key]).toBe(want);
    }
  });

  it("carries the notified firms through the same select, and whether a repository is pinned", async () => {
    requestFindFirstMock.mockResolvedValue(noticeRow());
    auditorFindManyMock.mockResolvedValue([
      { id: "n", firm_name: "Nordlicht Security", github_username: "nordlicht-sec", members: [] },
    ]);

    const notice = await getApprovalNotice("req-1");

    expect(auditorFindManyMock.mock.calls[0][0]).toEqual({ where: NOTIFIED_ACTIVE, ...FIRM_USERNAMES });
    expect(notice).toEqual({
      email: "owner@glacierswap.example",
      request_id: "req-1",
      project_name: "Glacierswap",
      quote_deadline: FUTURE,
      pins_repository: true,
      shared_handle: false,
      shared_calendar: false,
      firms: [{ id: "n", firm_name: "Nordlicht Security", github_usernames: ["nordlicht-sec"] }],
    });

    for (const repos of [[], null]) {
      requestFindFirstMock.mockResolvedValueOnce(noticeRow({ repos }));
      auditorFindManyMock.mockResolvedValueOnce([]);
      expect((await getApprovalNotice("req-1"))?.pins_repository).toBe(false);
    }
  });
});
