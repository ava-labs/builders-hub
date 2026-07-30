import { describe, expect, it, vi, beforeEach } from "vitest";

const { requestFindManyMock, requestFindFirstMock } = vi.hoisted(() => ({
  requestFindManyMock: vi.fn(),
  requestFindFirstMock: vi.fn(),
}));

vi.mock("@/prisma/prisma", () => ({
  prisma: {
    auditRequest: {
      findMany: requestFindManyMock,
      findFirst: requestFindFirstMock,
    },
  },
}));

import { getOwnerRequests, getOwnerRequestDetail } from "@/server/services/audits/visibility";

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
  requestFindManyMock.mockReset();
  requestFindFirstMock.mockReset();
});

describe("getOwnerRequests", () => {
  it("always pins the owner's user_id in the where clause", async () => {
    requestFindManyMock.mockResolvedValue([]);

    await getOwnerRequests(OWNER);

    expect(requestFindManyMock.mock.calls[0][0].where).toMatchObject({ user_id: OWNER });
  });

  it("returns derived display status and quote counts", async () => {
    requestFindManyMock.mockResolvedValue([
      { ...baseRequest, _count: { quotes: 4 } },
      { ...baseRequest, id: "req-2", quote_deadline: PAST, _count: { quotes: 2 } },
      { ...baseRequest, id: "req-3", status: "draft", quote_deadline: null, _count: { quotes: 0 } },
    ]);

    const rows = await getOwnerRequests(OWNER);

    expect(rows.map((r) => r.display_status)).toEqual(["collecting", "deciding", "draft"]);
    expect(rows.map((r) => r.quote_count)).toEqual([4, 2, 0]);
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
  });

  it("exposes the subsidy outcome without the deciding admin", async () => {
    requestFindFirstMock.mockResolvedValue({
      ...baseRequest,
      status: "engaged",
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
