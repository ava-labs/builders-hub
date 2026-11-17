import type { App } from 'e2e';
import { bypassHeaders } from '../lib/bypass.ts';

// Same default as e2e.config.ts.
const DEFAULT_BASE_URL = 'http://localhost:3000';

// A target without an engine has no app, so app.baseUrl is undefined there.
// Then read the site URL from E2E_BASE_URL, as the config does.
export function baseUrl(app: App): URL {
  return new URL(app.baseUrl ?? process.env.E2E_BASE_URL ?? DEFAULT_BASE_URL);
}

// Sends a request from Node to the site under test.
// A Vercel preview is behind SSO, and the Cloudflare WAF challenges automated clients on build.avax.network.
// The bypass headers (lib/bypass.ts) open both when their secrets are set.
// The headers go only to the site's origin. Redirects are not followed, so a secret cannot go to another host.
export async function appFetch(app: App, path: string, init: RequestInit = {}): Promise<Response> {
  const base = baseUrl(app);
  const url = new URL(path, base);
  const headers = new Headers(init.headers);
  if (url.origin === base.origin) {
    for (const [name, value] of Object.entries(bypassHeaders() ?? {})) headers.set(name, value);
  }
  const res = await fetch(url, { ...init, headers, redirect: 'manual' });
  if (res.status >= 300 && res.status < 400) {
    throw new Error(
      `${init.method ?? 'GET'} ${url.pathname} was redirected (${res.status}) to ${res.headers.get('location') ?? 'an unknown location'}. ` +
        'A protected Vercel preview needs a valid VERCEL_AUTOMATION_BYPASS_SECRET.',
    );
  }
  return res;
}

// Requests a path without following a redirect and returns the status and the Location path.
// appFetch fails on a redirect, so this sends its own request. The bypass headers go only to the site's origin.
export async function redirectOf(app: App, path: string): Promise<{ status: number; location: string }> {
  const base = baseUrl(app);
  const url = new URL(path, base);
  const headers = new Headers();
  if (url.origin === base.origin) {
    for (const [name, value] of Object.entries(bypassHeaders() ?? {})) headers.set(name, value);
  }
  const res = await fetch(url, { headers, redirect: 'manual' });
  const location = res.headers.get('location');
  if (!location) return { status: res.status, location: '' };
  const target = new URL(location, base);
  // A redirect to another host is a failure: show the full URL.
  return { status: res.status, location: target.origin === base.origin ? target.pathname : target.href };
}
