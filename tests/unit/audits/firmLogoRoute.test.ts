import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { sessionMock, resolveMock, updateMock, putMock, delMock } = vi.hoisted(() => ({
  sessionMock: vi.fn(),
  resolveMock: vi.fn(),
  updateMock: vi.fn(),
  putMock: vi.fn(),
  delMock: vi.fn(),
}));
vi.mock("@/lib/auth/authSession", () => ({ getAuthSession: sessionMock }));
vi.mock("@/server/services/audits/auditors", () => ({
  resolveAuditorByEmail: resolveMock,
  updateAuditor: updateMock,
}));
vi.mock("@vercel/blob", () => ({ put: putMock, del: delMock }));

import { DELETE, POST } from "@/app/api/audits/portal/me/logo/route";

const HOST = "qizat5l3bwvomkny.public.blob.vercel-storage.com";
const ROUTE = "http://localhost/api/audits/portal/me/logo";
const ACTOR_EMAIL = "alice@nordlicht.example";
const ACTOR = { type: "auditor", id: "aud-1", email: ACTOR_EMAIL };
const FIRM = {
  id: "aud-1",
  firm_name: "Nordlicht Security",
  quote_email: "quotes@nordlicht.example",
  active: true,
  logo_url: null as string | null,
};
const OLD_LOGO = `https://${HOST}/audits/firms/aud-1/old.png`;

const file = (name = "logo.png", type = "image/png", bytes = 1024) =>
  new File([new Uint8Array(bytes)], name, { type });

function upload(attachment: File | null, headers: Record<string, string> = {}) {
  const form = new FormData();
  if (attachment) form.append("file", attachment);
  return new NextRequest(ROUTE, { method: "POST", body: form, headers });
}

const post = (attachment: File | null, headers?: Record<string, string>) =>
  POST(upload(attachment, headers), {} as never);
const remove = () => DELETE(new NextRequest(ROUTE, { method: "DELETE" }), {} as never);

beforeEach(() => {
  vi.clearAllMocks();
  process.env.BLOB_READ_WRITE_TOKEN = "test-token";
  sessionMock.mockResolvedValue({ user: { email: ACTOR_EMAIL } });
  resolveMock.mockResolvedValue(FIRM);
  updateMock.mockResolvedValue({ success: true, auditor: FIRM });
  putMock.mockImplementation(async (key: string) => ({ url: `https://${HOST}/${key}` }));
  delMock.mockResolvedValue(undefined);
});

describe("POST /api/audits/portal/me/logo", () => {
  it("stores a PNG under a firm-scoped key and saves the URL with an auditor actor", async () => {
    const res = await post(file());

    expect(res.status).toBe(200);
    const key = putMock.mock.calls[0][0] as string;
    expect(key).toMatch(/^audits\/firms\/aud-1\/[0-9a-f-]{36}\.png$/);
    expect(putMock.mock.calls[0][2]).toMatchObject({ access: "public", token: "test-token" });
    const url = `https://${HOST}/${key}`;
    expect(updateMock).toHaveBeenCalledWith("aud-1", { logo_url: url }, ACTOR);
    expect(await res.json()).toEqual({ success: true, logo_url: url });
  });

  it("rejects an SVG without touching storage", async () => {
    const res = await post(file("logo.svg", "image/svg+xml"));
    expect(res.status).toBe(400);
    expect(putMock).not.toHaveBeenCalled();
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("rejects a file whose extension contradicts its declared type", async () => {
    const res = await post(file("logo.png", "image/jpeg"));
    expect(res.status).toBe(400);
    expect(putMock).not.toHaveBeenCalled();
  });

  it("rejects a file over 2MB", async () => {
    const res = await post(file("logo.png", "image/png", 2 * 1024 * 1024 + 1));
    expect(res.status).toBe(400);
    expect(putMock).not.toHaveBeenCalled();
  });

  it("rejects a request without a file", async () => {
    const res = await post(null);
    expect(res.status).toBe(400);
    expect(putMock).not.toHaveBeenCalled();
  });

  it("refuses to save a URL that is not on our store", async () => {
    putMock.mockResolvedValue({ url: "https://other.public.blob.vercel-storage.com/x.png" });
    const res = await post(file());
    expect(res.status).toBe(500);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("fails loud when the blob token is missing", async () => {
    delete process.env.BLOB_READ_WRITE_TOKEN;
    const res = await post(file());
    expect(res.status).toBe(500);
    expect(putMock).not.toHaveBeenCalled();
  });

  it("refuses a deactivated firm before reading the file", async () => {
    resolveMock.mockResolvedValue({ ...FIRM, active: false });
    const res = await post(file());
    expect(res.status).toBe(403);
    expect(putMock).not.toHaveBeenCalled();
  });

  it("refuses a cross-site request before touching anything", async () => {
    const res = await post(file(), { "sec-fetch-site": "cross-site" });
    expect(res.status).toBe(403);
    expect(putMock).not.toHaveBeenCalled();
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("rejects an oversized declared body before parsing it", async () => {
    const res = await post(file(), { "content-length": String(5 * 1024 * 1024) });
    expect(res.status).toBe(413);
    expect(putMock).not.toHaveBeenCalled();
  });

  it("unpublishes the firm's previous blob after a replace is saved", async () => {
    resolveMock.mockResolvedValue({ ...FIRM, logo_url: OLD_LOGO });
    const res = await post(file());
    expect(res.status).toBe(200);
    expect(delMock).toHaveBeenCalledWith(OLD_LOGO, { token: "test-token" });
    expect(delMock.mock.invocationCallOrder[0]).toBeGreaterThan(
      updateMock.mock.invocationCallOrder[0],
    );
  });

  it("never deletes a blob outside the firm's own folder", async () => {
    resolveMock.mockResolvedValue({ ...FIRM, logo_url: `https://${HOST}/cuid-admin/x.png` });
    const res = await post(file());
    expect(res.status).toBe(200);
    expect(delMock).not.toHaveBeenCalled();
  });

  it("a failed unpublish never fails the request", async () => {
    resolveMock.mockResolvedValue({ ...FIRM, logo_url: OLD_LOGO });
    delMock.mockRejectedValue(new Error("store down"));
    const res = await post(file());
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ success: true });
  });

  it("accepts a same-site request", async () => {
    const res = await post(file(), { "sec-fetch-site": "same-site" });
    expect(res.status).toBe(200);
  });

  it("cleans up the stored blob when the row save throws", async () => {
    updateMock.mockRejectedValue(new Error("db down"));
    const res = await post(file());
    expect(res.status).toBe(500);
    const stored = `https://${HOST}/${putMock.mock.calls[0][0] as string}`;
    expect(delMock).toHaveBeenCalledWith(stored, { token: "test-token" });
  });

  it("cleans up the stored blob when the firm row is gone", async () => {
    updateMock.mockResolvedValue({ success: false, code: "not_found" });
    const res = await post(file());
    expect(res.status).toBe(404);
    const stored = `https://${HOST}/${putMock.mock.calls[0][0] as string}`;
    expect(delMock).toHaveBeenCalledWith(stored, { token: "test-token" });
  });

  it("cleans up a stored blob that fails the host guard", async () => {
    const foreign = "https://other.public.blob.vercel-storage.com/x.png";
    putMock.mockResolvedValue({ url: foreign });
    const res = await post(file());
    expect(res.status).toBe(500);
    expect(delMock).toHaveBeenCalledWith(foreign, { token: "test-token" });
    expect(updateMock).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/audits/portal/me/logo", () => {
  it("clears the logo with an auditor actor", async () => {
    const res = await remove();
    expect(res.status).toBe(200);
    expect(updateMock).toHaveBeenCalledWith("aud-1", { logo_url: null }, ACTOR);
    expect(await res.json()).toEqual({ success: true, logo_url: null });
  });

  it("refuses a deactivated firm", async () => {
    resolveMock.mockResolvedValue({ ...FIRM, active: false });
    const res = await remove();
    expect(res.status).toBe(403);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("unpublishes the firm's previous blob after the column is cleared", async () => {
    resolveMock.mockResolvedValue({ ...FIRM, logo_url: OLD_LOGO });
    const res = await remove();
    expect(res.status).toBe(200);
    expect(delMock).toHaveBeenCalledWith(OLD_LOGO, { token: "test-token" });
    expect(delMock.mock.invocationCallOrder[0]).toBeGreaterThan(
      updateMock.mock.invocationCallOrder[0],
    );
  });

  it("leaves a blob outside the firm's own folder alone", async () => {
    resolveMock.mockResolvedValue({ ...FIRM, logo_url: `https://${HOST}/cuid-admin/x.png` });
    const res = await remove();
    expect(res.status).toBe(200);
    expect(delMock).not.toHaveBeenCalled();
  });
});
