import { test } from '@e2e-dev/web';
import { expect } from 'e2e';
import { desktopOnly, needsModel } from '../lib/skip';
import { waitForHydration } from '../lib/hydration';
import { TWO_ROUTE_TIMEOUT, openAsReturningVisitor } from '../site/helpers';
import { expectSamePage, markPage } from '../academy/sidebar';
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
      'the site header, the start of the bar of Academy parts under it, and the lesson heading "Avalanche L1s" with the start of the lesson, all fully visible',
      // The part bar scrolls sideways below 1024 px (app/academy/critical.css). At 390 px two of its five parts are off-screen.
      [
        'On a narrow screen the bar of Academy parts scrolls sideways, so the parts past the right edge are hidden, and the last one in view can be cut there.',
      ],
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

// After a client move between tracks the sidebar listed three track folders in place of the course.
test(
  'sidebar after a move between tracks shows one course outline',
  { ...VISUAL, timeout: TWO_ROUTE_TIMEOUT },
  async (fixtures) => {
    needsModel();
    const { app, agent, browser, screen } = fixtures;
    await openAsReturningVisitor(app, browser, '/academy/avalanche-l1/avalanche-fundamentals');
    await desktopOnly(browser, 'the phone keeps the sidebar in a drawer; academy/course-sidebar.e2e.ts opens it');
    await markPage(browser);
    await screen.getByRole('navigation', 'Academy parts').getByRole('link', 'Applications').tap();
    await expect(browser).toHaveURL('/academy/blockchain/solidity-foundry', { timeout: 120_000 });
    await expectSamePage(browser);
    await waitForStillScreen(browser);
    await agent.assert(
      'The left sidebar starts with a "Welcome to the course" link, then numbered module headings that begin ' +
        '"01 Avalanche Starter Kit" and "02 Smart Contracts", with lesson links under them. It does not show ' +
        '"Primer on Avalanche Consensus". It is not a short list of three folders named "Avalanche l1", "Blockchain" ' +
        'and "Team1 Academy". No sidebar heading has an emoji.',
      SCREENSHOT_ONLY,
    );
  },
);
