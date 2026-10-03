import { test, type Browser } from '@e2e-dev/web';

// The phone target is 390 px wide and the site's mobile layout starts below 768 px (Tailwind md).
const MOBILE_MAX_WIDTH = 767;

// The test states the right behavior for a bug the site still has. It is skipped, so CI stays green.
// Set E2E_KNOWN_BUGS=1 to run it and see it fail. Remove the call when the fix lands.
export function knownBug(reason: string): void {
  test.skip(!process.env.E2E_KNOWN_BUGS, `known bug: ${reason}`);
}

// The test uses agent steps, which need a model key. Without ANTHROPIC_API_KEY the test is skipped.
// Take the fixtures as one object and read `agent` after this call: a fixture named in the parameter list
// is set up before the first line runs, and setting up `agent` without a key stops the whole run.
export function needsModel(): void {
  test.skip(!process.env.ANTHROPIC_API_KEY, 'needs a model: set ANTHROPIC_API_KEY');
}

// Every target uses platform web, so a test reads the page width to learn which layout it has.
export async function isPhoneLayout(browser: Browser): Promise<boolean> {
  return (await browser.evaluate(() => window.innerWidth)) <= MOBILE_MAX_WIDTH;
}

export async function desktopOnly(browser: Browser, reason = 'desktop layout only'): Promise<void> {
  test.skip(await isPhoneLayout(browser), reason);
}

export async function phoneOnly(browser: Browser, reason = 'phone layout only'): Promise<void> {
  test.skip(!(await isPhoneLayout(browser)), reason);
}
