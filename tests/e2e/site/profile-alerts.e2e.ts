import { test } from '@e2e-dev/web';
import { expect } from 'e2e';
import { waitForHydration } from '../lib/hydration';
import { RETURNING_USER_ID, TEST_EMAIL, fakeAuth } from '../lib/fake-auth';
import { alertsAnswers } from '../lib/fake-alerts';
import { profileAnswers } from '../lib/fake-profile';
import { NAVIGATION_TIMEOUT, openAsReturningVisitor } from './helpers';

// The Alerts section of the profile (components/profile/sections/AlertsSection.tsx) on the validator alert API,
// faked in lib/fake-alerts.ts. It reads and writes no database and sends no email.

test('the Alerts section lists a validator, its checks and the alerts sent', async ({ app, screen, browser }) => {
  const auth = await fakeAuth(app, browser, {
    newUser: false,
    signedIn: true,
    answers: { ...profileAnswers(RETURNING_USER_ID, TEST_EMAIL), ...alertsAnswers() },
  });
  await openAsReturningVisitor(app, browser, '/profile?tab=alerts');
  await expect(screen.getByRole('heading', 'Alerts')).toBeVisible({ timeout: NAVIGATION_TIMEOUT });
  const validators = screen.getByRole('list', 'Validators');
  await expect(validators.getByText('Primary validator')).toBeVisible();
  await expect(validators.getByText(/Uptime below 90%/)).toBeVisible();
  await expect(screen.getByRole('list', 'Recent alerts').getByText(/below your threshold of 90%/)).toBeVisible();
  await expect(screen.getByText('Every 15 minutes')).toBeVisible();

  // The switch pauses the alert at once: no form, no save bar.
  await waitForHydration(browser, '#section-title');
  const alertsOn = screen.getByRole('switch', 'Alerts on for Primary validator');
  await expect(alertsOn).toHaveAttribute('aria-checked', 'true');
  await alertsOn.tap();
  await expect(alertsOn).toHaveAttribute('aria-checked', 'false');
  await expect(validators.getByText('Paused')).toBeVisible();
  await expect(screen.getByRole('region', 'Unsaved changes')).toHaveCount(0);
  expect(auth.unanswered, 'API writes with no fake answer').toEqual([]);
});
