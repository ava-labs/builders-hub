import { test } from '@e2e-dev/web';
import { expect } from 'e2e';
import { desktopOnly } from '../lib/skip';

// /academy is one landing for the 13 courses, in three views: Overview, Tree and Stages (?view=).
// In the overview, a course link's name starts with the course's two-digit number.
const PARTS = ['L1 Development', 'Interoperability', 'VM Customization', 'Applications'];
const STAGES = ['Foundations', 'Core', 'Advanced'];

test('academy home shows the overview of the courses', async ({ app, screen, browser }) => {
  await app.open('/academy');
  await expect(browser).toHaveTitle('Avalanche Academy | Avalanche Builder Hub');
  await expect(screen.getByRole('heading', 'Avalanche Academy.', { level: 1 })).toBeVisible();

  const views = screen.getByRole('navigation', 'Course views');
  await expect(views.getByRole('link', 'Overview')).toHaveAttribute('aria-current', 'page');
  await expect(views.getByRole('link', 'Tree')).toBeVisible();
  await expect(views.getByRole('link', 'Stages')).toBeVisible();

  // The overview starts with Avalanche Fundamentals, then lists the other courses by part.
  const start = screen.getByRole('article');
  await expect(start.getByRole('heading', 'Avalanche Fundamentals')).toBeVisible();
  await expect(start.getByRole('link', 'Start the course')).toHaveAttribute(
    'href',
    '/academy/avalanche-l1/avalanche-fundamentals',
  );
  for (const part of PARTS) await expect(screen.getByRole('heading', part)).toBeVisible();
  for (const name of ['Permissioned L1s', 'Interchain Messaging', 'Customizing the EVM', 'Encrypted ERC']) {
    await expect(screen.getByRole('link', new RegExp(`^\\d{2} ${name} `))).toBeVisible();
  }
});

test('view links show the tree and the stages of the courses', async ({ app, screen, browser }) => {
  await app.open('/academy');
  const views = screen.getByRole('navigation', 'Course views');

  await views.getByRole('link', 'Tree').tap();
  await expect(browser).toHaveURL('/academy?view=tree');
  await expect(views.getByRole('link', 'Tree')).toHaveAttribute('aria-current', 'page');
  // The tree view gives each course a card with the course name as a level 3 heading.
  for (const name of ['Avalanche Fundamentals', 'Interchain Messaging', 'Encrypted ERC']) {
    await expect(screen.getByRole('heading', name, { level: 3 })).toBeVisible();
  }

  await views.getByRole('link', 'Stages').tap();
  await expect(browser).toHaveURL('/academy?view=stages');
  await expect(views.getByRole('link', 'Stages')).toHaveAttribute('aria-current', 'page');
  for (const stage of STAGES) await expect(screen.getByRole('heading', stage, { level: 2 })).toBeVisible();
});

test('course link opens its course', async ({ app, screen, browser }) => {
  await app.open('/academy');
  await screen.getByRole('link', /^\d{2} Interchain Messaging /).tap();

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

// The Avalanche L1 and Blockchain landings merged into /academy, and two courses were removed (next.config.mjs).
for (const path of [
  '/academy/avalanche-l1',
  '/academy/blockchain',
  '/academy/entrepreneur',
  '/academy/blockchain/nft-deployment',
]) {
  test(`${path} opens the academy home`, async ({ app, browser }) => {
    await app.open(path);
    await desktopOnly(browser, 'the redirect is the same at both sizes');
    await expect(browser).toHaveURL('/academy');
  });
}
