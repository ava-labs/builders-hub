import { test } from '@e2e-dev/web';
import type { Browser } from '@e2e-dev/web';
import { expect } from 'e2e';
import { desktopOnly } from '../lib/skip';
import { openAsReturningVisitor } from '../site/helpers';

// con-tour-glide (components/console/onboarding-tour/): the Console tour's spotlight and card travel from stop to stop
// (transform and translate, 350ms). The first stop is placed at once, and so is a restart: a closed tour forgets its
// place (placement.ts). The card sits on its step's side of the target, 12px off it, centred on it, measured before
// paint so it never lands 10px off and jumps.

/** The card (a portal at z-index 10000) and the spotlight's cutout (the first child of the z-index 9998 overlay). */
const CARD = '.fixed.z-\\[10000\\]';
const CUTOUT = '.fixed.z-\\[9998\\] > div:first-child';

/** Every transition the card or the cutout starts, as "card translate", "cutout transform". */
async function recordTravel(browser: Browser) {
  await browser.evaluate(
    ({ card, cutout }) => {
      const runs: string[] = [];
      (window as unknown as { __e2eTour: string[] }).__e2eTour = runs;
      document.addEventListener(
        'transitionrun',
        (event) => {
          const target = event.target as Element;
          if (target.matches(card)) runs.push(`card ${event.propertyName}`);
          else if (target.matches(cutout)) runs.push(`cutout ${event.propertyName}`);
        },
        true,
      );
      return null;
    },
    { card: CARD, cutout: CUTOUT },
  );
}

const travelRuns = (browser: Browser) =>
  browser.evaluate(() => (window as unknown as { __e2eTour: string[] }).__e2eTour.splice(0));

/** The card's box and transform origin, the cutout's box, and where the first stop's step puts the card. */
function firstStop(browser: Browser) {
  return browser.evaluate(
    ({ card, cutout }) => {
      const box = (node: Element | null) => {
        if (!node) return null;
        const { left, top, width, height } = node.getBoundingClientRect();
        return { left: Math.round(left), top: Math.round(top), width: Math.round(width), height: Math.round(height) };
      };
      const cardNode = document.querySelector<HTMLElement>(card);
      const target = document.querySelector("[data-tour='sidebar']")!.getBoundingClientRect();
      const cardBox = box(cardNode);
      // The Sidebar stop (components/console/onboarding-tour/types.ts): position "right", spotlight padding 0. The card
      // sits 12px right of the target, centred on it, kept 12px inside the viewport (tour-tooltip.tsx).
      const expected = cardBox && {
        left: Math.round(Math.max(12, Math.min(innerWidth - cardBox.width - 12, target.right + 12))),
        top: Math.round(
          Math.max(
            12,
            Math.min(innerHeight - cardBox.height - 12, target.top + target.height / 2 - cardBox.height / 2),
          ),
        ),
      };
      return {
        card: cardBox,
        origin: cardNode ? getComputedStyle(cardNode).transformOrigin : null,
        expected,
        cutout: box(document.querySelector(cutout)),
        target: box(document.querySelector("[data-tour='sidebar']")),
      };
    },
    { card: CARD, cutout: CUTOUT },
  );
}

test('the Console tour opens on a first visit, travels on Next, closes on Escape and restarts in place', async ({
  app,
  screen,
  browser,
}) => {
  // A first Console visit: the privacy banner answered, the Console welcome not.
  await openAsReturningVisitor(app, browser, '/console', { answeredConsoleWelcome: false });
  await desktopOnly(browser, 'the tour is checked at the desktop size');
  const welcome = screen.getByRole('dialog', 'Welcome to Builder Console');
  await expect(welcome).toBeVisible();
  await recordTravel(browser);
  await welcome.getByRole('button', 'Take the tour').tap();

  // Stop 1, placed at once where its step puts it: right of the sidebar, 12px off, centred, growing from its left side.
  const first = screen.getByRole('heading', 'Sidebar', { level: 3 });
  await expect(first).toBeVisible();
  await expect(screen.getByText(/^1 of \d+$/)).toBeVisible();
  await new Promise((resolve) => setTimeout(resolve, 500));
  const stop1 = await firstStop(browser);
  expect(stop1.card, 'the card').not.toBeNull();
  expect({ left: stop1.card!.left, top: stop1.card!.top }).toEqual(stop1.expected);
  expect(stop1.origin, 'the card grows from its left side, which faces the target').toMatch(/^0px /);
  expect(stop1.cutout, 'the spotlight around the sidebar').toEqual(stop1.target);
  expect((await travelRuns(browser)).filter((run) => /translate|transform/.test(run))).toEqual([]);

  // Next: the card and the spotlight travel to the next stop.
  await screen.getByRole('button', 'Next').tap();
  await expect(screen.getByText(/^2 of \d+$/)).toBeVisible();
  await new Promise((resolve) => setTimeout(resolve, 600));
  const stop2 = await firstStop(browser);
  expect(stop2.card!.left !== stop1.card!.left || stop2.card!.top !== stop1.card!.top, 'the card moved').toBe(true);
  expect(stop2.cutout, 'the spotlight moved').not.toEqual(stop1.cutout);
  expect(await travelRuns(browser)).toEqual(expect.arrayContaining(['card translate', 'cutout transform']));

  // Escape closes the tour: the card and the overlay leave.
  await browser.keyboard.press('Escape');
  await expect(screen.getByText(/^2 of \d+$/)).toBeHidden();
  await expect(browser.locator(CARD)).toHaveCount(0);
  await expect(browser.locator('.fixed.z-\\[9998\\]')).toHaveCount(0);
  await travelRuns(browser);

  // Restart from the header: the card is at stop 1 at once, with no travel from where the tour closed.
  await screen.getByRole('button', 'Help & Resources').tap();
  await screen.getByRole('menuitem', /Restart Tour/).tap();
  await expect(first).toBeVisible();
  await expect(screen.getByText(/^1 of \d+$/)).toBeVisible();
  await new Promise((resolve) => setTimeout(resolve, 500));
  const restarted = await firstStop(browser);
  expect({ left: restarted.card!.left, top: restarted.card!.top }).toEqual(restarted.expected);
  expect(restarted.cutout).toEqual(restarted.target);
  expect((await travelRuns(browser)).filter((run) => /translate|transform/.test(run))).toEqual([]);
});
