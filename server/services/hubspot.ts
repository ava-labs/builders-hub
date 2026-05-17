/**
 * Centralized gate for outbound HubSpot requests.
 *
 * Defaults to "production only" so local dev, preview deployments, and any
 * non-production environment stop leaking data into HubSpot by accident.
 * The override env var lets you flip the behavior per environment without
 * touching code:
 *
 *   HUBSPOT_ENABLED=true   → force enabled (e.g. staging smoke test)
 *   HUBSPOT_ENABLED=false  → force disabled (e.g. emergency prod kill switch)
 *   HUBSPOT_ENABLED unset  → environment-based default:
 *       - VERCEL_ENV === "production"  → enabled
 *       - otherwise (preview, dev, none) → disabled
 *       - non-Vercel fallback: NODE_ENV === "production" → enabled
 */
export function isHubSpotEnabled(): boolean {
  const override = process.env.HUBSPOT_ENABLED?.trim().toLowerCase();
  if (override === "true" || override === "1") return true;
  if (override === "false" || override === "0") return false;

  if (process.env.VERCEL_ENV) {
    return process.env.VERCEL_ENV === "production";
  }
  return process.env.NODE_ENV === "production";
}

/** Log tag so skip messages are easy to grep in test runs. */
export const HUBSPOT_LOG_TAG = "[HubSpot]";

/**
 * Convenience: log a consistent "skipped" message and return false. Use at the
 * top of any HubSpot-pushing function so the caller's flow stays unchanged.
 */
export function skipHubSpot(reason: string): false {
  const env = process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "unknown";
  const flag = process.env.HUBSPOT_ENABLED ?? "(unset)";
  console.info(
    `${HUBSPOT_LOG_TAG} Skipped ${reason} — env=${env} HUBSPOT_ENABLED=${flag}`,
  );
  return false;
}
