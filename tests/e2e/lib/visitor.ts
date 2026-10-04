import type { Browser } from '@e2e-dev/web';

// A first visit shows the privacy banner, and a first Console visit opens a welcome dialog 800 ms after the page
// mounts (components/console/onboarding-tour/welcome-modal.tsx). The open dialog hides the rest of the page from
// the accessibility tree. A returning visitor has answered both. This writes those answers to localStorage.
// All URLs of the site share one localStorage, so any page of the site can be open when this runs.
export async function answerFirstVisitPrompts(
  browser: Browser,
  { answeredConsoleWelcome = true } = {},
): Promise<void> {
  await browser.evaluate((welcome) => {
    localStorage.setItem('cookie_consent', 'no');
    if (welcome) {
      localStorage.setItem(
        'console-onboarding-tour',
        JSON.stringify({ state: { hasCompletedTour: true, hasSeenWelcome: true }, version: 0 }),
      );
    }
    return null;
  }, answeredConsoleWelcome);
}
