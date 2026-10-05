import type { Browser, WebRoute } from '@e2e-dev/web';
import type { App } from 'e2e';

// The tests that sign in or sign up drive the real login UI against this fake backend. The fake answers the NextAuth
// reads and each write of the login flow. Other reads go to the site. No write reaches NextAuth, the database, the
// email service or an OAuth provider. So a run on a preview or on production creates no account and sends no email.
// The fake aborts an API write that it has no answer for, and records it in `unanswered`. Each test ends with a
// check that `unanswered` is empty.

export const TEST_EMAIL = 'signup@example.test';
export const TEST_OTP = '123456';

// The page the flow returns to. The fake backend serves it, so the test does not depend on a real event page.
export const CALLBACK_PATH = '/events/signup-test';
export const CALLBACK_HEADING = 'Signup callback reached';

// Team1 signs in through the site's OAuth server (app/api/oauth/authorize). The fake authorize step shows this heading.
export const TEAM1_HEADING = 'Team1 authorize resumed';

// The ids NextAuth gives a new email user before Terms (lib/auth/authOptions.ts), after Terms, and a returning user.
const PENDING_USER_ID = `pending_${TEST_EMAIL}`;
const CREATED_USER_ID = 'signup-test-user';
const RETURNING_USER_ID = 'returning-test-user';

const PROVIDERS = {
  credentials: { id: 'credentials', name: 'Email', type: 'credentials' },
  google: { id: 'google', name: 'Google', type: 'oauth' },
  github: { id: 'github', name: 'GitHub', type: 'oauth' },
};

// A type, not an interface, so it fits the engine's JSON type for a fulfilled body.
type SessionUser = {
  id: string;
  email: string;
  is_new_user: boolean;
  custom_attributes: string[];
};

export interface ReferralAttribution {
  referralCode?: string;
  landingPath?: string;
}

// What the login UI sent to the fake backend. The tests read it after the step that sends it.
export interface FakeAuthRecord {
  // The callbackUrl each social sign-in sent, by provider id (google, github).
  social: Record<string, string>;
  // The email that asked for a one-time code.
  otpEmail?: string;
  // The code and the callbackUrl of the email sign-in.
  credentials?: { otp: string | null; callbackUrl: string | null };
  // The referral attribution that Terms sent with the new account. Null when the flow sent none.
  createdUserReferral?: ReferralAttribution | null;
  // Each API write that had no fake answer, as "METHOD /path". The fake aborted it.
  unanswered: string[];
}

function htmlPage(heading: string): { headers: Record<string, string>; body: string } {
  return {
    headers: { 'content-type': 'text/html; charset=utf-8' },
    body: `<!doctype html><html><head><title>${heading}</title></head><body><h1>${heading}</h1></body></html>`,
  };
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// The absolute URL of a callbackUrl that the login UI sent, resolved against the request URL as NextAuth does.
function absoluteCallback(route: WebRoute, callbackUrl: string | null): string {
  if (!callbackUrl) throw new Error(`fake auth: ${route.request.url} got no callbackUrl`);
  return new URL(callbackUrl, route.request.url).href;
}

// Registers the fake backend. Call it before the first app.open of the page under test.
// A returning user (newUser false) signs in with the code and skips Terms.
export async function fakeAuth(app: App, browser: Browser, { newUser = true } = {}): Promise<FakeAuthRecord> {
  if (!app.baseUrl) throw new Error('fake auth needs a web target with an app URL');
  const origin = escapeRegExp(new URL(app.baseUrl).origin);
  const record: FakeAuthRecord = { social: {}, unanswered: [] };
  let user: SessionUser | null = null;

  const answer = async (route: WebRoute): Promise<void> => {
    const { method, url, postData } = route.request;
    const path = new URL(url).pathname;
    const form = new URLSearchParams(postData ?? '');
    const social = /^\/api\/auth\/signin\/(google|github)$/.exec(path);

    if (path === '/api/auth/providers') return route.fulfill({ json: PROVIDERS });
    if (path === '/api/auth/csrf') return route.fulfill({ json: { csrfToken: 'fake-csrf-token' } });
    // GET reads the session. POST is useSession().update(), which answers with the session too.
    if (path === '/api/auth/session') {
      return route.fulfill({ json: user ? { user, expires: '2099-01-01T00:00:00.000Z' } : {} });
    }
    // NextAuth's client posts its own errors here.
    if (path === '/api/auth/_log') return route.fulfill({ json: {} });
    if (social) {
      const callbackUrl = form.get('callbackUrl');
      record.social[social[1]] = callbackUrl ?? '';
      // NextAuth answers with the provider's consent page. The fake skips it and goes back to the callback at once.
      return route.fulfill({ json: { url: absoluteCallback(route, callbackUrl) } });
    }
    if (path === '/api/auth/callback/credentials') {
      const callbackUrl = form.get('callbackUrl');
      record.credentials = { otp: form.get('otp'), callbackUrl };
      user = {
        id: newUser ? PENDING_USER_ID : RETURNING_USER_ID,
        email: TEST_EMAIL,
        is_new_user: newUser,
        custom_attributes: [],
      };
      return route.fulfill({ json: { url: absoluteCallback(route, callbackUrl) } });
    }
    if (path === '/api/send-otp') {
      record.otpEmail = (JSON.parse(postData ?? '{}') as { email?: string }).email;
      return route.fulfill({ json: { success: true } });
    }
    // hooks/useTrackNewUser.ts posts the referral for a new session. The site refuses a pending user with 401,
    // and Terms sends the referral with the new account instead.
    if (path === '/api/referrals/attribution') return route.fulfill({ status: 401, json: { error: 'Forbidden' } });
    if (path === '/api/user/create-after-terms') {
      const body = JSON.parse(postData ?? '{}') as { referral_attribution?: ReferralAttribution | null };
      record.createdUserReferral = body.referral_attribution ?? null;
      if (user) user = { ...user, id: CREATED_USER_ID, is_new_user: false };
      return route.fulfill({ json: { id: CREATED_USER_ID, referralAttributed: Boolean(body.referral_attribution) } });
    }
    if (path === '/api/oauth/authorize') return route.fulfill(htmlPage(TEAM1_HEADING));
    if (method === 'GET' || method === 'HEAD') return route.continue();
    // The engine aborts the request and fails the next step with this error. An expect.poll step retries past the
    // error, so the test also checks `unanswered` at its end.
    record.unanswered.push(`${method} ${path}`);
    throw new Error(`fake auth: no fake answer for ${method} ${path}. Add one in lib/fake-auth.ts`);
  };

  await browser.route(new RegExp(`^${origin}/api/`), answer);
  await browser.route(new RegExp(`^${origin}${escapeRegExp(CALLBACK_PATH)}([?#]|$)`), (route) =>
    route.fulfill(htmlPage(CALLBACK_HEADING)),
  );
  return record;
}
