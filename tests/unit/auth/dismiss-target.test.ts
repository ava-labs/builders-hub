import { describe, expect, it } from 'vitest';
import { resolveDismissTarget } from '@/lib/auth/dismiss-target';

const ORIGIN = 'https://build.avax.network';
const EVENT = '0f8d6c1e-5b4a-4c3e-9a2b-7d1e3f5a6b7c';

describe('login modal dismiss target', () => {
  it('sends a gated form back to its event page with the ref', () => {
    expect(resolveDismissTarget(`/events/registration-form?event=${EVENT}&ref=TEAM1`, null, ORIGIN)).toBe(
      `/events/${EVENT}?ref=TEAM1`,
    );
    expect(resolveDismissTarget(`${ORIGIN}/hackathons/project-submission?hackathon=build-games-2026`, null, ORIGIN)).toBe(
      '/events/build-games-2026',
    );
  });

  it('keeps an event page and falls back to the current page', () => {
    expect(resolveDismissTarget('/events/x?tab=prizes', null, ORIGIN)).toBe('/events/x?tab=prizes');
    expect(resolveDismissTarget('/profile', '/hackathons/y', ORIGIN)).toBe('/hackathons/y');
  });

  it('sends a page that needs sign-in home', () => {
    expect(resolveDismissTarget('/profile', '/profile', ORIGIN)).toBe('/');
    expect(resolveDismissTarget('/console/utilities/data-api-keys', '/console/utilities/data-api-keys', ORIGIN)).toBe('/');
  });

  it('stays on a page that works without sign-in', () => {
    expect(resolveDismissTarget('/console/studio', '/console/studio', ORIGIN)).toBeNull();
    expect(resolveDismissTarget('/profile', '/stats', ORIGIN)).toBeNull();
    expect(resolveDismissTarget('/', '/explorer/mainnet/query?q=x', ORIGIN)).toBeNull();
  });

  it.each([
    '..//evil.example/pwn',
    '../..//evil.example/login',
    '%2e%2e//evil.example',
    '..\\evil.example',
    'x/../..//evil.com',
    '../\\evil.example',
  ])('stays on the site when the event id is %j', (eventId) => {
    for (const page of ['/events/registration-form', '/hackathons/project-submission']) {
      for (const key of ['event', 'hackathon']) {
        const gated = `${page}?${new URLSearchParams({ [key]: eventId, ref: 'R' })}`;
        const target = resolveDismissTarget(gated, gated, ORIGIN) ?? '';

        expect(target).not.toBe('');
        expect(new URL(target, ORIGIN).origin).toBe(ORIGIN);
        expect(target.startsWith('//')).toBe(false);
      }
    }
  });
});
