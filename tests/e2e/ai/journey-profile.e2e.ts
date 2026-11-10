import { test } from '@e2e-dev/web';
import { expect } from 'e2e';
import { desktopOnly, needsModel } from '../lib/skip';
import { waitForHydration } from '../lib/hydration';
import { CREATED_USER_ID, TEST_EMAIL, TEST_OTP, fakeAuth } from '../lib/fake-auth';
import { profileAnswers } from '../lib/fake-profile';
import { NAVIGATION_TIMEOUT, openAsReturningVisitor } from '../site/helpers';

// A new visitor signs up, lands back on the page they came from with no dialog that asks for more, then finds their
// Academy progress and their Console history on the profile. The fake auth backend (lib/fake-auth.ts) and the fake
// profile answers (lib/fake-profile.ts) stand in for the database: no account is made and no email is sent.
// site/signup.e2e.ts and site/profile.e2e.ts check the same pages with locators at both sizes.
test(
  'a new visitor signs up, then finds their Academy progress and Console history',
  { timeout: 360_000 },
  async (fixtures) => {
    needsModel();
    const { app, agent, browser, screen } = fixtures;
    const auth = await fakeAuth(app, browser, { answers: profileAnswers(CREATED_USER_ID, TEST_EMAIL) });
    await openAsReturningVisitor(app, browser, '/signup?callbackUrl=%2Fintegrations');
    await desktopOnly(browser, 'site/profile.e2e.ts tests the profile at both sizes');
    await waitForHydration(browser, 'input[name="email"]');

    await agent.act(
      `sign up with the email ${TEST_EMAIL}, enter the verification code ${TEST_OTP}, and accept the terms`,
    );
    // Signup ends at Terms: the visitor is back on the page they came from, and no dialog asks for more.
    await expect(browser).toHaveURL(/\/integrations(\?|#|$)/, { timeout: NAVIGATION_TIMEOUT });
    await expect(screen.getByRole('dialog')).toHaveCount(0);

    await waitForHydration(browser, '#nd-nav');
    await agent.act('open your profile');
    await expect(browser).toHaveURL(/\/profile(\?|$)/, { timeout: NAVIGATION_TIMEOUT });
    await waitForHydration(browser, '#section-title');

    await agent.act('find your Academy progress');
    await expect(browser).toHaveURL('/profile?tab=achievements');
    await expect(screen.getByRole('heading', 'Academy')).toBeVisible();

    await agent.act('find your Console history');
    await expect(browser).toHaveURL('/profile?tab=console');
    await expect(screen.getByRole('heading', 'Console history')).toBeVisible();
    expect(auth.unanswered, 'API writes with no fake answer').toEqual([]);
  },
);
