import { describe, expect, it } from "vitest";
import {
  isAllowedAttachmentSrc,
  isLegacyAttachmentSrc,
  isRequestAttachmentSrc,
} from "@/lib/audits/blobSrc";
import { rejectedAttachmentUrls } from "@/server/services/audits/requests";

const HOST = "qizat5l3bwvomkny.public.blob.vercel-storage.com";
const MINE = "11111111-1111-4111-8111-111111111111";
const THEIRS = "22222222-2222-4222-8222-222222222222";
const mine = `https://${HOST}/audits/${MINE}/scope-abc.pdf`;
const theirs = `https://${HOST}/audits/${THEIRS}/secret-xyz.pdf`;
const legacy = `https://${HOST}/audits/old-scope-abc.pdf`;
const att = (url: string) => ({ name: "f.pdf", url, size: 1 });

describe("isRequestAttachmentSrc", () => {
  it("accepts only a key minted for that request", () => {
    expect(isRequestAttachmentSrc(mine, MINE)).toBe(true);
    expect(isRequestAttachmentSrc(theirs, MINE)).toBe(false);
    expect(isRequestAttachmentSrc(legacy, MINE)).toBe(false);
  });

  it("rejects a deeper key, so a nested path cannot impersonate a prefix", () => {
    expect(isRequestAttachmentSrc(`https://${HOST}/audits/${MINE}/sub/f.pdf`, MINE)).toBe(false);
  });

  it("rejects a request id that only prefixes the real one", () => {
    expect(isRequestAttachmentSrc(`https://${HOST}/audits/${MINE}extra/f.pdf`, MINE)).toBe(false);
  });

  it("rejects a bogus request id rather than building a loose prefix", () => {
    expect(isRequestAttachmentSrc(mine, "../")).toBe(false);
    expect(isRequestAttachmentSrc(mine, "")).toBe(false);
  });

  it("still refuses anything off our store", () => {
    expect(isRequestAttachmentSrc(`https://attacker.example/audits/${MINE}/f.pdf`, MINE)).toBe(false);
  });
});

describe("isLegacyAttachmentSrc / isAllowedAttachmentSrc", () => {
  it("separates the unbound shape from the bound one", () => {
    expect(isLegacyAttachmentSrc(legacy)).toBe(true);
    expect(isLegacyAttachmentSrc(mine)).toBe(false);
  });

  it("the shape guard accepts both but proves nothing about ownership", () => {
    expect(isAllowedAttachmentSrc(legacy)).toBe(true);
    expect(isAllowedAttachmentSrc(mine)).toBe(true);
    expect(isAllowedAttachmentSrc("https://attacker.example/audits/x/f.pdf")).toBe(false);
  });
});

describe("rejectedAttachmentUrls", () => {
  // The reported attack: paste another project's URL onto your own draft,
  // then remove it so the cleanup deletes the victim's file.
  it("refuses another request's attachment", () => {
    expect(rejectedAttachmentUrls(MINE, [], [att(theirs)])).toEqual([theirs]);
  });

  it("allows a key minted for this request", () => {
    expect(rejectedAttachmentUrls(MINE, [], [att(mine)])).toEqual([]);
  });

  it("refuses a legacy key this request does not already hold", () => {
    expect(rejectedAttachmentUrls(MINE, [], [att(legacy)])).toEqual([legacy]);
  });

  it("keeps a legacy key the request already holds, so old drafts stay editable", () => {
    expect(rejectedAttachmentUrls(MINE, [att(legacy)], [att(legacy)])).toEqual([]);
  });

  it("refuses an off-store URL", () => {
    const evil = "https://attacker.example/x.exe";
    expect(rejectedAttachmentUrls(MINE, [], [att(evil)])).toEqual([evil]);
  });

  it("treats a missing attachments key as no change", () => {
    expect(rejectedAttachmentUrls(MINE, [att(mine)], undefined)).toEqual([]);
  });
});
