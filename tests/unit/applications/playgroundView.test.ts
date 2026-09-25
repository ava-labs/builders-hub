import { describe, expect, it, vi, beforeEach } from 'vitest';

const { findUnique, update } = vi.hoisted(() => ({
  findUnique: vi.fn(),
  update: vi.fn(),
}));

vi.mock('@/prisma/prisma', () => ({
  prisma: { statsPlayground: { findUnique, update } },
}));

import { POST } from '@/app/api/playground/[id]/view/route';

function req(ip: string) {
  return new Request('https://build.avax.network/api/playground/pg-1/view', {
    method: 'POST',
    headers: { 'cf-connecting-ip': ip },
  }) as any;
}
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  findUnique.mockReset();
  update.mockReset();
  update.mockResolvedValue({ view_count: 1 });
});

describe('POST /api/playground/[id]/view', () => {
  // Finding: any id could be incremented, including ids of private
  // playgrounds, which also made this a probe for their existence.
  it('refuses to count views on a private playground', async () => {
    findUnique.mockResolvedValue({ is_public: false });
    const res = await POST(req('1.1.1.1'), ctx('pg-private'));
    expect(res.status).toBe(404);
    expect(update).not.toHaveBeenCalled();
  });

  it('returns the same 404 for a playground that does not exist', async () => {
    findUnique.mockResolvedValue(null);
    const res = await POST(req('1.1.1.1'), ctx('nope'));
    expect(res.status).toBe(404);
    expect(update).not.toHaveBeenCalled();
  });

  it('counts a first view of a public playground', async () => {
    findUnique.mockResolvedValue({ is_public: true });
    const res = await POST(req('2.2.2.2'), ctx('pg-public-a'));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ counted: true });
    expect(update).toHaveBeenCalledTimes(1);
  });

  // Finding: no throttling at all, so a loop inflated the count freely.
  it('does not re-count repeat views from the same viewer', async () => {
    findUnique.mockResolvedValue({ is_public: true, view_count: 1 });
    await POST(req('3.3.3.3'), ctx('pg-public-b'));
    expect(update).toHaveBeenCalledTimes(1);

    for (let i = 0; i < 25; i++) {
      const res = await POST(req('3.3.3.3'), ctx('pg-public-b'));
      expect(await res.json()).toMatchObject({ counted: false });
    }
    expect(update).toHaveBeenCalledTimes(1);
  });

  it('still counts a different viewer', async () => {
    findUnique.mockResolvedValue({ is_public: true });
    await POST(req('4.4.4.4'), ctx('pg-public-c'));
    await POST(req('5.5.5.5'), ctx('pg-public-c'));
    expect(update).toHaveBeenCalledTimes(2);
  });
});
