import { test } from '@e2e-dev/web';
import type { Browser } from '@e2e-dev/web';
import { expect } from 'e2e';
import { waitForHydration } from '../lib/hydration';

// The home hero paints a mountain still (components/landing-v2/HeroSplash.tsx) and lays a snow loop over it.
// The background is decorative and aria-hidden, so these checks read it from the page. Its root reports the choice
// it made in data-motion: "loop" or "still".
const HEADING = /^Build an? [a-z]+ ?\.$/;
const HERO_H1 = '[data-chapter="hero"] h1';

// The still for this viewport, and whether the heading paints over everything at its center.
function readHero(browser: Browser) {
  return browser.evaluate(() => {
    const poster = document.querySelector('.v2-hero-splash-poster');
    const h1 = document.querySelector('[data-chapter="hero"] h1');
    if (!poster || !h1) return { still: '', narrow: false, headingOnTop: false };
    // the splash ignores the pointer, and hit testing skips it: let it take
    // part, so a splash painted over the heading is the element found
    const splash = document.querySelector<HTMLElement>('.v2-hero-splash');
    if (splash) splash.style.pointerEvents = 'auto';
    const r = h1.getBoundingClientRect();
    const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    if (splash) splash.style.pointerEvents = '';
    return {
      still: getComputedStyle(poster).backgroundImage,
      narrow: innerWidth < 768,
      headingOnTop: top !== null && h1.contains(top),
    };
  });
}

// The time of the loop that is on screen, or -1 while none plays.
function loopTime(browser: Browser) {
  return browser.evaluate(() => {
    const shown = [...document.querySelectorAll<HTMLVideoElement>('.v2-hero-splash-loop')].find(
      (v) => getComputedStyle(v).opacity !== '0',
    );
    return shown && !shown.paused ? shown.currentTime : -1;
  });
}

test('home hero heading paints over the mountain background', async ({ app, screen, browser }) => {
  await app.open('/');
  await expect(screen.getByRole('heading', HEADING, { level: 1 })).toBeVisible();
  const hero = await readHero(browser);
  // phones get the portrait crop, wider screens the 21:9 still
  expect(hero.still).toContain('/home/splash/');
  expect(hero.still).toContain(hero.narrow ? '-still-phone.' : '-still-desk.');
  expect(hero.headingOnTop).toBe(true);
});

test('home hero snow plays on screen and pauses off screen', async ({ app, browser }) => {
  await app.open('/');
  await waitForHydration(browser, HERO_H1);
  await expect
    .poll(() => browser.evaluate(() => document.querySelector('.v2-hero-splash')?.getAttribute('data-motion') ?? null))
    .toBe('loop');
  // the loop's clock moves while the hero is on screen
  await expect.poll(() => loopTime(browser), { timeout: 60_000 }).toBeGreaterThan(0.5);

  // below the hero, nothing decodes
  await browser.evaluate(() => {
    window.scrollTo(0, document.documentElement.scrollHeight);
    return null;
  });
  await expect
    .poll(() =>
      browser.evaluate(() =>
        [...document.querySelectorAll<HTMLVideoElement>('.v2-hero-splash-loop')].every((v) => v.paused),
      ),
    )
    .toBe(true);
});

test('home hero keeps a still background under reduced motion', async ({ app, browser }) => {
  await app.open('/');
  await waitForHydration(browser, HERO_H1);
  await expect
    .poll(() => browser.evaluate(() => document.querySelector('.v2-hero-splash')?.getAttribute('data-motion') ?? null))
    .toBe('loop');
  // The engine cannot emulate the media feature, and Chrome blocks a fulfilled document's requests to a local
  // server. So the page answers HeroSplash's question at run time: MediaQueryList reports the reduced-motion query
  // as matched, and a class change on <html> (watched for the theme) makes it choose again.
  await browser.evaluate(() => {
    const matches = Object.getOwnPropertyDescriptor(MediaQueryList.prototype, 'matches');
    Object.defineProperty(MediaQueryList.prototype, 'matches', {
      configurable: true,
      get(this: MediaQueryList) {
        return /prefers-reduced-motion:\s*reduce/.test(this.media) || Boolean(matches?.get?.call(this));
      },
    });
    document.documentElement.classList.add('e2e-reduced-motion');
    return null;
  });
  await expect
    .poll(() => browser.evaluate(() => document.querySelector('.v2-hero-splash')?.getAttribute('data-motion') ?? null))
    .toBe('still');
  await expect(browser.locator('.v2-hero-splash-loop')).toHaveCount(0);
  const hero = await readHero(browser);
  expect(hero.still).toContain('/home/splash/');
  expect(hero.headingOnTop).toBe(true);
});
