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
 * Attachment keys carry the request they belong to: `audits/<requestId>/<file>`.
 *
 * Being on our store is NOT ownership. A URL is a public bearer string, so any
 * check that asks only "is this one of ours" lets a caller name someone else's
 * object and have the server act on it: read it back through the proxy, or
 * delete it by adding it to a draft and removing it again. The request id in
 * the key is what makes the URL self-describing, so authorization never
 * depends on a row the caller can write.
 */
export function isRequestAttachmentSrc(value: string, requestId: string): boolean {
  // No assumption about the id's shape: a "/" in it is the only thing that
  // could widen the prefix, and guessing a format is how a checker starts
  // silently rejecting real ids when the id scheme changes.
  if (!requestId || requestId.includes("/")) return false;
  const prefix = `/audits/${requestId}/`;
  return isStoreUrl(value, (pathname) => {
    if (!pathname.startsWith(prefix)) return false;
    const file = pathname.slice(prefix.length);
    return file.length > 0 && !file.includes("/");
  });
}

/**
 * The unbound shape written before keys carried a request id. These are kept
 * readable on the request that already holds them, but a save can never ADD
 * one (requests.ts) and they are never passed to del(): there is no way to
 * tell a legitimate holder from someone who copied the URL.
 */
export function isLegacyAttachmentSrc(value: string): boolean {
  return isStoreUrl(value, (pathname) => /^\/audits\/[^/]+$/.test(pathname));
}

/**
 * Shape only: on our store, somewhere under audits/. Use this for the schema
 * and as the SSRF guard before a server-side fetch. It says nothing about who
 * the object belongs to, so it is never sufficient on its own for a read or a
 * delete: pair it with isRequestAttachmentSrc.
 */
export function isAllowedAttachmentSrc(value: string): boolean {
  return isStoreUrl(value, (pathname) => /^\/audits\/[^/]+(\/[^/]+)?$/.test(pathname));
}
