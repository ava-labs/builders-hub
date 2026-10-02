import type { App } from 'e2e';

// Same default as e2e.config.ts.
const DEFAULT_BASE_URL = 'http://localhost:3000';

// A target without an engine has no app, so app.baseUrl is undefined there.
// Then read the site URL from E2E_BASE_URL, as the config does.
export function baseUrl(app: App): URL {
  return new URL(app.baseUrl ?? process.env.E2E_BASE_URL ?? DEFAULT_BASE_URL);
}

// Sends a request from Node to the site under test.
// A Vercel preview is behind SSO. When VERCEL_AUTOMATION_BYPASS_SECRET is set, the bypass header opens it.
// The header goes only to the site's origin. Redirects are not followed, so the secret cannot go to another host.
export async function appFetch(app: App, path: string, init: RequestInit = {}): Promise<Response> {
  const base = baseUrl(app);
  const url = new URL(path, base);
  const headers = new Headers(init.headers);
  const secret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  if (secret && url.origin === base.origin) headers.set('x-vercel-protection-bypass', secret);
  const res = await fetch(url, { ...init, headers, redirect: 'manual' });
  if (res.status >= 300 && res.status < 400) {
    throw new Error(
      `${init.method ?? 'GET'} ${url.pathname} was redirected (${res.status}) to ${res.headers.get('location') ?? 'an unknown location'}. ` +
        'A protected Vercel preview needs a valid VERCEL_AUTOMATION_BYPASS_SECRET.',
    );
  }
  return res;
}
