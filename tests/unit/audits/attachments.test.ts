import { describe, expect, it } from "vitest";
import { isAllowedAttachmentSrc } from "@/lib/audits/blobSrc";
import {
  contentDispositionFor,
  parseStoredAttachments,
  safeDownloadName,
  toAttachmentLinks,
} from "@/lib/audits/attachments";
import { auditDraftSchema, auditSubmitSchema } from "@/types/audits";

const HOST = "qizat5l3bwvomkny.public.blob.vercel-storage.com";
const ok = `https://${HOST}/audits/scope-abc123.pdf`;

const submittable = (attachments: unknown) => ({
  project_name: "Glacierswap",
  website: "https://glacierswap.example",
  description: "0123456789",
  scope: "0123456789",
  deployment_target: "c_chain",
  services: ["OpSec"],
  needed_by: new Date(),
  contact_name: "A",
  contact_email: "a@b.example",
  attachments,
});

describe("isAllowedAttachmentSrc", () => {
  it("accepts exactly the key shape the upload route mints", () => {
    expect(isAllowedAttachmentSrc(ok)).toBe(true);
  });

  it("rejects another host, http, and a path outside audits/", () => {
    expect(isAllowedAttachmentSrc("https://attacker.example/audits/x.pdf")).toBe(false);
    expect(isAllowedAttachmentSrc(`http://${HOST}/audits/x.pdf`)).toBe(false);
    expect(isAllowedAttachmentSrc(`https://${HOST}/projects/x.pdf`)).toBe(false);
  });

  it("rejects a nested key, so a firm's logo folder is not reachable as an attachment", () => {
    expect(isAllowedAttachmentSrc(`https://${HOST}/audits/firms/aud-1/logo.png`)).toBe(false);
  });

  it("rejects non-URLs and the scheme tricks", () => {
    for (const value of ["", "not a url", "javascript:alert(1)", "data:text/html,<script>"]) {
      expect(isAllowedAttachmentSrc(value)).toBe(false);
    }
  });
});

describe("attachment URLs on the draft and submit schemas", () => {
  it("accepts a stored key on the draft", () => {
    const parsed = auditDraftSchema.safeParse({
      attachments: [{ name: "scope.pdf", url: ok, size: 10 }],
    });
    expect(parsed.success).toBe(true);
  });

  it("refuses an off-store URL on the draft, so it never reaches the column", () => {
    const parsed = auditDraftSchema.safeParse({
      attachments: [{ name: "scope-v2.pdf", url: "https://attacker.example/x.exe", size: 10 }],
    });
    expect(parsed.success).toBe(false);
  });

  it("refuses an off-store URL at submit, so a row written earlier cannot fan out", () => {
    const parsed = auditSubmitSchema.safeParse(
      submittable([{ name: "scope-v2.pdf", url: "https://attacker.example/x.exe", size: 10 }]),
    );
    expect(parsed.success).toBe(false);
  });

  it("still submits with no attachments at all", () => {
    expect(auditSubmitSchema.safeParse(submittable(undefined)).success).toBe(true);
    expect(auditSubmitSchema.safeParse(submittable([])).success).toBe(true);
  });
});

describe("toAttachmentLinks", () => {
  it("hands out program paths and no store URL", () => {
    const links = toAttachmentLinks("req-1", [
      { name: "scope.pdf", url: ok, size: 10 },
      { name: "spec.pdf", url: ok, size: 20 },
    ]);

    expect(links).toEqual([
      { name: "scope.pdf", size: 10, href: "/api/audits/attachments/req-1/0" },
      { name: "spec.pdf", size: 20, href: "/api/audits/attachments/req-1/1" },
    ]);
    expect(JSON.stringify(links)).not.toContain(HOST);
  });

  it("survives a malformed column", () => {
    expect(toAttachmentLinks("req-1", null)).toEqual([]);
    expect(toAttachmentLinks("req-1", "nope")).toEqual([]);
    expect(parseStoredAttachments([{ name: "x" }, null, 7])).toEqual([]);
  });
});

describe("the download filename", () => {
  it("strips CR/LF and quotes so a name cannot break out of the header", () => {
    const header = contentDispositionFor('a"\r\nX-Evil: 1.pdf');
    expect(header).not.toMatch(/[\r\n]/);
    // The only quotes left are the two the header itself uses.
    expect(header.match(/"/g)).toHaveLength(2);
  });

  it("falls back rather than emitting an empty filename", () => {
    expect(safeDownloadName("日本語")).toBe("attachment");
  });

  it("keeps a non-latin name readable through filename*", () => {
    expect(contentDispositionFor("日本語.pdf")).toContain(
      `filename*=UTF-8''${encodeURIComponent("日本語.pdf")}`,
    );
  });
});
