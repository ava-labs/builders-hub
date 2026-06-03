#!/usr/bin/env node
/**
 * Permission test runner for the Avalanche docs app.
 *
 * Run with:
 *   node permission_test.js
 *
 * Required settings (shell environment or .env.permissions):
 *   BASE_URL
 *   DEVREL_EMAIL
 *   DUMMY_EMAIL
 *   DUMMY_USER_ID
 *
 * Optional settings:
 *   DEVREL_OTP_CODE
 *   DUMMY_OTP_CODE
 *   NODE_ENV=development
 *
 * Example .env.permissions:
 *   BASE_URL=http://localhost:3000
 *   DEVREL_EMAIL=admin@example.com
 *   DUMMY_EMAIL=testing@example.com
 *   DUMMY_USER_ID=00000000-0000-0000-0000-000000000000
 *
 * Notes:
 * - This script performs auth-only checks and does not try to create valid records.
 * - It assigns and revokes roles on the dummy account as part of the test cycle.
 */

const { readFileSync } = require('fs');

try {
  const env = readFileSync('.env.permissions', 'utf-8');
  for (const line of env.split('\n')) {
    const [key, ...rest] = line.trim().split('=');
    if (key && !key.startsWith('#') && process.env[key] === undefined) {
      process.env[key] = rest.join('=');
    }
  }
} catch (_) {
  // No .env.permissions file found, fall through to shell environment variables
}

const readline = require('node:readline');
const { URL, URLSearchParams } = require('node:url');

const fetch = globalThis.fetch;
if (!fetch) {
  throw new Error('Node fetch is required. Run this with Node 18+ or a compatible runtime.');
}

const BASE_URL = process.env.BASE_URL;
const DEVREL_EMAIL = process.env.DEVREL_EMAIL;
const DUMMY_EMAIL = process.env.DUMMY_EMAIL;
const DUMMY_USER_ID = process.env.DUMMY_USER_ID;
const DEVREL_OTP_CODE = process.env.DEVREL_OTP_CODE;
const DUMMY_OTP_CODE = process.env.DUMMY_OTP_CODE;

if (!BASE_URL || !DEVREL_EMAIL || !DUMMY_EMAIL || !DUMMY_USER_ID) {
  console.error('Missing required environment variables.');
  console.error('Required: BASE_URL, DEVREL_EMAIL, DUMMY_EMAIL, DUMMY_USER_ID');
  process.exit(1);
}

const RAW_ROUTES = [
  {
    name: '/api/events/[id]',
    method: 'PUT',
    path: '/api/events/__test__',
    expectedRoles: ['hackathonCreator', 'team1-admin', 'devrel'],
    body: { id: '__test__' },
    type: 'api',
  },
  {
    name: '/api/events/[id]',
    method: 'PATCH',
    path: '/api/events/__test__',
    expectedRoles: ['hackathonCreator', 'team1-admin', 'devrel'],
    body: { is_public: true },
    type: 'api',
  },
  {
    name: '/api/events',
    method: 'POST',
    path: '/api/events',
    expectedRoles: ['hackathonCreator', 'team1-admin', 'devrel'],
    body: { title: '__test_DO_NOT_PUBLISH__', start_date: 'invalid-date' },
    type: 'api',
  },
  {
    name: '/events/new',
    method: 'GET',
    path: '/events/new',
    expectedRoles: ['hackathonCreator', 'team1-admin', 'devrel'],
    type: 'ui',
  },
  {
    name: '/showcase',
    method: 'GET',
    path: '/showcase',
    expectedRoles: ['showcase', 'hackathonCreator', 'team1-admin', 'devrel'],
    type: 'ui',
  },
  {
    name: '/api/showcase',
    method: 'GET',
    path: '/api/showcase',
    expectedRoles: ['showcase', 'hackathonCreator', 'team1-admin', 'devrel'],
    type: 'api',
  },
  {
    name: '/api/projects/export',
    method: 'POST',
    path: '/api/projects/export',
    expectedRoles: ['hackathonCreator', 'devrel'],
    body: { query: '__test_invalid_query__' },
    type: 'api',
  },
  {
    name: '/api/badge/assign',
    method: 'POST',
    path: '/api/badge/assign',
    expectedRoles: ['badge_admin', 'devrel'],
    body: { userId: DUMMY_USER_ID, projectId: '__test_project' },
    type: 'api',
  },
  {
    name: '/api/notifications/create',
    method: 'POST',
    path: '/api/notifications/create',
    expectedRoles: ['notify_event', 'devrel'],
    body: { notifications: [{ title: '__test__', content: '__test__' }] },
    type: 'api',
  },
  {
    name: '/evaluate',
    method: 'GET',
    path: '/evaluate',
    expectedRoles: ['judge', 'devrel'],
    type: 'ui',
  },
  {
    name: '/api/evaluate/final-verdict',
    method: 'POST',
    path: '/api/evaluate/final-verdict',
    expectedRoles: ['devrel'],
    body: { formDataId: '__test__', verdict: 'top' },
    type: 'api',
  },
  {
    name: '/api/projects/[id]/winner',
    method: 'POST',
    path: '/api/projects/__test__/winner',
    expectedRoles: ['team1-admin', 'devrel'],
    body: { is_winner: true },
    type: 'api',
  },
];

const ROLE_CYCLES = [
  'hackathonCreator',
  'showcase',
  'BuildGamesJudge',
  'NotifyEvent',
  'badge_admin',
  'Team1-Leader',
  'Team1-member',
  'T1-Technical',
];

const ROLE_NAME_MAP = {
  BuildGamesJudge: 'judge',
  NotifyEvent: 'notify_event',
};

const ALLOWED_ROLE_NAMES = new Set([
  'hackathonCreator',
  'showcase',
  'judge',
  'badge_admin',
  'notify_event',
  'builder_insights',
  'Team1-Leader',
  'Team1-member',
  'T1-Technical',
  'team1-admin',
  'devrel',
]);

class SessionClient {
  constructor(baseUrl) {
    this.baseUrl = new URL(baseUrl);
    this.cookies = new Map();
  }

  clearCookies() {
    this.cookies.clear();
  }

  _buildCookieHeader(url) {
    const cookies = [];
    for (const [name, value] of this.cookies.entries()) {
      if (value != null) cookies.push(`${name}=${value}`);
    }
    return cookies.join('; ');
  }

  _storeCookies(url, setCookieHeaders) {
    if (!setCookieHeaders) return;
    for (const header of setCookieHeaders) {
      const parts = header.split(';').map((part) => part.trim());
      const [nameValue] = parts;
      if (!nameValue) continue;
      const [name, ...rest] = nameValue.split('=');
      const value = rest.join('=');
      if (!name) continue;
      if (value === '') {
        this.cookies.delete(name);
      } else {
        this.cookies.set(name, value);
      }
    }
  }

  async fetch(path, options = {}) {
    const url = new URL(path, this.baseUrl);
    const headers = new Headers(options.headers || {});
    const cookieHeader = this._buildCookieHeader(url);
    if (cookieHeader) {
      headers.set('cookie', cookieHeader);
    }
    if (options.body && typeof options.body === 'object' && !(options.body instanceof URLSearchParams)) {
      if (!headers.has('content-type')) {
        headers.set('content-type', 'application/json');
      }
      options.body = JSON.stringify(options.body);
    }
    const response = await fetch(url.toString(), {
      ...options,
      headers,
      redirect: options.redirect ?? 'manual',
    });
    // después - fixed
    const setCookie = response.headers.getSetCookie
      ? response.headers.getSetCookie()
      : response.headers.get('set-cookie')
        ? [response.headers.get('set-cookie')]
        : [];
    this._storeCookies(url, setCookie);
    return response;
  }
}

async function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise((resolve) => rl.question(question, resolve));
  rl.close();
  return answer.trim();
}

async function getCsrfToken(client) {
  const resp = await client.fetch('/api/auth/csrf', { method: 'GET', headers: { Accept: 'application/json' } });
  if (!resp.ok) {
    throw new Error(`Failed to get CSRF token: ${resp.status}`);
  }
  const data = await resp.json();
  if (!data?.csrfToken) {
    throw new Error('CSRF response missing csrfToken');
  }
  return data.csrfToken;
}

async function sendOtp(client, email) {
  const resp = await client.fetch('/api/send-otp', {
    method: 'POST',
    body: { email },
    headers: { Accept: 'application/json' },
  });
  if (!resp.ok) {
    const body = await safeJson(resp);
    throw new Error(`send-otp failed: ${resp.status} ${JSON.stringify(body)}`);
  }
  return true;
}

async function safeJson(response) {
  try {
    return await response.json();
  } catch (err) {
    return { text: await response.text().catch(() => '') };
  }
}

async function authenticateClient(client, email, otpCode, label) {
  const csrfToken = await getCsrfToken(client);
  const payload = new URLSearchParams({
    csrfToken,
    callbackUrl: BASE_URL,
    json: 'true',
    email,
    otp: otpCode,
  });
  const pathsToTry = ['/api/auth/callback/credentials', '/api/auth/signin/credentials'];
  let response;
  let lastError = null;
  for (const path of pathsToTry) {
    response = await client.fetch(path, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: payload,
      redirect: 'manual',
    });
    if (response.status !== 404 && response.status !== 405) break;
    lastError = `path ${path} returned ${response.status}`;
  }
  if (!response) {
    throw new Error(`No auth response: ${lastError}`);
  }
  const data = await safeJson(response);
  if (response.status >= 400 || data?.error) {
    const reason = data?.error || `${response.status}`;
    throw new Error(`Login failed for ${label}: ${reason}`);
  }
  const session = await fetchSession(client);
  if (!session || !session.user || session.user.email?.toLowerCase() !== email.toLowerCase()) {
    throw new Error(`Login did not yield expected session for ${label}.`);
  }
  return session;
}

async function fetchSession(client) {
  const resp = await client.fetch('/api/auth/session', { method: 'GET', headers: { Accept: 'application/json' } });
  if (!resp.ok) {
    return null;
  }
  return await safeJson(resp);
}

async function loginAs(email, otpOverride, label) {
  const client = new SessionClient(BASE_URL);
  await sendOtp(client, email);
  const otp = otpOverride || (await prompt(`Enter OTP for ${label} (${email}): `));
  await authenticateClient(client, email, otp, label);
  return client;
}

async function assignRole(devrelClient, role) {
  const resp = await devrelClient.fetch('/api/admin/user-roles', {
    method: 'POST',
    body: {
      user_id: DUMMY_USER_ID,
      role,
      expires_at: new Date(Date.now() + 1000 * 60 * 60).toISOString(),
    },
    headers: { Accept: 'application/json' },
  });
  return resp;
}

async function revokeRole(devrelClient, role) {
  const resp = await devrelClient.fetch('/api/admin/user-roles', {
    method: 'DELETE',
    body: { user_id: DUMMY_USER_ID, role },
    headers: { Accept: 'application/json' },
  });
  return resp;
}

async function listDummyRoles(devrelClient) {
  const resp = await devrelClient.fetch(`/api/admin/user-roles?user_id=${encodeURIComponent(DUMMY_USER_ID)}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });
  if (!resp.ok) return null;
  const body = await safeJson(resp);
  return body?.roles ?? null;
}

function effectiveRole(roleLabel) {
  return ROLE_NAME_MAP[roleLabel] || roleLabel;
}

function routeHasPermission(route, effectiveRoleName) {
  if (!effectiveRoleName) return false;
  return route.expectedRoles.includes(effectiveRoleName);
}

async function runRequest(client, route) {
  const headers = { Accept: route.type === 'ui' ? 'text/html' : 'application/json' };
  const opts = { method: route.method, headers };
  if (route.body && route.method !== 'GET') {
    opts.body = route.body;
  }
  const response = await client.fetch(route.path, opts);
  const status = response.status;
  let bodyText = '';
  let json = null;
  if (route.type === 'api' || response.headers.get('content-type')?.includes('application/json')) {
    json = await safeJson(response);
    bodyText = JSON.stringify(json);
  } else {
    bodyText = await response.text().catch(() => '');
  }
  return { status, bodyText, json, redirected: response.headers.get('location') || null };
}

function interpretUiDeny(result, route) {
  if (result.status === 0) return true;
  if (result.status === 401 || result.status === 403) return true;
  if (result.redirected && result.redirected === '/') return true;
  return false;
}

function expectDeny(route, result) {
  if (route.type === 'ui') {
    return interpretUiDeny(result, route);
  }
  return result.status === 401 || result.status === 403;
}

function expectAllow(route, result) {
  if (route.type === 'ui') {
    if (result.status === 0) return false;
    if (result.status === 401 || result.status === 403) return false;
    if (result.redirected && result.redirected === '/') return false;
    return true;
  }
  return result.status !== 401 && result.status !== 403;
}

async function run() {
  console.log('Permission test start');
  console.log(`BASE_URL=${BASE_URL}`);

  const devrelClient = await loginAs(DEVREL_EMAIL, DEVREL_OTP_CODE, 'DEVREL');
  console.log('Devrel authenticated.');

  const initialRoles = await listDummyRoles(devrelClient);
  if (initialRoles == null) {
    console.warn('Unable to list existing dummy roles.');
  } else if (initialRoles.length > 0) {
    console.warn('Dummy account has existing roles:', initialRoles.map((r) => r.role).join(', '));
  }

  const results = [];
  let dummyClient = await loginAs(DUMMY_EMAIL, DUMMY_OTP_CODE, 'DUMMY');
  console.log('Dummy authenticated; the session will be refreshed after each role change.');

  for (const roleLabel of ROLE_CYCLES) {
    const backendRole = effectiveRole(roleLabel);
    if (!ALLOWED_ROLE_NAMES.has(backendRole)) {
      console.warn(`Skipping role cycle ${roleLabel}: no mapped backend role available.`);
      continue;
    }
    console.log(`\n=== Role cycle: ${roleLabel} (mapped to ${backendRole}) ===`);

    let assigned = false;
    try {
      const assignResp = await assignRole(devrelClient, backendRole);
      const assignBody = await safeJson(assignResp);
      if (!assignResp.ok) {
        throw new Error(`Failed to assign ${backendRole}: ${assignResp.status} ${JSON.stringify(assignBody)}`);
      }
      assigned = true;
      console.log(`Assigned ${backendRole} to dummy account.`);

      dummyClient = await loginAs(DUMMY_EMAIL, DUMMY_OTP_CODE, 'DUMMY');
      console.log('Re-authenticated dummy client after role assignment to refresh JWT claims.');

      for (const route of RAW_ROUTES) {
        const hasPermission = routeHasPermission(route, backendRole);
        const result = await runRequest(dummyClient, route);
        const allow = hasPermission ? expectAllow(route, result) : expectDeny(route, result);
        const got = `${result.status}${result.redirected ? ` -> ${result.redirected}` : ''}`;
        const pass = allow;
        const verdict = pass ? '✅' : '❌';
        results.push({
          route: route.name,
          method: route.method,
          roleTested: roleLabel,
          hasPermission: hasPermission ? 'yes' : 'no',
          got,
          result: pass ? '✅' : '❌',
          detail: pass
            ? ''
            : hasPermission
              ? `EXPECTED allow but got deny (${result.status})`
              : `EXPECTED deny (401/403) but got ${result.status}`,
        });
        console.log(
          `${verdict} ${route.method} ${route.path} | ${roleLabel} | expected ${hasPermission ? 'allow' : 'deny'} | got ${got}`,
        );
      }
    } catch (error) {
      console.error(`Error during ${roleLabel} cycle:`, error.message || error);
      results.push({
        route: 'ROLE_CYCLE_FAILED',
        method: '',
        roleTested: roleLabel,
        hasPermission: 'n/a',
        got: 'ERROR',
        result: '❌',
        detail: error.message || String(error),
      });
    } finally {
      if (assigned) {
        const revokeResp = await revokeRole(devrelClient, backendRole);
        const revokeBody = await safeJson(revokeResp);
        if (!revokeResp.ok) {
          console.error(`Failed to revoke ${backendRole}: ${revokeResp.status} ${JSON.stringify(revokeBody)}`);
        } else {
          console.log(`Revoked ${backendRole} from dummy account.`);
        }
      }
    }
  }

  console.log('\n=== No-role cycle ===');
  dummyClient = await loginAs(DUMMY_EMAIL, DUMMY_OTP_CODE, 'DUMMY');
  console.log('Re-authenticated dummy client before the no-role cycle.');
  for (const route of RAW_ROUTES) {
    const hasPermission = false;
    const result = await runRequest(dummyClient, route);
    const allow = expectDeny(route, result) ? true : false; // expect deny for all routes in no-role cycle
    const got = `${result.status}${result.redirected ? ` -> ${result.redirected}` : ''}`;
    const pass = expectDeny(route, result);
    results.push({
      route: route.name,
      method: route.method,
      roleTested: 'NO_ROLE',
      hasPermission: 'no',
      got,
      result: pass ? '✅' : '❌',
      detail: pass ? '' : 'EXPECTED deny but got allow',
    });
    console.log(`${pass ? '✅' : '❌'} ${route.method} ${route.path} | NO_ROLE | expected deny | got ${got}`);
  }

  const passed = results.filter((r) => r.result === '✅').length;
  const failed = results.filter((r) => r.result === '❌').length;
  const flagged = results.filter((r) => r.detail).length;

  console.log('\n=== Results ===');
  console.log(`Total tests run: ${results.length}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  if (flagged > 0) {
    console.log('⚠️ FLAGGED results:');
    results
      .filter((r) => r.detail)
      .forEach((r) => {
        console.log(`- ${r.route} ${r.method} | ${r.roleTested} | ${r.got} | ${r.detail}`);
      });
  }

  console.log('\nMarkdown summary:');
  console.log('| Route | Method | Role tested | Has permission | Got | Result |');
  console.log('|---|---|---|---|---|---|');
  for (const row of results) {
    console.log(
      `| ${row.route} | ${row.method} | ${row.roleTested} | ${row.hasPermission} | ${row.got} | ${row.result} |`,
    );
  }
}

run().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
