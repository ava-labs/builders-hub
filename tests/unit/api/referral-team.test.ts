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
