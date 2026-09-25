import { beforeEach, describe, expect, it, vi } from "vitest";

const { sessionMock, readableMock } = vi.hoisted(() => ({
  sessionMock: vi.fn(),
  readableMock: vi.fn(),
}));
vi.mock("@/lib/auth/authSession", () => ({ getAuthSession: sessionMock }));
vi.mock("@/server/services/audits/visibility", () => ({ readableAttachment: readableMock }));

import { GET } from "@/app/api/audits/attachments/[requestId]/[index]/route";

const HOST = "qizat5l3bwvomkny.public.blob.vercel-storage.com";
const STORED = { name: "scope.pdf", url: `https://${HOST}/audits/scope-abc.pdf`, size: 10 };

const get = (index = "0") =>
  GET(new Request("http://localhost/api/audits/attachments/req-1/0"), {
    params: Promise.resolve({ requestId: "req-1", index }),
  });

const fetchMock = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
  sessionMock.mockResolvedValue({ user: { id: "user-owner", email: "owner@project.example" } });
  readableMock.mockResolvedValue(STORED);
  fetchMock.mockResolvedValue(
    new Response(new Blob(["%PDF-1.4"]).stream(), {
      headers: { "content-type": "application/pdf", "content-length": "8" },
    }),
  );
});

describe("GET /api/audits/attachments/[requestId]/[index]", () => {
  it("401s an anonymous caller without touching the row", async () => {
    sessionMock.mockResolvedValue(null);

    const res = await get();

    expect(res.status).toBe(401);
    expect(readableMock).not.toHaveBeenCalled();
  });

  it("404s whenever the viewer may not read it, never 403 (the request stays unconfirmed)", async () => {
    readableMock.mockResolvedValue(null);

    const res = await get();

    expect(res.status).toBe(404);
  });

  it("serves the bytes to a viewer who may read it", async () => {
    const res = await get();

    expect(res.status).toBe(200);
    expect(await res.text()).toBe("%PDF-1.4");
    expect(fetchMock).toHaveBeenCalledWith(STORED.url, { cache: "no-store" });
  });

  it("serves nothing renderable: octet-stream, attachment, nosniff, no store URL", async () => {
    const res = await get();

    expect(res.headers.get("content-type")).toBe("application/octet-stream");
    expect(res.headers.get("content-disposition")).toContain("attachment");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(JSON.stringify([...res.headers])).not.toContain(HOST);
  });

  it("refuses an index that is not a plain position in range", async () => {
    for (const index of ["-1", "10", "1.5", "abc", "", "1e1"]) {
      expect((await get(index)).status).toBe(404);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses to proxy a stored URL that is not on our store (no SSRF)", async () => {
    readableMock.mockResolvedValue({ ...STORED, url: "http://169.254.169.254/latest/meta-data" });

    const res = await get();

    expect(res.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("502s when the store itself fails, rather than leaking the error", async () => {
    fetchMock.mockRejectedValue(new Error("boom"));

    const res = await get();

    expect(res.status).toBe(502);
    expect(await res.json()).toMatchObject({ success: false });
  });
});
