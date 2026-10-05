import { fileURLToPath } from 'node:url';
import { test, type Browser } from '@e2e-dev/web';
import { expect, type Screen } from 'e2e';
import { waitForHydration } from '../lib/hydration';
import { RETURNING_USER_ID, TEST_EMAIL, fakeAuth, type FakeAnswers } from '../lib/fake-auth';
import { ACADEMY_DONE, ACADEMY_TOTAL, profileAnswers } from '../lib/fake-profile';
import { NAVIGATION_TIMEOUT, openAsReturningVisitor } from './helpers';

// The profile (app/(home)/profile, components/profile) for a signed-in user, against the fake auth backend and the
// fake profile answers in lib/fake-profile.ts. It reads and writes no database.
// Desktop shows the sections as a side list; a phone shows them as a row of tabs under the name. Both are a navigation
// landmark named "Profile sections", and only one shows at each size.

const SECTIONS: Array<{ link: string; heading: string; tab: string | null }> = [
  { link: 'Personal info', heading: 'Personal info', tab: null },
  { link: 'Connected accounts', heading: 'Connected accounts', tab: 'accounts' },
  { link: 'Referrals', heading: 'Referrals', tab: 'referrals' },
  { link: 'Settings', heading: 'Settings', tab: 'settings' },
  { link: 'Projects', heading: 'Projects', tab: 'projects' },
  { link: 'Achievements', heading: 'Achievements', tab: 'achievements' },
  { link: 'Console history', heading: 'Console history', tab: 'console' },
  { link: 'Query', heading: 'Query', tab: 'query' },
];

async function openProfile(
  app: Parameters<typeof fakeAuth>[0],
  browser: Browser,
  path = '/profile',
  extra: FakeAnswers = {},
) {
  const auth = await fakeAuth(app, browser, {
    newUser: false,
    signedIn: true,
    answers: { ...profileAnswers(RETURNING_USER_ID, TEST_EMAIL), ...extra },
  });
  await openAsReturningVisitor(app, browser, path);
  return auth;
}

function sectionLink(screen: Screen, name: string) {
  return screen.getByRole('navigation', 'Profile sections').getByRole('link', new RegExp(`^${name}`));
}

test('the profile opens each section from its list', { timeout: 240_000 }, async ({ app, screen, browser }) => {
  const auth = await openProfile(app, browser);
  await expect(screen.getByRole('heading', 'Personal info')).toBeVisible({ timeout: NAVIGATION_TIMEOUT });
  await waitForHydration(browser, '#section-title');
  for (const section of SECTIONS) {
    await sectionLink(screen, section.link).tap();
    await expect(screen.getByRole('heading', section.heading)).toBeVisible();
    await expect(browser).toHaveURL(section.tab ? `/profile?tab=${section.tab}` : '/profile');
    await expect(sectionLink(screen, section.link)).toHaveAttribute('aria-current', 'page');
  }
  // Back returns to the section before.
  await browser.back();
  await expect(screen.getByRole('heading', 'Console history')).toBeVisible();
  expect(auth.unanswered, 'API writes with no fake answer').toEqual([]);
});

test('a ?tab= link opens its section, and Achievements shows one Academy group', async ({ app, screen, browser }) => {
  const auth = await openProfile(app, browser, '/profile?tab=achievements');
  await expect(screen.getByRole('heading', 'Achievements')).toBeVisible({ timeout: NAVIGATION_TIMEOUT });
  await expect(screen.getByRole('heading', 'Academy')).toBeVisible();
  await expect(screen.getByRole('heading', 'Hackathons')).toBeVisible();
  await expect(screen.getByRole('progressbar', /Academy/)).toHaveAttribute('aria-valuenow', String(ACADEMY_DONE));
  await expect(screen.getByText(`${ACADEMY_DONE} of ${ACADEMY_TOTAL} courses`)).toBeVisible();
  // The old split groups are gone.
  await expect(screen.getByText(/Blockchain Academy Badges|Avalanche L1 Academy Badges|Other Badges/)).toHaveCount(0);
  expect(auth.unanswered, 'API writes with no fake answer').toEqual([]);
});

test('Console history and Query list what the user did', async ({ app, screen, browser }) => {
  await openProfile(app, browser, '/profile?tab=console');
  await expect(screen.getByRole('heading', 'Console history')).toBeVisible({ timeout: NAVIGATION_TIMEOUT });
  await expect(screen.getByText('Chain created')).toBeVisible();
  await waitForHydration(browser, '#section-title');
  await sectionLink(screen, 'Query').tap();
  await expect(screen.getByRole('heading', 'Query')).toBeVisible();
  await expect(screen.getByRole('link', /^C-Chain fees/)).toHaveAttribute(
    'href',
    '/explorer/mainnet/c-chain/query/boards/pg-board',
  );
  // No label on the page says Playground.
  await expect(screen.getByText(/Playground/)).toHaveCount(0);
});

test('a save that does not validate says so and keeps the edit', async ({ app, screen, browser }) => {
  await openProfile(app, browser);
  const name = screen.getByRole('textbox', 'Full name');
  await expect(name).toHaveValue('Test Builder', { timeout: NAVIGATION_TIMEOUT });
  await waitForHydration(browser, '#pr-name');
  await name.fill('');
  // The save bar shows only while the form has edits.
  const bar = screen.getByRole('region', 'Unsaved changes');
  await expect(bar).toBeVisible();
  await bar.getByRole('button', 'Save').tap();
  await expect(screen.getByText('Enter your full name.')).toBeVisible();
  await expect(bar).toBeVisible();
  await bar.getByRole('button', 'Discard').tap();
  await expect(name).toHaveValue('Test Builder');
  await expect(screen.getByRole('region', 'Unsaved changes')).toHaveCount(0);
});

test('a failed save opens the section of the field to fix', async ({ app, screen, browser }) => {
  await openProfile(app, browser, '/profile?tab=accounts');
  const telegram = screen.getByRole('textbox', 'Telegram');
  await expect(telegram).toBeVisible({ timeout: NAVIGATION_TIMEOUT });
  await waitForHydration(browser, '#pr-telegram');
  await telegram.fill('ab');
  // The save starts from another section: the page must go back to the field.
  await sectionLink(screen, 'Personal info').tap();
  await screen.getByRole('textbox', 'Full name').fill('Test Builder Two');
  await screen.getByRole('region', 'Unsaved changes').getByRole('button', 'Save').tap();
  await expect(browser).toHaveURL('/profile?tab=accounts');
  await expect(screen.getByRole('textbox', 'Telegram')).toBeFocused();
  await expect(
    screen.getByText('Enter a Telegram username of 5 to 32 characters that starts with a letter.'),
  ).toBeVisible();
});

test('a link off the profile asks before it drops unsaved edits', async ({ app, screen, browser }) => {
  await openProfile(app, browser);
  const bio = screen.getByRole('textbox', 'Bio');
  await expect(bio).toBeVisible({ timeout: NAVIGATION_TIMEOUT });
  await waitForHydration(browser, '#pr-bio');
  await bio.fill('I build L1s for payments and games.');
  // A section link keeps the edit and does not ask.
  await sectionLink(screen, 'Query').tap();
  const asked: string[] = [];
  await browser.onDialog(async (dialog) => {
    asked.push(dialog.message);
    await dialog.dismiss();
  });
  await screen.getByRole('link', /^C-Chain fees/).tap();
  await expect.poll(() => asked).toEqual(['Leave this page? Your changes are not saved.']);
  await expect(browser).toHaveURL('/profile?tab=query');
  await sectionLink(screen, 'Personal info').tap();
  await expect(screen.getByRole('textbox', 'Bio')).toHaveValue('I build L1s for payments and games.');
});

test('a photo uploads and is removed at once, and a GIF is refused before any upload', async ({
  app,
  screen,
  browser,
}) => {
  // the server re-encodes the photo; the fake answers with the stored URL
  const auth = await openProfile(app, browser, '/profile', {
    'POST /api/profile/photo': { image: '/small-logo.png' },
    'DELETE /api/profile/photo': { image: '' },
  });
  const upload = screen.getByRole('button', 'Upload photo');
  await expect(upload).toBeVisible({ timeout: NAVIGATION_TIMEOUT });
  await waitForHydration(browser, '#pr-photo');
  const input = browser.locator('#pr-photo');

  await input.setInputFiles(fileURLToPath(new URL('./fixtures/photo.gif', import.meta.url)));
  await expect(screen.getByText('Choose a PNG or JPG file of 4 MB or less.')).toBeVisible();

  await input.setInputFiles(fileURLToPath(new URL('./fixtures/photo.png', import.meta.url)));
  await expect(screen.getByText('Photo saved')).toBeVisible();
  await expect(screen.getByRole('button', 'Change photo')).toBeVisible();
  // the photo saves at once: it leaves no edit for the save bar
  await expect(screen.getByRole('region', 'Unsaved changes')).toHaveCount(0);

  await screen.getByRole('button', 'Remove').tap();
  await expect(screen.getByText('Photo removed')).toBeVisible();
  await expect(screen.getByRole('button', 'Upload photo')).toBeVisible();
  expect(auth.unanswered, 'API writes with no fake answer').toEqual([]);
});

test('a signed-out visitor gets the sign-in dialog, not the profile', async ({ app, screen, browser }) => {
  await fakeAuth(app, browser, { newUser: false });
  await openAsReturningVisitor(app, browser, '/profile');
  // components/login/AutoLoginModalTrigger.tsx opens the dialog on a protected path. The page under it shows only a
  // sign-in prompt: no section, no data.
  await expect(screen.getByRole('dialog').getByRole('heading', 'Sign in to your account')).toBeVisible({
    timeout: NAVIGATION_TIMEOUT,
  });
  await expect(browser.locator('#section-title')).toHaveCount(0);
});
