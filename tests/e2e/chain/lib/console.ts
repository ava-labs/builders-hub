import type { Browser } from '@e2e-dev/web';
import { expect, type App, type Locator, type Screen } from 'e2e';
import { answerFirstVisitPrompts } from '../../lib/visitor.ts';
import type { Signer, WalletSend } from '../wallet/signer.ts';
import { FUJI } from './chain.ts';

// Page helpers of the Console chain tests. lib/console-map.md lists the controls, the success signals and the traps
// of each step.

// Opens a page as a returning visitor: the privacy banner and the Console welcome dialog are answered
// (lib/visitor.ts), so no dialog hides the page. A small static file loads first, because localStorage needs a page
// of the site.
export async function openAsReturningVisitor(app: App, browser: Browser, path: string): Promise<void> {
  await app.open('/small-logo.png');
  await answerFirstVisitPrompts(browser);
  await app.open(path);
}

// The tool card of the current step: `data-console-tool` holds the tool title (components/toolbox/components/
// Container.tsx). Its heading is level 1.
export function toolHeading(screen: Screen, title: string): Locator {
  return screen.getByRole('heading', title, { level: 1 });
}

// The text of the tool card, for an error message. The Console's error boxes have no role (Alert.tsx, UX finding
// B23), so a failed wait names what the card showed instead.
export async function toolText(browser: Browser): Promise<string> {
  const text = await browser.evaluate(() => {
    const tools = Array.from(document.querySelectorAll<HTMLElement>('[data-console-tool]'));
    return tools.map((tool) => tool.innerText).join('\n---\n');
  });
  const compact = text.replace(/\n{2,}/g, '\n').trim();
  return compact.length > 2_500 ? `...${compact.slice(-2_500)}` : compact;
}

// Waits until the locator is visible. On a timeout the error names the step and adds the tool card's text, so the
// report shows the page's own error message.
export async function waitForPage(
  browser: Browser,
  label: string,
  locator: Locator,
  timeoutMs = 180_000,
): Promise<void> {
  try {
    await expect(locator).toBeVisible({ timeout: timeoutMs });
  } catch (error) {
    const text = await toolText(browser).catch(() => '(no tool text)');
    const reason = error instanceof Error ? error.message.split('\n')[0] : String(error);
    throw new Error(`${label}: ${reason}\nThe tool card shows:\n${text}`);
  }
}

// Waits for the next tx that the wallet sends after `from` (an index into signer.sends) with this type: an
// avalanchejs type such as 'pvm.CreateSubnetTx', or 'eth_sendTransaction'. `failed` reads the page: when it returns
// true before the send, the page gave up, and this throws with the tool card's text.
export async function waitForSend(
  browser: Browser,
  signer: Signer,
  from: number,
  txType: string,
  { timeoutMs = 180_000, failed }: { timeoutMs?: number; failed?: () => Promise<boolean> } = {},
): Promise<WalletSend> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const send = signer.sends.slice(from).find((s) => s.txType === txType);
    if (send) return send;
    const gaveUp = failed ? await failed() : false;
    if (gaveUp || Date.now() > deadline) {
      const text = await toolText(browser).catch(() => '(no tool text)');
      const why = gaveUp
        ? 'The page failed before the wallet sent'
        : `In ${Math.round(timeoutMs / 1000)} s the wallet sent no`;
      throw new Error(`${why} ${txType}. The tool card shows:\n${text}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}

// A `failed` check for waitForSend: true when the button went busy and then came back idle with no send.
export function busyThenIdle(button: Locator): () => Promise<boolean> {
  let sawBusy = false;
  return async () => {
    const idle = await button.isVisible();
    if (!idle) sawBusy = true;
    return sawBusy && idle;
  };
}

// Clicks a button that is busy while its work runs, and waits until `done` shows. While busy, the toolbox Button
// shows 'Loading...' in place of its label (Button.tsx, UX finding B27), so the locator by the idle name stops
// matching. When the idle button comes back without `done`, the work failed: this throws with the tool card's text.
export async function clickAndSettle(
  browser: Browser,
  label: string,
  button: Locator,
  done: Locator,
  timeoutMs = 300_000,
): Promise<void> {
  await button.click();
  const start = Date.now();
  let sawBusy = false;
  for (;;) {
    if (await done.isVisible()) return;
    const idle = await button.isVisible();
    if (!idle) sawBusy = true;
    const failed = (sawBusy && idle) || (!sawBusy && Date.now() - start > 20_000);
    if (failed || Date.now() - start > timeoutMs) {
      const text = await toolText(browser).catch(() => '(no tool text)');
      throw new Error(`${label} ${failed ? 'failed' : 'timed out'}. The tool card shows:\n${text}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}

// Mounts the current step again with client navigation: 'Back', then 'Next'. The flow stores keep their state, and
// the step's React state (a signature, a reverted tx hash) starts fresh. A reload would lose the subnet of the
// validator flows (UX finding A12).
export async function remountStep(screen: Screen, browser: Browser, stepPath: RegExp): Promise<void> {
  await screen.getByRole('link', 'Back').click();
  await expect.poll(async () => stepPath.test(await browser.url()), { timeout: 60_000 }).toBe(false);
  await screen.getByRole('link', 'Next').click();
  await browser.waitForURL(stepPath, { timeout: 60_000 });
}

// The validator flows read the manager details (address, signing subnet) from Glacier when a step mounts
// (hooks/useVMCAddress.ts). Until they load, three steps sign with the L1's own subnet (UX finding A13). The badge
// 'PoA · EOA' shows once the owner type is read, which needs the manager address; the signing subnet comes in the
// same update. CSS shows the badge in upper case; the text is mixed case.
export async function waitForPoaBadge(screen: Screen): Promise<void> {
  await expect(screen.getByText(/^PoA · EOA$/i)).toBeVisible({ timeout: 90_000 });
}

// The Glacier request that ends a step's manager-details load: the record of the manager's chain (the Fuji C-Chain
// for tier 1). Start it before the navigation that mounts the step, and await it after. Used on the change-weight
// steps, which show no badge.
export const MANAGER_CHAIN_RECORD = new RegExp(
  `^https://glacier-api\\.avax\\.network/v1/networks/testnet/blockchains/${FUJI.cBlockchainId}$`,
);

// Moves to the next step of a step flow. 'Next' is a link (components/console/step-flow.tsx).
export async function clickNext(screen: Screen, browser: Browser, nextPath: string | RegExp): Promise<void> {
  await screen.getByRole('link', 'Next').click();
  await browser.waitForURL(nextPath, { timeout: 60_000 });
}

// Reads one persisted zustand store from localStorage: its `state`, or {} when the key is missing.
export async function readStore(browser: Browser, key: string): Promise<Record<string, unknown>> {
  const raw = await browser.evaluate((name) => localStorage.getItem(name) ?? '', key);
  if (!raw) return {};
  const parsed = JSON.parse(raw) as { state?: Record<string, unknown> };
  return parsed.state ?? {};
}

// One line in the run output, with a prefix that a person can grep for.
export function note(message: string): void {
  console.log(`[chain] ${message}`);
}
