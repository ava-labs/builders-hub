import { crc32 } from "zlib";
import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { PHOTO_SIZE_PX, isOwnPhoto, photoKey, reencodePhoto, sniffPhotoType } from "@/server/services/profile-photo";

const USER = "user-1";
const HOST = "https://abc123.public.blob.vercel-storage.com";

async function png(width = 64, height = 48): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: { r: 200, g: 30, b: 40 } } })
    .png()
    .toBuffer();
}

/** a PNG whose header claims a size; no pixel data follows */
function pngHeader(width: number, height: number): Buffer {
  const chunk = (type: string, data: Buffer) => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body) >>> 0);
    return Buffer.concat([length, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8); // bit depth
  ihdr.writeUInt8(2, 9); // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", Buffer.alloc(0)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

describe("sniffPhotoType", () => {
  it("reads the type from the bytes", async () => {
    expect(sniffPhotoType(await png())).toBe("image/png");
    expect(sniffPhotoType(await sharp(await png()).jpeg().toBuffer())).toBe("image/jpeg");
  });

  it("refuses an SVG, a GIF, HTML and an empty file, whatever their name or type say", () => {
    expect(sniffPhotoType(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'))).toBeNull();
    expect(sniffPhotoType(Buffer.from("GIF89a"))).toBeNull();
    expect(sniffPhotoType(Buffer.from("<html><script>alert(1)</script></html>"))).toBeNull();
    expect(sniffPhotoType(new Uint8Array(0))).toBeNull();
  });
});

describe("reencodePhoto", () => {
  it("writes a square JPEG of the profile size", async () => {
    const out = await reencodePhoto(await png(800, 300));
    const meta = await sharp(out).metadata();
    expect(meta.format).toBe("jpeg");
    expect([meta.width, meta.height]).toEqual([PHOTO_SIZE_PX, PHOTO_SIZE_PX]);
  });

  it("drops the EXIF data, GPS included", async () => {
    const tagged = await sharp(await png())
      .jpeg()
      .withExifMerge({ IFD0: { Copyright: "secret owner" }, IFD3: { GPSLatitudeRef: "N" } })
      .toBuffer();
    expect((await sharp(tagged).metadata()).exif).toBeDefined();
    const out = await reencodePhoto(tagged);
    expect((await sharp(out).metadata()).exif).toBeUndefined();
    expect(out.includes(Buffer.from("secret owner"))).toBe(false);
  });

  it("drops data hidden after the image (a polyglot file)", async () => {
    const polyglot = Buffer.concat([await png(), Buffer.from("<script>alert(document.cookie)</script>")]);
    const out = await reencodePhoto(polyglot);
    expect(out.includes(Buffer.from("<script>"))).toBe(false);
  });

  it("refuses a header that claims more than 40 million pixels before it decodes", async () => {
    await expect(reencodePhoto(pngHeader(50_000, 50_000))).rejects.toThrow();
  });

  it("refuses bytes that only start like an image", async () => {
    await expect(reencodePhoto(Buffer.concat([(await png()).subarray(0, 16), Buffer.alloc(64)]))).rejects.toThrow();
  });
});

describe("isOwnPhoto", () => {
  it("accepts only this user's folder on the blob store, over https", () => {
    expect(isOwnPhoto(`${HOST}/${photoKey(USER)}`, USER)).toBe(true);
    expect(isOwnPhoto(`${HOST}/${photoKey("user-2")}`, USER)).toBe(false);
    expect(isOwnPhoto(`${HOST}/profile-photos/${USER}x/a.jpg`, USER)).toBe(false);
    expect(isOwnPhoto(`${HOST}/hackathons/${USER}/a.jpg`, USER)).toBe(false);
    expect(isOwnPhoto(`http://abc123.public.blob.vercel-storage.com/${photoKey(USER)}`, USER)).toBe(false);
    expect(isOwnPhoto(`https://evil.example/profile-photos/${USER}/a.jpg`, USER)).toBe(false);
    expect(isOwnPhoto(`https://public.blob.vercel-storage.com.evil.example/profile-photos/${USER}/a.jpg`, USER)).toBe(
      false,
    );
    expect(isOwnPhoto("not a url", USER)).toBe(false);
    expect(isOwnPhoto(null, USER)).toBe(false);
  });

  it("keys a photo in the user's folder with a random name", () => {
    expect(photoKey(USER)).toMatch(new RegExp(`^profile-photos/${USER}/[0-9a-f-]{36}\\.jpg$`));
    expect(photoKey(USER)).not.toBe(photoKey(USER));
  });
});

describe("reencodePhoto shapes", () => {
  it("refuses a strip longer than 4:1 from its header, both ways", async () => {
    await expect(reencodePhoto(await png(4000, 1))).rejects.toThrow(/4:1/);
    await expect(reencodePhoto(await png(1, 4000))).rejects.toThrow(/4:1/);
    await expect(reencodePhoto(await png(400, 100))).resolves.toBeInstanceOf(Buffer);
  });
});
