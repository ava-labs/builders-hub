/* The origin this deployment answers on, for server code that calls the
   app's own API routes. NEXT_PUBLIC_SITE_URL wins; on Vercel the deployment
   host is next; local dev falls back to :3000. */

export function siteBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}
