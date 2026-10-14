// The Warp steps of the Console's validator flows, shared by chain/poa-cchain.e2e.ts and chain/pos-erc20-cchain.e2e.ts:
// the P-Chain registration of a new validator, a completion on the manager (C-Chain), and a step in two clicks
// (aggregate, then deliver). Each retries through lib/warp.ts deliverWithRetry until the chain shows the result, and
// each send goes through lib/ledger.ts sendOnce with the test file's own ledger. lib/console-map.md lists the
// controls and the success signals of each step.

import type { Browser } from '@e2e-dev/web';
import { expect, type Locator, type Screen } from 'e2e';
import type { Hex } from 'viem';
import { chainShows, waitForCTx, waitForPTx } from './chain.ts';
import { busyThenIdle, clickAndSettle, note, readStore, waitForPage, waitForSend } from './console.ts';
import { finishSend, sendOnce, type ChainName } from './ledger.ts';
import { deliverWithRetry } from './warp.ts';
import type { Signer } from '../wallet/signer.ts';

export interface StepContext {
  browser: Browser;
  screen: Screen;
  signer: Signer;
  /** The ledger of the test file. */
  ledgerPath: string;
}

/**
 * The page's error box after a failed Warp step: a failed submission ('P-Chain transaction failed: ...', 'P-Chain
 * submission failed: ...') or a failed aggregation ('Signature aggregation failed: ...', or the mapped texts that
 * start 'Signature aggregation reached' or 'Signature aggregation could not').
 */
function warpStepFailure(screen: Screen): Locator {
  const failure =
    /^(P-Chain transaction failed|P-Chain submission failed|Signature aggregation failed|Signature aggregation (reached|could not))/;
  return screen.getByRole('alert').filter({ hasText: failure }).first();
}

/**
 * The P-Chain Registration step of the add-validator flow (permissioned-l1s/add-validator/
 * SubmitPChainTxRegisterL1Validator.tsx). One button, 'Sign and submit to P-Chain', aggregates and sends the
 * RegisterL1ValidatorTx. The page enables it once the manager details and the signing subnet have loaded. After a
 * failure the button comes back, so a retry clicks it again. The success is a link named by the tx ID under the exact
 * text 'RegisterL1ValidatorTx ID' (after a failed confirmation the label ends in '(not confirmed)'). Returns the tx ID
 * that the page shows; the flow store's pChainTxId must hold the same ID.
 */
export async function registerOnPChain(
  o: StepContext & {
    step: string;
    label: string;
    /** The localStorage key of the flow store, for the cross-check of the tx ID. */
    storeKey: string;
    landed: () => Promise<boolean>;
    /** Waits until the step shows what the test checks before the click. */
    ready: () => Promise<void>;
  },
): Promise<string> {
  const { browser, screen, signer } = o;
  let attempts = 0;
  let shownTxId = '';
  const firstSend = signer.sends.length;
  await sendOnce({
    step: o.step,
    chain: 'P',
    path: o.ledgerPath,
    landed: o.landed,
    send: async () => {
      const result = await deliverWithRetry({
        label: o.label,
        log: note,
        landed: o.landed,
        deliver: async () => {
          await o.ready();
          const from = signer.sends.length;
          const button = screen.getByRole('button', 'Sign and submit to P-Chain');
          await expect(button).toBeEnabled({ timeout: 90_000 });
          await button.click();
          const idle = busyThenIdle(button);
          const failure = warpStepFailure(screen);
          const tx = await waitForSend(browser, signer, from, 'pvm.RegisterL1ValidatorTx', {
            timeoutMs: 6 * 60_000,
            failed: async () => (await idle()) || (await failure.isVisible()),
          });
          note(`${o.label}: tx ${tx.hash}`);
          await waitForPTx(tx.hash);
          shownTxId = await shownPChainTxId(browser, screen, `${o.label} success`, 'RegisterL1ValidatorTx ID', tx.hash);
          const stored = (await readStore(browser, o.storeKey)).pChainTxId;
          expect(stored, `the flow store's pChainTxId (${o.storeKey})`).toBe(shownTxId);
        },
      });
      attempts = result.attempts;
      return { txIds: signer.sends.slice(firstSend).map((s) => s.hash) };
    },
    confirm: () => chainShows(o.label, o.landed),
  });
  finishSend(o.step, { status: 'landed', attempts }, o.ledgerPath);
  // A send of an earlier run: the page of this run shows no tx, so the store is the only record.
  if (!shownTxId) shownTxId = String((await readStore(browser, o.storeKey)).pChainTxId ?? '');
  return shownTxId;
}

/**
 * The P-Chain tx ID that the page shows in a Success box (components/toolbox/components/Success.tsx): the `label`
 * (a string matches the whole text), then a link named by the ID to /explorer/fuji/p-chain/tx/<ID>. Waits for the
 * label, checks that the link names the wallet's tx (`expected`) and points at it, and returns the ID as the page
 * shows it.
 */
export async function shownPChainTxId(
  browser: Browser,
  screen: Screen,
  what: string,
  label: string | RegExp,
  expected: string,
): Promise<string> {
  const shown = typeof label === 'string' ? screen.getByText(label, { exact: true }) : screen.getByText(label);
  await waitForPage(browser, what, shown, 120_000);
  const link = screen.getByRole('link', expected);
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute('href', `/explorer/fuji/p-chain/tx/${expected}`);
  return (await link.textContent())?.trim() ?? '';
}

/**
 * A completion that one button does on the C-Chain: it aggregates the P-Chain's signed message and sends the tx with
 * the Warp access list (Complete validator registration, Complete Weight Change, Sign and complete validator removal,
 * and the PoS completions). The page enables the button once the manager details and the signing subnet have
 * loaded, and again after a failed or reverted try, so a retry clicks it again. `beforeRetry` runs first on a retry,
 * for a step that needs more (a remount). Returns the attempts that clicked.
 */
export async function completeOnManager(
  o: StepContext & {
    step: string;
    label: string;
    button: string;
    done: Locator;
    landed: () => Promise<boolean>;
    ready: () => Promise<void>;
    beforeRetry?: () => Promise<void>;
  },
): Promise<number> {
  const { browser, screen, signer } = o;
  let attempts = 0;
  await sendOnce({
    step: o.step,
    chain: 'C',
    path: o.ledgerPath,
    landed: o.landed,
    send: async () => {
      const from = signer.sends.length;
      const result = await deliverWithRetry({
        label: o.label,
        log: note,
        landed: o.landed,
        deliver: async (attempt) => {
          if (attempt > 1 && o.beforeRetry) await o.beforeRetry();
          await o.ready();
          const start = signer.sends.length;
          const button = screen.getByRole('button', o.button);
          await expect(button).toBeEnabled({ timeout: 90_000 });
          await button.click();
          const tx = await waitForSend(browser, signer, start, 'eth_sendTransaction', {
            timeoutMs: 6 * 60_000,
            failed: busyThenIdle(button),
          });
          note(`${o.label}: tx ${tx.hash}`);
          await waitForCTx(tx.hash as Hex);
          await waitForPage(browser, `${o.label} success`, o.done);
        },
      });
      attempts = result.attempts;
      return { txIds: signer.sends.slice(from).map((s) => s.hash) };
    },
    confirm: () => chainShows(o.label, o.landed),
  });
  finishSend(o.step, { status: 'landed', attempts }, o.ledgerPath);
  return attempts;
}

/**
 * The HashChip (components/explorer-v2/ui.tsx HashChip, format.ts truncate) that shows `value`: its text is the
 * first `len` characters, '…' and the last 4 (the whole value when it is at most `len` + 6 long). Its title holds
 * the whole value. `ignoreCase` is for a hex value that a store can keep in another case.
 */
export function hashChip(screen: Screen, value: string, len: number, { ignoreCase = false } = {}): Locator {
  const text = value.length <= len + 6 ? value : `${value.slice(0, len)}…${value.slice(-4)}`;
  if (!ignoreCase) return screen.getByText(text, { exact: true });
  return screen.getByText(new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'));
}

/**
 * A Warp step in two clicks: 'Aggregate signatures', then the deliver button. The P-Chain weight update of the
 * weight, removal and delegation flows (console/shared/SubmitPChainTxWeightUpdate.tsx) sends a
 * SetL1ValidatorWeightTx with 'Submit to P-Chain'; the PoS Complete Removal (permissionless-l1s/withdraw/
 * CompleteValidatorRemoval.tsx) sends a C-Chain tx. After a failed submission the step keeps its signature and shows
 * no 'Aggregate signatures' button, so a retry mounts the step again first (beforeRetry) and aggregates a fresh
 * signature. Returns the attempts.
 */
export async function aggregateThenSend(
  o: StepContext & {
    step: string;
    chain: ChainName;
    label: string;
    landed: () => Promise<boolean>;
    beforeRetry: () => Promise<void>;
    /** The deliver button, for example 'Submit to P-Chain'. */
    button: string;
    /** 'pvm.SetL1ValidatorWeightTx' or 'eth_sendTransaction'. */
    txType: string;
    /**
     * What the page shows after the tx: a text, or `{ txChip: len }`, the HashChip of the wallet's tx with that
     * length (SubmitPChainTxWeightUpdate.tsx shows 'P-Chain tx' with a chip of length 18). The chip's title must hold
     * the whole tx ID.
     */
    done: RegExp | { txChip: number };
    /** The start of the page's error box, when the step has its own texts (default: warpStepFailure). */
    failure?: RegExp;
  },
): Promise<number> {
  const { browser, screen, signer } = o;
  let attempts = 0;
  await sendOnce({
    step: o.step,
    chain: o.chain,
    path: o.ledgerPath,
    landed: o.landed,
    send: async () => {
      const from = signer.sends.length;
      const result = await deliverWithRetry({
        label: o.label,
        log: note,
        landed: o.landed,
        aggregate: async (attempt) => {
          if (attempt > 1) await o.beforeRetry();
          const aggregate = screen.getByRole('button', 'Aggregate signatures');
          await expect(aggregate).toBeEnabled({ timeout: 90_000 });
          await clickAndSettle(browser, 'Aggregate signatures', aggregate, screen.getByText('Signatures aggregated'));
        },
        deliver: async () => {
          const start = signer.sends.length;
          const button = screen.getByRole('button', o.button);
          await button.click();
          const idle = busyThenIdle(button);
          const failure = o.failure
            ? screen.getByRole('alert').filter({ hasText: o.failure }).first()
            : warpStepFailure(screen);
          const tx = await waitForSend(browser, signer, start, o.txType, {
            failed: async () => (await idle()) || (await failure.isVisible()),
          });
          note(`${o.label}: tx ${tx.hash}`);
          if (o.chain === 'P') await waitForPTx(tx.hash);
          else await waitForCTx(tx.hash as Hex);
          if (o.done instanceof RegExp) {
            await waitForPage(browser, `${o.label} success`, screen.getByText(o.done));
          } else {
            const chip = hashChip(screen, tx.hash, o.done.txChip);
            await waitForPage(browser, `${o.label} success`, chip);
            await expect(chip).toHaveAttribute('title', tx.hash);
          }
        },
      });
      attempts = result.attempts;
      return { txIds: signer.sends.slice(from).map((s) => s.hash) };
    },
    confirm: () => chainShows(o.label, o.landed),
  });
  finishSend(o.step, { status: 'landed', attempts }, o.ledgerPath);
  return attempts;
}
