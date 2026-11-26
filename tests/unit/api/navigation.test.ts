import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { readJsonBody } from '@/lib/api/json-body';
import { isNavigation } from '@/lib/api/navigation';

/* A browser marks a page load (a link, a redirect, a form post) in Sec-Fetch-Mode, and page script cannot set that
   header. A page load is the one request another site can send with a visitor's session cookie, so a route that
   changes state does not act on one. */

const request = (headers: Record<string, string>, body?: string) => new Request('http://localhost/api/x', { method: body ? 'POST' : 'GET', headers, body });
const schema = z.object({ address: z.string() });

describe('isNavigation', () => {
  it('is true for a page load only', () => {
    expect(isNavigation(request({ 'sec-fetch-mode': 'navigate' }))).toBe(true);
    for (const mode of ['cors', 'same-origin', 'no-cors']) expect(isNavigation(request({ 'sec-fetch-mode': mode }))).toBe(false);
    // a client that is not a browser sends no such header
    expect(isNavigation(request({}))).toBe(false);
  });
});

describe('readJsonBody', () => {
  const body = JSON.stringify({ address: 'x' });

  it("reads a fetch's body, with or without the JSON content type", async () => {
    expect(await readJsonBody(request({ 'sec-fetch-mode': 'cors', 'content-type': 'application/json' }, body), schema)).toEqual({ address: 'x' });
    expect(await readJsonBody(request({ 'sec-fetch-mode': 'same-origin' }, body), schema)).toEqual({ address: 'x' });
    expect(await readJsonBody(request({}, body), schema)).toEqual({ address: 'x' });
  });

  it('refuses a form post, whose body can be JSON text', async () => {
    expect(await readJsonBody(request({ 'sec-fetch-mode': 'navigate', 'content-type': 'text/plain' }, body), schema)).toBeNull();
  });
});
