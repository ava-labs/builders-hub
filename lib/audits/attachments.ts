/**
 * Attachments are read through the program, never straight from the store.
 *
 * A blob URL is a bearer token: whoever holds it reads the file forever, with
 * no re-check of who is still allowed to. Uploaded specs and scoping docs are
 * exactly the material a project does NOT want outside the firms it reached,
 * so the stored URL stays server-side and every surface links to
 * /api/audits/attachments/<request>/<index>, which re-authorizes on each read.
 */

export interface StoredAttachment {
  name: string;
  url: string;
  size: number;
}

/** A link handed to a client: no store URL, only the program's own path. */
export interface AttachmentLink {
  name: string;
  size: number;
  href: string;
}

/**
 * The Json column, defensively. Rows predate every schema tightening, so the
 * shape is checked rather than asserted; anything malformed drops out instead
 * of crashing a view.
 */
export function parseStoredAttachments(value: unknown): StoredAttachment[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (entry): entry is StoredAttachment =>
      Boolean(entry) &&
      typeof entry === "object" &&
      typeof (entry as StoredAttachment).name === "string" &&
      typeof (entry as StoredAttachment).url === "string" &&
      typeof (entry as StoredAttachment).size === "number",
  );
}

/** Position in the STORED array: the read route resolves the same element. */
export function attachmentHref(requestId: string, index: number): string {
  return `/api/audits/attachments/${requestId}/${index}`;
}

export function toAttachmentLinks(requestId: string, value: unknown): AttachmentLink[] {
  return parseStoredAttachments(value).map((attachment, index) => ({
    name: attachment.name,
    size: attachment.size,
    href: attachmentHref(requestId, index),
  }));
}

/**
 * The ASCII half of the filename: Content-Disposition is a header, so a name
 * carrying CR/LF or a quote would break out of it. Anything outside a
 * conservative set is dropped, and a name left with nothing (a fully
 * non-latin one) falls back to a generic label.
 */
export function safeDownloadName(name: string): string {
  const cleaned = name
    .replace(/[^A-Za-z0-9._ -]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
  return cleaned.length > 0 ? cleaned : "attachment";
}

/**
 * The whole header value. `filename` is the sanitized ASCII fallback and
 * `filename*` carries the real name percent-encoded (RFC 5987), so a
 * non-latin name still downloads under its own name without a single raw
 * byte of it reaching the header.
 */
export function contentDispositionFor(name: string): string {
  const encoded = encodeURIComponent(name.replace(/[\r\n]/g, "").slice(0, 200));
  return `attachment; filename="${safeDownloadName(name)}"; filename*=UTF-8''${encoded}`;
}
