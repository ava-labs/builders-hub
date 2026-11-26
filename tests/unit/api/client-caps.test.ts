import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

/* Two routes that act for an address the caller names (a sign-in code by mail, a newsletter sign-up) count each
   client's requests over every address, and the newsletter takes only an email address. */

const { consumeQuota, sendOTP } = vi.hoisted(() => ({ consumeQuota: vi.fn(), sendOTP: vi.fn() }));

vi.mock('@/lib/verification/limits', () => ({ consumeQuota }));
vi.mock('@/server/services/login', () => ({ sendOTP }));
vi.mock('@/server/services/hubspot', () => ({ isHubSpotEnabled: () => true, skipHubSpot: vi.fn() }));

const fetchMock = vi.fn();
const json = (url: string, body: unknown) =>
  new NextRequest(`https://build.avax.network${url}`, { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json', 'cf-connecting-ip': '203.0.113.9' } });

beforeEach(() => {
  consumeQuota.mockReset().mockResolvedValue({ allowed: true, retryAfterSeconds: 1 });
  sendOTP.mockReset().mockResolvedValue({ status: 'sent' });
  fetchMock.mockReset().mockImplementation(async () => new Response('{}', { status: 200 }));
  vi.stubGlobal('fetch', fetchMock);
  vi.stubEnv('HUBSPOT_API_KEY', 'test');
  vi.stubEnv('HUBSPOT_PORTAL_ID', '1');
  vi.stubEnv('HUBSPOT_NEWSLETTER_FORM_GUID', 'form');
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('POST /api/send-otp', () => {
  it('counts the client over every address, and mails nothing past the cap', async () => {
    const { POST } = await import('@/app/api/send-otp/route');
    expect((await POST(json('/api/send-otp', { email: 'a@example.com' }))).status).toBe(200);
    expect(consumeQuota).toHaveBeenCalledWith('otp-send:203.0.113.9', { limit: 120, windowMs: 600_000 });
    consumeQuota.mockResolvedValue({ allowed: false, retryAfterSeconds: 90 });
    const over = await POST(json('/api/send-otp', { email: 'b@example.com' }));
    expect(over.status).toBe(429);
    expect(over.headers.get('retry-after')).toBe('90');
    expect(sendOTP).toHaveBeenCalledTimes(1);
  });
});

describe('POST /api/newsletter', () => {
  it('takes an email address only, and sends the form nothing else', async () => {
    vi.resetModules();
    const { POST } = await import('@/app/api/newsletter/route');
    for (const email of ['not an address', 'a@b', '<script>@example.com>', 'x'.repeat(400)]) {
      expect((await POST(json('/api/newsletter', { email }))).status, email).toBe(400);
    }
    expect(fetchMock).not.toHaveBeenCalled();
    expect(consumeQuota).not.toHaveBeenCalled();
  });

  it('counts the client, and sends nothing past the cap', async () => {
    vi.resetModules();
    const { POST } = await import('@/app/api/newsletter/route');
    expect((await POST(json('/api/newsletter', { email: ' Reader@Example.com ' }))).status).toBe(200);
    expect(consumeQuota).toHaveBeenCalledWith('newsletter:203.0.113.9', { limit: 20, windowMs: 3_600_000 });
    expect(String(fetchMock.mock.calls[0][1]?.body)).toContain('reader@example.com');
    consumeQuota.mockResolvedValue({ allowed: false, retryAfterSeconds: 60 });
    expect((await POST(json('/api/newsletter', { email: 'reader@example.com' }))).status).toBe(429);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
