import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { isTeam1Slug, normalizePathname } from '@/lib/auth/normalize-path';
import { academy } from '@/lib/source';
import { proxy } from '@/proxy';

vi.mock('next-auth/jwt', () => ({ getToken: vi.fn() }));
vi.mock('next-auth/middleware', () => ({ withAuth: vi.fn() }));
vi.mock('@/lib/source', () => {
  // Like the fumadocs loader, the lookup joins the segments: `['team1/course']` finds the page of
  // `['team1', 'course']`.
  const getPage = vi.fn((slug: string[]) => {
    const slugs = slug.join('/').split('/');
    return { url: `/academy/${slugs.join('/')}`, slugs, data: { title: 'Course' } };
  });
  const source = { getPage, getPages: vi.fn(() => []) };
  return { documentation: source, academy: source, integration: source, blog: source };
});
vi.mock('@/lib/llm-utils', () => ({ getLLMText: vi.fn(async () => '# Course') }));

const { GET } = await import('@/app/api/raw/[...slug]/route');

const ORIGIN = 'https://build.avax.network';
const VARIANTS = [
  '/api/raw/academy/team1/course',
  '/api/raw/academy/te%61m1/course',
  '/api/raw/academy/TEAM1/course',
  '/api/raw/academy/team1/../team1/course',
  '/api/raw/academy/x/%2e%2e/team1/course',
  '/api/raw/%61cademy/team1/course',
  '/api/raw/academy/te%2561m1/course',
  '/api/raw/academy/team1%2Fcourse',
];

const signedOut = () => vi.mocked(getToken).mockResolvedValue(null);
const signedInWith = (attrs: string[]) =>
  vi.mocked(getToken).mockResolvedValue({ custom_attributes: attrs } as never);

describe('normalizePathname', () => {
  it.each([
    ['/academy/te%61m1/x', '/academy/team1/x'],
    ['/Academy/TEAM1/x', '/academy/team1/x'],
    ['/academy/team1/../team1/x', '/academy/team1/x'],
    ['/academy/./team1//x/', '/academy/team1/x'],
    ['/academy/x/%2e%2e/team1', '/academy/team1'],
    ['/academy/te%2561m1', '/academy/team1'],
    ['/../../academy', '/academy'],
    ['/bad%zzescape', '/bad%zzescape'],
  ])('%s -> %s', (input, expected) => {
    expect(normalizePathname(input)).toBe(expected);
  });
});

describe('isTeam1Slug', () => {
  it.each([
    [['team1'], true],
    [['team1', 'course'], true],
    [['TEAM1', 'course'], true],
    [['team1/course'], true],
    [['', 'team1', 'course'], true],
    [['x', '..', 'team1'], true],
    [['te%61m1', 'course'], true],
    [['team1-notes'], false],
    [['avalanche-l1', 'team1'], false],
    [[], false],
    [undefined, false],
  ])('%j -> %s', (slug, expected) => {
    expect(isTeam1Slug(slug)).toBe(expected);
  });
});

describe('Team1 raw markdown in the proxy', () => {
  beforeEach(() => vi.clearAllMocks());

  it.each(VARIANTS)('answers 401 to a signed-out caller on %s', async (path) => {
    signedOut();
    const res = await proxy(new NextRequest(`${ORIGIN}${path}`));
    expect(res?.status).toBe(401);
  });

  it.each(VARIANTS)('answers 403 to a caller without the Team1 role on %s', async (path) => {
    signedInWith(['devrel-ish', 'showcase']);
    const res = await proxy(new NextRequest(`${ORIGIN}${path}`));
    expect(res?.status).toBe(403);
  });

  it('lets a Team1 member through', async () => {
    signedInWith(['team1-member']);
    const res = await proxy(new NextRequest(`${ORIGIN}/api/raw/academy/te%61m1/course`));
    expect(res?.status).toBe(200);
    expect(res?.headers.get('x-middleware-next')).toBe('1');
  });

  it('leaves other raw markdown public', async () => {
    signedOut();
    const res = await proxy(new NextRequest(`${ORIGIN}/api/raw/academy/avalanche-l1/course`));
    expect(res?.headers.get('x-middleware-next')).toBe('1');
    expect(getToken).not.toHaveBeenCalled();
  });

  it('does not rewrite an encoded Team1 page to raw markdown for a signed-out caller', async () => {
    signedOut();
    const res = await proxy(
      new NextRequest(`${ORIGIN}/academy/te%61m1/course`, { headers: { accept: 'text/markdown' } }),
    );
    expect(res?.headers.get('x-middleware-rewrite')).toBeNull();
    expect(res?.headers.get('x-auth-required')).toBe('true');
  });
});

describe('Team1 raw markdown in the route handler', () => {
  beforeEach(() => vi.clearAllMocks());

  const get = (slug: string[]) =>
    GET(new NextRequest(`${ORIGIN}/api/raw/${slug.join('/')}`), { params: Promise.resolve({ slug }) });

  it.each([['team1'], ['TEAM1'], ['Team1']])('refuses a signed-out caller for academy/%s', async (segment) => {
    signedOut();
    expect((await get(['academy', segment, 'course'])).status).toBe(401);
  });

  it('refuses a caller without the Team1 role', async () => {
    signedInWith([]);
    expect((await get(['academy', 'team1', 'course'])).status).toBe(403);
  });

  // `/academy/team1%2Fcourse.md` reaches the handler as one segment that holds the slash.
  it('refuses a signed-out caller when one segment holds the slash', async () => {
    signedOut();
    expect((await get(['academy', 'team1/course'])).status).toBe(401);
  });

  it('refuses a caller without the Team1 role when one segment holds the slash', async () => {
    signedInWith(['showcase']);
    expect((await get(['academy', 'team1/course'])).status).toBe(403);
  });

  it('serves a Team1 member without a shared cache when one segment holds the slash', async () => {
    signedInWith(['team1-member']);
    const res = await get(['academy', 'team1/course']);
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('private, no-store');
  });

  it('refuses a signed-out caller when only the resolved page is a Team1 page', async () => {
    signedOut();
    vi.mocked(academy.getPage).mockReturnValueOnce({ slugs: ['team1', 'course'] } as never);
    expect((await get(['academy', 'alias', 'course'])).status).toBe(401);
  });

  it('does not check the session for the academy index', async () => {
    const res = await get(['academy']);
    expect(res.status).toBe(200);
    expect(getToken).not.toHaveBeenCalled();
  });

  it('serves a Team1 member without a shared cache', async () => {
    signedInWith(['team1-admin']);
    const res = await get(['academy', 'team1', 'course']);
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('private, no-store');
  });

  it('serves public pages with the shared cache and no session lookup', async () => {
    const res = await get(['academy', 'avalanche-l1', 'course']);
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('public, max-age=3600, s-maxage=3600');
    expect(getToken).not.toHaveBeenCalled();
  });
});
