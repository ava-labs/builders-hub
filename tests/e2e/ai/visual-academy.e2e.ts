import { test } from '@e2e-dev/web';
import { expect } from 'e2e';
import { needsModel } from '../lib/skip';
import { waitForHydration } from '../lib/hydration';
import { openAsReturningVisitor } from '../site/helpers';
import { SCREENSHOT_ONLY, VISUAL, layoutIsIntact, waitForStillScreen } from './visual';

// This lesson has a diagram near the top, so the screenshot shows text next to an image.
const LESSON = '/academy/avalanche-l1/avalanche-fundamentals/03-multi-chain-architecture-intro/03-L1';

test('academy lesson is laid out without clipped or overlapping content', VISUAL, async (fixtures) => {
  needsModel();
  const { app, agent, browser, screen } = fixtures;
  await openAsReturningVisitor(app, browser, LESSON);
  await waitForHydration(browser, '#nd-nav');
  await expect(screen.getByRole('heading', 'Avalanche L1s', { level: 1 })).toBeVisible();
  await waitForStillScreen(browser);
  await agent.assert(
    layoutIsIntact(
      'the site header and the lesson heading "Avalanche L1s" with the start of the lesson, all fully visible',
    ),
    SCREENSHOT_ONLY,
  );
});
