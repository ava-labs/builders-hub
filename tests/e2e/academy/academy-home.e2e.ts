import { test } from '@e2e-dev/web';
import { expect, type Screen } from 'e2e';

// A course card is a link that holds the course name as a level 4 heading.
// The page renders a desktop tree and a phone list; only the one for the current width is in the accessibility tree.
function courseCard(screen: Screen, name: string) {
  return screen.getByRole('link').filter({ has: screen.getByRole('heading', name, { level: 4 }) });
}

test('academy home lists the Avalanche L1 courses', async ({ app, screen, browser }) => {
  await app.open('/academy');
  await expect(browser).toHaveTitle('Avalanche L1 Academy | Avalanche Builder Hub');
  await expect(screen.getByRole('heading', 'Avalanche L1 Learning Tree', { level: 1 })).toBeVisible();

  const tracks = screen.getByRole('navigation', 'Academy tracks');
  await expect(tracks.getByRole('link', /^Avalanche L1/)).toHaveAttribute('aria-current', 'page');
  await expect(tracks.getByRole('link', /^Blockchain/)).toBeVisible();

  for (const name of ['Avalanche Fundamentals', 'Interchain Messaging', 'Permissioned L1s', 'ERC20 Bridge']) {
    await expect(courseCard(screen, name)).toBeVisible();
  }
});

test('course card opens its course', async ({ app, screen, browser }) => {
  await app.open('/academy');
  await courseCard(screen, 'Interchain Messaging').tap();

  // The tap can be the first visit to the course route. On a dev server that route can compile for a minute,
  // so give the navigation the budget of app.open, not of an assertion.
  await expect(browser).toHaveURL('/academy/avalanche-l1/interchain-messaging', { timeout: 120_000 });
  await expect(
    screen.getByText('Learn about Interchain Messaging, the interoperability protocol of Avalanche.'),
  ).toBeVisible();
  // Start course opens the first lesson of the first module.
  await expect(screen.getByRole('link', 'Start course')).toHaveAttribute(
    'href',
    '/academy/avalanche-l1/interchain-messaging/02-interoperability/01-interopability-between-blockchains',
  );
  await expect(screen.getByRole('heading', 'Modules', { level: 2 })).toBeVisible();
});
