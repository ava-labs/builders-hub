import type { App } from 'e2e';
import { appFetch } from './app-fetch';

// The query service runs two reads at once for every caller of the site, and turns a third away. The route waits a
// few seconds for a slot, then passes the refusal on. A full CI run reads the Explorer from several jobs at once, so a
// refused read is not a failed read: wait, then send it again.
const BUSY = /too many ad-hoc queries in flight/;
const BUSY_WAITS_MS = [5_000, 10_000, 20_000];

// Posts a body to the Explorer query route. Returns the status and the text of the answer.
export async function postQuery(app: App, body: object, ms: number): Promise<{ status: number; text: string }> {
  for (let tried = 0; ; tried += 1) {
    const res = await appFetch(app, '/api/explorer/query', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(ms),
    });
    const text = await res.text();
    if (res.ok || !BUSY.test(text) || tried === BUSY_WAITS_MS.length) return { status: res.status, text };
    await new Promise((resolve) => setTimeout(resolve, BUSY_WAITS_MS[tried]));
  }
}
