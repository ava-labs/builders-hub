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
      const callback = new URLSearchParams(route.request().postData() ?? '').get('callbackUrl') ?? '/events/signup-test';
      await route.fulfill({ json: { url: new URL(callback, route.request().url()).href } });
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
    await expect(page.getByRole('dialog').getByRole('heading', { name: label === 'Sign up' ? 'Create your Builder Hub account' : 'Sign in to your account' })).toBeVisible();
    await expect(page).toHaveURL(/\/signup$/);
  });
}

for (const label of ['Log in', 'Sign up']) {
  test(`mobile ${label} opens the matching modal`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/signup');
    await expect(page.getByRole('heading', { name: 'Create your Builder Hub account' })).toBeVisible();
    await page.screenshot({ path: '/tmp/builders-hub-signup-mobile.png' });
    await page.getByRole('button', { name: 'Toggle Menu' }).click();
    await page.getByRole('button', { name: label, exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('dialog').getByRole('heading', { name: label === 'Sign up' ? 'Create your Builder Hub account' : 'Sign in to your account' })).toBeVisible();
    await expect(page).toHaveURL(/\/signup$/);
  });
}

for (const browserName of ['Instagram', 'LinkedIn']) {
  test.describe(`${browserName} webview`, () => {
    test.use({ userAgent: `Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 ${browserName === 'LinkedIn' ? 'LinkedInApp' : 'Instagram'}` });
    test('signup shows the existing external-browser warning above social login', async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto('/signup?ref=TEAM1');
      const warning = page.getByText(`Opening from ${browserName}`);
      await expect(warning).toBeVisible();
      await expect(page.getByRole('button', { name: 'Open in Browser' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Google' })).toBeVisible();
      const warningBox = await warning.boundingBox();
      const googleBox = await page.getByRole('button', { name: 'Google' }).boundingBox();
      expect(warningBox!.y).toBeLessThan(googleBox!.y);
    });
  });
}

for (const authPage of ['login', 'signup']) {
  test(`${authPage} preserves an absolute same-origin Team1 OAuth callback`, async ({ page, baseURL }) => {
    const callbackPath = '/api/oauth/authorize?client_id=team1&redirect_uri=https%3A%2F%2Fdao.team1.network%2Fcallback&state=original-state';
    const callback = new URL(callbackPath, baseURL).href;
    await page.route('**/api/oauth/authorize*', (route) => route.fulfill({ contentType: 'text/html', body: '<h1>Team1 authorize resumed</h1>' }));
    let oauthCallback = '';
    await page.route('**/api/auth/signin/google', async (route) => {
      oauthCallback = new URLSearchParams(route.request().postData() ?? '').get('callbackUrl') ?? '';
      await route.fulfill({ json: { url: new URL(oauthCallback, page.url()).href } });
    });
    await page.goto(`/${authPage}?${new URLSearchParams({ callbackUrl: callback, ref: 'TEAM1', utm_source: 'qr' })}`);
    await page.getByRole('button', { name: 'Google' }).click();
    await expect(page.getByRole('heading', { name: 'Team1 authorize resumed' })).toBeVisible();
    const finalUrl = new URL(page.url());
    expect(finalUrl.searchParams.get('client_id')).toBe('team1');
    expect(finalUrl.searchParams.get('state')).toBe('original-state');
    expect(finalUrl.searchParams.get('redirect_uri')).toBe('https://dao.team1.network/callback');
    expect(oauthCallback).toBe(`${callbackPath}${authPage === 'signup' ? '&ref=TEAM1&utm_source=qr' : ''}`);
  });
}

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
