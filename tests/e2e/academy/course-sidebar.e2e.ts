import { test } from '@e2e-dev/web';
import { expect } from 'e2e';
import { desktopOnly } from '../lib/skip';
import { NAVIGATION_TIMEOUT, TWO_ROUTE_TIMEOUT, openAsReturningVisitor } from '../site/helpers';
import { expectSamePage, expectSidebarOf, markPage, openSidebar, sidebarCourse, sidebarCourses } from './sidebar';

const NAVIGATION = { timeout: NAVIGATION_TIMEOUT };

// Every course page opens with a sidebar of that course only.
for (const course of sidebarCourses()) {
  test(`${course.path} sidebar lists the course`, async ({ app, screen, browser }) => {
    await openAsReturningVisitor(app, browser, course.path);
    await expectSidebarOf(await openSidebar(screen, browser), browser, sidebarCourse(course.path));
  });
}

// The part bar moves between the two tracks without a page load. The sidebar must then list the new course.
const MOVES = [
  {
    from: '/academy/avalanche-l1/avalanche-fundamentals',
    part: 'Applications',
    to: '/academy/blockchain/solidity-foundry',
  },
  {
    from: '/academy/avalanche-l1/avalanche-fundamentals',
    part: 'Fundamentals',
    to: '/academy/blockchain/blockchain-fundamentals',
  },
  {
    from: '/academy/blockchain/solidity-foundry',
    part: 'L1 Development',
    to: '/academy/avalanche-l1/permissioned-l1s',
  },
];

for (const { from, part, to } of MOVES) {
  test(
    `${part} in the part bar moves from ${from} to the sidebar of ${to}`,
    { timeout: TWO_ROUTE_TIMEOUT },
    async ({ app, screen, browser }) => {
      await openAsReturningVisitor(app, browser, from);
      await markPage(browser);
      await screen.getByRole('navigation', 'Academy parts').getByRole('link', part).tap();
      await expect(browser).toHaveURL(to, NAVIGATION);
      await expectSamePage(browser);
      await expectSidebarOf(await openSidebar(screen, browser), browser, sidebarCourse(to));
    },
  );
}

// On desktop, a part's hover card lists its courses. A course there is a client move too.
test(
  'a course in the Applications hover card opens with its own sidebar',
  { timeout: TWO_ROUTE_TIMEOUT },
  async ({ app, screen, browser }) => {
    await openAsReturningVisitor(app, browser, '/academy/avalanche-l1/interchain-messaging');
    await desktopOnly(browser, 'below 768 px the part bar has no hover cards');
    await markPage(browser);
    await screen.getByRole('navigation', 'Academy parts').getByRole('link', 'Applications').hover();
    await screen.getByRole('link', /^Encrypted ERC /).tap();
    await expect(browser).toHaveURL('/academy/blockchain/encrypted-erc', NAVIGATION);
    await expectSamePage(browser);
    await expectSidebarOf(
      await openSidebar(screen, browser),
      browser,
      sidebarCourse('/academy/blockchain/encrypted-erc'),
    );
  },
);
