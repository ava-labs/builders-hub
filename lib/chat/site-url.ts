/* The origin this deployment answers on, for server code that calls the
   app's own API routes. NEXT_PUBLIC_SITE_URL wins. Production calls its
   public domain: its deployment host (VERCEL_URL) sits behind Vercel's
   login, which answers every call with a sign-in page, so a token list or
   a signature lookup read through it came back empty. A preview has only
   its deployment host; local dev falls back to :3000. */

const PRODUCTION = "https://build.avax.network";

export function siteBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  if (process.env.VERCEL_ENV === "production") return PRODUCTION;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}
