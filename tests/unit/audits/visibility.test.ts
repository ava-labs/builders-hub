import { describe, expect, it, vi, beforeEach } from "vitest";

const {
  requestFindManyMock,
  requestFindFirstMock,
  requestFindUniqueMock,
  auditorFindManyMock,
  deliveryFindManyMock,
  deliveryFindUniqueMock,
  quoteFindManyMock,
  quoteFindUniqueMock,
  subsidyFindFirstMock,
} = vi.hoisted(() => ({
  requestFindManyMock: vi.fn(),
  requestFindFirstMock: vi.fn(),
  requestFindUniqueMock: vi.fn(),
  auditorFindManyMock: vi.fn(),
  deliveryFindManyMock: vi.fn(),
  deliveryFindUniqueMock: vi.fn(),
  quoteFindManyMock: vi.fn(),
  quoteFindUniqueMock: vi.fn(),
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
    },
  },
}));

import {
  getAdminAuditors,
  getAdminOverview,
  getAdminRequests,
  getAuditorInbox,
  getOwnerRequests,
  getOwnerRequestDetail,
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
  created_at: new Date(),
  submitted_at: new Date(),
};

beforeEach(() => {
  vi.clearAllMocks();
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
          duration_weeks: 3,
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
          duration_weeks: 4,
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
      duration_weeks: 3,
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
        members: [
          {
            id: "mem-1",
            email: "alice@nordlicht.example",
            invited_at: new Date("2026-09-01"),
            first_login_at: null,
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

  it("never looks up a subsidy for a firm that did not win", async () => {
    quoteFindUniqueMock.mockResolvedValue({ id: "q-1", status: "not_selected", price_usd: 12500 });

    const view = await getRequestForAuditor("aud-1", "req-1");

    expect(view!.subsidy).toBeNull();
    expect(subsidyFindFirstMock).not.toHaveBeenCalled();
  });
});
