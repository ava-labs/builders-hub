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
      'the site header, the bar of the five Academy parts under it, and the lesson heading "Avalanche L1s" with the start of the lesson, all fully visible',
      // The part bar scrolls sideways below 1024 px (app/academy/critical.css).
      ['On a narrow screen the bar of Academy parts scrolls sideways, so its last label can be cut at the right edge.'],
    ),
    SCREENSHOT_ONLY,
  );
});

// The landing's views (components/academy/landing): the overview's start card and parts, and the tree, whose
// desktop cards have fixed places with arrows between them.
for (const { view, path, subject, normal } of [
  {
    view: 'overview',
    path: '/academy',
    subject:
      'the heading "Avalanche Academy." with the Overview, Tree and Stages links, and the start card of the Avalanche Fundamentals course',
    normal: [],
  },
  {
    view: 'tree',
    path: '/academy?view=tree',
    subject: 'the heading "Avalanche Academy." and the first course cards of the tree',
    normal: ['Thin lines and arrows that join the course cards are part of the tree, not overlaps.'],
  },
]) {
  test(`academy home ${view} is laid out without clipped or overlapping content`, VISUAL, async (fixtures) => {
    needsModel();
    const { app, agent, browser, screen } = fixtures;
    await openAsReturningVisitor(app, browser, path);
    await waitForHydration(browser, '#nd-nav');
    await expect(screen.getByRole('heading', 'Avalanche Academy.', { level: 1 })).toBeVisible();
    await waitForStillScreen(browser);
    await agent.assert(layoutIsIntact(`the site header, ${subject}, all fully visible`, normal), SCREENSHOT_ONLY);
  });
}
