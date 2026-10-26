import { test } from '@e2e-dev/web';
import type { Browser } from '@e2e-dev/web';
import { expect } from 'e2e';
import { isPhoneLayout } from '../lib/skip';
import { waitForHydration } from '../lib/hydration';
import { movingAnimations, reducedMotion } from '../lib/motion';
import { openAsReturningVisitor } from './helpers';

// site-reduced-motion-policy (app/global.css) and the app-wide MotionConfig (app/layout.client.tsx): under Reduce
// Motion nothing moves, while colour and opacity changes keep a 150ms fade. The engine cannot emulate the media
// feature, so the reducedMotion init script answers it (lib/motion.ts).

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** The page's height, then each screen of it in turn: the chapters reveal as they scroll in. */
async function scrollThrough(browser: Browser, check: () => Promise<void>) {
  const height = await browser.evaluate(() => document.documentElement.scrollHeight);
  const screen = await browser.evaluate(() => window.innerHeight);
  for (let y = 0; y < height; y += Math.round(screen * 0.75)) {
    await browser.evaluate((top) => {
      window.scrollTo(0, top);
      return null;
    }, y);
    await pause(200);
    await check();
  }
}

test('home runs no animation that moves anything under reduced motion', async ({ app, browser }) => {
  await browser.addInitScript(reducedMotion);
  await openAsReturningVisitor(app, browser, '/');
  await waitForHydration(browser, '[data-chapter="hero"] h1');
  expect(await browser.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);

  const expectStill = async () => expect(await movingAnimations(browser)).toEqual([]);
  await expectStill();
  // The hero's word turns every few seconds, and the boards tick: watch the first screen for a while.
  for (let i = 0; i < 4; i++) {
    await pause(750);
    await expectStill();
  }
  await scrollThrough(browser, expectStill);
});

test('a navbar menu still fades in 150ms under reduced motion, with no movement', async ({ app, screen, browser }) => {
  await browser.addInitScript(reducedMotion);
  await openAsReturningVisitor(app, browser, '/');
  const phone = await isPhoneLayout(browser);
  // Desktop: the Radix menu panel under the navbar. Phone: the menu sheet (components/navigation/navbar-dropdown.tsx).
  const panel = phone ? '[data-navbar-dropdown] > div' : '#nd-nav > :last-child > div';
  const trigger = phone ? '[data-navbar-dropdown] > button' : '#nd-nav nav button[aria-controls]';
  await waitForHydration(browser, trigger);

  // Every transition that starts, with its duration and whether it runs on the panel.
  await browser.evaluate((selector) => {
    const runs: { property: string; duration: number; onPanel: boolean }[] = [];
    (window as unknown as { __e2eRuns: typeof runs }).__e2eRuns = runs;
    document.addEventListener(
      'transitionrun',
      (event) => {
        const target = event.target as Element;
        const transition = target
          .getAnimations()
          .find(
            (animation) => animation instanceof CSSTransition && animation.transitionProperty === event.propertyName,
          );
        runs.push({
          property: event.propertyName,
          duration: Number(transition?.effect?.getTiming().duration ?? -1),
          onPanel: target.matches(selector),
        });
      },
      true,
    );
    return null;
  }, panel);

  if (phone) {
    await screen.getByRole('button', 'Toggle Menu').tap();
  } else {
    await browser.mouse.move(0, 0);
    await browser.locator('#nd-nav').getByRole('button', 'Solutions').hover();
  }
  await expect(browser.locator(panel)).toHaveAttribute('data-state', 'open');
  await pause(400);

  const runs = await browser.evaluate(
    () => (window as unknown as { __e2eRuns: { property: string; duration: number; onPanel: boolean }[] }).__e2eRuns,
  );
  const onPanel = runs.filter((run) => run.onPanel).map((run) => `${run.property} ${run.duration}ms`);
  expect(onPanel, 'the transitions of the panel').toContain('opacity 150ms');
  const moves = runs
    .filter((run) => /^(transform|translate|scale|rotate|width|height)$/.test(run.property))
    .map((run) => `${run.property} ${run.duration}ms`);
  expect(moves, 'transitions that move or resize something').toEqual([]);
});
