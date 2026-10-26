import { test } from '@e2e-dev/web';
import { expect } from 'e2e';
import { pickTheme } from '../lib/motion';

// site-phone-baseline (app/layout.tsx viewport, components/content-design/theme-observer.tsx): a phone's status bar
// takes the page's colour in the theme picked on the site, not only in the OS scheme. The browser uses the first
// theme-color meta whose media matches; the theme observer puts one with no media first in <head>.
//
// The engine runs Chromium in the light OS scheme and cannot emulate another, so the dark case is the one where a
// meta that followed only the OS scheme would paint the bar white over a dark page.

for (const theme of ['light', 'dark'] as const) {
  test(`theme-color matches the top of the page in the ${theme} theme`, async ({ app, browser }) => {
    await browser.addInitScript(pickTheme, theme);
    await app.open('/');
    await expect(browser).toHaveClass(browser.locator('html'), new RegExp(`\\b${theme}\\b`));

    // Both colours through a canvas, which reads any CSS colour syntax: the meta the browser uses, and the page's
    // backgrounds from <html> down to the element at the top centre (the navbar), painted over white.
    const read = () =>
      browser.evaluate(() => {
        const context = Object.assign(document.createElement('canvas'), { width: 1, height: 1 }).getContext('2d')!;
        const paint = (colours: string[]) => {
          context.fillStyle = '#fff';
          context.fillRect(0, 0, 1, 1);
          for (const colour of colours) {
            context.fillStyle = colour;
            context.fillRect(0, 0, 1, 1);
          }
          return [...context.getImageData(0, 0, 1, 1).data.slice(0, 3)];
        };
        const meta = [...document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')].find(
          (entry) => !entry.media || matchMedia(entry.media).matches,
        );
        const layers: string[] = [];
        for (let at = document.elementFromPoint(innerWidth / 2, 1); at; at = at.parentElement) {
          layers.unshift(getComputedStyle(at).backgroundColor);
        }
        return { meta: meta ? paint([meta.content]) : null, top: paint(layers) };
      });

    // The largest channel gap. The observer sets its meta once the page runs, so wait for it.
    const gap = async () => {
      const { meta, top } = await read();
      return meta ? Math.max(...top.map((channel, i) => Math.abs(channel - meta[i]))) : 255;
    };
    await expect.poll(gap).toBeLessThanOrEqual(3);
  });
}
