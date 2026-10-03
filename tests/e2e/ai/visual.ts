import type { Browser } from '@e2e-dev/web';
import { expect } from 'e2e';

// The visual tests judge one screenshot of the viewport. The framework has no screenshot diff, so a model reads it.
// Run them alone with --tag visual, or leave them out with --exclude-tag visual.
export const VISUAL = { tags: ['visual'] };

// The judge gets the screenshot only. A layout fault shows in pixels, and the accessibility tree adds no evidence
// for it but costs 3 to 5 times the input tokens: about 2k per judgment alone, 6k to 16k with the tree.
export const SCREENSHOT_ONLY = { vision: 'only' } as const;

// The judge sees the screenshot scaled to 768 px on its long side (e2e src/agent/pixels.ts), so body text is
// too small to judge. The check names layout faults only, and the normal parts of a page that look like one.
// `normal` lists the parts of this page that are cut or covered on purpose, so the judge does not report them.
export function layoutIsIntact(subject: string, normal: readonly string[] = []): string {
  return [
    `The screenshot shows ${subject}.`,
    'No text, button or image is cut off at the left or right edge of the screen.',
    'No text overlaps other text or an image, and no element covers the main heading.',
    'These are normal and are not faults: content that continues below the bottom edge of the screen;',
    'text shortened with an ellipsis (…); the round chat button that floats in the bottom right corner.',
    ...normal,
  ].join(' ');
}

// Waits until the screen the judge sees has settled. First the page is at the top, the web fonts have loaded and
// the images in view have decoded. A timeout names the image (a broken image in view never loads).
export async function waitForStillScreen(browser: Browser): Promise<void> {
  await expect
    .poll(
      () =>
        browser.evaluate(async () => {
          window.scrollTo(0, 0);
          await document.fonts.ready;
          const loading = [...document.images]
            .filter((image) => {
              const box = image.getBoundingClientRect();
              // A marquee keeps lazy copies of its images beside the screen, and those never load.
              const inHeight = box.bottom > 0 && box.top < window.innerHeight;
              return box.width > 0 && inHeight && box.right > 0 && box.left < window.innerWidth;
            })
            .filter((image) => !(image.complete && image.naturalWidth > 0))
            .map((image) => image.currentSrc || image.src);
          return loading.length > 0 ? `images not loaded: ${loading.slice(0, 3).join(', ')}` : 'loaded';
        }),
      { timeout: 30_000 },
    )
    .toBe('loaded');
  // Then it waits up to 5 s for the animations in view that have an end. This wait does not fail: the explorer
  // fades in a new row every second or so, and the engine's screenshot already jumps each running CSS or web
  // animation to its end (@e2e-dev/web src/observe.ts takes it with animations: 'disabled').
  await browser.evaluate(async () => {
    const moving = () =>
      document
        .getAnimations()
        .filter((animation) => animation.playState === 'running')
        // A looping animation never ends.
        .filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity)
        .filter((animation) => {
          const target = animation.effect instanceof KeyframeEffect ? animation.effect.target : null;
          if (!target) return true;
          const box = target.getBoundingClientRect();
          return box.bottom > 0 && box.top < window.innerHeight && box.right > 0 && box.left < window.innerWidth;
        });
    const deadline = Date.now() + 5_000;
    while (moving().length > 0 && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 100));
    return null;
  });
}
