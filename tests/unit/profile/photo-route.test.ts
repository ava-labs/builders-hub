import sharp from "sharp";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { sessionMock, putMock, delMock, listMock, findMock, updateMock } = vi.hoisted(() => ({
  sessionMock: vi.fn(),
  putMock: vi.fn(),
  delMock: vi.fn(),
  listMock: vi.fn(),
  findMock: vi.fn(),
  updateMock: vi.fn(),
}));
vi.mock("@/lib/auth/authSession", () => ({ getAuthSession: sessionMock }));
vi.mock("@vercel/blob", () => ({ put: putMock, del: delMock, list: listMock }));
vi.mock("@/prisma/prisma", () => ({ prisma: { user: { findUnique: findMock, update: updateMock } } }));

import { DELETE, POST } from "@/app/api/profile/photo/route";

const STORE = "https://abc123.public.blob.vercel-storage.com";
let userId = "user-0";
let row: { image: string | null } = { image: null };
let blobs: Array<{ url: string; uploadedAt: Date }> = [];

async function photo(width = 640, height = 480): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: { r: 10, g: 120, b: 200 } } })
    .png()
    .toBuffer();
}

function request(
  method: "POST" | "DELETE",
  file?: { bytes: Uint8Array; type: string; name?: string },
  headers: Record<string, string> = { "sec-fetch-site": "same-origin" },
) {
  const init: { method: string; headers: Record<string, string>; body?: FormData } = { method, headers };
  if (file) {
    const body = new FormData();
    body.set("file", new File([file.bytes as BlobPart], file.name ?? "me.png", { type: file.type }));
    init.body = body;
  }
  return new NextRequest("http://localhost/api/profile/photo", init);
}

const send = (req: NextRequest) => (req.method === "POST" ? POST : DELETE)(req, {} as never);

beforeEach(() => {
  vi.clearAllMocks();
  // the rate limit lives in module state: each test is a new user
  userId = `user-${Math.random().toString(36).slice(2)}`;
  row = { image: null };
  blobs = [];
  process.env.BLOB_READ_WRITE_TOKEN = "test-token";
  sessionMock.mockImplementation(async () => ({ user: { id: userId, custom_attributes: [] } }));
  findMock.mockImplementation(async () => ({ image: row.image }));
  updateMock.mockImplementation(async ({ data }: { data: { image: string | null } }) => {
    row.image = data.image;
    return {};
  });
  putMock.mockImplementation(async (key: string) => {
    const url = `${STORE}/${key}`;
    blobs.push({ url, uploadedAt: new Date() });
    return { url };
  });
  listMock.mockImplementation(async () => ({ blobs }));
  delMock.mockResolvedValue(undefined);
});

describe("POST /api/profile/photo: refusals", () => {
  it("refuses a cross-site or sibling-subdomain request before it reads the body", async () => {
    for (const site of ["cross-site", "same-site"]) {
      const res = await send(request("POST", { bytes: await photo(), type: "image/png" }, { "sec-fetch-site": site }));
      expect(res.status).toBe(403);
    }
    expect(putMock).not.toHaveBeenCalled();
  });

  it("refuses an account that has not accepted the terms", async () => {
    sessionMock.mockResolvedValue({ user: { id: "pending_a@b.co", custom_attributes: [] } });
    expect((await send(request("POST", { bytes: await photo(), type: "image/png" }))).status).toBe(403);
  });

  it("refuses a body that says it is too large", async () => {
    const res = await send(
      request("POST", { bytes: await photo(), type: "image/png" }, {
        "sec-fetch-site": "same-origin",
        "content-length": String(5 * 1024 * 1024),
      }),
    );
    expect(res.status).toBe(413);
  });

  it("refuses an SVG, and bytes that are not a PNG or JPG whatever the type says", async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>');
    expect((await send(request("POST", { bytes: svg, type: "image/svg+xml", name: "x.svg" }))).status).toBe(400);
    const res = await send(request("POST", { bytes: Buffer.from("GIF89a....."), type: "image/png" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("That file is not a PNG or JPG image.");
    expect(putMock).not.toHaveBeenCalled();
  });

  it("refuses a strip before its resize can take gigabytes", async () => {
    const res = await send(request("POST", { bytes: await photo(4000, 1), type: "image/png" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/at most 4 times as wide/);
    expect(putMock).not.toHaveBeenCalled();
  });

  it("stops a burst: 10 uploads an hour, and Remove keeps its own limit", async () => {
    const bytes = await photo(64, 64);
    for (let i = 0; i < 10; i++) expect((await send(request("POST", { bytes, type: "image/png" }))).status).toBe(200);
    expect((await send(request("POST", { bytes, type: "image/png" }))).status).toBe(429);
    expect((await send(request("DELETE"))).status).toBe(200);
  });
});

describe("POST /api/profile/photo: a saved photo", () => {
  it("stores a clean JPEG in the user's folder and saves it on the row", async () => {
    const res = await send(request("POST", { bytes: await photo(), type: "image/png" }));
    expect(res.status).toBe(200);
    const [key, body, options] = putMock.mock.calls[0];
    expect(key).toMatch(new RegExp(`^profile-photos/${userId}/[0-9a-f-]{36}\\.jpg$`));
    expect(options).toMatchObject({ access: "public", contentType: "image/jpeg", addRandomSuffix: false });
    expect([body[0], body[1]]).toEqual([0xff, 0xd8]);
    expect((await sharp(body).metadata()).width).toBe(512);
    expect(row.image).toBe(`${STORE}/${key}`);
    expect((await res.json()).image).toBe(row.image);
  });

  it("deletes the photo it replaced and old leftovers, but keeps a file a save in flight may still need", async () => {
    const old = `${STORE}/profile-photos/${userId}/old.jpg`;
    const leftover = `${STORE}/profile-photos/${userId}/leftover.jpg`;
    const inFlight = `${STORE}/profile-photos/${userId}/in-flight.jpg`;
    const someoneElse = `${STORE}/profile-photos/other-user/theirs.jpg`;
    row.image = old;
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
    blobs.push(
      { url: old, uploadedAt: hourAgo },
      { url: leftover, uploadedAt: hourAgo },
      { url: inFlight, uploadedAt: new Date() },
      { url: someoneElse, uploadedAt: hourAgo },
    );
    await send(request("POST", { bytes: await photo(), type: "image/png" }));
    const deleted = delMock.mock.calls.flatMap(([urls]) => urls as string[]);
    expect(deleted.sort()).toEqual([leftover, old].sort());
    expect(deleted).not.toContain(row.image);
  });

  it("does not save the row when the store answers with a URL outside the user's folder", async () => {
    putMock.mockResolvedValue({ url: "https://evil.example/x.jpg" });
    const res = await send(request("POST", { bytes: await photo(), type: "image/png" }));
    expect(res.status).toBe(500);
    expect(updateMock).not.toHaveBeenCalled();
    expect(delMock).toHaveBeenCalledWith("https://evil.example/x.jpg", expect.anything());
  });
});

describe("DELETE /api/profile/photo", () => {
  it("saves null (removed, so sign-in does not refill it) and deletes the stored file", async () => {
    const current = `${STORE}/profile-photos/${userId}/now.jpg`;
    row.image = current;
    blobs.push({ url: current, uploadedAt: new Date() });
    const res = await send(request("DELETE"));
    expect(res.status).toBe(200);
    expect(row.image).toBeNull();
    expect(delMock).toHaveBeenCalledWith([current], expect.anything());
  });
});
