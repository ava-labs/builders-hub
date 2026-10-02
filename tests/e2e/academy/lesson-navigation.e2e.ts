import { test } from '@e2e-dev/web';
import { expect } from 'e2e';
import { desktopOnly, phoneOnly } from '../lib/skip';

const COURSE = '/academy/avalanche-l1/avalanche-fundamentals';
const LESSON = `${COURSE}/02-avalanche-consensus-intro/02-consensus-mechanisms`;
const NEXT_LESSON = `${COURSE}/02-avalanche-consensus-intro/03-snowman-consensus`;
// A lesson link waits for the server to render the next lesson. On a busy dev server that can take
// longer than the assertion budget, so the URL check gets the budget of app.open.
const NAVIGATION = { timeout: 120_000 };

test('desktop sidebar shows the course outline', async ({ app, screen, browser }) => {
  await app.open(LESSON);
  await desktopOnly(browser);

  const outline = screen.getByRole('complementary');
  await expect(outline.getByRole('button', 'Course Avalanche Fundamentals')).toBeVisible();
  await expect(outline.getByText('01 Primer on Avalanche Consensus')).toBeVisible();
  await expect(outline.getByRole('link', 'Consensus Mechanisms')).toBeVisible();
  await expect(outline.getByRole('link', 'Snowman Consensus')).toBeVisible();
  await expect(outline.getByRole('link', 'Course Completion Certificate')).toBeVisible();
});

test('phone menu opens the course outline and a lesson from it', async ({ app, screen, browser }) => {
  await app.open(LESSON);
  await phoneOnly(browser);

  // The phone layout hides the outline until the user opens it from the top bar.
  await expect(screen.getByRole('complementary')).toBeHidden();
  await screen.getByRole('button', 'Toggle academy sidebar').tap();

  const outline = screen.getByRole('complementary');
  await expect(outline.getByRole('button', 'Course Avalanche Fundamentals')).toBeVisible();
  await expect(outline.getByText('01 Primer on Avalanche Consensus')).toBeVisible();
  await outline.getByRole('link', 'Snowman Consensus').tap();

  await expect(browser).toHaveURL(NEXT_LESSON, NAVIGATION);
  await expect(screen.getByRole('heading', 'Snowman Consensus', { level: 1 })).toBeVisible();
});

test('next lesson link opens the next lesson', async ({ app, screen, browser }) => {
  await app.open(LESSON);
  await expect(browser).toHaveTitle(/^Consensus Mechanisms/);
  await expect(screen.getByRole('heading', 'Consensus Mechanisms', { level: 1 })).toBeVisible();
  await expect(screen.getByText('Lesson 2 of 4')).toBeVisible();

  // A fresh visit shows the privacy banner. On a phone it covers the footer links at the end of the page.
  // Decline closes it and reloads the page. Wait for the new page, so the next tap does not race the reload.
  await screen.getByRole('button', 'Decline').tap();
  await expect
    .poll(() =>
      browser.evaluate(() => (performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming).type),
    )
    .toBe('reload');
  // The footer under the article links the previous and the next lesson by title.
  await screen.getByRole('article').getByRole('link', /^Snowman Consensus/).tap();

  await expect(browser).toHaveURL(NEXT_LESSON, NAVIGATION);
  await expect(screen.getByRole('heading', 'Snowman Consensus', { level: 1 })).toBeVisible();
  await expect(screen.getByText('Lesson 3 of 4')).toBeVisible();
});
