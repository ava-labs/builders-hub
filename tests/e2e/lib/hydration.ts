import type { Browser } from '@e2e-dev/web';
import { expect } from 'e2e';

// React marks each DOM node it hydrates with a "__reactFiber$<id>" property.
// A hover or tap before hydration does nothing, and a client-side crash shows only after it.
// A replayed agent step makes each action once, with no second try, so it waits for this mark too.
export async function waitForHydration(browser: Browser, selector: string): Promise<void> {
  await expect
    .poll(
      () =>
        browser.evaluate((css) => {
          const node = document.querySelector(css);
          return node !== null && Object.keys(node).some((key) => key.startsWith('__reactFiber$'));
        }, selector),
      { timeout: 60_000 },
    )
    .toBe(true);
}
