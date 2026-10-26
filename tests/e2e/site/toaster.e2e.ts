import { test } from '@e2e-dev/web';
import { expect } from 'e2e';
import { desktopOnly } from '../lib/skip';
import { captureConsole, consoleMessages, hydrationMessages } from '../lib/motion';

// components/ui/toaster.tsx: every use-toast Toaster renders the whole toast store, so two mounted at once showed each
// toast twice. Only the first one mounted renders; the server and the first client render show none, so hydration
// matches. The project submission form mounts two: GeneralSecure's and the Members section's.
//
// The page opens the sign-in dialog for a visitor who is not signed in, and the dialog hides the rest of the page from
// the accessibility tree (aria-hidden), so a role query cannot see the region. Closing the dialog leaves the page. The
// region is counted by its role and label in the DOM instead. "Notifications (F8)" is the Radix toast viewport's label;
// the global Sonner toaster's region is "Notifications alt+T", a different system.

test('the project submission page renders one use-toast region, with no hydration warning', async ({
  app,
  screen,
  browser,
}) => {
  await browser.addInitScript(captureConsole);
  await app.open('/events/project-submission');
  await desktopOnly(browser, 'one size covers the toaster: it renders the same at both');
  // The Members section, the second Toaster host, is on the page.
  await expect(screen.getByText('Team & Collaboration')).toBeVisible();
  const regions = browser.locator('[role="region"][aria-label^="Notifications (F8)"]');
  // The region appears once the first Toaster has mounted, after hydration.
  await expect(regions).toHaveCount(1);
  // A second Toaster rendering late would add a region: look again after the page settles.
  await new Promise((resolve) => setTimeout(resolve, 2_000));
  await expect(regions).toHaveCount(1);
  expect(hydrationMessages(await consoleMessages(browser))).toEqual([]);
});
