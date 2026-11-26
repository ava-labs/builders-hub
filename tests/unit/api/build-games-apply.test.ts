import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/* A Build Games application is the account's: the address is the session's, and only the fields of the form go
   to HubSpot. */

const { upsert, recordReferral } = vi.hoisted(() => ({ upsert: vi.fn(), recordReferral: vi.fn() }));
vi.mock('@/prisma/prisma', () => ({ prisma: { buildGamesApplication: { upsert } } }));
vi.mock('@/lib/auth/authSession', () => ({ getAuthSession: async () => ({ user: { id: 'me', email: 'me@example.com' } }) }));
vi.mock('@/server/services/hubspot', () => ({ isHubSpotEnabled: () => true, skipHubSpot: vi.fn() }));
vi.mock('@/server/services/referrals', () => ({ recordReferralAttributionFromRequest: recordReferral }));

const fetchMock = vi.fn();
const post = async (body: unknown) => {
  const { POST } = await import('@/app/api/build-games/apply/route');
  return POST(
    new Request('https://build.avax.network/api/build-games/apply', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json' },
    }) as never,
    {},
  );
};

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv('HUBSPOT_API_KEY', 'test');
  upsert.mockReset().mockResolvedValue({ id: 'a1' });
  recordReferral.mockReset().mockResolvedValue(null);
  fetchMock.mockReset().mockImplementation(async () => new Response('{}', { status: 200 }));
  vi.stubGlobal('fetch', fetchMock);
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('POST /api/build-games/apply', () => {
  it('sends the session address and the form fields only, to the form and to the database', async () => {
    const res = await post({
      email: 'other@example.com',
      firstName: 'A',
      privacyPolicyRead: true,
      hs_lead_status: 'CUSTOMER',
      referral_attribution: { referralCode: 'abc' },
    });
    expect(res.status).toBe(200);
    const sent = JSON.parse(String(fetchMock.mock.calls[0][1].body)) as { fields: { name: string; value: unknown }[] };
    const byName = Object.fromEntries(sent.fields.map((f) => [f.name, f.value]));
    expect(byName.email).toBe('me@example.com');
    expect(byName.firstname).toBe('A');
    expect(Object.keys(byName)).not.toContain('hs_lead_status');
    expect(Object.keys(byName)).not.toContain('referral_attribution');
    expect(upsert.mock.calls[0][0].where).toEqual({ email: 'me@example.com' });
    expect(recordReferral.mock.calls[0][1]).toMatchObject({ userEmail: 'me@example.com', attribution: { referralCode: 'abc' } });
  });

  it('refuses a field that is not text or a checkbox, before any write', async () => {
    for (const body of [{ firstName: { set: 'x' } }, { telegram: ['a'] }, { whyYou: 'x'.repeat(5_001) }, 'text', null]) {
      expect((await post(body)).status).toBe(400);
    }
    expect(fetchMock).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
  });
});
