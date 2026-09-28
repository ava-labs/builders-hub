import { describe, expect, it } from 'vitest';
import { getDefaultReferralDestination, resolveReferralDestination } from '@/server/services/referrals';

describe('Builder Hub signup referrals', () => {
  it('uses the direct signup page for new links', () => {
    expect(getDefaultReferralDestination('bh_signup')).toBe('/signup');
  });

  it('sends existing links with a stored home destination to signup', () => {
    expect(resolveReferralDestination('bh_signup', null, '/')).toBe('/signup');
  });
});
