import { test } from '@e2e-dev/web';
import { expect } from 'e2e';
import { needsModel } from '../lib/skip';
import { waitForHydration } from '../lib/hydration';
import { openAsReturningVisitor } from '../site/helpers';
import { SCREENSHOT_ONLY, VISUAL, layoutIsIntact, waitForStillScreen } from './visual';

// A returning visitor has answered the privacy banner, so the banner does not cover the screen the judge reads.
test('home page hero is laid out without clipped or overlapping content', VISUAL, async (fixtures) => {
  needsModel();
  const { app, agent, browser, screen } = fixtures;
  await openAsReturningVisitor(app, browser, '/');
  await waitForHydration(browser, '#nd-nav');
  // The last word of the heading changes every few seconds. Match the shape of the sentence.
  await expect(screen.getByRole('heading', /^Build an? [a-z]+ ?\.$/, { level: 1 })).toBeVisible();
  await waitForStillScreen(browser);
  // ChapterOne in components/landing-v2/StoryHome.tsx swaps the last word every 2.8 s, and a script slides it for about 0.6 s,
  // which waitForStillScreen cannot see. Wait for a swap and its slide, so the screenshot shows a still word.
  await browser.evaluate(
    () =>
      new Promise<null>((resolve) => {
        const heading = document.querySelector('section[data-chapter="hero"] h1');
        // With no swap in 4 s the word does not rotate, so it is already still.
        const noSwap = setTimeout(() => resolve(null), 4_000);
        const observer = new MutationObserver(() => {
          observer.disconnect();
          clearTimeout(noSwap);
          setTimeout(() => resolve(null), 700);
        });
        if (heading) observer.observe(heading, { subtree: true, childList: true, characterData: true });
      }),
  );
  await agent.assert(
    layoutIsIntact('the site header and the main heading, which starts with "Build", both fully visible', [
      // components/landing-v2/BuiltOnMarquee.tsx slides the logos sideways without end.
      'The rows of partner logos near the bottom slide sideways, so the logos at both screen edges are cut on purpose.',
      // components/landing-v2/HeroSplash.tsx paints the hero's background.
      'The heading and the buttons sit on a full-width photo of snowy mountains behind them. That is the background, not an overlap.',
    ]),
    SCREENSHOT_ONLY,
  );
});
