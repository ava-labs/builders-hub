import { test } from '@e2e-dev/web';
import { expect } from 'e2e';
import { desktopOnly, needsModel } from '../lib/skip';
import { waitForHydration } from '../lib/hydration';
import { TWO_ROUTE_TIMEOUT, openAsReturningVisitor } from '../site/helpers';

const COURSE = '/academy/avalanche-l1/avalanche-fundamentals';
// A lesson link waits for the server to render the next lesson. academy/lesson-navigation.e2e.ts uses the same budget.
const NAVIGATION = { timeout: 120_000 };

// From the Academy home to the second lesson: course card, course page, then a lesson.
// The agent may take Start course and then the next lesson, or the lesson from the outline. Both are right.
test('learner starts Avalanche Fundamentals and opens its second lesson', { timeout: TWO_ROUTE_TIMEOUT }, async (fixtures) => {
  needsModel();
  const { app, agent, browser, screen } = fixtures;
  await app.open('/academy');
  await desktopOnly(browser, 'academy/lesson-navigation.e2e.ts tests the phone outline');
  await waitForHydration(browser, '#nd-nav');
  await agent.act('start the Avalanche Fundamentals course and open its second lesson');
  await expect(browser).toHaveURL(`${COURSE}/02-avalanche-consensus-intro/02-consensus-mechanisms`, NAVIGATION);
  await expect(screen.getByRole('heading', 'Consensus Mechanisms', { level: 1 })).toBeVisible();
  await expect(screen.getByText('Lesson 2 of 4')).toBeVisible();
});

// The last lesson of a module links to the first lesson of the next module.
// academy/lesson-navigation.e2e.ts checks a next link inside one module.
test('next lesson link at the end of a module opens the next module', async (fixtures) => {
  needsModel();
  const { app, agent, browser, screen } = fixtures;
  // A returning visitor has answered the privacy banner, which would cover the links at the end of the page.
  await openAsReturningVisitor(app, browser, `${COURSE}/02-avalanche-consensus-intro/04-tps-vs-ttf`);
  await desktopOnly(browser, 'academy/lesson-navigation.e2e.ts tests the next link at both sizes');
  await waitForHydration(browser, '#nd-nav');
  await agent.act('go to the end of this lesson and open the next lesson with the link there');
  await expect(browser).toHaveURL(`${COURSE}/03-multi-chain-architecture-intro/01-multi-chain-architecture`, NAVIGATION);
  await expect(screen.getByRole('heading', 'Multi-Chain Architecture', { level: 1 })).toBeVisible();
});
