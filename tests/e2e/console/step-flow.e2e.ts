import { test } from '@e2e-dev/web';
import { expect } from 'e2e';
import { desktopOnly } from '../lib/skip';
import { waitForHydration } from '../lib/hydration';
import { openAsReturningVisitor } from '../site/helpers';

// The Console's flow motion (Task 13):
// - con-step-travel (components/console/step-flow.tsx, components/console/step-flow-route.tsx): a step flow renders in
//   its base route's layout, so the step bar stays mounted from step to step and one red mark travels on transform.
// - con-palette-instant (components/console/command-palette.tsx, components/ui/dialog.tsx): the command palette, opened
//   from the keyboard many times a day, appears and leaves in one frame.
// - con-busy-keep (components/toolbox/components/Button.tsx): a busy toolbox Button keeps its colours, reads as busy
//   and unavailable (aria-busy and aria-disabled, not the native disabled state) and ignores clicks.

const FLOW = '/console/create-l1';

/** The Create L1 questionnaire's answers, as the flow store keeps them (components/toolbox/stores/createL1FlowStore.ts):
    a PoA L1 with its Validator Manager on the C-Chain. A step route without answers sends the visitor back to the
    questionnaire, which needs a wallet. */
function seedCreateL1Answers(): void {
  localStorage.setItem(
    'v4-create-l1-flow',
    JSON.stringify({
      state: {
        answers: {
          startingPoint: 'new',
          validatorType: 'poa',
          vmLocation: 'c-chain',
          multisig: false,
          hosting: 'docker',
          interoperability: true,
        },
        currentStepIndex: 0,
      },
      version: 0,
    }),
  );
}

/** The red mark of the step bar: the bar's one absolutely placed span outside the segments. */
const MARK = 'nav[aria-label="Steps"] span.pointer-events-none.absolute';

test('the next step keeps the same step bar, and its red mark travels', async ({ app, screen, browser }) => {
  await browser.addInitScript(seedCreateL1Answers);
  await openAsReturningVisitor(app, browser, `${FLOW}/create-subnet`);
  await desktopOnly(browser, 'the Console flow is checked at the desktop size');
  const steps = screen.getByRole('navigation', 'Steps');
  await expect(steps).toBeVisible();
  // A click before hydration would load the next step as a new page.
  await waitForHydration(browser, 'nav[aria-label="Steps"]');

  // Tag the bar and the mark, and record the transitions the mark runs.
  const before = await browser.evaluate((mark) => {
    const nav = document.querySelector('nav[aria-label="Steps"]') as HTMLElement & { __e2eBar?: boolean };
    const red = document.querySelector(mark) as HTMLElement & { __e2eMark?: boolean };
    nav.__e2eBar = true;
    red.__e2eMark = true;
    const runs: string[] = [];
    (window as unknown as { __e2eMarkRuns: string[] }).__e2eMarkRuns = runs;
    red.addEventListener('transitionrun', (event) => runs.push(event.propertyName));
    return Math.round(red.getBoundingClientRect().left);
  }, MARK);

  await screen.getByRole('link', /^Next/).tap();
  await expect(browser).toHaveURL(`${FLOW}/deploy-validator-manager`);
  await expect(steps.getByText(/^Step 2 of \d+/)).toBeVisible();

  const after = await browser.evaluate((mark) => {
    const nav = document.querySelector('nav[aria-label="Steps"]') as (HTMLElement & { __e2eBar?: boolean }) | null;
    const red = document.querySelector(mark) as (HTMLElement & { __e2eMark?: boolean }) | null;
    return {
      sameBar: nav?.__e2eBar === true,
      sameMark: red?.__e2eMark === true,
      runs: (window as unknown as { __e2eMarkRuns?: string[] }).__e2eMarkRuns ?? null,
    };
  }, MARK);
  expect(after.sameBar, 'the step bar is the element the first step showed').toBe(true);
  expect(after.sameMark, 'the red mark is the element the first step showed').toBe(true);
  expect(after.runs, 'the transitions the red mark ran').toContain('transform');
  // The mark ends on the second segment, to the right of where it started.
  await expect
    .poll(() =>
      browser.evaluate((mark) => Math.round(document.querySelector(mark)!.getBoundingClientRect().left), MARK),
    )
    .toBeGreaterThan(before);
});

test('the command palette opened from the keyboard runs no animation', async ({ app, screen, browser }) => {
  await openAsReturningVisitor(app, browser, '/console');
  await desktopOnly(browser, 'Cmd K is a desktop shortcut');
  // The palette's shortcut listener exists after hydration.
  await waitForHydration(browser, 'header.console-header button');
  await browser.evaluate(() => {
    const log: { at: number; what: string }[] = [];
    (window as unknown as { __e2ePalette: typeof log }).__e2ePalette = log;
    const slot = (node: EventTarget | null) => (node as Element | null)?.getAttribute?.('data-slot') ?? '';
    for (const type of ['animationstart', 'transitionrun'] as const) {
      document.addEventListener(
        type,
        (event) => {
          if (slot(event.target).startsWith('dialog'))
            log.push({ at: performance.now(), what: `${type} ${slot(event.target)}` });
        },
        true,
      );
    }
    window.addEventListener('keydown', (event) => log.push({ at: performance.now(), what: `key ${event.key}` }), true);
    new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.removedNodes) {
          if (
            node instanceof Element &&
            (node.matches('[data-slot="dialog-content"]') || node.querySelector('[data-slot="dialog-content"]'))
          ) {
            log.push({ at: performance.now(), what: 'palette removed' });
          }
        }
      }
    }).observe(document.body, { childList: true, subtree: true });
    return null;
  });

  await browser.keyboard.press('Meta+k');
  const palette = screen.getByRole('dialog', 'Command Palette');
  await expect(palette).toBeVisible();
  await new Promise((resolve) => setTimeout(resolve, 300));
  const running = await browser.evaluate(() =>
    [...document.querySelectorAll('[data-slot="dialog-content"], [data-slot="dialog-overlay"]')].flatMap((node) =>
      node.getAnimations().map((animation) => animation.playState),
    ),
  );
  expect(running, 'animations on the palette and its overlay').toEqual([]);

  await browser.keyboard.press('Escape');
  await expect(palette).toBeHidden();
  const log = await browser.evaluate(
    () => (window as unknown as { __e2ePalette: { at: number; what: string }[] }).__e2ePalette,
  );
  expect(
    log.filter((entry) => entry.what.startsWith('animationstart') || entry.what.startsWith('transitionrun')),
  ).toEqual([]);
  const escape = log.find((entry) => entry.what === 'key Escape')!.at;
  const removed = log.find((entry) => entry.what === 'palette removed')!.at;
  expect(removed - escape, 'ms from Escape to the palette leaving').toBeLessThan(100);
});

// A busy state needs an action that waits on something. Deploy Library (the Deploy Validator Manager step) first checks
// that the chain's RPC answers (components/toolbox/lib/rpcPreflight.ts, an eth_chainId POST) and only then asks the
// wallet. The test holds that one request for 3s, so the button stays busy, then fails it: the deploy stops with an
// RPC error before any wallet call. The step needs a connected wallet, so the page gets a read-only stand-in.

/** Init script: an EIP-1193 wallet that answers account and chain reads for a fixed address on the Fuji C-Chain and
    refuses to sign or send anything (code 4001, as a user's Reject). wagmi's reconnect flag connects it at load. */
function readOnlyWallet(): void {
  const address = '0x1111111111111111111111111111111111111111';
  const answers: Record<string, unknown> = {
    eth_accounts: [address],
    eth_requestAccounts: [address],
    eth_chainId: '0xa869',
    net_version: '43113',
    eth_blockNumber: '0x1',
    eth_getBalance: '0x0',
    eth_getTransactionCount: '0x0',
    eth_gasPrice: '0x1',
    wallet_switchEthereumChain: null,
    wallet_addEthereumChain: null,
    wallet_getPermissions: [{ parentCapability: 'eth_accounts' }],
    wallet_requestPermissions: [{ parentCapability: 'eth_accounts' }],
  };
  (window as unknown as { ethereum: unknown }).ethereum = {
    isMetaMask: false,
    request: async ({ method }: { method: string }) => {
      if (method in answers) return answers[method];
      if (/^(eth_send|eth_sign|personal_sign|eth_signTypedData|avalanche_send)/.test(method)) {
        throw Object.assign(new Error('read-only test wallet: nothing is signed'), { code: 4001 });
      }
      if (method === 'eth_call' || method === 'eth_getCode') return '0x';
      return null;
    },
    on: () => undefined,
    removeListener: () => undefined,
  };
  localStorage.setItem('wagmi.injected.connected', 'true');
  localStorage.setItem('wagmi.recentConnectorId', '"injected"');
}

/** The Fuji C-Chain RPC, and the exact body of the preflight's request (rpcPreflight.ts). */
const FUJI_C_RPC = /^https:\/\/api\.avax-test\.network\/ext\/bc\/C\/rpc/;
const PREFLIGHT = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_chainId', params: [] });

test('a busy toolbox Button keeps its look and ignores clicks', async ({ app, screen, browser }) => {
  await app.open('/small-logo.png');
  await desktopOnly(browser, 'the Console flow is checked at the desktop size');
  await browser.addInitScript(seedCreateL1Answers);
  await browser.addInitScript(readOnlyWallet);
  let preflights = 0;
  await browser.route(FUJI_C_RPC, async (route) => {
    if (route.request.method !== 'POST' || route.request.postData !== PREFLIGHT) return route.fallback();
    preflights += 1;
    await new Promise((resolve) => setTimeout(resolve, 3_000));
    return route.fulfill({ status: 503, body: 'held by the test' });
  });
  await openAsReturningVisitor(app, browser, `${FLOW}/deploy-validator-manager`);

  const deploy = screen.getByRole('button', 'Deploy Library');
  await expect(deploy).toBeEnabled();
  await expect(deploy).toHaveAttribute('aria-busy', 'false');
  await waitForHydration(browser, 'nav[aria-label="Steps"]');
  // The button's fill under the pointer, before and while busy: hover first, so both reads are hovered.
  const look = () =>
    browser.evaluate(() => {
      const button = [...document.querySelectorAll('button[aria-busy]')].find((node) =>
        node.textContent?.includes('Deploy Library'),
      ) as HTMLButtonElement;
      const style = getComputedStyle(button);
      return { background: style.backgroundColor, cursor: style.cursor, disabled: button.disabled };
    });
  await deploy.hover();
  await new Promise((resolve) => setTimeout(resolve, 300));
  const idle = await look();
  await deploy.tap();

  // Busy: the accessible name is the busy label, and the button reads as busy and unavailable. It is not natively
  // disabled, so it keeps its colours.
  const busy = screen.getByRole('button', 'Working…');
  await expect(busy).toHaveAttribute('aria-busy', 'true');
  await expect(busy).toHaveAttribute('aria-disabled', 'true');
  await new Promise((resolve) => setTimeout(resolve, 300));
  const working = await look();
  expect(working.disabled, 'the native disabled state while busy').toBe(false);
  expect(working.cursor).toBe('progress');
  expect(working.background, 'the busy fill, against the idle one').toBe(idle.background);

  // Two more clicks while it is busy, neither of which waits for an enabled button: a pointer click on its middle (a
  // tap at a position skips the enabled check) and a click dispatched in the page. Both reach the busy button, and
  // neither starts the deploy again.
  await browser.evaluate(() => {
    const counter = window as unknown as { __e2eBusyClicks: number };
    counter.__e2eBusyClicks = 0;
    window.addEventListener(
      'click',
      (event) => {
        const button = (event.target as Element).closest('button[aria-busy="true"]');
        if (button?.textContent?.includes('Deploy Library')) counter.__e2eBusyClicks += 1;
      },
      true,
    );
    return null;
  });
  const box = await busy.boundingBox();
  await busy.tap({ position: { x: Math.round(box!.width / 2), y: Math.round(box!.height / 2) } });
  await browser.evaluate(() => {
    [...document.querySelectorAll<HTMLButtonElement>('button[aria-busy="true"]')]
      .find((node) => node.textContent?.includes('Deploy Library'))
      ?.click();
    return null;
  });
  const clicks = await browser.evaluate(() => (window as unknown as { __e2eBusyClicks: number }).__e2eBusyClicks);
  expect(clicks, 'clicks that reached the busy button').toBe(2);
  // Both came while it was busy.
  await expect(busy).toHaveAttribute('aria-busy', 'true');
  await expect(screen.getByRole('button', 'Deploy Library')).toHaveAttribute('aria-busy', 'false', { timeout: 15_000 });
  expect(preflights, 'deploys started').toBe(1);
  await expect(screen.getByText(/responded, but not like an EVM endpoint \(HTTP 503\)/)).toBeVisible();
});
