import { describe, expect, it } from 'vitest';

import { clientBucket } from '@/lib/net/clientIp';

/* A rate limit counts by the address the edge names. A header that the caller sets has no part in the bucket. */

const request = (headers: Record<string, string>) => new Request('http://localhost/api/x', { headers });

describe('clientBucket', () => {
  it('is the address from the edge, whatever Origin and X-Forwarded-For say', () => {
    const one = clientBucket(request({ 'cf-connecting-ip': '203.0.113.7' }));
    expect(one).toBe('203.0.113.7');
    expect(clientBucket(request({ 'cf-connecting-ip': '203.0.113.7', origin: 'https://a.example', 'x-forwarded-for': '198.51.100.1' }))).toBe(one);
    expect(clientBucket(request({ 'cf-connecting-ip': '203.0.113.7', origin: 'https://b.example', 'x-real-ip': '198.51.100.2' }))).toBe(one);
  });

  it('is one bucket for every address of an IPv6 /64', () => {
    expect(clientBucket(request({ 'cf-connecting-ip': '2001:db8:1:2:aaaa::1' }))).toBe(clientBucket(request({ 'cf-connecting-ip': '2001:db8:1:2:bbbb::9' })));
    expect(clientBucket(request({ 'cf-connecting-ip': '2001:db8:1:3::1' }))).not.toBe(clientBucket(request({ 'cf-connecting-ip': '2001:db8:1:2::1' })));
  });

  it('is one shared bucket for a request with no edge header', () => {
    expect(clientBucket(request({ origin: 'https://a.example', 'x-forwarded-for': '198.51.100.1' }))).toBe('unknown');
  });
});
