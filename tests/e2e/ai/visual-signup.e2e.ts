import { test } from '@e2e-dev/web';
import { expect } from 'e2e';
import { isPhoneLayout, needsModel } from '../lib/skip';
import { waitForHydration } from '../lib/hydration';
import { openAsReturningVisitor } from '../site/helpers';
import { SCREENSHOT_ONLY, VISUAL, layoutIsIntact, waitForStillScreen } from './visual';

// site/signup.e2e.ts measures the contrast of the artwork's color. This test judges what a visitor sees: the
// artwork drawn and clear in each theme, and the navbar's Log in and Sign up buttons clear of the menu names.
// app/global.css moves the desktop menu beside the logo up to 1500 px wide, so the buttons have room.
for (const theme of ['light', 'dark'] as const) {
  test(`signup page in the ${theme} theme shows the form and the artwork intact`, VISUAL, async (fixtures) => {
    needsModel();
    const { app, agent, browser, screen } = fixtures;
    await openAsReturningVisitor(app, browser, '/signup', { theme });
    await waitForHydration(browser, '#nd-nav');
    await expect(screen.getByRole('heading', 'Create your Builder Hub account')).toBeVisible();
    await waitForStillScreen(browser);
    const phone = await isPhoneLayout(browser);
    const subject = phone
      ? `the Builder Hub sign-up page on a phone in the ${theme} theme: the site header, and the heading "Create your Builder Hub account" above an email field`
      : `the Builder Hub sign-up page in the ${theme} theme: the site header, the heading "Create your Builder Hub account" above an email field, and to the left of the form a drawing of a browser window that holds a stack of outlined Avalanche logos`;
    const checks = phone
      ? []
      : [
          'The lines of the drawing stand out clearly from the page background.',
          'In the site header, the "Log in" and "Sign up" buttons do not overlap the menu names or the search box.',
        ];
    await agent.assert(`${layoutIsIntact(subject)} ${checks.join(' ')}`.trim(), SCREENSHOT_ONLY);
  });
}
