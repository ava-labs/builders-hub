import { test } from '@e2e-dev/web';
import { expect } from 'e2e';
import { phoneOnly } from '../lib/skip';
import { waitForHydration } from '../lib/hydration';
import { openAsReturningVisitor } from '../site/helpers';

// The docs on a phone (app/docs/styles.css, app/docs/docs-layout-wrapper.tsx, app/docs/book/*.css):
// - docs-phone-drawer: the sidebar is a drawer that waits behind the left edge. Fumadocs mounts it closed after
//   hydration; its exit keyframes must not run then, or it crosses the screen for a few frames. Opened, it slides in.
//   A key pressed while a pointer closes it cuts the exit short, and the drawer still goes.
// - docs-anchor-flash: the heading a reader jumps to carries a brief wash ([data-bk-anchor-mark]). Below 1280px the
//   On this page list is a popover that covers the heading, so the mark starts when the list closes.
// - docs-tabs-slide: one underline (the tab list's ::after) travels to the chosen tab.

const PAGE = '/docs/tooling/avalanche-deploy/add-ons';
const DRAWER = '#nd-sidebar-mobile';

test('the closed docs drawer never paints on screen at load, and opening it slides it in', async ({
  app,
  screen,
  browser,
}) => {
  await app.open('/small-logo.png');
  await phoneOnly(browser, 'the drawer is the phone sidebar');
  // From the first frame the drawer exists, sample its box on every frame for one second.
  await browser.addInitScript(() => {
    const samples: { left: number; right: number; state: string | null }[] = [];
    (window as unknown as { __e2eDrawer: typeof samples }).__e2eDrawer = samples;
    let since: number | null = null;
    const sample = () => {
      const drawer = document.getElementById('nd-sidebar-mobile');
      if (drawer) {
        since ??= performance.now();
        const box = drawer.getBoundingClientRect();
        samples.push({ left: box.left, right: box.right, state: drawer.getAttribute('data-state') });
      }
      if (since === null || performance.now() - since < 1_000) requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
  await openAsReturningVisitor(app, browser, PAGE);
  await waitForHydration(browser, '#nd-page article h1');
  const samples = () =>
    browser.evaluate(
      () => (window as unknown as { __e2eDrawer: { left: number; right: number; state: string | null }[] }).__e2eDrawer,
    );
  // Wait for the second of samples to end: about 60 frames.
  await expect.poll(async () => (await samples()).length).toBeGreaterThan(30);
  await new Promise((resolve) => setTimeout(resolve, 1_200));
  const drawn = await samples();
  const onScreen = drawn
    .filter((box) => box.right > 0.5)
    .map((box) => `${Math.round(box.left)}..${Math.round(box.right)}`);
  expect(onScreen, 'frames where the closed drawer reached into the screen').toEqual([]);
  expect(drawn.every((box) => box.state === 'closed')).toBe(true);

  // Opening runs the slide on the drawer.
  await browser.evaluate(() => {
    const names: string[] = [];
    (window as unknown as { __e2eDrawerRuns: string[] }).__e2eDrawerRuns = names;
    document.addEventListener(
      'animationstart',
      (event) => {
        if ((event.target as Element).id === 'nd-sidebar-mobile') names.push(event.animationName);
      },
      true,
    );
    return null;
  });
  await screen.getByRole('button', 'Toggle docs sidebar').tap();
  await expect(browser.locator(DRAWER)).toHaveAttribute('data-state', 'open');
  await expect
    .poll(() => browser.evaluate(() => (window as unknown as { __e2eDrawerRuns: string[] }).__e2eDrawerRuns))
    .toContain('slideInFromLeft');
  // It lands at the left edge.
  await expect
    .poll(() =>
      browser.evaluate((css) => Math.round(document.querySelector(css)!.getBoundingClientRect().left), DRAWER),
    )
    .toBe(0);
});

test('a key pressed while a pointer closes the docs drawer still lets the drawer go', async ({
  app,
  screen,
  browser,
}) => {
  await app.open('/small-logo.png');
  await phoneOnly(browser, 'the drawer is the phone sidebar');
  await openAsReturningVisitor(app, browser, PAGE);
  await waitForHydration(browser, '#nd-page article h1');
  const drawer = browser.locator(DRAWER);
  await screen.getByRole('button', 'Toggle docs sidebar').tap();
  await expect(drawer).toHaveAttribute('data-state', 'open');
  await expect
    .poll(() =>
      browser.evaluate((css) => Math.round(document.querySelector(css)!.getBoundingClientRect().left), DRAWER),
    )
    .toBe(0);
  // The pointer close below starts the 200ms exit of the drawer and of its backdrop. The page runs both at a tenth of
  // their speed from their first frame (2s), so the key lands during them however busy the machine is. The rate leaves
  // the stylesheet alone: the keyboard rule still sets the exit's duration and name.
  await browser.evaluate((css) => {
    const node = document.querySelector(css)!;
    const slow = new MutationObserver(() => {
      if (node.getAttribute('data-state') !== 'closed') return;
      for (const part of [node, node.previousElementSibling])
        for (const animation of part?.getAnimations() ?? []) animation.playbackRate = 0.1;
    });
    slow.observe(node, { attributes: true, attributeFilter: ['data-state'] });
    (window as unknown as { __e2eSlow: MutationObserver }).__e2eSlow = slow;
    return null;
  }, DRAWER);

  // A pointer press on the drawer's close button (fumadocs names it Open Sidebar) starts the exit.
  const box = await drawer.getByRole('button', 'Open Sidebar').boundingBox();
  await browser.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await browser.mouse.down();
  await browser.mouse.up();
  await expect
    .poll(
      () =>
        browser.evaluate((css) => {
          const node = document.querySelector(css)!;
          return {
            drawer: `${node.getAttribute('data-state')}${node.classList.contains('invisible') ? ' hidden' : ''}`,
            exits: [node, node.previousElementSibling]
              .flatMap((part) => part?.getAnimations() ?? [])
              .filter((animation) => animation instanceof CSSAnimation)
              .map((animation) => `${animation.animationName} ${animation.playState} x${animation.playbackRate}`)
              .sort(),
          };
        }, DRAWER),
      { message: 'the drawer and its backdrop before the key' },
    )
    .toEqual({ drawer: 'closed', exits: ['drawerFadeOut running x0.1', 'slideOutToLeft running x0.1'] });
  // A key pressed during the exit puts the focus ring in the drawer, which makes the exit instant (app/docs/styles.css).
  await browser.keyboard.press('Escape');
  await browser.evaluate(() => {
    (window as unknown as { __e2eSlow: MutationObserver }).__e2eSlow.disconnect();
    for (const animation of document.getAnimations()) animation.playbackRate = 1;
    return null;
  });

  // The exit still ends, so Radix Presence lets the drawer go: fumadocs hides it behind the left edge, and the backdrop
  // leaves the page.
  await expect(browser).toHaveClass(drawer, /\binvisible\b/);
  await expect
    .poll(() =>
      browser.evaluate((css) => Math.round(document.querySelector(css)!.getBoundingClientRect().right), DRAWER),
    )
    .toBeLessThanOrEqual(0);
  await expect(browser.locator('div.backdrop-blur-xs[data-state]')).toHaveCount(0);
});

test('a jump from On this page marks the target heading', async ({ app, screen, browser }) => {
  await app.open('/small-logo.png');
  await phoneOnly(browser, 'below 1280px On this page is a popover');
  await openAsReturningVisitor(app, browser, PAGE);
  await waitForHydration(browser, '#nd-tocnav button');
  const toc = browser.locator('#nd-tocnav');
  const target = screen.getByRole('heading', 'Faucet', { level: 2 });
  await expect(target).not.toHaveAttribute('data-bk-anchor-mark');

  await toc.getByRole('button').tap();
  await toc.getByRole('link', 'Faucet').tap();
  await expect(browser).toHaveURL(`${PAGE}#faucet`);
  // The list stays open over the heading after a pick; the mark starts once it closes.
  await toc.getByRole('button').tap();
  await expect(toc).toHaveAttribute('data-state', 'closed');
  await expect(target).toHaveAttribute('data-bk-anchor-mark', '');
  const wash = await browser.evaluate(() =>
    (document.getElementById('faucet')?.getAnimations() ?? []).map((animation) =>
      animation instanceof CSSAnimation ? animation.animationName : '',
    ),
  );
  expect(wash).toContain('bk-anchor-wash');
});

test('a code tab switch moves the underline under the chosen tab', async ({ app, browser }) => {
  await app.open('/small-logo.png');
  await phoneOnly(browser, 'the phone docs page; the desktop draws the same line');
  await openAsReturningVisitor(app, browser, PAGE);
  await waitForHydration(browser, '#nd-page article [role="tablist"]');
  // The page has five tab lists with the same two tabs; the first one is under test.
  const list = browser.locator('#nd-page article').getByRole('tablist').first();
  await list.scrollIntoView();
  await expect(list).toHaveAttribute('data-bk-tab-line', 'still');

  // The underline is the list's ::after, placed by transform: translateX(left) scaleX(width) of a 1px line.
  const line = () =>
    browser.evaluate(() => {
      const tabs = document.querySelector('#nd-page article [role="tablist"]')!;
      const active = tabs.querySelector(':scope > [role="tab"][data-state="active"]')!;
      const box = active.getBoundingClientRect();
      const listBox = tabs.getBoundingClientRect();
      const matrix = getComputedStyle(tabs, '::after')
        .transform.match(/matrix\(([^)]+)\)/)?.[1]
        .split(',');
      return {
        tab: active.textContent?.trim() ?? '',
        tabLeft: Math.round(box.left - listBox.left - tabs.clientLeft + tabs.scrollLeft),
        tabWidth: Math.round(box.width),
        lineLeft: matrix ? Math.round(Number(matrix[4])) : null,
        lineWidth: matrix ? Math.round(Number(matrix[0])) : null,
      };
    });
  const before = await line();
  expect(before.lineLeft).toBe(before.tabLeft);

  await browser.evaluate(() => {
    const runs: string[] = [];
    (window as unknown as { __e2eTabLine: string[] }).__e2eTabLine = runs;
    document.addEventListener(
      'transitionrun',
      (event) => {
        if ((event.target as Element).getAttribute('role') === 'tablist')
          runs.push(`${event.pseudoElement} ${event.propertyName}`);
      },
      true,
    );
    return null;
  });
  await list.getByRole('tab', 'Kubernetes').tap();
  await expect(list.getByRole('tab', 'Kubernetes')).toHaveAttribute('data-state', 'active');
  // The line travels (a transform transition on ::after) and ends under the chosen tab.
  await expect
    .poll(() => browser.evaluate(() => (window as unknown as { __e2eTabLine: string[] }).__e2eTabLine))
    .toContain('::after transform');
  await expect
    .poll(async () => {
      const now = await line();
      return now.lineLeft === now.tabLeft && now.lineWidth === now.tabWidth ? now.tab : `${JSON.stringify(now)}`;
    })
    .toBe('Kubernetes');
  expect((await line()).lineLeft).not.toBe(before.lineLeft);
});
