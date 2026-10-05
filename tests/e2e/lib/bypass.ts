// The header that opens a Vercel preview, for the configs: e2e.config.ts (and webview/e2e.config.ts through it) and
// chain/e2e.config.ts. Previews are behind SSO. The engine sends the header only to the app's site.
//
// This module has no side effects: it loads no file and reads the environment only when a config calls it. So a config
// that loads .env.local first gets the secret from that file.

/** The bypass header, or undefined when VERCEL_AUTOMATION_BYPASS_SECRET is not set. */
export function bypassHeaders(): Record<string, string> | undefined {
  const secret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  // No secret, no header: headers also turn off the HTTP cache and service workers.
  return secret ? { 'x-vercel-protection-bypass': secret } : undefined;
}
