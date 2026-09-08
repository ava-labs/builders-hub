import { describe, expect, it, vi, beforeEach } from "vitest";

const {
  txQuoteUpdateManyMock,
  txRequestUpdateManyMock,
  eventCreateMock,
  participantsMock,
  noticeMock,
  acceptedNoticeMock,
} = vi.hoisted(() => ({
  txQuoteUpdateManyMock: vi.fn(),
  txRequestUpdateManyMock: vi.fn(),
  eventCreateMock: vi.fn(),
  participantsMock: vi.fn(),
  noticeMock: vi.fn(),
  acceptedNoticeMock: vi.fn(),
}));

const tx = {
  auditQuote: { updateMany: txQuoteUpdateManyMock },
  auditRequest: { updateMany: txRequestUpdateManyMock },
};

vi.mock("@/prisma/prisma", () => ({
  prisma: {
    $transaction: vi.fn(async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx)),
    auditEventLog: { create: eventCreateMock },
  },
}));

vi.mock("@/server/services/audits/visibility", () => ({
  getAcceptanceParticipants: participantsMock,
}));

vi.mock("@/server/services/audits/emails/sendNotSelectedNotice", () => ({
  sendNotSelectedNotice: noticeMock,
}));

vi.mock("@/server/services/audits/emails/sendQuoteAcceptedNotice", () => ({
  sendQuoteAcceptedNotice: acceptedNoticeMock,
}));

import { acceptQuote } from "@/server/services/audits/acceptance";

const OWNER = "user-owner";

beforeEach(() => {
  vi.clearAllMocks();
  // First updateMany call = the winner (guard-carrying); count 1 = accepted.
  txQuoteUpdateManyMock.mockResolvedValue({ count: 1 });
  txRequestUpdateManyMock.mockResolvedValue({ count: 1 });
  eventCreateMock.mockResolvedValue({});
  noticeMock.mockResolvedValue(undefined);
  acceptedNoticeMock.mockResolvedValue(undefined);
  participantsMock.mockResolvedValue({
    project_name: "Glacierswap",
    winner: {
      price_usd: 28000,
      status: "accepted",
      submitted_by_email: null,
      auditor: { firm_name: "Nordlicht Security", quote_email: "quotes@nordlicht.example" },
    },
    losers: [
      { auditor: { firm_name: "Harborline", quote_email: "quotes@harborline.example" } },
      { auditor: { firm_name: "Ashgrove", quote_email: "security@ashgrove.example" } },
    ],
  });
});

describe("acceptQuote", () => {
  it("carries every guard on the winner update and closes the request atomically", async () => {
    const result = await acceptQuote("req-1", "q-2", OWNER);

    // The winner write IS the guard: own request, stored collecting (which
    // covers early accept and deciding), quote belongs, quote submitted.
    expect(txQuoteUpdateManyMock.mock.calls[0][0]).toMatchObject({
      where: {
        id: "q-2",
        request_id: "req-1",
        status: "submitted",
        request: { user_id: OWNER, status: "collecting" },
      },
      data: { status: "accepted" },
    });
    expect(txRequestUpdateManyMock.mock.calls[0][0]).toMatchObject({
      where: { id: "req-1", user_id: OWNER, status: "collecting" },
      data: { status: "engaged", accepted_quote_id: "q-2" },
    });
    // Siblings flip to not_selected in the same transaction.
    expect(txQuoteUpdateManyMock.mock.calls[1][0]).toMatchObject({
      where: { request_id: "req-1", id: { not: "q-2" }, status: "submitted" },
      data: { status: "not_selected" },
    });
    expect(result).toMatchObject({
      success: true,
      firm_name: "Nordlicht Security",
      quote_email: "quotes@nordlicht.example",
    });
  });

  it("reveals the teammate who saved the winning quote as the contact", async () => {
    participantsMock.mockResolvedValue({
      project_name: "Glacierswap",
      winner: {
        price_usd: 28000,
        status: "accepted",
        submitted_by_email: "alice@nordlicht.example",
        auditor: {
          firm_name: "Nordlicht Security",
          quote_email: "quotes@nordlicht.example",
          members: [{ email: "alice@nordlicht.example" }],
        },
      },
      losers: [],
    });

    const result = await acceptQuote("req-1", "q-2", OWNER);

    expect(result).toMatchObject({ success: true, quote_email: "alice@nordlicht.example" });
  });

  it("never hands the project a teammate who has since been removed", async () => {
    participantsMock.mockResolvedValue({
      project_name: "Glacierswap",
      winner: {
        price_usd: 28000,
        status: "accepted",
        submitted_by_email: "gone@nordlicht.example",
        auditor: {
          firm_name: "Nordlicht Security",
          quote_email: "quotes@nordlicht.example",
          members: [],
        },
      },
      losers: [],
    });

    const result = await acceptQuote("req-1", "q-2", OWNER);

    expect(result).toMatchObject({ success: true, quote_email: "quotes@nordlicht.example" });
  });

  it("logs quote_accepted and contacts_revealed with firm and price", async () => {
    await acceptQuote("req-1", "q-2", OWNER);

    const actions = eventCreateMock.mock.calls.map((call) => call[0].data.action);
    expect(actions).toEqual(["quote_accepted", "contacts_revealed"]);
    expect(eventCreateMock.mock.calls[0][0].data.meta).toMatchObject({
      firm_name: "Nordlicht Security",
      price_usd: 28000,
    });
  });

  it("notifies the winner and every losing firm after commit, failures non-fatal", async () => {
    noticeMock.mockRejectedValueOnce(new Error("sendgrid down"));

    const result = await acceptQuote("req-1", "q-2", OWNER);

    expect(result.success).toBe(true);
    expect(noticeMock).toHaveBeenCalledTimes(2);
    expect(noticeMock.mock.calls[0][0]).toMatchObject({
      quote_email: "quotes@harborline.example",
    });
    // The winning firm gets its own accepted notice with the request handle.
    expect(acceptedNoticeMock).toHaveBeenCalledTimes(1);
    expect(acceptedNoticeMock.mock.calls[0][0]).toMatchObject({
      quote_email: "quotes@nordlicht.example",
    });
    expect(acceptedNoticeMock.mock.calls[0][1]).toMatchObject({
      id: "req-1",
      project_name: "Glacierswap",
    });
  });

  it("rejects when the guarded winner update matches nothing", async () => {
    txQuoteUpdateManyMock.mockResolvedValue({ count: 0 });

    const result = await acceptQuote("req-1", "q-2", "someone-else");

    expect(result).toEqual({ success: false, code: "not_acceptable" });
    expect(txRequestUpdateManyMock).not.toHaveBeenCalled();
    expect(noticeMock).not.toHaveBeenCalled();
    expect(acceptedNoticeMock).not.toHaveBeenCalled();
    expect(eventCreateMock).not.toHaveBeenCalled();
  });
});