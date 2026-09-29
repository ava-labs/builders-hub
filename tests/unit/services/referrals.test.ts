import { describe, expect, it } from 'vitest';
import { getDefaultReferralDestination, resolveReferralDestination } from '@/server/services/referrals';

describe('Builder Hub signup referrals', () => {
  it('uses the direct signup page for new links', () => {
    expect(getDefaultReferralDestination('bh_signup')).toBe('/signup');
  });

  it('preserves existing modal links and campaign parameters', () => {
    expect(resolveReferralDestination('bh_signup', null, '/')).toBe('/');
    expect(resolveReferralDestination('bh_signup', null, '/signup?utm_source=team1')).toBe('/signup?utm_source=team1');
  });
});
