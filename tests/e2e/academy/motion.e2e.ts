import { test } from '@e2e-dev/web';
import type { Browser } from '@e2e-dev/web';
import { expect } from 'e2e';
import { desktopOnly } from '../lib/skip';
import { waitForHydration } from '../lib/hydration';
import { openAsReturningVisitor } from '../site/helpers';

// acad-view-switch (components/academy/landing/view-toggle.tsx, components/academy/theme/academy-tokens.css): the
// Academy overview's Overview, Tree and Stages links stay mounted through a view change, so the keyboard focus stays on
// the toggle, and one red rule (the list's ::after) slides to the chosen view. The path card tests are in
// learning-path.e2e.ts.

/** The rule and the current view's link, in the list's coordinates; the rule's transform is "none" at rest. */
function readToggle(browser: Browser) {
  return browser.evaluate(() => {
    const list = document.querySelector('[data-view-switch="academy"]');
    const current = list?.querySelector('a[aria-current="page"]');
    if (!list || !current) return null;
    const rule = getComputedStyle(list, '::after');
    const listBox = list.getBoundingClientRect();
    const box = current.getBoundingClientRect();
    return {
      current: current.textContent?.trim() ?? '',
      focused: list.contains(document.activeElement) ? (document.activeElement?.textContent?.trim() ?? '') : null,
      link: { left: Math.round(box.left - listBox.left), width: Math.round(box.width) },
      rule: {
        left: Math.round(parseFloat(rule.left)),
        width: Math.round(parseFloat(rule.width)),
        transform: rule.transform,
      },
    };
  });
}

test('switching Overview, Tree and Stages keeps the focus on the toggle, with the rule under the chosen view', async ({
  app,
  screen,
  browser,
}) => {
  await openAsReturningVisitor(app, browser, '/academy');
  await desktopOnly(browser, 'the toggle is checked at the desktop size');
  const views = screen.getByRole('navigation', 'Course views');
  await waitForHydration(browser, '[data-view-switch="academy"] a');
  await views.getByRole('link', 'Overview').focus();

  // Tab to the next view and press Enter, then back with Shift+Tab: each view in turn, from the keyboard.
  for (const [keys, view, search] of [
    [['Tab'], 'Tree', '?view=tree'],
    [['Tab'], 'Stages', '?view=stages'],
    [['Shift+Tab', 'Shift+Tab'], 'Overview', ''],
  ] as const) {
    for (const key of keys) await browser.keyboard.press(key);
    await expect(views.getByRole('link', view)).toBeFocused();
    await browser.keyboard.press('Enter');
    await expect(views.getByRole('link', view)).toHaveAttribute('aria-current', 'page');
    await expect.poll(() => browser.evaluate(() => location.search)).toBe(search);
    // The rule slides for 250ms; at rest it sits on the chosen link's box.
    await expect
      .poll(async () => {
        const toggle = await readToggle(browser);
        if (!toggle || toggle.rule.transform !== 'none') return null;
        return toggle.rule.left === toggle.link.left && toggle.rule.width === toggle.link.width ? toggle.current : null;
      })
      .toBe(view);
    // The view changed under the keyboard focus, which stayed on the link that was pressed.
    expect((await readToggle(browser))?.focused, `the focus after opening ${view}`).toBe(view);
    await expect(views.getByRole('link', view)).toBeFocused();
  }
});
