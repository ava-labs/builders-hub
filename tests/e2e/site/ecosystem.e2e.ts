import { test } from '@e2e-dev/web';
import { expect } from 'e2e';
import { appFetch, redirectOf } from '../api/app-fetch';
import { openAsReturningVisitor } from './helpers';

// The overview lists every item of the Ecosystem menu (components/ecosystem/entries.ts).
// A dev server compiles each linked route on its first request, so the link check can take minutes.
const LINK_CHECK_TIMEOUT = 300_000;
const LINK_CHECK_CONCURRENCY = 3;

// Sites outside the Builder Hub. The test does not fetch them; they must open in a new tab without an opener.
const EXTERNAL_LINKS = ['https://www.avalanchesummit.com', 'https://lu.ma/Team1?utm_source=builder_hub'];

test('ecosystem page lists the three menu groups', async ({ app, screen, browser }) => {
  await app.open('/ecosystem');
  await expect(browser).toHaveTitle('Ecosystem | Avalanche Builder Hub');
  await expect(screen.getByRole('heading', 'Ecosystem', { level: 1 })).toBeVisible();
  for (const group of ['Events', 'Programs', 'Guides and tools']) {
    await expect(screen.getByRole('heading', group, { level: 2 })).toBeVisible();
  }
});

test('every link on the ecosystem page opens a page', { timeout: LINK_CHECK_TIMEOUT }, async ({ app, browser }) => {
  await openAsReturningVisitor(app, browser, '/ecosystem');
  const links = await browser.evaluate(() =>
    [...document.querySelectorAll('section[aria-label="Ecosystem overview"] a')].map((a) => ({
      href: a.getAttribute('href') ?? '',
      target: a.getAttribute('target'),
      rel: a.getAttribute('rel') ?? '',
      name: (a.textContent ?? '').trim(),
    })),
  );
  expect(links.length, 'links in the overview').toBeGreaterThan(EXTERNAL_LINKS.length);
  for (const link of links) expect(link.name, `text of ${link.href}`).not.toBe('');

  // A protocol-relative href (//host/path) leaves the site, so it counts as external.
  const internal = (href: string) => href.startsWith('/') && !href.startsWith('//');
  const external = links.filter((link) => !internal(link.href));
  expect(external.map((link) => link.href).sort()).toEqual([...EXTERNAL_LINKS].sort());
  for (const link of external) {
    expect(link.target, `${link.href} opens in a new tab`).toBe('_blank');
    expect(link.rel.split(' '), `${link.href} has no opener`).toEqual(
      expect.arrayContaining(['noopener', 'noreferrer']),
    );
  }

  // An internal link answers 200, or redirects once on this site to a page that answers 200.
  // A missing page answers 404 (pages.e2e.ts), so the status alone tells a page from the 404 page.
  const broken: string[] = [];
  const queue = links.filter((link) => internal(link.href)).map((link) => link.href);
  const worker = async () => {
    for (let path = queue.shift(); path; path = queue.shift()) {
      try {
        const first = await redirectOf(app, path);
        if (first.status === 200) continue;
        if (first.status >= 300 && first.status < 400 && first.location.startsWith('/')) {
          const res = await appFetch(app, first.location);
          if (res.status === 200) continue;
          broken.push(`${path} -> ${first.location} (${res.status})`);
        } else {
          broken.push(`${path} (${first.status}${first.location ? ` -> ${first.location}` : ''})`);
        }
      } catch (error) {
        broken.push(`${path} (${error instanceof Error ? error.message : String(error)})`);
      }
    }
  };
  await Promise.all(Array.from({ length: LINK_CHECK_CONCURRENCY }, worker));
  expect(broken.sort(), 'ecosystem links that do not open a page').toEqual([]);
});
