import { describe, expect, it, vi, beforeEach } from "vitest";

const { updateManyMock, deleteManyMock, eventCreateMock } = vi.hoisted(() => ({
  updateManyMock: vi.fn(),
  deleteManyMock: vi.fn(),
  eventCreateMock: vi.fn(),
}));

vi.mock("@/prisma/prisma", () => ({
  prisma: {
    auditRequest: { updateMany: updateManyMock, deleteMany: deleteManyMock },
    auditEventLog: { create: eventCreateMock },
  },
}));

import { patchDraft, deleteDraft, withdraw } from "@/server/services/audits/requests";

const OWNER = "user-owner";

beforeEach(() => {
  vi.clearAllMocks();
  updateManyMock.mockResolvedValue({ count: 1 });
  deleteManyMock.mockResolvedValue({ count: 1 });
  eventCreateMock.mockResolvedValue({});
});

describe("patchDraft", () => {
  it("only ever updates the caller's own draft", async () => {
    await patchDraft(OWNER, "req-1", { project_name: "Glacierswap" });

    expect(updateManyMock.mock.calls[0][0].where).toMatchObject({
      id: "req-1",
      user_id: OWNER,
      status: "draft",
    });
  });

  it("reports not_found when nothing matched (submitted or foreign request)", async () => {
    updateManyMock.mockResolvedValue({ count: 0 });

    const result = await patchDraft(OWNER, "req-1", { project_name: "X" });

    expect(result).toEqual({ success: false, code: "not_found" });
  });
});

describe("deleteDraft", () => {
  it("pins owner and draft status on delete", async () => {
    await deleteDraft(OWNER, "req-1");

    expect(deleteManyMock.mock.calls[0][0].where).toMatchObject({
      id: "req-1",
      user_id: OWNER,
      status: "draft",
    });
  });
});

describe("withdraw", () => {
  it("withdraws only a collecting request and logs the event", async () => {
    const result = await withdraw(OWNER, "req-1");

    expect(updateManyMock.mock.calls[0][0].where).toMatchObject({
      id: "req-1",
      user_id: OWNER,
      status: "collecting",
    });
    expect(updateManyMock.mock.calls[0][0].data).toMatchObject({ status: "withdrawn" });
    expect(result).toEqual({ success: true });
    expect(eventCreateMock.mock.calls[0][0].data).toMatchObject({
      request_id: "req-1",
      action: "request_withdrawn",
      actor_type: "project_user",
      actor_id: OWNER,
    });
  });

  it("does not log an event when nothing was withdrawn", async () => {
    updateManyMock.mockResolvedValue({ count: 0 });

    const result = await withdraw(OWNER, "req-1");

    expect(result).toEqual({ success: false, code: "not_found" });
    expect(eventCreateMock).not.toHaveBeenCalled();
  });
});
