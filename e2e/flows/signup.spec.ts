import { test, expect, type Page } from '@playwright/test';

// Auth and account writes are mocked: exercise the real UI without creating
// users, sending email, contacting OAuth providers or accepting actual terms.
async function mockAuth(page: Page, newUser = true) {
  let user: Record<string, unknown> | null = null;
  await page.route('**/api/auth/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/providers')) {
      await route.fulfill({ json: {
        credentials: { id: 'credentials', type: 'credentials', name: 'Email' },
        google: { id: 'google', type: 'oauth', name: 'Google' },
        github: { id: 'github', type: 'oauth', name: 'GitHub' },
      } });
    } else if (path.endsWith('/csrf')) {
      await route.fulfill({ json: { csrfToken: 'test-csrf' } });
    } else if (path.endsWith('/callback/credentials')) {
      user = { id: newUser ? 'pending_signup@example.test' : 'returning-test-user', email: 'signup@example.test', is_new_user: newUser, custom_attributes: [] };
      await route.fulfill({ json: { url: new URL('/events/signup-test', route.request().url()).href } });
    } else if (path.endsWith('/session')) {
      await route.fulfill({ json: user ? { user, expires: '2099-01-01T00:00:00Z' } : {} });
    } else {
      await route.fulfill({ json: {} });
    }
  });
  await page.route('**/api/send-otp', (route) => route.fulfill({ json: { success: true } }));
  await page.route('**/api/user/create-after-terms', async (route) => {
    user = { ...user, id: 'signup-test-user', is_new_user: false };
    await route.fulfill({ json: { id: 'signup-test-user', referralAttributed: true } });
  });
  await page.route('**/api/profile/extended/signup-test-user', (route) => route.fulfill({ json: {} }));
  await page.route('**/events/signup-test*', (route) => route.fulfill({ contentType: 'text/html', body: '<h1>Signup callback reached</h1>' }));
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('cookie_consent', 'no'));
  await mockAuth(page);
});

test('signup captures referral and UTMs before OAuth and passes callback', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto('/signup?ref=TEAM1&utm_source=qr&callbackUrl=%2Fevents%2Fsignup-test');
  await expect(page.getByRole('heading', { name: 'Create your Builder Hub account' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('builderHubReferralAttribution') ?? 'null')?.referralCode)).toBe('TEAM1');
  const attribution = await page.evaluate(() => JSON.parse(localStorage.getItem('builderHubReferralAttribution')!));
  expect(attribution.landingPath).toContain('utm_source=qr');
  expect((await page.context().cookies()).some(cookie => cookie.name.includes('referral'))).toBeTruthy();
  await page.screenshot({ path: '/tmp/builders-hub-signup-light.png' });
  let oauthCallback = '';
  await page.route('**/api/auth/signin/google', async (route) => {
    oauthCallback = new URLSearchParams(route.request().postData() ?? '').get('callbackUrl') ?? '';
    await route.fulfill({ json: { url: new URL(oauthCallback, page.url()).href } });
  });
  await page.getByRole('button', { name: 'Google' }).click();
  await expect(page.getByRole('heading', { name: 'Signup callback reached' })).toBeVisible();
  expect(oauthCallback).toBe('/events/signup-test?ref=TEAM1&utm_source=qr');
});

for (const label of ['Log in', 'Sign up']) {
  test(`navbar ${label} keeps login on the current page`, async ({ page }) => {
    await page.goto('/signup');
    await page.getByRole('button', { name: label, exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('dialog').getByText('Sign in to your account')).toBeVisible();
    await expect(page).toHaveURL(/\/signup$/);
  });
}

test('mobile signup and menu retain the modal entry point', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/signup');
  await expect(page.getByRole('heading', { name: 'Create your Builder Hub account' })).toBeVisible();
  await page.screenshot({ path: '/tmp/builders-hub-signup-mobile.png' });
  await page.getByRole('button', { name: 'Toggle Menu' }).click();
  await page.getByRole('button', { name: 'Sign up', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page).toHaveURL(/\/signup$/);
});

test('signup artwork adapts to dark mode', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.addInitScript(() => localStorage.setItem('theme', 'dark'));
  await page.goto('/signup');
  await expect(page.locator('html')).toHaveClass(/dark/);
  await expect(page.getByRole('heading', { name: 'Create your Builder Hub account' })).toBeVisible();
  await page.screenshot({ path: '/tmp/builders-hub-signup-dark.png' });
});

test('home referral links still open the in-app modal', async ({ page }) => {
  await page.goto('/?ref=TEAM1');
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page).toHaveURL(/\/\?ref=TEAM1$/);
});

test('email signup completes Terms and optional Basic Setup before callback', async ({ page }) => {
  await page.goto('/signup?ref=TEAM1&callbackUrl=%2Fevents%2Fsignup-test');
  await page.getByRole('textbox', { name: 'Email address' }).fill('signup@example.test');
  await page.getByRole('button', { name: 'SEND VERIFICATION CODE' }).click();
  await expect(page.getByRole('heading', { name: 'Verify Your Email' })).toBeVisible();
  await page.locator('input[autocomplete="one-time-code"]').fill('123456');
  await page.getByRole('button', { name: 'Verify & Continue' }).click();
  const terms = page.getByRole('dialog', { name: 'Terms and Conditions' });
  await expect(terms).toBeVisible();
  await page.screenshot({ path: '/tmp/builders-hub-signup-terms.png' });
  await expect(page).toHaveURL(/\/signup\?/);
  await terms.getByRole('checkbox').first().check();
  const creation = page.waitForRequest('**/api/user/create-after-terms');
  await terms.getByRole('button', { name: 'Accept', exact: true }).click();
  expect((await creation).postDataJSON().referral_attribution.referralCode).toBe('TEAM1');
  const setup = page.getByRole('dialog', { name: 'Basic Profile Setup' });
  await expect(setup).toBeVisible();
  await page.screenshot({ path: '/tmp/builders-hub-signup-basic.png' });
  await expect(page).toHaveURL(/\/signup\?/);
  await setup.getByRole('button', { name: 'Skip for now' }).click();
  await expect(page.getByRole('heading', { name: 'Signup callback reached' })).toBeVisible();
  await expect(page).toHaveURL(/\/events\/signup-test\?ref=TEAM1$/);
});

test('returning email users go directly to their callback', async ({ page }) => {
  await mockAuth(page, false);
  await page.goto('/signup?callbackUrl=%2Fevents%2Fsignup-test');
  await page.getByRole('textbox', { name: 'Email address' }).fill('signup@example.test');
  await page.getByRole('button', { name: 'SEND VERIFICATION CODE' }).click();
  await page.locator('input[autocomplete="one-time-code"]').fill('123456');
  await page.getByRole('button', { name: 'Verify & Continue' }).click();
  await expect(page.getByRole('heading', { name: 'Signup callback reached' })).toBeVisible();
});
