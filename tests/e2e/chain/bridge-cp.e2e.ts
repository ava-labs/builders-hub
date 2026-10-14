import type { Browser } from '@e2e-dev/web';
import { expect, type App, type Screen } from 'e2e';
import { type AtomicUtxo, importsToClear, isOurAvax, strandedUtxos, sumOf } from './lib/atomic.ts';
import { auditSends, requireOwnSigner } from './lib/audit.ts';
import {
  ATOMIC_FEE_CAP,
  BRIDGE_LEDGER,
  C_TO_P,
  P_TO_C,
  balances,
  chainShowsBalances,
  chainShowsNoUtxos,
  expectChange,
  historyRow,
  importPending,
  importProblems,
  openBridge,
  pageImportRules,
  recoverStranded,
  runLeg,
  startNewTransfer,
  waitForExportReady,
  waitForPageToSeeNoUtxos,
} from './lib/bridge-cp.ts';
import { NANO_AVAX, assertFuji, formatNanoAvax, isRateLimited } from './lib/chain.ts';
import { note, readStore } from './lib/console.ts';
import { describe, test } from './lib/fixtures.ts';
import { archiveLedger, finishSend, runIdFromEnv, updateLedger } from './lib/ledger.ts';
import type { Signer } from './wallet/signer.ts';

// The Console's C/P bridge (/console/primary-network/c-p-bridge) on Fuji: 0.01 AVAX from the P-Chain to the C-Chain
// and back, between the test key's own addresses. Each leg is two txs that one click starts: the page sends the
// export, and then imports by itself when it sees the UTXO in shared memory. The second leg undoes the first, so a
// passed run leaves the balances where they were, less about 0.000025 AVAX of fees.
//
// The wallet signs atomic txs only with its bridge capability (signer.allowBridge), which member 1 turns on and the
// sends audit (member 5) turns off. Every tx comes from the page; Node only reads the chain to check it.
//
// A run that stops between an export and its import leaves the AVAX in shared memory. The key still owns it. A failed
// leg imports it back through the page before the member fails (recoverStranded). After the run, teardown.ts (pass 3)
// imports whatever still waits, signed in Node; member 1 of the next run imports what is left after that.
//
// Anyone can export a UTXO to the key's address. The test, the page and the teardown leave each UTXO that the key
// cannot import: one that is not the key's own unlocked AVAX, and dust (a UTXO that does not hold more than the fee of
// its own input, or a side where the page's next import is not above its fee). Member 1 records the dust, and the
// later checks do not wait for it. The page builds each import from its own selection of the key's AVAX, and
// importPending checks that the import spent exactly that selection.
//
//   export E2E_CHAIN_FUJI_KEY_FILE=~/.config/e2e-chain/fuji.key   # mode 0600
//   npm run test:chain -- --tag bridge

const runId = runIdFromEnv();

const AMOUNT_AVAX = '0.01';
const AMOUNT = NANO_AVAX / 100n;
// The round trip needs 0.01 AVAX plus fees on the P-Chain. The C-Chain pays only the fees of its atomic txs.
const MIN_P = NANO_AVAX / 50n; // 0.02 AVAX
const MIN_C = NANO_AVAX / 500n; // 0.002 AVAX

// The state of this run. The runner imports this file once for the serial group, so its members share it.
const run: {
  /** Imports of AVAX that an earlier run left in shared memory (member 1), per side. */
  stranded: { P: number; C: number };
  /** Dust that member 1 left in shared memory: its UTXO IDs, and its nAVAX per side. */
  left: Set<string>;
  dust: { P: bigint; C: bigint };
  /** Balances in nAVAX (lib/bridge-cp.ts balances): before the round trip, and after leg 1. */
  before?: { p: bigint; c: bigint };
  afterLeg1?: { p: bigint; c: bigint };
  pExport?: string;
  cImport?: string;
  cExport?: string;
  pImport?: string;
} = { stranded: { P: 0, C: 0 }, left: new Set(), dust: { P: 0n, C: 0n } };

function need<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`An earlier member did not record ${what}.`);
  return value;
}

/**
 * Runs a member's body. On a failure it first brings stranded AVAX back through the page (when `recover` is set and
 * the public API did not rate-limit), then turns off the wallet's capabilities, so a later test in this process does
 * not inherit them. The audit (member 5) turns them off on the passing path.
 */
async function guarded(
  { app, browser, screen, signer }: { app: App; browser: Browser; screen: Screen; signer: Signer },
  recover: boolean,
  body: () => Promise<void>,
): Promise<void> {
  try {
    await body();
  } catch (error) {
    if (recover && !isRateLimited(error)) await recoverStranded(app, browser, screen, signer, { left: run.left });
    signer.revokeAll();
    throw error;
  }
}

describe('C/P bridge round trip of 0.01 AVAX', { serial: true, retries: 0, tags: ['chain', 'bridge'] }, () => {
  test(
    'turns on the bridge and imports AVAX that an earlier run left',
    { timeout: 8 * 60_000 },
    async ({ app, browser, screen, wallet }) => {
      const { signer } = wallet;
      // The sends audit counts every send of the signer, so this file needs a signer that has sent nothing.
      requireOwnSigner(signer, 'bridge');
      archiveLedger(BRIDGE_LEDGER);
      updateLedger((ledger) => {
        ledger.runId = runId;
        ledger.baseUrl = app.baseUrl;
      }, BRIDGE_LEDGER);
      await assertFuji();
      note(`bridge run ${runId}, wallet C ${signer.address}, P ${signer.pChainAddress}`);
      signer.allowBridge();

      await guarded({ app, browser, screen, signer }, false, async () => {
        const address = signer.pChainAddress;
        const start = await balances(signer);
        // The nAVAX that the imports of this member took on each side.
        const imported = { P: 0n, C: 0n };
        const printed = new Set<string>();
        let limit: number | undefined;

        await openBridge(app, browser, screen, { connect: true });
        // The page's next import on a side takes one selection of the key's AVAX (lib/atomic.ts importSelection): the
        // UTXOs that pay for their own input, the largest first, as many as fit in one tx. So each pass sorts shared
        // memory again, as the page does after an import. The dust stays.
        for (let i = 1; ; i++) {
          const all = await strandedUtxos(address);
          // The rule needs the prices that the page reads, only when the key's AVAX waits.
          const rules = [...all.P, ...all.C].some(isOurAvax) ? await pageImportRules() : undefined;
          const sorted = { P: importProblems('P', all.P, rules?.P), C: importProblems('C', all.C, rules?.C) };
          const problems = [...sorted.P.problems, ...sorted.C.problems];
          if (problems.length > 0) {
            throw new Error(`Shared memory holds AVAX that the wallet cannot import here: ${problems.join('; ')}`);
          }
          // Anyone can export a UTXO to this address. A UTXO that the key cannot import alone, and dust (it cannot
          // pay its own import fee), stay where they are. The page and the teardown leave them too.
          const ignored = [...sorted.P.ignored, ...sorted.C.ignored].filter((line) => !printed.has(line));
          for (const line of ignored) printed.add(line);
          if (ignored.length > 0) note(`shared memory: left as they are: ${ignored.join('; ')}`);
          for (const side of ['P', 'C'] as const) {
            for (const u of sorted[side].dust) run.left.add(u.utxoId);
            run.dust[side] = sumOf(all[side].filter((u) => run.left.has(u.utxoId)));
          }
          const importable = (u: AtomicUtxo) => isOurAvax(u) && !run.left.has(u.utxoId);
          const waiting = { P: all.P.filter(importable), C: all.C.filter(importable) };
          note(
            `shared memory: ${formatNanoAvax(sumOf(waiting.P))} AVAX for the P-Chain (${waiting.P.length} UTXOs), ` +
              `${formatNanoAvax(sumOf(waiting.C))} AVAX for the C-Chain (${waiting.C.length} UTXOs)`,
          );
          if (!rules || waiting.P.length + waiting.C.length === 0) break;
          // One import per selection clears what waits on the first pass (lib/atomic.ts importsToClear).
          limit ??= importsToClear('P', waiting.P, rules.P) + importsToClear('C', waiting.C, rules.C);
          if (i > limit) throw new Error(`Shared memory still holds AVAX of this key after ${limit} imports.`);
          if (i > 1) await openBridge(app, browser, screen);
          const { side, send, utxos } = await importPending(screen, browser, signer, `stranded-import-${i}`);
          run.stranded[side] += 1;
          imported[side] += sumOf(utxos);
          note(`imported ${utxos.length} UTXO(s) that waited for the ${side}-Chain: ${send.txType} ${send.hash}`);
        }
        // A fresh page for the round trip: an import leaves the page in its done state.
        if (run.stranded.P + run.stranded.C > 0) await openBridge(app, browser, screen);
        await waitForExportReady(app, browser, screen);

        // The baseline of the round trip must include these imports. A node of the public API can lag them, so
        // poll until both balances show at least the imported AVAX less the fee cap per import.
        const { p, c } = await chainShowsBalances(
          signer,
          'the imports of member 1',
          (now) =>
            now.p >= start.p + imported.P - BigInt(run.stranded.P) * ATOMIC_FEE_CAP &&
            now.c >= start.c + imported.C - BigInt(run.stranded.C) * ATOMIC_FEE_CAP,
        );
        note(`balances: P ${formatNanoAvax(p)} AVAX unlocked, C ${formatNanoAvax(c)} AVAX`);
        // The baseline of the round trip. Member 2 does not read it again: the next read can reach a node that lags.
        run.before = { p, c };
        if (p < MIN_P) throw new Error(`The P-Chain holds ${formatNanoAvax(p)} AVAX unlocked; the run needs 0.02.`);
        if (c < MIN_C) throw new Error(`The C-Chain holds ${formatNanoAvax(c)} AVAX; the run needs 0.002 for fees.`);
      });
    },
  );

  test(
    'moves 0.01 AVAX from the P-Chain to the C-Chain',
    { timeout: 8 * 60_000 },
    async ({ app, browser, screen, wallet }) => {
      const { signer } = wallet;
      await guarded({ app, browser, screen, signer }, true, async () => {
        const before = need(run.before, 'the balances before the round trip');
        const from = signer.sends.length;

        const { exportTx, importTx } = await runLeg(screen, browser, signer, P_TO_C, AMOUNT_AVAX);
        run.pExport = exportTx.hash;
        run.cImport = importTx.hash;
        note(`P to C: ${exportTx.txType} ${exportTx.hash}, ${importTx.txType} ${importTx.hash}`);

        // One click, two txs: the P-Chain export, then the C-Chain import (avax.issueTx).
        expect(signer.sends.slice(from).map((s) => `${s.kind} ${s.txType}`)).toEqual([
          'p-chain pvm.ExportTx',
          'atomic evm.ImportTx',
        ]);
        // A node of the public API can lag the txs, so each read polls until the change shows.
        const after = await chainShowsBalances(
          signer,
          'the export and the import',
          (now) => before.p - now.p >= AMOUNT && now.c - before.c >= AMOUNT - ATOMIC_FEE_CAP,
        );
        expectChange('Unlocked P-Chain balance', after.p - before.p, -(AMOUNT + ATOMIC_FEE_CAP), -AMOUNT);
        // The page can import the dust of the side with the new UTXO in the same tx.
        expectChange('C-Chain balance', after.c - before.c, AMOUNT - ATOMIC_FEE_CAP, AMOUNT + run.dust.C);
        await chainShowsNoUtxos(signer.pChainAddress, run.left);
        run.afterLeg1 = after;
        finishSend(
          P_TO_C.importStep,
          {
            status: 'landed',
            outputs: { pBalanceAfter: formatNanoAvax(after.p), cBalanceAfter: formatNanoAvax(after.c) },
          },
          BRIDGE_LEDGER,
        );
        note(`after P to C: P ${formatNanoAvax(after.p)} AVAX unlocked, C ${formatNanoAvax(after.c)} AVAX`);
      });
    },
  );

  test(
    'moves 0.01 AVAX from the C-Chain back to the P-Chain',
    { timeout: 8 * 60_000 },
    async ({ app, browser, screen, wallet }) => {
      const { signer } = wallet;
      await guarded({ app, browser, screen, signer }, true, async () => {
        const before = need(run.before, 'the balances before the round trip');
        const mid = need(run.afterLeg1, 'the balances after leg 1');
        const from = signer.sends.length;

        // 'Start New Transfer' resets the page to its export form. Click it only after the page read both UTXO lists
        // with nothing to import: a list that still holds the imported UTXO makes the page offer a pending import.
        await waitForPageToSeeNoUtxos(browser, signer.pChainAddress, run.left);
        await startNewTransfer(screen).click();
        const { exportTx, importTx } = await runLeg(screen, browser, signer, C_TO_P, AMOUNT_AVAX);
        // Leave at once: the page polls the UTXOs every 5 s while it is open.
        await app.open('/small-logo.png');
        run.cExport = exportTx.hash;
        run.pImport = importTx.hash;
        note(`C to P: ${exportTx.txType} ${exportTx.hash}, ${importTx.txType} ${importTx.hash}`);

        expect(signer.sends.slice(from).map((s) => `${s.kind} ${s.txType}`)).toEqual([
          'atomic evm.ExportTx',
          'p-chain pvm.ImportTx',
        ]);
        const after = await chainShowsBalances(
          signer,
          'the export and the import',
          (now) => mid.c - now.c >= AMOUNT && now.p - mid.p >= AMOUNT - ATOMIC_FEE_CAP,
        );
        expectChange('C-Chain balance', after.c - mid.c, -(AMOUNT + ATOMIC_FEE_CAP), -AMOUNT);
        expectChange('Unlocked P-Chain balance', after.p - mid.p, AMOUNT - ATOMIC_FEE_CAP, AMOUNT + run.dust.P);
        await chainShowsNoUtxos(signer.pChainAddress, run.left);
        // The round trip costs only the fees of its 4 txs (about 0.000025 AVAX measured). An import can also take the
        // dust of its side, which adds to the total.
        expectChange(
          'P-Chain plus C-Chain over the round trip',
          after.p + after.c - (before.p + before.c),
          -ATOMIC_FEE_CAP,
          run.dust.P + run.dust.C,
        );
        finishSend(
          C_TO_P.importStep,
          {
            status: 'landed',
            outputs: { pBalanceAfter: formatNanoAvax(after.p), cBalanceAfter: formatNanoAvax(after.c) },
          },
          BRIDGE_LEDGER,
        );
        note(
          `after the round trip: P ${formatNanoAvax(after.p)} AVAX unlocked, C ${formatNanoAvax(after.c)} AVAX, fees ` +
            `${formatNanoAvax(before.p + before.c - after.p - after.c)} AVAX`,
        );
      });
    },
  );

  test(
    'lists the four txs as confirmed in the history, each on its own chain',
    { timeout: 3 * 60_000 },
    async ({ app, browser, screen, wallet }) => {
      const { signer } = wallet;
      await guarded({ app, browser, screen, signer }, false, async () => {
        const pExport = need(run.pExport, 'the P-Chain export');
        const pImport = need(run.pImport, 'the P-Chain import');
        const cExport = need(run.cExport, 'the C-Chain export');
        const cImport = need(run.cImport, 'the C-Chain import');
        await app.open('/console/history');
        // The history reads the Fuji copy of its store only after the wallet connected again (isTestnet).
        await expect(screen.getByRole('button', /P-Chain.*AVAX$/)).toBeVisible({ timeout: 60_000 });
        await expect(screen.getByRole('heading', 'History', { level: 1 })).toBeVisible();
        await expect(screen.getByRole('heading', 'Transaction History')).toBeVisible();
        // The page names the chain that issued each tx: a C-Chain atomic tx has the 'C-Chain' badge.
        await expect(screen.getByText(historyRow('Cross Chain Export', pExport))).toBeVisible();
        await expect(screen.getByText(historyRow('Cross Chain Import', pImport))).toBeVisible();
        await expect(screen.getByText(historyRow('Cross Chain Export', cExport, 'C-Chain'))).toBeVisible();
        await expect(screen.getByText(historyRow('Cross Chain Import', cImport, 'C-Chain'))).toBeVisible();

        // The store under the list: the type of each record.
        const { transactions = [] } = (await readStore(browser, 'v4-tx-history-store-testnet')) as {
          transactions?: { txHash: string; type: string }[];
        };
        const typeOf = (txId: string) => transactions.find((tx) => tx.txHash === txId)?.type;
        expect([pExport, pImport, cExport, cImport].map(typeOf)).toEqual([
          'pchain',
          'pchain',
          'cchain-atomic',
          'cchain-atomic',
        ]);
      });
    },
  );

  test('audits the wallet sends and turns off the bridge', { timeout: 3 * 60_000 }, async ({ wallet }) => {
    const { signer } = wallet;
    // Exact counts: the round trip, plus one import per side that member 1 cleared. No refusals.
    const record = auditSends(signer, {
      ledgerPath: BRIDGE_LEDGER,
      expect: {
        'pvm.ExportTx': 1,
        'evm.ImportTx': 1 + run.stranded.C,
        'evm.ExportTx': 1,
        'pvm.ImportTx': 1 + run.stranded.P,
      },
    });
    const totals = record.totals.map(({ name, value }) => `${name} ${value}`).join(', ');
    note(`sends audit passed: ${totals}`);
  });
});
