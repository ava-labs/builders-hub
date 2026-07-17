import { createHmac } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createUnlinkSessionCookie,
  readUnlinkSession,
  UNLINK_SESSION_COOKIE,
  UNLINK_SESSION_TTL_SECONDS,
} from '@/lib/unlink/session';

const ADDRESS = `unlink1${'a'.repeat(38)}`;
const OTHER_ADDRESS = `unlink1${'b'.repeat(38)}`;
const SECRET = 'test-session-secret-with-32-characters';
const NOW = Date.UTC(2026, 6, 18, 12, 0, 0);

function cookiePair(setCookie: string): string {
  return setCookie.split(';', 1)[0];
}

function requestWithCookie(cookie: string): Request {
  return new Request('https://build.avax.network/api/unlink/authorization-token', {
    headers: { cookie },
  });
}

function signedValue(payload: unknown): string {
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const signature = createHmac('sha256', SECRET).update(encoded).digest('base64url');
  return `${encoded}.${signature}`;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('Unlink demo session', () => {
  it('round-trips the Engine address in a one-hour HttpOnly strict cookie', () => {
    const setCookie = createUnlinkSessionCookie(ADDRESS, SECRET, { now: NOW, secure: false });

    expect(setCookie).toContain(`${UNLINK_SESSION_COOKIE}=`);
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('SameSite=Strict');
    expect(setCookie).toContain('Path=/api/unlink');
    expect(setCookie).toContain(`Max-Age=${UNLINK_SESSION_TTL_SECONDS}`);
    expect(setCookie).toContain('Expires=Sat, 18 Jul 2026 13:00:00 GMT');
    expect(setCookie).not.toContain('Secure');

    expect(readUnlinkSession(requestWithCookie(`another=value; ${cookiePair(setCookie)}`), SECRET, NOW)).toEqual({
      unlinkAddress: ADDRESS,
      expiresAt: NOW + UNLINK_SESSION_TTL_SECONDS * 1_000,
    });
  });

  it('adds Secure by default in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(createUnlinkSessionCookie(ADDRESS, SECRET, { now: NOW })).toContain('; Secure');
  });

  it('rejects expired, tampered, wrongly signed, duplicate, and malformed cookies', () => {
    const setCookie = createUnlinkSessionCookie(ADDRESS, SECRET, { now: NOW, secure: false });
    const pair = cookiePair(setCookie);
    const value = pair.slice(pair.indexOf('=') + 1);
    const tampered = `${value.slice(0, -1)}${value.endsWith('a') ? 'b' : 'a'}`;

    expect(readUnlinkSession(requestWithCookie(pair), SECRET, NOW + UNLINK_SESSION_TTL_SECONDS * 1_000)).toBeNull();
    expect(readUnlinkSession(requestWithCookie(`${UNLINK_SESSION_COOKIE}=${tampered}`), SECRET, NOW)).toBeNull();
    expect(readUnlinkSession(requestWithCookie(pair), 'wrong-secret', NOW)).toBeNull();
    expect(readUnlinkSession(requestWithCookie(`${pair}; ${pair}`), SECRET, NOW)).toBeNull();
    expect(readUnlinkSession(requestWithCookie(`${UNLINK_SESSION_COOKIE}=not-a-session`), SECRET, NOW)).toBeNull();
    expect(readUnlinkSession(new Request('https://build.avax.network'), SECRET, NOW)).toBeNull();
  });

  it('rejects non-canonical base64url signatures', () => {
    const pair = cookiePair(createUnlinkSessionCookie(ADDRESS, SECRET, { now: NOW, secure: false }));
    const value = pair.slice(pair.indexOf('=') + 1);
    const [payload, signature] = value.split('.');
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
    const finalIndex = alphabet.indexOf(signature.at(-1) ?? '');
    const equivalentFinalCharacter = alphabet[(finalIndex & 0b111100) | 0b000001];
    const nonCanonicalSignature = `${signature.slice(0, -1)}${equivalentFinalCharacter}`;

    expect(Buffer.from(nonCanonicalSignature, 'base64url')).toEqual(Buffer.from(signature, 'base64url'));
    expect(
      readUnlinkSession(requestWithCookie(`${UNLINK_SESSION_COOKIE}=${payload}.${nonCanonicalSignature}`), SECRET, NOW),
    ).toBeNull();
  });

  it('rejects validly signed payloads with invalid fields or JSON', () => {
    const expiresAt = NOW + 60_000;
    const cases = [
      { version: 2, unlinkAddress: ADDRESS, expiresAt },
      { version: 1, unlinkAddress: OTHER_ADDRESS.toUpperCase(), expiresAt },
      { version: 1, unlinkAddress: ADDRESS, expiresAt: 1.5 },
    ];

    for (const payload of cases) {
      expect(
        readUnlinkSession(requestWithCookie(`${UNLINK_SESSION_COOKIE}=${signedValue(payload)}`), SECRET, NOW),
      ).toBeNull();
    }

    const encoded = Buffer.from('{', 'utf8').toString('base64url');
    const signature = createHmac('sha256', SECRET).update(encoded).digest('base64url');
    expect(
      readUnlinkSession(requestWithCookie(`${UNLINK_SESSION_COOKIE}=${encoded}.${signature}`), SECRET, NOW),
    ).toBeNull();
  });

  it('refuses to mint a session for invalid input', () => {
    expect(() => createUnlinkSessionCookie('not-an-unlink-address', SECRET)).toThrow('Invalid Unlink address');
    expect(() => createUnlinkSessionCookie(ADDRESS, 'too-short')).toThrow(
      'Unlink session secret must be at least 32 characters',
    );
  });
});
