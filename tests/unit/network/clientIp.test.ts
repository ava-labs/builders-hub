import { describe, expect, it } from 'vitest';
import { getClientIP } from '@/lib/chat/rateLimit';

const withHeaders = (h: Record<string, string>) =>
  new Request('https://build.avax.network/api/chat', { method: 'POST', headers: h });

describe('getClientIP', () => {
  it('uses cf-connecting-ip, which Cloudflare overwrites at the edge', () => {
    expect(getClientIP(withHeaders({ 'cf-connecting-ip': '203.0.113.7' }))).toBe('203.0.113.7');
  });

  // Finding: x-forwarded-for was read, and Cloudflare *appends* to it rather
  // than replacing it — so its first element is whatever the client sent.
  // Honouring it let a caller pick a fresh rate-limit bucket per request.
  it('ignores a spoofed x-forwarded-for', () => {
    const spoofed = getClientIP(withHeaders({ 'x-forwarded-for': '9.9.9.9' }));
    expect(spoofed).not.toBe('9.9.9.9');
    expect(spoofed).toBe('unknown');
  });

  it('ignores x-real-ip', () => {
    expect(getClientIP(withHeaders({ 'x-real-ip': '8.8.8.8' }))).toBe('unknown');
  });

  it('prefers the edge header over a spoofed one alongside it', () => {
    expect(
      getClientIP(
        withHeaders({ 'cf-connecting-ip': '203.0.113.7', 'x-forwarded-for': '9.9.9.9' }),
      ),
    ).toBe('203.0.113.7');
  });

  it('collapses every non-edge caller into one shared bucket', () => {
    const a = getClientIP(withHeaders({ 'x-forwarded-for': '1.1.1.1' }));
    const b = getClientIP(withHeaders({ 'x-forwarded-for': '2.2.2.2' }));
    expect(a).toBe(b);
  });

  it('rejects values that are not IP literals', () => {
    expect(getClientIP(withHeaders({ 'cf-connecting-ip': 'not-an-ip' }))).toBe('unknown');
    expect(getClientIP(withHeaders({ 'cf-connecting-ip': '999.1.1.1' }))).toBe('unknown');
    expect(getClientIP(withHeaders({ 'cf-connecting-ip': 'x'.repeat(500) }))).toBe('unknown');
  });

  it('accepts the Vercel edge header when Cloudflare is not in front', () => {
    expect(getClientIP(withHeaders({ 'x-vercel-forwarded-for': '198.51.100.4' }))).toBe('198.51.100.4');
  });
});
