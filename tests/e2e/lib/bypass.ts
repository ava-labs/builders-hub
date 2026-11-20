// The headers that let the tests reach the app's site, for the configs: e2e.config.ts (and webview/e2e.config.ts
// through it), chain/e2e.config.ts and explore/console/e2e.config.ts, and for api/app-fetch.ts.
//
// - x-vercel-protection-bypass opens a Vercel preview. Previews are behind SSO.
// - x-builders-hub-e2e marks a test run for the Cloudflare WAF in front of build.avax.network. The WAF challenges
//   automated browsers on that host, and a skip rule that matches this header lets the tests through.
//
// The engine sends the headers only to the app's site.
//
// This module has no side effects: it loads no file and reads the environment only when a config calls it. So a config
// that loads .env.local first gets the secrets from that file.

/** The name of the header that the Cloudflare WAF skip rule matches. */
export const WAF_BYPASS_HEADER = 'x-builders-hub-e2e';

/**
 * The bypass headers, or undefined when neither VERCEL_AUTOMATION_BYPASS_SECRET nor E2E_WAF_BYPASS_SECRET is set.
 */
export function bypassHeaders(): Record<string, string> | undefined {
  const headers: Record<string, string> = {};
  const vercel = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  if (vercel) headers['x-vercel-protection-bypass'] = vercel;
  const waf = process.env.E2E_WAF_BYPASS_SECRET;
  if (waf) headers[WAF_BYPASS_HEADER] = waf;
  // No secret, no header: headers also turn off the HTTP cache and service workers.
  return Object.keys(headers).length > 0 ? headers : undefined;
}
