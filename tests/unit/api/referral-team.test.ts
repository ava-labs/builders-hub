import { describe, expect, it } from 'vitest';
import { isReferralTeamId } from '@/lib/referrals/team-labels';

describe('isReferralTeamId', () => {
  it('takes a team of the list', () => {
    expect(isReferralTeamId('devrel')).toBe(true);
    expect(isReferralTeamId('team1-india')).toBe(true);
  });

  it('refuses a name that every object has, and a value that is no string', () => {
    for (const value of ['constructor', 'toString', '__proto__', 'hasOwnProperty', '', 'nope', 7, null, undefined, ['devrel']]) {
      expect(isReferralTeamId(value), String(value)).toBe(false);
    }
  });
});

describe('cleanAttribution', () => {
  it('keeps the text fields of an attribution', async () => {
    const { cleanAttribution } = await import('@/server/services/referrals');
    expect(
      cleanAttribution({ referralCode: 'abc', landingPath: '/x?ref=abc', manualReferrer: { teamId: 'devrel', userId: 'u1' }, extra: 1 }),
    ).toEqual({ referralCode: 'abc', landingPath: '/x?ref=abc', manualReferrer: { teamId: 'devrel', teamIdOther: null, userId: 'u1' } });
  });

  it('leaves out a field that is no text, or too long', async () => {
    const { cleanAttribution } = await import('@/server/services/referrals');
    expect(
      cleanAttribution({ referralCode: { not: '' }, landingPath: 'x'.repeat(2_049), manualReferrer: { teamId: ['devrel'], userId: { not: '' } } }),
    ).toEqual({ referralCode: null, landingPath: null, manualReferrer: null });
    expect(cleanAttribution({ manualReferrer: { teamId: 'devrel', userId: { not: '' } } })?.manualReferrer).toEqual({
      teamId: 'devrel',
      teamIdOther: null,
      userId: null,
    });
    for (const raw of [null, undefined, 'text', 7]) expect(cleanAttribution(raw)).toBeNull();
  });
});
