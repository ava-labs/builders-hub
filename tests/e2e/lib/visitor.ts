import type { Browser } from '@e2e-dev/web';

// A first visit shows the privacy banner, and a first Console visit opens a welcome dialog 800 ms after the page
// mounts (components/console/onboarding-tour/welcome-modal.tsx). The open dialog hides the rest of the page from
// the accessibility tree. A returning visitor has answered both. This writes those answers to localStorage.
// All URLs of the site share one localStorage, so any page of the site can be open when this runs.
//
// A Vercel preview also shows the Vercel Toolbar: a round button at the right edge of the screen, which covers the
// page in screenshots, and agent.assert reads it as part of the site. Its script (vercel.live feedback.js) shows it
// unless sessionStorage holds the "Disable for Session" opt-out, and it puts the button back when a test removes it.
// The x-vercel-skip-toolbar header did not hide it. sessionStorage belongs to the tab, which the next app.open keeps.
// On production and on a local server there is no toolbar, and the key does nothing.
export async function answerFirstVisitPrompts(
  browser: Browser,
  { answeredConsoleWelcome = true } = {},
): Promise<void> {
  await browser.evaluate((welcome) => {
    localStorage.setItem('cookie_consent', 'no');
    sessionStorage.setItem('vercel-live-feedback-optout', '1');
    if (welcome) {
      localStorage.setItem(
        'console-onboarding-tour',
        JSON.stringify({ state: { hasCompletedTour: true, hasSeenWelcome: true }, version: 0 }),
      );
    }
    return null;
  }, answeredConsoleWelcome);
}
