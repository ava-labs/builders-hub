import { test } from '@e2e-dev/web';
import { expect } from 'e2e';
import { needsModel, phoneOnly } from '../lib/skip';
import { waitForHydration } from '../lib/hydration';
import { openAsReturningVisitor, openSiteMenu } from '../site/helpers';
import { SCREENSHOT_ONLY, VISUAL, waitForStillScreen } from './visual';

// Desktop has no menu button. Its menus open on hover and site/navbar.e2e.ts tests them.
test('phone menu lists its links without clipped or overlapping text', VISUAL, async (fixtures) => {
  needsModel();
  const { app, agent, browser, screen } = fixtures;
  await openAsReturningVisitor(app, browser, '/');
  await phoneOnly(browser);
  await waitForHydration(browser, '#nd-nav');
  const menu = await openSiteMenu(screen, browser, 'Solutions');
  await expect(menu.getByRole('link', /^Why Avalanche\b/)).toBeVisible();
  await waitForStillScreen(browser);
  await agent.assert(
    [
      'The screenshot shows an open navigation menu. Each section has a small title, red picture cards with a label under each card, and some sections have short text links in a column beside their card.',
      'No link text is cut off at the left or right edge of the screen, and no link text overlaps another link or a picture.',
      'The page behind the menu does not show through the menu or cover any part of it.',
      // components/navigation/navbar-dropdown.tsx:80 ends the menu above the bottom of the screen and scrolls it.
      'The menu box ends above the bottom of the screen and scrolls, so sections that continue below its bottom edge are normal.',
    ].join(' '),
    SCREENSHOT_ONLY,
  );
});
