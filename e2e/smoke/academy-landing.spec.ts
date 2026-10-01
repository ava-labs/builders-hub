/**
 * Smoke for the learning path on the Academy landing (/academy), the client
 * state in components/academy/landing/course-state.tsx.
 *
 * On a desktop pointer or keyboard, a course opens a hover card with its
 * learning path, and the courses off that path dim. The state lives only in
 * the browser (a controlled Radix HoverCard behind a media query), so these
 * cases pin it on the page itself: a hover and its leave; a move from one
 * course to the next, where the old card must close after the new one opens
 * (a shorter close delay left a moment with no card and nothing dimmed); a
 * quick move; focus and Escape; narrowing below 1024 px and widening again;
 * and a tap on a phone.
 *
 * It is in the smoke tier because it only reads the page (no wallet, no
 * transaction) and gives the same result on every run against the live
 * site: the move check records every DOM state the page commits, so it
 * depends on the order of the two Radix timers, not on frame timing.
 */

import type { Page } from '@playwright/test';
import { test, expect } from '../fixtures';

const CARD = '[data-radix-popper-content-wrapper] [data-academy="landing"]';
/** The course whose card is open: Radix writes data-state on the trigger. */
const OPEN = 'main [data-course-id][data-state="open"]';
const DIMMED = 'main [data-dim="true"]';
/** The hero's title at 1440 x 900, on no course and no card. */
const OFF = { x: 700, y: 120 };

/** Consecutive courses in one lane of the overview: the pointer moves down from the first to the second. */
const MOVES = [
  ['interchain-messaging', 'erc20-bridge'],
  ['permissioned-l1s', 'l1-native-tokenomics'],
  ['customizing-evm', 'access-restriction'],
] as const;

interface Sample {
  dim: number;
  open: string;
}

/** A course's link (the tree view also holds a phone copy; the overview has one link per course). */
const course = (page: Page, id: string) => page.locator(`main [data-course-id="${id}"]:visible`).first();

const openCourses = (page: Page) =>
  page.locator(OPEN).evaluateAll((links) => links.map((link) => link.getAttribute('data-course-id')));

const dimmedCourses = (page: Page) =>
  page.locator(DIMMED).evaluateAll((links) => links.map((link) => link.getAttribute('data-course-id')));

async function cardLines(page: Page): Promise<string[]> {
  const text = await page.locator(CARD).innerText();
  return text.split('\n').map((line) => line.trim()).filter(Boolean);
}

/**
 * Open the landing without its overlays. The hub's fixed privacy card mounts
 * after hydration, so it is removed whenever it shows, never clicked (best
 * effort: a card that is no longer fixed is no overlay). The Next dev overlay
 * is there at load on a dev server.
 */
async function gotoLanding(page: Page) {
  await page.addLocatorHandler(
    page.getByText('We respect your privacy and are committed'),
    (text) =>
      text.evaluate((node) => {
        for (let el: Element | null = node; el && el !== document.body; el = el.parentElement) {
          if (getComputedStyle(el).position === 'fixed') {
            el.remove();
            break;
          }
        }
      }),
    { noWaitAfter: true },
  );
  await page.goto('/academy');
  await page.evaluate(() => document.querySelectorAll('nextjs-portal').forEach((el) => el.remove()));
}

/**
 * Hover a course until its card shows. The hover listeners exist only after
 * hydration, so it retries: pointer off, onto the course, the card within a
 * second.
 */
async function hoverPath(page: Page, id: string) {
  await expect(async () => {
    await page.mouse.move(OFF.x, OFF.y);
    await course(page, id).hover();
    await expect(page.locator(CARD)).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 30_000 });
}

/** Focus a course until its card shows, retried as in hoverPath (a focus again needs a blur first). */
async function focusPath(page: Page, id: string) {
  await expect(async () => {
    await course(page, id).blur();
    await course(page, id).focus();
    await expect(page.locator(CARD)).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 30_000 });
}

/**
 * Record the path's state now and at every DOM change until stopRecorder: the
 * dimmed count and the courses whose card is open. Every committed state is
 * recorded, so a gap cannot fall between two samples.
 */
async function startRecorder(page: Page) {
  await page.evaluate(
    ({ dimmed, open }) => {
      const samples: Sample[] = [];
      const record = () => {
        samples.push({
          dim: document.querySelectorAll(dimmed).length,
          open: [...document.querySelectorAll(open)].map((link) => link.getAttribute('data-course-id')).join(','),
        });
      };
      record();
      const observer = new MutationObserver(record);
      observer.observe(document.body, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ['data-dim', 'data-state'],
      });
      (window as any).__pathRecorder = { observer, samples };
    },
    { dimmed: DIMMED, open: OPEN },
  );
}

async function stopRecorder(page: Page): Promise<Sample[]> {
  return page.evaluate(() => {
    const { observer, samples } = (window as any).__pathRecorder;
    observer.disconnect();
    return samples;
  });
}

/** A gap is a sample with no card open and nothing dimmed: the path went out before the next one came in. */
function expectNoGap(samples: Sample[], move: string) {
  const gaps = samples.filter((sample) => sample.dim === 0 && sample.open === '');
  expect(gaps, `${move}: ${JSON.stringify(samples)}`).toEqual([]);
}

test.describe('academy landing', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('a hover shows the path and dims the courses off it; leaving clears both', async ({ page }) => {
    await gotoLanding(page);
    await hoverPath(page, 'interchain-messaging');
    await expect
      .poll(() => cardLines(page))
      .toEqual([
        'LEARNING PATH',
        '1',
        'Blockchain Fundamentals',
        '2',
        'Avalanche Fundamentals',
        '3',
        'Interchain Messaging',
      ]);
    await expect
      .poll(() => dimmedCourses(page))
      .toEqual([
        'permissioned-l1s',
        'l1-native-tokenomics',
        'permissionless-l1s',
        'erc20-bridge',
        'native-token-bridge',
        'customizing-evm',
        'access-restriction',
        'intro-to-solidity',
        'x402-payment-infrastructure',
        'encrypted-erc',
      ]);
    await expect(course(page, 'interchain-messaging')).not.toHaveAttribute('data-dim');

    await page.mouse.move(OFF.x, OFF.y);
    await expect(page.locator(CARD)).toHaveCount(0);
    await expect(page.locator(DIMMED)).toHaveCount(0);
  });

  test('a move from one course to the next hands the path straight over', async ({ page }) => {
    await gotoLanding(page);
    for (const [from, to] of MOVES) {
      await hoverPath(page, from);
      await startRecorder(page);
      await course(page, to).hover();
      await expect.poll(() => openCourses(page)).toEqual([to]);
      expectNoGap(await stopRecorder(page), `${from} to ${to}`);
      await page.mouse.move(OFF.x, OFF.y);
      await expect(page.locator(CARD)).toHaveCount(0);
    }

    await focusPath(page, 'interchain-messaging');
    await startRecorder(page);
    await page.keyboard.press('Tab');
    await expect(page.locator(':focus')).toHaveAttribute('data-course-id', 'erc20-bridge');
    await expect.poll(() => openCourses(page)).toEqual(['erc20-bridge']);
    expectNoGap(await stopRecorder(page), 'Tab from interchain-messaging to erc20-bridge');
  });

  test("a quick move shows only the last course's path", async ({ page }) => {
    await gotoLanding(page);
    // A first open proves hydration; the quick move then starts with no card, as a pointer crossing the lane does.
    await hoverPath(page, 'interchain-messaging');
    await page.mouse.move(OFF.x, OFF.y);
    await expect(page.locator(CARD)).toHaveCount(0);

    await course(page, 'interchain-messaging').hover();
    await page.waitForTimeout(80);
    await course(page, 'erc20-bridge').hover();
    await page.waitForTimeout(600);
    expect(await openCourses(page)).toEqual(['erc20-bridge']);
    expect(await page.locator(CARD).count()).toBe(1);
    expect((await cardLines(page)).pop()).toBe('ERC20 Bridge');
  });

  test('keyboard focus opens the path and Escape closes it', async ({ page }) => {
    await gotoLanding(page);
    await focusPath(page, 'permissioned-l1s');
    await expect.poll(() => openCourses(page)).toEqual(['permissioned-l1s']);

    await page.keyboard.press('Escape');
    await expect(page.locator(CARD)).toHaveCount(0);
    await expect(page.locator(DIMMED)).toHaveCount(0);
  });

  test('narrowing below 1024 px closes the path and dims nothing; widening again does not reopen it', async ({
    page,
  }) => {
    await gotoLanding(page);
    await hoverPath(page, 'interchain-messaging');
    await page.setViewportSize({ width: 900, height: 900 });
    await expect(page.locator(CARD)).toHaveCount(0);
    await expect(page.locator(DIMMED)).toHaveCount(0);

    // Off the course first: at 1440 the pointer would be back on it, and Chromium sends a pointerover, a new hover.
    await page.mouse.move(OFF.x, OFF.y);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForTimeout(600);
    expect(await page.locator(CARD).count()).toBe(0);
    expect(await page.locator(DIMMED).count()).toBe(0);
  });

  test.describe('on a phone', () => {
    test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

    test('a tap on a phone navigates to the course with no card', async ({ page }) => {
      await gotoLanding(page);
      expect(await page.evaluate(() => matchMedia('(hover: hover) and (min-width: 1024px)').matches)).toBe(false);
      await expect(page.locator(CARD)).toHaveCount(0);

      await course(page, 'erc20-bridge').tap();
      await page.waitForURL(/\/academy\/avalanche-l1\/erc20-bridge$/);
    });
  });
});
