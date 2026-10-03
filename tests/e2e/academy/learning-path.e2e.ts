import { test, type Browser } from '@e2e-dev/web';
import { expect } from 'e2e';
import { desktopOnly, phoneOnly } from '../lib/skip';
import { openAsReturningVisitor } from '../site/helpers';

// The learning path on the Academy overview (/academy), the client state in components/academy/landing/course-state.tsx.
// On a desktop pointer or keyboard, a course opens a hover card with its learning path, and the courses off that
// path dim. The state lives only in the browser (a controlled Radix HoverCard behind a media query), so these tests
// check it on the page: a hover and its leave; a move from one course to the next, where the old card must close
// after the new one opens (a shorter close delay left a moment with no card and nothing dimmed); a quick move;
// focus and Escape; narrowing below 1024 px and widening again; and a tap on a phone.

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

/** A course's link. The tree view also holds a phone copy; the overview has one link per course. */
const course = (browser: Browser, id: string) => browser.locator(`main [data-course-id="${id}"]:visible`).first();

const courseIds = (browser: Browser, css: string) =>
  browser.evaluate(
    (selector) => [...document.querySelectorAll(selector)].map((link) => link.getAttribute('data-course-id') ?? ''),
    css,
  );

const cardLines = (browser: Browser) =>
  browser.evaluate((selector) => {
    const card = document.querySelector<HTMLElement>(selector);
    return (card?.innerText ?? '')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
  }, CARD);

const blurActive = (browser: Browser) =>
  browser.evaluate(() => {
    (document.activeElement as HTMLElement | null)?.blur();
    return null;
  });

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// A returning visitor has answered the privacy banner, which would cover the lower lanes.
async function openOverview(app: Parameters<typeof openAsReturningVisitor>[0], browser: Browser) {
  await openAsReturningVisitor(app, browser, '/academy');
}

// The hover listeners exist only after hydration, so this tries again: pointer off, onto the course, the card soon after.
async function hoverPath(browser: Browser, id: string) {
  await expect
    .poll(
      async () => {
        await browser.mouse.move(OFF.x, OFF.y);
        await course(browser, id).hover();
        await pause(1_000);
        return (await browser.locator(CARD).count()) === 1;
      },
      { timeout: 30_000, message: `the card of ${id} did not open` },
    )
    .toBe(true);
}

// The same for keyboard focus: a second focus needs a blur first.
async function focusPath(browser: Browser, id: string) {
  await expect
    .poll(
      async () => {
        await blurActive(browser);
        await course(browser, id).focus();
        await pause(1_000);
        return (await browser.locator(CARD).count()) === 1;
      },
      { timeout: 30_000, message: `the card of ${id} did not open on focus` },
    )
    .toBe(true);
}

// Record the path's state now and at every DOM change until stopRecorder: the dimmed count and the courses whose
// card is open. Every committed state is recorded, so a gap cannot fall between two samples.
async function startRecorder(browser: Browser) {
  await browser.evaluate(
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
      (window as unknown as { __pathRecorder: unknown }).__pathRecorder = { observer, samples };
      return null;
    },
    { dimmed: DIMMED, open: OPEN },
  );
}

function stopRecorder(browser: Browser) {
  return browser.evaluate(() => {
    const recorder = (window as unknown as { __pathRecorder: { observer: MutationObserver; samples: Sample[] } })
      .__pathRecorder;
    recorder.observer.disconnect();
    return recorder.samples.map(({ dim, open }) => ({ dim, open }));
  });
}

/** A gap is a sample with no card open and nothing dimmed: the path went out before the next one came in. */
function expectNoGap(samples: Sample[], move: string) {
  const gaps = samples.filter((sample) => sample.dim === 0 && sample.open === '');
  expect(gaps, `${move}: ${JSON.stringify(samples)}`).toEqual([]);
}

test('a hover shows the path and dims the courses off it; leaving clears both', async ({ app, browser }) => {
  await openOverview(app, browser);
  await desktopOnly(browser, 'the card needs a pointer that hovers and a width of 1024 px or more');
  await hoverPath(browser, 'interchain-messaging');
  await expect
    .poll(() => cardLines(browser))
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
    .poll(() => courseIds(browser, DIMMED))
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
  await expect(course(browser, 'interchain-messaging')).not.toHaveAttribute('data-dim');

  await browser.mouse.move(OFF.x, OFF.y);
  await expect(browser.locator(CARD)).toHaveCount(0);
  await expect(browser.locator(DIMMED)).toHaveCount(0);
});

test('a move from one course to the next hands the path straight over', async ({ app, browser }) => {
  await openOverview(app, browser);
  await desktopOnly(browser, 'the card needs a pointer that hovers and a width of 1024 px or more');
  for (const [from, to] of MOVES) {
    await hoverPath(browser, from);
    await startRecorder(browser);
    await course(browser, to).hover();
    await expect.poll(() => courseIds(browser, OPEN)).toEqual([to]);
    expectNoGap(await stopRecorder(browser), `${from} to ${to}`);
    await browser.mouse.move(OFF.x, OFF.y);
    await expect(browser.locator(CARD)).toHaveCount(0);
  }

  await focusPath(browser, 'interchain-messaging');
  await startRecorder(browser);
  await browser.keyboard.press('Tab');
  await expect
    .poll(() => browser.evaluate(() => document.activeElement?.getAttribute('data-course-id') ?? null))
    .toBe('erc20-bridge');
  await expect.poll(() => courseIds(browser, OPEN)).toEqual(['erc20-bridge']);
  expectNoGap(await stopRecorder(browser), 'Tab from interchain-messaging to erc20-bridge');
});

test("a quick move shows only the last course's path", async ({ app, browser }) => {
  await openOverview(app, browser);
  await desktopOnly(browser, 'the card needs a pointer that hovers and a width of 1024 px or more');
  // A first open proves hydration. The quick move then starts with no card, as a pointer crossing the lane does.
  await hoverPath(browser, 'interchain-messaging');
  await browser.mouse.move(OFF.x, OFF.y);
  await expect(browser.locator(CARD)).toHaveCount(0);

  await course(browser, 'interchain-messaging').hover();
  await pause(80);
  await course(browser, 'erc20-bridge').hover();
  await pause(600);
  expect(await courseIds(browser, OPEN)).toEqual(['erc20-bridge']);
  expect(await browser.locator(CARD).count()).toBe(1);
  expect((await cardLines(browser)).pop()).toBe('ERC20 Bridge');
});

test('keyboard focus opens the path and Escape closes it', async ({ app, browser }) => {
  await openOverview(app, browser);
  await desktopOnly(browser, 'the card needs a width of 1024 px or more');
  await focusPath(browser, 'permissioned-l1s');
  await expect.poll(() => courseIds(browser, OPEN)).toEqual(['permissioned-l1s']);

  await browser.keyboard.press('Escape');
  await expect(browser.locator(CARD)).toHaveCount(0);
  await expect(browser.locator(DIMMED)).toHaveCount(0);
});

test('narrowing below 1024 px closes the path and dims nothing; widening again does not reopen it', async ({
  app,
  browser,
}) => {
  await openOverview(app, browser);
  await desktopOnly(browser, 'the test starts at the desktop width');
  await hoverPath(browser, 'interchain-messaging');
  await browser.setViewport({ width: 900, height: 900 });
  await expect(browser.locator(CARD)).toHaveCount(0);
  await expect(browser.locator(DIMMED)).toHaveCount(0);

  // Off the course first: at 1440 the pointer would be back on it, and Chromium sends a pointerover, a new hover.
  await browser.mouse.move(OFF.x, OFF.y);
  await browser.setViewport({ width: 1440, height: 900 });
  await pause(600);
  expect(await browser.locator(CARD).count()).toBe(0);
  expect(await browser.locator(DIMMED).count()).toBe(0);
});

test('a tap on a phone opens the course with no card', async ({ app, browser }) => {
  await openOverview(app, browser);
  await phoneOnly(browser, 'the desktop tests cover the card');
  expect(await browser.evaluate(() => matchMedia('(hover: hover) and (min-width: 1024px)').matches)).toBe(false);
  await expect(browser.locator(CARD)).toHaveCount(0);

  await course(browser, 'erc20-bridge').tap();
  // The tap can be the first visit to the course route. Give the navigation the budget of app.open.
  await expect(browser).toHaveURL('/academy/avalanche-l1/erc20-bridge', { timeout: 120_000 });
});
