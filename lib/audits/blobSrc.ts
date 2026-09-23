/**
 * Our own Vercel Blob store, and the two shapes the audit program stores in
 * it. Every URL the program persists to a row is checked against these before
 * the write and again at render, so a value that never came from one of our
 * upload routes cannot ride into a link or an <img> (S-9, S-10).
 *
 * BLOB_BASE_URL overrides the host, which is what a preview or dev deployment
 * on its own store needs; the literal is the production store.
 */
export const BLOB_STORE_HOST = (() => {
  const base = process.env.BLOB_BASE_URL?.trim();
  if (base) {
    try {
      return new URL(base).hostname;
    } catch {
      // fall through to the literal
    }
  }
  return "qizat5l3bwvomkny.public.blob.vercel-storage.com";
})();

/** https, our store, and a path the caller recognizes. Never throws. */
function isStoreUrl(value: string, pathMatches: (pathname: string) => boolean): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" && url.hostname === BLOB_STORE_HOST && pathMatches(url.pathname)
    );
  } catch {
    return false;
  }
}

/** A firm logo: /audits/firms/<auditor id>/<file>, or any non-empty path for
    the marks admins saved through the generic /api/file route before v1.1. */
export function isAllowedLogoSrc(value: string): boolean {
  return isStoreUrl(value, (pathname) => pathname.length > 1);
}

/**
 * A request attachment: exactly the key shape the attachment route mints,
 * `audits/<one segment>` (app/api/audits/attachments/upload/route.ts pins the
 * same regex on the token). Anything else, including a link to somewhere off
 * the store entirely, is refused: the list is rendered to every firm the
 * request fans out to, so an arbitrary URL there is a link the program would
 * be publishing on the requester's behalf.
 */
export function isAllowedAttachmentSrc(value: string): boolean {
  return isStoreUrl(value, (pathname) => /^\/audits\/[^/]+$/.test(pathname));
}
