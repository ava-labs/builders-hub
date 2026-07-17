import { createHmac, timingSafeEqual } from 'node:crypto';

export const UNLINK_SESSION_COOKIE = 'unlink_demo_session';
export const UNLINK_SESSION_TTL_SECONDS = 60 * 60;

/**
 * Deployment requirement: generate UNLINK_DEMO_SESSION_SECRET from at least
 * 32 random bytes, for example with `openssl rand -hex 32`. The length check
 * below rejects obviously weak configuration but cannot measure entropy.
 */
export const UNLINK_SESSION_SECRET_MIN_LENGTH = 32;

const UNLINK_ADDRESS_RE = /^unlink1[a-z0-9]{38,}$/;
const COOKIE_VALUE_RE = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

type SessionPayload = {
  version: 1;
  unlinkAddress: string;
  expiresAt: number;
};

export type UnlinkSession = Pick<SessionPayload, 'unlinkAddress' | 'expiresAt'>;

type CookieOptions = {
  now?: number;
  secure?: boolean;
};

function sign(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

function createSessionValue(unlinkAddress: string, secret: string, expiresAt: number): string {
  const payload: SessionPayload = { version: 1, unlinkAddress, expiresAt };
  const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  return `${encodedPayload}.${sign(encodedPayload, secret)}`;
}

function readCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;

  let found: string | null = null;
  for (const part of cookieHeader.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0 || part.slice(0, separator).trim() !== UNLINK_SESSION_COOKIE) continue;

    // Reject duplicate session cookies instead of relying on browser ordering.
    if (found !== null) return null;
    found = part.slice(separator + 1).trim();
  }

  return found;
}

function verifySessionValue(value: string, secret: string, now: number): UnlinkSession | null {
  if (secret.length < UNLINK_SESSION_SECRET_MIN_LENGTH || value.length > 2_048 || !COOKIE_VALUE_RE.test(value)) {
    return null;
  }

  const [encodedPayload, encodedSignature] = value.split('.');
  const suppliedSignature = Buffer.from(encodedSignature, 'ascii');
  const expectedSignature = Buffer.from(sign(encodedPayload, secret), 'ascii');

  if (suppliedSignature.length !== expectedSignature.length || !timingSafeEqual(suppliedSignature, expectedSignature)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as Partial<SessionPayload>;

    if (
      payload.version !== 1 ||
      typeof payload.unlinkAddress !== 'string' ||
      !UNLINK_ADDRESS_RE.test(payload.unlinkAddress) ||
      typeof payload.expiresAt !== 'number' ||
      !Number.isSafeInteger(payload.expiresAt) ||
      payload.expiresAt <= now
    ) {
      return null;
    }

    return {
      unlinkAddress: payload.unlinkAddress,
      expiresAt: payload.expiresAt,
    };
  } catch {
    return null;
  }
}

/** Creates the complete Set-Cookie value for a one-hour signed demo session. */
export function createUnlinkSessionCookie(unlinkAddress: string, secret: string, options: CookieOptions = {}): string {
  if (!UNLINK_ADDRESS_RE.test(unlinkAddress)) throw new Error('Invalid Unlink address');
  if (secret.length < UNLINK_SESSION_SECRET_MIN_LENGTH) {
    throw new Error(`Unlink session secret must be at least ${UNLINK_SESSION_SECRET_MIN_LENGTH} characters`);
  }

  const now = options.now ?? Date.now();
  const expiresAt = now + UNLINK_SESSION_TTL_SECONDS * 1_000;
  const value = createSessionValue(unlinkAddress, secret, expiresAt);
  const attributes = [
    `${UNLINK_SESSION_COOKIE}=${value}`,
    'HttpOnly',
    'SameSite=Strict',
    'Path=/api/unlink',
    `Max-Age=${UNLINK_SESSION_TTL_SECONDS}`,
    `Expires=${new Date(expiresAt).toUTCString()}`,
  ];

  if (options.secure ?? process.env.NODE_ENV === 'production') attributes.push('Secure');
  return attributes.join('; ');
}

/** Verifies the request cookie and returns only its server-trusted fields. */
export function readUnlinkSession(request: Request, secret: string, now = Date.now()): UnlinkSession | null {
  const value = readCookie(request.headers.get('cookie'));
  return value ? verifySessionValue(value, secret, now) : null;
}
