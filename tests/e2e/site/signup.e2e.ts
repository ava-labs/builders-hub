import { test, type Browser } from '@e2e-dev/web';
import { expect, type Locator, type Screen } from 'e2e';
import { waitForHydration } from '../lib/hydration';
import { isPhoneLayout } from '../lib/skip';
import {
  CALLBACK_HEADING,
  CALLBACK_PATH,
  TEAM1_HEADING,
  TEST_EMAIL,
  TEST_OTP,
  fakeAuth,
  type ReferralAttribution,
} from '../lib/fake-auth';
import { NAVIGATION_TIMEOUT, openAsReturningVisitor } from './helpers';

// The /signup page (app/(home)/signup/page.tsx), the /login page and the login dialog, against the fake auth
// backend in lib/fake-auth.ts. No test creates an account or sends an email.

const SIGNUP_HEADING = 'Create your Builder Hub account';
const SIGNIN_HEADING = 'Sign in to your account';

// lib/referrals/client.ts keeps the referral in localStorage and in a cookie, so it survives an OAuth round trip.
const REFERRAL_STORAGE_KEY = 'builderHubReferralAttribution';
const REFERRAL_COOKIE = 'bh_referral';

// Each social button holds an image and a hidden label with the same word, so its name has the word twice.
const PROVIDER_BUTTONS = [
  { provider: 'google', name: /^Google\b/ },
  { provider: 'github', name: /^GitHub\b/ },
];

// The email field of the login form. The footer's newsletter field has no name attribute.
const LOGIN_EMAIL_FIELD = 'input[name="email"]';

function signupPath(params: Record<string, string>): string {
  return `/signup?${new URLSearchParams(params)}`;
}

async function storedReferral(browser: Browser): Promise<ReferralAttribution | null> {
  return browser.evaluate(
    (key) => JSON.parse(localStorage.getItem(key) ?? 'null') as { referralCode?: string; landingPath?: string } | null,
    REFERRAL_STORAGE_KEY,
  );
}

// Opens the navbar's account buttons and returns the area that holds them.
// Desktop: the buttons are in the navbar. Phone: they are at the top of the menu sheet.
async function accountButtons(screen: Screen, browser: Browser): Promise<Locator> {
  await waitForHydration(browser, '#nd-nav');
  if (!(await isPhoneLayout(browser))) return browser.locator('#nd-nav');
  await screen.getByRole('button', 'Toggle Menu').tap();
  // The phone sheet is a custom component (components/navigation/navbar-dropdown.tsx).
  return browser.locator('[data-navbar-dropdown]');
}

// Sends the email and the one-time code through the login form of the page.
async function signInWithEmail(screen: Screen, browser: Browser): Promise<void> {
  await waitForHydration(browser, LOGIN_EMAIL_FIELD);
  await screen.getByRole('textbox', 'Email address').fill(TEST_EMAIL);
  await screen.getByRole('button', 'SEND VERIFICATION CODE').tap();
  await expect(screen.getByRole('heading', 'Verify Your Email')).toBeVisible();
  // The code field (components/ui/input-otp) has no label, so find it by its autocomplete hint.
  await browser.locator('input[autocomplete="one-time-code"]').fill(TEST_OTP);
  await screen.getByRole('button', 'Verify & Continue').tap();
}

for (const { provider, name } of PROVIDER_BUTTONS) {
  test(`signup stores the referral and sends it with the UTM tags to ${provider} sign-in`, async ({
    app,
    screen,
    browser,
  }) => {
    const auth = await fakeAuth(app, browser);
    const path = signupPath({ ref: 'TEAM1', utm_source: 'qr', callbackUrl: CALLBACK_PATH });
    await openAsReturningVisitor(app, browser, path);
    await expect(screen.getByRole('heading', SIGNUP_HEADING)).toBeVisible();

    // FormLoginWrapper stores the referral when it mounts, before a social sign-in leaves the site.
    await expect.poll(async () => (await storedReferral(browser))?.referralCode).toBe('TEAM1');
    expect((await storedReferral(browser))?.landingPath).toBe(path);
    const cookie = (await browser.cookies()).find((entry) => entry.name === REFERRAL_COOKIE);
    expect(cookie, `the ${REFERRAL_COOKIE} cookie`).toBeDefined();
    expect(JSON.parse(decodeURIComponent(cookie!.value)).referralCode).toBe('TEAM1');

    await screen.getByRole('button', name).tap();
    await expect(screen.getByRole('heading', CALLBACK_HEADING)).toBeVisible();
    // The page adds the referral and UTM tags of its own URL to the callback.
    expect(auth.social[provider]).toBe(`${CALLBACK_PATH}?ref=TEAM1&utm_source=qr`);
    await expect(browser).toHaveURL(`${CALLBACK_PATH}?ref=TEAM1&utm_source=qr`);
    expect(auth.unanswered, 'API writes with no fake answer').toEqual([]);
  });
}

for (const { label, heading } of [
  { label: 'Log in', heading: SIGNIN_HEADING },
  { label: 'Sign up', heading: SIGNUP_HEADING },
]) {
  test(`navbar ${label} opens the matching login dialog and keeps the page`, async ({ app, screen, browser }) => {
    const auth = await fakeAuth(app, browser);
    await openAsReturningVisitor(app, browser, '/signup');
    const buttons = await accountButtons(screen, browser);
    await buttons.getByRole('button', label).tap();
    const dialog = screen.getByRole('dialog');
    await expect(dialog.getByRole('heading', heading)).toBeVisible();
    await expect(browser).toHaveURL('/signup');
    expect(auth.unanswered, 'API writes with no fake answer').toEqual([]);
  });
}

test('signup in a normal browser shows no in-app browser warning', async ({ app, screen, browser }) => {
  await openAsReturningVisitor(app, browser, '/signup?ref=TEAM1');
  await waitForHydration(browser, LOGIN_EMAIL_FIELD);
  await expect(screen.getByRole('button', PROVIDER_BUTTONS[0].name)).toBeVisible();
  // The warning (components/login/EmbeddedBrowserWarning.tsx) shows after hydration for in-app user agents only.
  // webview/ runs the in-app case.
  await expect(screen.getByText(/^Opening from /)).toBeHidden();
});

for (const authPage of ['login', 'signup']) {
  test(`${authPage} keeps an absolute same-site Team1 OAuth callback`, async ({ app, screen, browser }) => {
    const auth = await fakeAuth(app, browser);
    const callbackPath =
      '/api/oauth/authorize?client_id=team1&redirect_uri=https%3A%2F%2Fdao.team1.network%2Fcallback&state=original-state';
    const callback = new URL(callbackPath, app.baseUrl).href;
    await openAsReturningVisitor(
      app,
      browser,
      `/${authPage}?${new URLSearchParams({ callbackUrl: callback, ref: 'TEAM1', utm_source: 'qr' })}`,
    );
    await waitForHydration(browser, LOGIN_EMAIL_FIELD);
    await screen.getByRole('button', PROVIDER_BUTTONS[0].name).tap();
    await expect(screen.getByRole('heading', TEAM1_HEADING)).toBeVisible();

    // The OAuth request comes back whole. Only the signup page adds its referral and UTM tags.
    const resumed = new URL(await browser.url());
    expect(resumed.pathname).toBe('/api/oauth/authorize');
    expect(resumed.searchParams.get('client_id')).toBe('team1');
    expect(resumed.searchParams.get('redirect_uri')).toBe('https://dao.team1.network/callback');
    expect(resumed.searchParams.get('state')).toBe('original-state');
    expect(auth.social.google).toBe(`${callbackPath}${authPage === 'signup' ? '&ref=TEAM1&utm_source=qr' : ''}`);
    expect(auth.unanswered, 'API writes with no fake answer').toEqual([]);
  });
}

// The artwork beside the form is an SVG in currentColor (components/login/LoginArtwork.tsx). It must stand out
// from the page in both themes. The phone layout has no artwork: FormLogin shows it from the lg breakpoint.
for (const theme of ['light', 'dark'] as const) {
  test(`signup artwork stands out from the page in the ${theme} theme`, async ({ app, screen, browser }) => {
    await openAsReturningVisitor(app, browser, '/signup', { theme });
    await expect(browser).toHaveClass(browser.locator('html'), new RegExp(`\\b${theme}\\b`));
    await expect(screen.getByRole('heading', SIGNUP_HEADING)).toBeVisible();
    // The artwork is aria-hidden, and the engine counts an aria-hidden node as hidden. So the page measures it:
    // whether it is drawn, and the WCAG 2 contrast of its color against the first opaque background behind it.
    // A canvas turns any CSS color (the site uses lab() and oklch()) into sRGB.
    const artwork = await browser.evaluate(() => {
      const svg = document.querySelector('svg[viewBox="0 0 559 685"]');
      const context = document.createElement('canvas').getContext('2d');
      if (!svg || !context) return { drawn: false, contrast: 0 };
      const box = svg.getBoundingClientRect();
      const drawn = svg.checkVisibility({ opacityProperty: true, visibilityProperty: true }) && box.width > 0;
      const rgb = (color: string): number[] => {
        context.clearRect(0, 0, 1, 1);
        context.fillStyle = color;
        context.fillRect(0, 0, 1, 1);
        return [...context.getImageData(0, 0, 1, 1).data];
      };
      const luminance = ([r, g, b]: number[]): number => {
        const [R, G, B] = [r, g, b].map((v) =>
          v / 255 <= 0.04045 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4,
        );
        return 0.2126 * R + 0.7152 * G + 0.0722 * B;
      };
      let background = 'rgb(255, 255, 255)';
      for (let node: Element | null = svg; node; node = node.parentElement) {
        const color = getComputedStyle(node).backgroundColor;
        if (rgb(color)[3] === 255) {
          background = color;
          break;
        }
      }
      const [light, dark] = [luminance(rgb(getComputedStyle(svg).color)), luminance(rgb(background))].sort(
        (a, b) => b - a,
      );
      return { drawn, contrast: (light + 0.05) / (dark + 0.05) };
    });
    if (await isPhoneLayout(browser)) {
      expect(artwork.drawn, 'artwork on the phone layout').toBe(false);
      return;
    }
    expect(artwork.drawn, 'artwork on the desktop layout').toBe(true);
    // The check reads the base color, not the opacity of each line. 3:1 is the WCAG 2 floor for graphics.
    expect(artwork.contrast).toBeGreaterThanOrEqual(3);
  });
}

test('a referral link to the home page opens the login dialog in place', async ({ app, screen, browser }) => {
  const auth = await fakeAuth(app, browser);
  await openAsReturningVisitor(app, browser, '/?ref=TEAM1');
  // components/login/AutoLoginModalTrigger.tsx opens the dialog for a signed-out visitor with a referral.
  await expect(screen.getByRole('dialog').getByRole('heading', SIGNIN_HEADING)).toBeVisible();
  await expect(browser).toHaveURL('/?ref=TEAM1');
  expect((await storedReferral(browser))?.referralCode).toBe('TEAM1');
  expect(auth.unanswered, 'API writes with no fake answer').toEqual([]);
});

test('email signup goes through Terms, then straight to the callback', async ({ app, screen, browser }) => {
  const auth = await fakeAuth(app, browser);
  await openAsReturningVisitor(app, browser, signupPath({ ref: 'TEAM1', callbackUrl: CALLBACK_PATH }));
  await signInWithEmail(screen, browser);
  expect(auth.otpEmail).toBe(TEST_EMAIL);

  // A new user accepts Terms on the signup page. The callback waits.
  const terms = screen.getByRole('dialog', 'Terms and Conditions');
  await expect(terms).toBeVisible();
  expect(auth.credentials).toEqual({ otp: TEST_OTP, callbackUrl: `${CALLBACK_PATH}?ref=TEAM1` });
  await expect(browser).toHaveURL(/\/signup\?/);
  const accept = terms.getByRole('button', 'Accept');
  await expect(accept).toBeDisabled();
  await terms.getByRole('checkbox', /^I have read and agree to the Avalanche Privacy Policy/).check();
  await accept.tap();

  // Terms creates the account with the referral of the signup link. No dialog asks for more: the user lands on the
  // callback, and the profile page holds every optional field.
  await expect(screen.getByRole('heading', CALLBACK_HEADING)).toBeVisible();
  await expect(browser).toHaveURL(`${CALLBACK_PATH}?ref=TEAM1`);
  // The fake serves the callback as a static page with no app (lib/fake-auth.ts), so no dialog can open on it and
  // this check always passes. The heading and URL checks are the guard: a dialog that holds the user on /signup fails
  // them. The next test checks for a dialog on a real site page.
  await expect(screen.getByRole('dialog')).toHaveCount(0);
  expect(auth.createdUserReferral?.referralCode).toBe('TEAM1');
  expect(auth.unanswered, 'API writes with no fake answer').toEqual([]);
});

test('email signup lands on a real site page with no dialog', async ({ app, screen, browser }) => {
  const auth = await fakeAuth(app, browser);
  // /grants is in the (home) group, which mounts the login dialogs (components/login/LoginModalWrapper.tsx).
  await openAsReturningVisitor(app, browser, signupPath({ callbackUrl: '/grants' }));
  await signInWithEmail(screen, browser);
  const terms = screen.getByRole('dialog', 'Terms and Conditions');
  await terms.getByRole('checkbox', /^I have read and agree to the Avalanche Privacy Policy/).check();
  await terms.getByRole('button', 'Accept').tap();

  // The site renders the callback page, so a dialog or a redirect that starts on the page after signup shows here.
  await expect(browser).toHaveURL(/\/grants(\?|#|$)/, { timeout: NAVIGATION_TIMEOUT });
  await waitForHydration(browser, '#nd-nav');
  // A dialog can open after a later session read, so watch the page for a while, not once.
  const sawDialog = await browser.evaluate(
    () =>
      new Promise<boolean>((resolve) => {
        const open = () => document.querySelector('[role="dialog"]') !== null;
        if (open()) return resolve(true);
        const observer = new MutationObserver(() => {
          if (!open()) return;
          observer.disconnect();
          resolve(true);
        });
        observer.observe(document.body, { childList: true, subtree: true });
        setTimeout(() => {
          observer.disconnect();
          resolve(false);
        }, 3_000);
      }),
  );
  expect(sawDialog, 'a dialog opened after signup').toBe(false);
  await expect(screen.getByRole('dialog')).toHaveCount(0);
  expect(auth.unanswered, 'API writes with no fake answer').toEqual([]);
});

test('a returning email user goes straight to the callback', async ({ app, screen, browser }) => {
  const auth = await fakeAuth(app, browser, { newUser: false });
  await openAsReturningVisitor(app, browser, signupPath({ callbackUrl: CALLBACK_PATH }));
  await signInWithEmail(screen, browser);
  await expect(screen.getByRole('heading', CALLBACK_HEADING)).toBeVisible();
  await expect(browser).toHaveURL(CALLBACK_PATH);
  // No Terms step, so no new account.
  expect(auth.createdUserReferral).toBeUndefined();
  expect(auth.unanswered, 'API writes with no fake answer').toEqual([]);
});
