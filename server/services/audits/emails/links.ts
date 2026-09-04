/**
 * Absolute bases for the links inside audit-program emails.
 *
 * These were four hardcoded production literals, so mail sent from a preview
 * deployment pointed at build.avax.network, where /audits does not exist
 * until this feature ships: the recipient's only call to action 404s.
 *
 * Resolution order, production-safe by construction:
 *  1. NEXT_PUBLIC_SITE_URL, the repo's existing override (same pattern as
 *     server/services/validator-alert-check.ts).
 *  2. On Vercel, any NON-production deployment addresses itself, so preview
 *     branches work with no environment configuration at all.
 *  3. The public site, which is the right answer in production and the safe
 *     answer anywhere the variables above are missing.
 */
function resolveSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");

  const deployment = process.env.VERCEL_URL?.trim();
  if (deployment && process.env.VERCEL_ENV !== "production") {
    return `https://${deployment.replace(/\/+$/, "")}`;
  }

  return "https://build.avax.network";
}

export const SITE_URL = resolveSiteUrl();

export const PORTAL_URL = `${SITE_URL}/audits/portal`;

/** Deep link to one request inside the auditor portal. */
export const portalRequestUrl = (requestId: string) => `${PORTAL_URL}/requests/${requestId}`;

/** The REQUESTING project's own view of a request (not the auditor portal). */
export const ownerRequestUrl = (requestId: string) => `${SITE_URL}/audits/${requestId}`;
