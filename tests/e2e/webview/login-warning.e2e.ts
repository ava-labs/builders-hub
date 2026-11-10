import { test } from '@e2e-dev/web';
import { expect } from 'e2e';
import { waitForHydration } from '../lib/hydration';
import { openAsReturningVisitor } from '../site/helpers';

// The name the warning shows for each app, and the mark of that app in its user agent (lib/utils/browserDetection.ts).
const APPS = [
  { name: 'Instagram', mark: 'Instagram' },
  { name: 'LinkedIn', mark: 'LinkedInApp' },
];

for (const authPage of ['signup', 'login']) {
  test(`${authPage} shows the in-app browser warning above the social sign-in`, async ({ app, screen, browser }) => {
    await openAsReturningVisitor(app, browser, `/${authPage}?ref=TEAM1`);
    await waitForHydration(browser, 'input[name="email"]');
    const userAgent = await browser.evaluate(() => navigator.userAgent);
    const inApp = APPS.find(({ mark }) => userAgent.includes(mark));
    expect(inApp, `an in-app user agent, not ${userAgent}`).toBeDefined();

    await expect(screen.getByText(`Opening from ${inApp!.name}`)).toBeVisible();
    const openInBrowser = screen.getByRole('button', 'Open in Browser');
    await expect(openInBrowser).toBeVisible();
    // Each social button holds an image and a hidden label with the same word, so its name has the word twice.
    const google = screen.getByRole('button', /^Google\b/);
    await expect(google).toBeVisible();
    // The warning ends with its button. The whole warning is above the social sign-in.
    const [warningEnd, googleTop] = [await openInBrowser.boundingBox(), await google.boundingBox()];
    expect(warningEnd!.y + warningEnd!.height).toBeLessThanOrEqual(googleTop!.y);
  });
}
