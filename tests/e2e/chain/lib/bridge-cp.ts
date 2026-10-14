import { join } from 'node:path';
import type { Browser } from '@e2e-dev/web';
import { expect, type App, type Locator, type Screen } from 'e2e';
import type { Address } from 'viem';
import type { Signer, WalletSend } from '../wallet/signer.ts';
import { utils, type Context } from '@avalabs/avalanchejs';
import {
  type AtomicUtxo,
  type ImportRule,
  type ImportSide,
  UTXO_PAGE,
  MAX_UTXO_PAGES,
  atomicUtxos,
  confirmAtomic,
  importFeeOf,
  importSelection,
  importedUtxoIds,
  importsToClear,
  inputFee,
  isOurAvax,
  notOursReason,
  ourStrandedAvax,
  readHexUtxos,
  strandedUtxos,
  sumOf,
  worthImporting,
} from './atomic.ts';
import { FUJI, NANO_AVAX, cBalance, chainShows, formatNanoAvax, jsonRpc, pBalance, sleep } from './chain.ts';
import { answerFirstVisitPrompts } from '../../lib/visitor.ts';
import { note, toolHeading, toolText } from './console.ts';
import { connectCore } from './fixtures.ts';
import { RUN_DIR, beginSend, finishSend, updateLedger } from './ledger.ts';
import { LIVE_READS, fujiContext } from './teardown.ts';

// Helpers of chain/bridge-cp.e2e.ts: the Console's C/P bridge (/console/primary-network/c-p-bridge,
// components/toolbox/console/primary-network/CrossChainTransfer.tsx), and the balance checks. The shared memory
// reads are in lib/atomic.ts.
//
// The page sends the export when the user clicks 'Export ... AVAX from ...', and then imports by itself when its UTXO
// poll sees the UTXO (lib/atomic.ts explains the two txs). Each import takes the key's own AVAX that one import can
// take at the price that the page reads (atomic.ts importSelection, pageImportRule), and the page gives the SDK
// exactly those UTXOs.
//
// The page polls the public API from the browser: the UTXOs of both chains every 5 s, and its own tx status. These
// requests do not go through the Node throttle (chain.ts), but they use the same IP.

/** The ledger of this test file. Never the tier 1 default (.run/ledger.json). */
export const BRIDGE_LEDGER = join(RUN_DIR, 'bridge-cp.json');
export const BRIDGE_PATH = '/console/primary-network/c-p-bridge';

/** 0.001 AVAX: the signer's fee cap per atomic tx, and the round-trip limit of the test. */
export const ATOMIC_FEE_CAP = NANO_AVAX / 1_000n;
/** 0.05 AVAX: the signer imports at most this much in one tx. */
const IMPORT_CAP = NANO_AVAX / 20n;
const WEI_PER_NAVAX = 1_000_000_000n;

// ---------------------------------------------------------------------------------------------------------------------
// Node reads (the atomic reads are in lib/atomic.ts)
// ---------------------------------------------------------------------------------------------------------------------

/** The most UTXOs that importProblems names one by one for each side. */
const IGNORED_LINES = 10;

/**
 * Sorts what waits in shared memory on one side, as the page does (components/toolbox/utils/sharedMemoryImport.ts),
 * at the price of `rule` (pageImportRule). The page's next import takes the key's own AVAX that holds more than the
 * fee of its own input, the largest first, as many as fit in the gas limit of one import (atomic.ts importSelection).
 * The rest of that AVAX waits for a later import.
 * - `problems`: why the e2e wallet cannot sign the next import, or [] when it can. The wallet signs an import of at
 *   most 0.05 AVAX.
 * - `ignored`: the UTXOs that the page leaves, as lines to print. Anyone can export such a UTXO to this address, so it
 *   does not stop a run. These are the UTXOs that are not the key's unlocked AVAX (atomic.ts isOurAvax), and the dust.
 * - `dust`: the key's own AVAX that the page never imports. Each UTXO that does not hold more than the fee of its own
 *   input (atomic.ts inputFee). And all of the key's AVAX on this side when the next import's total is not above its
 *   fee (atomic.ts importFeeOf): the import cannot pay its own fee, so the page imports nothing on this side, and
 *   teardown.ts (pass 3) leaves it too.
 * Without `rule`, the function sorts only the UTXOs that are not the key's AVAX: give a rule when the key's AVAX waits.
 */
export function importProblems(
  side: ImportSide,
  utxos: AtomicUtxo[],
  rule?: ImportRule,
): { problems: string[]; ignored: string[]; dust: AtomicUtxo[] } {
  const foreign = utxos.filter((u) => notOursReason(u));
  const ignored = foreign.slice(0, IGNORED_LINES).map((u) => `${side}: UTXO ${u.utxoId} (${notOursReason(u)})`);
  if (foreign.length > IGNORED_LINES) {
    ignored.push(`${side}: ${foreign.length - IGNORED_LINES} more UTXOs that the key cannot import alone`);
  }
  const ours = utxos.filter(isOurAvax);
  if (!rule || ours.length === 0) return { problems: [], ignored, dust: [] };
  const own = (list: AtomicUtxo[]) => `${formatNanoAvax(sumOf(list))} AVAX of this key in ${list.length} UTXO(s)`;
  const worth = new Set(worthImporting(side, ours, rule).map((u) => u.utxoId));
  const small = ours.filter((u) => !worth.has(u.utxoId));
  const smallLine = () =>
    `${side}: ${own(small)}, each not above the fee of its own input of ` +
    `${formatNanoAvax(inputFee(side, ours[0], rule))} AVAX (dust)`;
  const next = importSelection(side, ours, rule);
  if (next.length === 0) {
    ignored.push(smallLine());
    return { problems: [], ignored, dust: ours };
  }
  const total = sumOf(next);
  const fee = importFeeOf(side, next, rule);
  if (total <= fee) {
    const share =
      next.length < ours.length
        ? `${own(ours)}. One import takes ${next.length} of them: ${formatNanoAvax(total)} AVAX,`
        : `${own(ours)},`;
    ignored.push(`${side}: ${share} not above the import fee of ${formatNanoAvax(fee)} AVAX (dust)`);
    return { problems: [], ignored, dust: ours };
  }
  if (small.length > 0) ignored.push(smallLine());
  const problems =
    total > IMPORT_CAP
      ? [
          `${side}: the next import takes ${formatNanoAvax(total)} AVAX of this key, above the wallet's import cap of 0.05 AVAX`,
        ]
      : [];
  return { problems, ignored, dust: small };
}

/**
 * The C-Chain base fee in nAVAX per gas, rounded up, and at least 1: the price of the page's C-Chain rule
 * (sharedMemoryImport.ts baseFeeNanoAvax). teardown.ts pays twice the base fee, so its rule is stricter.
 */
async function pageCBaseFeeNanoAvax(): Promise<bigint> {
  const wei = BigInt(await jsonRpc<string>(FUJI.cRpc, 'eth_baseFee', []));
  const nAvax = (wei + WEI_PER_NAVAX - 1n) / WEI_PER_NAVAX;
  return nAvax > 0n ? nAvax : 1n;
}

let fujiContextRead: Promise<Context.Context> | undefined;

/** The Fuji context (teardown.ts fujiContext), read once per process. A failed read is not kept. */
function pageContext(): Promise<Context.Context> {
  fujiContextRead ??= fujiContext().catch((error: unknown) => {
    fujiContextRead = undefined;
    throw error;
  });
  return fujiContextRead;
}

/**
 * The rule of the page's next import on `side` (atomic.ts ImportRule): the Fuji context and the price that the page
 * reads, the P-Chain gas price or the C-Chain base fee. So the test selects the same UTXOs as the page, and finds the
 * same dust (importProblems).
 */
export async function pageImportRule(side: ImportSide): Promise<ImportRule> {
  const context = await pageContext();
  return { context, price: side === 'P' ? (await LIVE_READS.feeState()).price : await pageCBaseFeeNanoAvax() };
}

/** The rule of the page's next import on each side (pageImportRule). */
export async function pageImportRules(): Promise<Record<ImportSide, ImportRule>> {
  return { P: await pageImportRule('P'), C: await pageImportRule('C') };
}

/** The UTXOs that a check after an import does not wait for: the dust that member 1 of the bridge file left. */
export type LeftUtxos = ReadonlySet<string>;

/** True when the UTXO is the key's own AVAX that the page imports: not one of `left`. */
const waitsForImport = (left: LeftUtxos) => (u: AtomicUtxo) => isOurAvax(u) && !left.has(u.utxoId);

/** The unlocked P-Chain balance and the C-Chain balance, both in nAVAX (the C-Chain wei divided by 1e9). */
export async function balances(signer: Signer): Promise<{ p: bigint; c: bigint }> {
  return {
    p: await pBalance(signer.pChainAddress),
    c: (await cBalance(signer.address as Address)) / WEI_PER_NAVAX,
  };
}

/** Polls both balances until `done` returns them. A node of the public API can lag a tx. */
export async function chainShowsBalances(
  signer: Signer,
  what: string,
  done: (now: { p: bigint; c: bigint }) => boolean,
): Promise<{ p: bigint; c: bigint }> {
  return chainShows(`the balances show ${what}`, async () => {
    const now = await balances(signer);
    return done(now) ? now : null;
  });
}

/**
 * Polls until shared memory holds none of the key's own AVAX on either side, except the dust in `left`. UTXOs that
 * the key cannot import alone stay.
 */
export async function chainShowsNoUtxos(pChainAddress: string, left: LeftUtxos = new Set()): Promise<void> {
  await chainShows('no AVAX waits in shared memory for this key', async () => {
    const stranded = await strandedUtxos(pChainAddress);
    return [...stranded.P, ...stranded.C].some(waitsForImport(left)) ? null : true;
  });
}

/** Throws unless min <= change <= max (all nAVAX), with the values as AVAX. */
export function expectChange(label: string, change: bigint, min: bigint, max: bigint): void {
  if (change >= min && change <= max) return;
  const avax = (n: bigint) => `${n < 0n ? '-' : ''}${formatNanoAvax(n < 0n ? -n : n)}`;
  throw new Error(`${label}: changed by ${avax(change)} AVAX, expected ${avax(min)} to ${avax(max)} AVAX`);
}

// ---------------------------------------------------------------------------------------------------------------------
// Ledger
// ---------------------------------------------------------------------------------------------------------------------

/** Writes the tx ID of a step after the wallet sent it. */
export function recordSent(step: string, txId: string, path = BRIDGE_LEDGER): void {
  updateLedger((ledger) => {
    const send = ledger.sends.find((s) => s.step === step);
    if (!send) throw new Error(`The ledger has no step '${step}'. Call beginSend first.`);
    if (!send.txIds.includes(txId)) send.txIds.push(txId);
    send.status = 'sent';
    send.updatedAt = new Date().toISOString();
  }, path);
}

/** Marks the steps that sent nothing yet as failed. A step with a tx keeps 'sent': its tx can still land. */
export function failPendingSteps(error: unknown, path = BRIDGE_LEDGER): void {
  const message = error instanceof Error ? error.message : String(error);
  updateLedger((ledger) => {
    for (const send of ledger.sends) {
      if (send.status !== 'pending') continue;
      send.status = 'failed';
      send.error = message;
      send.updatedAt = new Date().toISOString();
    }
  }, path);
}

// ---------------------------------------------------------------------------------------------------------------------
// The page
// ---------------------------------------------------------------------------------------------------------------------

// The page's own error messages (CrossChainTransfer.tsx). Its error boxes have no role (UX finding B23), so the test
// reads them by text. 'Export failed:' shows twice (under the amount and in the box), so the test takes the first.
// A wallet rejection shows WALLET_REJECTED (chain/lib/console.ts) with no prefix.
const PAGE_ERROR =
  /^(You rejected the request in your wallet\. |Export failed: |Import failed: |Amount exceeds available balance|Please enter a valid positive amount|Amount is below the smallest|Could not load network parameters|Network parameters are still loading|Cross-chain transfers require Core Wallet|No funds available to import yet)/;

// The page's own UTXO reads (pvm.PVMApi and evm.EVMApi of avalanchejs, from the browser).
const PAGE_P_READ = /^https:\/\/api\.avax-test\.network\/ext\/bc\/P(?:[?#]|$)/;
const PAGE_C_READ = /^https:\/\/api\.avax-test\.network\/ext\/bc\/C\/avax(?:[?#]|$)/;
// The network context that the page loads before it can build a tx (hooks/useAvalancheContext.ts).
const CONTEXT_READ = /\/api\/avalanche-context\?testnet=true$/;

/** The page's error message, or undefined when it shows none. */
export async function bridgeError(screen: Screen): Promise<string | undefined> {
  const box = screen.getByText(PAGE_ERROR).first();
  if (!(await box.isVisible())) return undefined;
  return (await box.textContent()) ?? '(no text)';
}

/** 'Start New Transfer': the page shows it when the import is accepted. */
export function startNewTransfer(screen: Screen): Locator {
  return screen.getByRole('button', 'Start New Transfer');
}

/**
 * Opens the bridge and waits until the page can build a tx: the wallet is connected and the page has the Fuji
 * network context. `connect`: the first visit of the group, which answers the first-visit prompts and runs
 * connectCore. Later loads connect again by themselves.
 */
export async function openBridge(app: App, browser: Browser, screen: Screen, { connect = false } = {}): Promise<void> {
  // A response wait needs an open page. The first visit has none yet, so it opens a small static file and answers the
  // first-visit prompts there (as openAsReturningVisitor does) before the wait starts.
  if (connect) {
    await app.open('/small-logo.png');
    await answerFirstVisitPrompts(browser);
  }
  // Started before the load, so the response cannot come first. The catch keeps a failed wait from going unhandled.
  const context = browser
    .waitForResponse(CONTEXT_READ, { timeout: 120_000 })
    .catch((error: unknown) => (error instanceof Error ? error : new Error(String(error))));
  if (connect) {
    await app.open(BRIDGE_PATH);
    await connectCore(screen);
  } else {
    await app.open(BRIDGE_PATH);
    // The header shows the P-Chain balance once the Console has the Core client and the P-Chain address.
    await expect(screen.getByRole('button', /P-Chain.*AVAX$/)).toBeVisible({ timeout: 60_000 });
  }
  await expect(toolHeading(screen, 'Cross-Chain Transfer')).toBeVisible();
  const response = await context;
  if (response instanceof Error) throw new Error(`The page did not load the Fuji network context: ${response.message}`);
  if (response.status !== 200) throw new Error(`The page's network context request answered HTTP ${response.status}`);
}

/**
 * Waits until the page shows its export button. A load right after an import can read the UTXOs from a node of the
 * public API that has not seen the import yet. Then the page offers a pending import of a UTXO that is gone, and it
 * keeps the stale state after the next poll. One reload after the Node check clears it.
 */
export async function waitForExportReady(app: App, browser: Browser, screen: Screen): Promise<void> {
  const ready = screen.getByRole('button', /^Export .* AVAX from (C|P)-Chain$/);
  try {
    await expect(ready).toBeVisible({ timeout: 60_000 });
  } catch {
    note(`the bridge shows no export button (${await describePage(browser)}); reloading once`);
    await openBridge(app, browser, screen);
    await expect(ready).toBeVisible({ timeout: 60_000 });
  }
}

/** Shows 'From <chain>-Chain'. The page starts at C-Chain to P-Chain; 'Swap chains' turns it round. */
export async function setDirection(screen: Screen, from: ImportSide): Promise<void> {
  const label = screen.getByText(`From ${from}-Chain`, { exact: true });
  if (await label.isVisible()) return;
  await screen.getByRole('button', 'Swap chains').click();
  await expect(label).toBeVisible();
}

/** The amount field under 'From ...' (CrossChainTransfer.tsx: AmountInput with aria-label 'Amount'). */
function amountField(screen: Screen): Locator {
  return screen.getByRole('spinbutton', 'Amount');
}

/** The counts of the signer's sends and refusals before a click, so a wait sees only what the click caused. */
export interface SendMark {
  sends: number;
  refusals: number;
}

export const markOf = (signer: Signer): SendMark => ({
  sends: signer.sends.length,
  refusals: signer.refusals.length,
});

/** Waits for the wallet's next send of this type. Fails at once on a wallet refusal or a page error. */
export async function waitForBridgeSend(
  screen: Screen,
  browser: Browser,
  signer: Signer,
  mark: SendMark,
  txType: string,
  timeoutMs: number,
): Promise<WalletSend> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const send = signer.sends.slice(mark.sends).find((s) => s.txType === txType);
    if (send) return send;
    const refusal = signer.refusals[mark.refusals];
    if (refusal) {
      throw new Error(
        `The wallet refused ${refusal.method} ${refusal.txType ?? ''} before ${txType}: ${refusal.reason}`,
      );
    }
    const failure = await bridgeError(screen);
    if (failure) throw new Error(`The page failed before the wallet sent ${txType}: ${failure}`);
    if (Date.now() > deadline) {
      throw new Error(
        `In ${Math.round(timeoutMs / 1000)} s the wallet sent no ${txType}. ${await describePage(browser)}`,
      );
    }
    await sleep(500);
  }
}

/** Waits for 'Start New Transfer'. Fails at once on a page error. */
export async function waitForTransferDone(
  screen: Screen,
  browser: Browser,
  label: string,
  timeoutMs = 180_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    if (await startNewTransfer(screen).isVisible()) return;
    const failure = await bridgeError(screen);
    if (failure) throw new Error(`${label}: the page shows '${failure}'`);
    if (Date.now() > deadline) {
      throw new Error(
        `${label}: no 'Start New Transfer' in ${Math.round(timeoutMs / 1000)} s. ${await describePage(browser)}`,
      );
    }
    await sleep(1_000);
  }
}

/**
 * Waits until the page has read both UTXO lists with nothing to import. 'Start New Transfer' shows before the page's
 * UTXO lists catch up with the import. When a list still holds the imported UTXO, the button and the page's next
 * render offer a pending import of it, and hide the export button (CrossChainTransfer.tsx, the 'Start New Transfer'
 * handler and the auto-skip effect). So the test clicks only after the page read both lists with none of the key's
 * own AVAX in them. The page ignores the other UTXOs, and the test ignores them and the dust in `left` too. The page
 * reads a list page by page (sharedMemoryImport.ts readSharedMemory): a list is clear only when each page up to a
 * short page holds nothing to import.
 */
export async function waitForPageToSeeNoUtxos(
  browser: Browser,
  pChainAddress: string,
  left: LeftUtxos = new Set(),
  timeoutMs = 60_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  const own = utils.bech32ToBytes(pChainAddress);
  const clearRead = async (pattern: RegExp, vm: 'PVM' | 'EVM', what: string) => {
    // False when a page of this read holds something to import. A short page ends the read, and so does the last page
    // that the page reads (MAX_UTXO_PAGES): past it, the page reads no more.
    let clear = true;
    let pages = 0;
    for (;;) {
      const wait = deadline - Date.now();
      if (wait <= 0)
        throw new Error(`The page did not read a ${what} UTXO list with nothing to import in ${timeoutMs / 1000} s`);
      const response = await browser.waitForResponse(pattern, { timeout: wait });
      const body = await response.json<{ result?: { utxos?: unknown } }>().catch(() => undefined);
      const utxos = body?.result?.utxos;
      if (!Array.isArray(utxos)) continue;
      // A list that the test cannot read counts as one with something to import: the next poll reads it again.
      let read: AtomicUtxo[] | undefined;
      try {
        read = readHexUtxos(vm, utxos as string[], own);
      } catch {
        read = undefined;
      }
      if (!read || read.some(waitsForImport(left))) clear = false;
      pages++;
      if (utxos.length < UTXO_PAGE || pages >= MAX_UTXO_PAGES) {
        if (clear) return;
        clear = true;
        pages = 0;
      }
    }
  };
  // One after the other: each poll of the page reads the P-Chain list first, then the C-Chain list.
  await clearRead(PAGE_P_READ, 'PVM', 'P-Chain');
  await clearRead(PAGE_C_READ, 'EVM', 'C-Chain');
  // The page sets its state from the response; give React one render.
  await sleep(1_000);
}

/** One line about the page for an error: the URL and the tool card's text. */
async function describePage(browser: Browser): Promise<string> {
  const url = await browser.url().catch(() => '(no URL)');
  const text = await toolText(browser).catch(() => '(no tool text)');
  return `Page ${url}. The tool card shows:\n${text}`;
}

// ---------------------------------------------------------------------------------------------------------------------
// Flows
// ---------------------------------------------------------------------------------------------------------------------

export interface Leg {
  from: ImportSide;
  to: ImportSide;
  exportStep: string;
  importStep: string;
  exportType: string;
  importType: string;
}

export const P_TO_C: Leg = {
  from: 'P',
  to: 'C',
  exportStep: 'p-to-c-export',
  importStep: 'p-to-c-import',
  exportType: 'pvm.ExportTx',
  importType: 'evm.ImportTx',
};

export const C_TO_P: Leg = {
  from: 'C',
  to: 'P',
  exportStep: 'c-to-p-export',
  importStep: 'c-to-p-import',
  exportType: 'evm.ExportTx',
  importType: 'pvm.ImportTx',
};

const importType = (side: ImportSide) => (side === 'P' ? 'pvm.ImportTx' : 'evm.ImportTx');

/**
 * One transfer through the page: set the direction, type the amount, click the export button, and wait while the
 * page exports and then imports by itself. The ledger gets both steps before the click (one click causes both txs),
 * each tx ID when the wallet sends it, and 'landed' when the chain accepted the tx.
 */
export async function runLeg(
  screen: Screen,
  browser: Browser,
  signer: Signer,
  leg: Leg,
  amountAvax: string,
  ledgerPath = BRIDGE_LEDGER,
): Promise<{ exportTx: WalletSend; importTx: WalletSend }> {
  await setDirection(screen, leg.from);
  const field = amountField(screen);
  await field.fill(amountAvax);
  await expect(field).toHaveValue(amountAvax);
  const exportButton = screen.getByRole('button', `Export ${amountAvax} AVAX from ${leg.from}-Chain`);
  await expect(exportButton).toBeEnabled();

  const inputs = { amountAvax, from: `${leg.from}-Chain`, to: `${leg.to}-Chain`, address: signer.pChainAddress };
  beginSend(leg.exportStep, leg.from, { ...inputs, txType: leg.exportType }, ledgerPath);
  beginSend(leg.importStep, leg.to, { ...inputs, txType: leg.importType, sentBy: 'the page' }, ledgerPath);
  const mark = markOf(signer);
  try {
    await exportButton.click();
    const exportTx = await waitForBridgeSend(screen, browser, signer, mark, leg.exportType, 180_000);
    recordSent(leg.exportStep, exportTx.hash, ledgerPath);
    finishSend(leg.exportStep, { status: 'landed', outputs: await confirmAtomic(leg.from, exportTx.hash) }, ledgerPath);

    // The page waits for its own confirmation of the export, polls the UTXOs for up to 30 s, and then imports.
    const importTx = await waitForBridgeSend(screen, browser, signer, mark, leg.importType, 300_000);
    recordSent(leg.importStep, importTx.hash, ledgerPath);
    finishSend(leg.importStep, { status: 'landed', outputs: await confirmAtomic(leg.to, importTx.hash) }, ledgerPath);

    await waitForTransferDone(screen, browser, `${leg.from}-Chain to ${leg.to}-Chain`);
    return { exportTx, importTx };
  } catch (error) {
    failPendingSteps(error, ledgerPath);
    throw error;
  }
}

/**
 * Clicks the page's pending import ('Pending import from a previous transfer', button 'Import <amount> AVAX to
 * <chain>'), which shows when shared memory holds AVAX for this key. The page imports one selection of the key's AVAX
 * (atomic.ts importSelection at pageImportRule). Waits until the chain accepted the import, checks that it spent
 * exactly that selection, and waits until shared memory no longer holds it. Returns the side, the wallet's send and
 * the selection.
 */
export async function importPending(
  screen: Screen,
  browser: Browser,
  signer: Signer,
  step: string,
  { ledgerPath = BRIDGE_LEDGER }: { ledgerPath?: string } = {},
): Promise<{ side: ImportSide; send: WalletSend; utxos: AtomicUtxo[] }> {
  const button = screen.getByRole('button', /^Import [0-9.]+ AVAX to (P|C)-Chain$/);
  await expect(button).toBeVisible({ timeout: 90_000 });
  await expect(screen.getByText('Pending import from a previous transfer', { exact: true })).toBeVisible();
  const name = (await button.textContent()) ?? '';
  const side = /to P-Chain/.test(name) ? 'P' : 'C';
  const utxos = importSelection(side, await atomicUtxos(side, signer.pChainAddress), await pageImportRule(side));
  const expected = new Set(utxos.map((u) => u.utxoId));
  beginSend(
    step,
    side,
    {
      txType: importType(side),
      button: name.trim(),
      utxos: [...expected],
      amount: formatNanoAvax(sumOf(utxos)),
    },
    ledgerPath,
  );
  const mark = markOf(signer);
  try {
    await button.click();
    const send = await waitForBridgeSend(screen, browser, signer, mark, importType(side), 180_000);
    recordSent(step, send.hash, ledgerPath);
    finishSend(step, { status: 'landed', outputs: await confirmAtomic(side, send.hash) }, ledgerPath);
    // The page builds the import from its own selection, not from every UTXO at the address (CrossChainTransfer.tsx
    // handleImport). A UTXO that the key cannot spend never goes into the SDK's fee count.
    const spent = await importedUtxoIds(side, send.hash);
    const missing = [...expected].filter((id) => !spent.includes(id));
    const extra = spent.filter((id) => !expected.has(id));
    if (missing.length > 0 || extra.length > 0) {
      throw new Error(
        `The ${side}-Chain import ${send.hash} spent ${spent.length} UTXO(s), not the ${expected.size} that the test ` +
          `expects. Not spent: ${missing.join(', ') || 'none'}. Not expected: ${extra.join(', ') || 'none'}.`,
      );
    }
    await chainShows(`shared memory no longer holds the UTXOs that the ${side}-Chain imported`, async () =>
      (await atomicUtxos(side, signer.pChainAddress)).some((u) => expected.has(u.utxoId)) ? null : true,
    );
    await waitForTransferDone(screen, browser, `the pending import to the ${side}-Chain`);
    return { side, send, utxos };
  } catch (error) {
    failPendingSteps(error, ledgerPath);
    throw error;
  }
}

/**
 * In-run teardown after a failed transfer: brings AVAX that waits in shared memory back to the key through the page.
 * First it gives an import that the page may still be sending 60 s to land. Then, while a side still holds the key's
 * AVAX, it opens the bridge and clicks the pending import: one import per selection (atomic.ts importsToClear at
 * pageImportRules). It does not wait for the dust in `left`. Best effort: it logs what it could not do, and never throws. The backstops:
 * teardown.ts (pass 3) imports what still waits after the run, and the next run's first member imports what is left
 * after that.
 */
export async function recoverStranded(
  app: App,
  browser: Browser,
  screen: Screen,
  signer: Signer,
  { left: dust = new Set(), ledgerPath = BRIDGE_LEDGER }: { left?: LeftUtxos; ledgerPath?: string } = {},
): Promise<void> {
  try {
    const address = signer.pChainAddress;
    const notDust = (u: AtomicUtxo) => !dust.has(u.utxoId);
    const waiting = async () => {
      const stranded = await ourStrandedAvax(address);
      return [...stranded.P, ...stranded.C].filter(notDust).length;
    };
    const settle = Date.now() + 60_000;
    let left = await waiting();
    while (left > 0 && Date.now() < settle) {
      await sleep(10_000);
      left = await waiting();
    }
    // The page's rule needs the prices only when the key's AVAX waits.
    const rules = left > 0 ? await pageImportRules() : undefined;
    const start = await strandedUtxos(address);
    const imports = rules
      ? importsToClear('P', start.P.filter(notDust), rules.P) + importsToClear('C', start.C.filter(notDust), rules.C)
      : 0;
    for (let attempt = 1; rules && left > 0 && attempt <= imports; attempt++) {
      const stranded = await strandedUtxos(address);
      const problems = [
        ...importProblems('P', stranded.P, rules.P).problems,
        ...importProblems('C', stranded.C, rules.C).problems,
      ];
      if (problems.length > 0) {
        note(`recovery: the page cannot import what waits in shared memory: ${problems.join('; ')}`);
        return;
      }
      await openBridge(app, browser, screen);
      const { side, send } = await importPending(screen, browser, signer, `recovery-import-${attempt}`, { ledgerPath });
      note(`recovery: imported to the ${side}-Chain in ${send.hash}`);
      left = await waiting();
    }
    note(
      left > 0
        ? `recovery: ${left} UTXOs of the key still wait in shared memory`
        : 'recovery: no AVAX waits for the key',
    );
  } catch (error) {
    note(`recovery stopped: ${error instanceof Error ? error.message.split('\n')[0] : String(error)}`);
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// /console/history
// ---------------------------------------------------------------------------------------------------------------------

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** The tx ID as the history shows it: 8 characters, '...', the last 6 (app/console/history/page.tsx shortAddr). */
function shortId(txId: string): string {
  return txId.length > 14 ? `${txId.slice(0, 8)}...${txId.slice(-6)}` : txId;
}

/**
 * The text of one row of the history's 'Transaction History' list: the operation, the short tx ID, the status, the
 * chain badge and the network badge, run together. The badge is 'P-Chain' for a P-Chain tx and 'C-Chain' for a
 * C-Chain atomic tx of the bridge. The rows have no role (each is a clickable div, app/console/history/page.tsx), so
 * the test finds a row by its text. getByText answers with the innermost match: the row.
 */
export function historyRow(operation: string, txId: string, chain: 'P-Chain' | 'C-Chain' = 'P-Chain'): RegExp {
  const id = escapeRegExp(shortId(txId));
  return new RegExp(`^${escapeRegExp(operation)}\\s*${id}\\s*Confirmed\\s*${chain}\\s*Fuji`);
}
