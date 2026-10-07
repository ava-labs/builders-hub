import { beforeEach, describe, expect, it, vi } from "vitest";

const { sessionMock, deleteRequestMock } = vi.hoisted(() => ({
  sessionMock: vi.fn(),
  deleteRequestMock: vi.fn(),
}));
vi.mock("@/lib/auth/authSession", () => ({ getAuthSession: sessionMock }));
vi.mock("@/server/services/audits/requests", () => ({ deleteRequest: deleteRequestMock }));
// The GET in the same route file reads through visibility; the delete never does.
vi.mock("@/server/services/audits/visibility", () => ({ getAdminRequestDetail: vi.fn() }));

import { DELETE } from "@/app/api/audits/admin/requests/[id]/route";

const ADMIN = {
  id: "user-admin",
  email: "admin@program.example",
  name: "Joey",
  custom_attributes: ["audit_admin"],
};

const remove = () =>
  DELETE(
    new Request("http://localhost/api/audits/admin/requests/req-1", {
      method: "DELETE",
    }) as never,
    { params: Promise.resolve({ id: "req-1" }) },
  );

beforeEach(() => {
  vi.clearAllMocks();
  sessionMock.mockResolvedValue({ user: ADMIN });
  deleteRequestMock.mockResolvedValue({ success: true });
});

describe("DELETE /api/audits/admin/requests/[id]", () => {
  it("deletes as the signed-in audit admin", async () => {
    const res = await remove();

    expect(res.status).toBe(200);
    expect(deleteRequestMock).toHaveBeenCalledWith("req-1", "user-admin", "Joey");
  });

  it("turns a signed-out caller away before any delete", async () => {
    sessionMock.mockResolvedValue(null);

    const res = await remove();

    expect(res.status).toBe(401);
    expect(deleteRequestMock).not.toHaveBeenCalled();
  });

  it("turns away a signed-in user who is not an audit admin", async () => {
    sessionMock.mockResolvedValue({ user: { ...ADMIN, custom_attributes: [] } });

    const res = await remove();

    expect(res.status).toBe(403);
    expect(deleteRequestMock).not.toHaveBeenCalled();
  });

  it("answers 404 when there is no such request", async () => {
    deleteRequestMock.mockResolvedValue({ success: false, code: "not_found" });

    const res = await remove();

    expect(res.status).toBe(404);
  });

  it("answers 409 when the request can no longer be deleted", async () => {
    deleteRequestMock.mockResolvedValue({ success: false, code: "not_deletable" });

    const res = await remove();
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.message).toMatch(/can no longer be deleted/);
  });

  it("answers 500 without the error text when the delete throws", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    deleteRequestMock.mockRejectedValue(new Error("connection reset by db-host-7"));

    const res = await remove();
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(JSON.stringify(body)).not.toContain("db-host-7");
    consoleError.mockRestore();
  });
});
