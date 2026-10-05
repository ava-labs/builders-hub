import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { sessionMock, headMock, delMock, fetchMock, BlobNotFoundError } = vi.hoisted(() => ({
  sessionMock: vi.fn(),
  headMock: vi.fn(),
  delMock: vi.fn(),
  fetchMock: vi.fn(),
  BlobNotFoundError: class extends Error {},
}));
vi.mock("@/lib/auth/authSession", () => ({ getAuthSession: sessionMock }));
vi.mock("@vercel/blob", () => ({ head: headMock, del: delMock, put: vi.fn(), BlobNotFoundError }));
vi.mock("@/prisma/prisma", () => ({ prisma: {} }));

import { DELETE } from "@/app/api/file/route";

// The store uploads actually land in, per BLOB_READ_WRITE_TOKEN.
const STORE = "https://qizat5l3bwvomkny.public.blob.vercel-storage.com";
const OWNER = "cmkd7xsmd0000k104ejq2x28i";
const OWN_URL = `${STORE}/${OWNER}/8b080b47-2645-4484-b408-f6c26611b639-hwP9.png`;

const remove = (params: Record<string, string>) =>
  DELETE(
    new NextRequest(`http://localhost/api/file?${new URLSearchParams(params)}`, { method: "DELETE" }),
    {} as never,
  );

beforeEach(() => {
  vi.clearAllMocks();
  process.env.BLOB_READ_WRITE_TOKEN = "test-token";
  // A base URL for a different store than the token writes to: the preview
  // configuration that made the old HEAD probe 404 on every real upload.
  process.env.BLOB_BASE_URL = "https://otherstore.public.blob.vercel-storage.com";
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockResolvedValue(new Response(null, { status: 404 }));
  sessionMock.mockResolvedValue({ user: { id: OWNER, custom_attributes: [] } });
  headMock.mockResolvedValue({ url: OWN_URL });
  delMock.mockResolvedValue(undefined);
});

describe("DELETE /api/file", () => {
  // Regression: existence was probed at `${BLOB_BASE_URL}/<key>` with a plain
  // fetch. When that base names a different store, every probe 404s and the
  // route reports "already deleted" without deleting anything.
  it("deletes the owner's blob via the URL it was uploaded to", async () => {
    const res = await remove({ url: OWN_URL });

    expect(res.status).toBe(200);
    expect(headMock).toHaveBeenCalledWith(OWN_URL, expect.objectContaining({ token: "test-token" }));
    expect(delMock).toHaveBeenCalledWith(OWN_URL, expect.objectContaining({ token: "test-token" }));
  });

  it("reports an already-deleted blob without calling del", async () => {
    headMock.mockRejectedValue(new BlobNotFoundError("not found"));

    const res = await remove({ url: OWN_URL });

    expect(res.status).toBe(201);
    expect(delMock).not.toHaveBeenCalled();
  });

  it("still refuses another user's blob before touching storage", async () => {
    const res = await remove({ url: `${STORE}/cmkd7xsmd0000k104ejq2x99z/x.png` });

    expect(res.status).toBe(403);
    expect(headMock).not.toHaveBeenCalled();
    expect(delMock).not.toHaveBeenCalled();
  });

  it("resolves a bare legacy key against BLOB_BASE_URL for admins", async () => {
    sessionMock.mockResolvedValue({ user: { id: OWNER, custom_attributes: ["admin"] } });

    const res = await remove({ fileName: "legacy-logo.png" });

    expect(res.status).toBe(200);
    expect(delMock).toHaveBeenCalledWith(
      "https://otherstore.public.blob.vercel-storage.com/legacy-logo.png",
      expect.anything(),
    );
  });
});
