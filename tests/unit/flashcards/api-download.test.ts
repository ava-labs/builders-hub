import { describe, expect, it } from 'vitest';
import { GET } from '@/app/api/flashcards/download/[setId]/route';

describe('GET /api/flashcards/download/[setId]', () => {
  it('returns 404 for an unknown set id', async () => {
    const res = await GET(new Request('http://test/api/flashcards/download/__nope__'), {
      params: Promise.resolve({ setId: '__nope__' }),
    });
    expect(res.status).toBe(404);
  });

  it('returns 400 for an empty set id', async () => {
    const res = await GET(new Request('http://test/api/flashcards/download/'), {
      params: Promise.resolve({ setId: '' }),
    });
    expect(res.status).toBe(400);
  });

  it('returns a non-empty .apkg for an existing legacy set', async () => {
    const res = await GET(new Request('http://test/api/flashcards/download/legal-foundations'), {
      params: Promise.resolve({ setId: 'legal-foundations' }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/octet-stream');
    expect(res.headers.get('Content-Disposition')).toContain('legal-foundations.apkg');
    const buf = await res.arrayBuffer();
    expect(buf.byteLength).toBeGreaterThan(1000);
    const bytes = new Uint8Array(buf);
    expect(bytes[0]).toBe(0x50);
    expect(bytes[1]).toBe(0x4b);
  });
});
