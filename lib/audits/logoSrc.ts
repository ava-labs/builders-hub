/**
 * True only for an https URL on OUR OWN Vercel Blob store with a real path
 * (S-9, S-10). Used as the zod refinement on Auditor.logo_url and again at
 * render on the public row and the admin header preview, failing closed to
 * the monogram. Repo paths (/images/...) are not a v1.1 shape.
 */
const STORE_HOST = (() => {
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

export function isAllowedLogoSrc(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === STORE_HOST && url.pathname.length > 1;
  } catch {
    return false;
  }
}
