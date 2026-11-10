import { isValidElement, type ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';

// The user button pulls in the auth client; the menu under test never renders it.
vi.mock('@/components/login/user-button/UserButtonWrapper', () => ({ UserButtonWrapper: () => null }));

import { consoleMenu } from '@/app/layout.config';

describe('Console menu (desktop)', () => {
  it('opens on /console from a trigger that does not prefetch', () => {
    // a prefetched Console route preloads its CSS into the current page, and
    // Chrome reports it as preloaded but not used on a page without that CSS
    const { text } = consoleMenu as unknown as { text: unknown };
    expect(isValidElement(text)).toBe(true);
    expect((text as ReactElement<{ href?: string; prefetch?: boolean; children?: unknown }>).props).toMatchObject({
      href: '/console',
      prefetch: false,
      children: 'Console',
    });
  });
});
