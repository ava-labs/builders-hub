/**
 * Transaction tier: drive the Builder Console like a user and submit REAL
 * Fuji transactions, verifying them on-chain. Unlike the render smoke (which
 * only asserts tools mount), this catches broken transaction logic.
 *
 * Tests here (all funded-key-only, no running L1 required):
 *   1. create L1       — CreateSubnetTx + CreateChainTx on the P-Chain
 *   2. C-Chain deploy  — deploy ExampleERC20 to Fuji C-Chain (EVM tx)
 *   3. cross-chain     — C-Chain → P-Chain transfer (export + import)
 *
 * Requirements: QA_WALLET_KEY with funded Fuji balances — P-Chain AVAX for
 * the create-L1 flow, C-Chain AVAX for the cross-chain export. The whole
 * file is skipped when the key is absent so the render smoke stays green
 * without secrets.
 *
 * SERIAL by design: every test spends from the SAME wallet's UTXO set, so
 * they must never overlap (concurrent P-Chain spends conflict). One serial
 * file runs on a single worker, so this is safe even at --workers=4 while
 * the render specs parallelize across the others.
 *
 * Costs real (testnet) AVAX per run.
 */

import type { Page } from '@playwright/test';
import { test, expect } from '../fixtures';

const FUNDED = !!process.env.QA_WALLET_KEY;
// The public Fuji RPC (api.avax-test.network) hard-blocks datacenter/cloud
// egress IPs, so these tx-executing flows cannot reach it from ANY GitHub-
// hosted runner (deployment_status or workflow_dispatch — same IP ranges).
// Run them only where the RPC is reachable: a local or self-hosted machine.
// In GitHub Actions they skip, so the auto-CI render gate stays clean instead
// of logging a guaranteed-to-fail tx attempt on every deploy.
const IN_GITHUB_CI = !!process.env.GITHUB_ACTIONS;
const CAN_RUN_FLOWS = FUNDED && !IN_GITHUB_CI;
const P_CHAIN_RPC = 'https://api.avax-test.network/ext/bc/P';
const C_CHAIN_RPC = 'https://api.avax-test.network/ext/bc/C/rpc';

// Every X/P/C JSON-RPC exchange is recorded so a submission failure shows the
// exact wire request/response instead of a bare UI timeout.
interface RpcExchange {
  url: string;
  method: string;
  request: string;
  status?: number;
  response?: string;
}

function captureRpc(page: Page): RpcExchange[] {
  const exchanges: RpcExchange[] = [];
  page.on('response', async (res) => {
    const url = res.url();
    if (!/avax-test\.network|localhost:9650/.test(url)) return;
    const req = res.request();
    const body = req.postData() ?? '';
    let method = '?';
    try {
      method = JSON.parse(body).method ?? '?';
    } catch {}
    if (!/^(platform|avm|avax)\./.test(method)) return;
    const entry: RpcExchange = { url, method, request: body, status: res.status() };
    try {
      entry.response = (await res.text()).slice(0, 1000);
    } catch {}
    exchanges.push(entry);
  });
  return exchanges;
}

function dumpRpc(exchanges: RpcExchange[], pageErrors: string[]) {
  console.log('--- X/P/C-Chain RPC traffic ---');
  for (const x of exchanges) {
    console.log(`>> ${x.method} ${x.url}`);
    console.log(`   req:  ${x.request.slice(0, 400)}`);
    console.log(`   resp: [${x.status}] ${x.response}`);
  }
  console.log('--- page errors ---');
  pageErrors.forEach((p) => console.log(p));
}

/** Poll a P-Chain tx to finality from inside the page (shares its network). */
async function waitForCommitted(page: Page, txID: string): Promise<string> {
  return page.evaluate(
    async ({ txID, rpc }) => {
      for (let i = 0; i < 30; i++) {
        const res = await fetch(rpc, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'platform.getTxStatus', params: { txID } }),
        });
        const s = (await res.json()).result?.status;
        if (s !== 'Processing' && s !== 'Unknown') return s;
        await new Promise((r) => setTimeout(r, 1000));
      }
      return 'timed out waiting for finality';
    },
    { txID, rpc: P_CHAIN_RPC },
  );
}

const CB58 = /^[1-9A-HJ-NP-Za-km-z]{40,60}$/;

test.describe('testnet transaction flows (real Fuji txs)', () => {
  // Serial: shared wallet UTXO set — see file header. Safe at any --workers.
  test.describe.configure({ mode: 'serial' });
  test.skip(
    !CAN_RUN_FLOWS,
    IN_GITHUB_CI
      ? 'tx flows skipped in GitHub CI — public Fuji RPC blocks datacenter IPs (run locally)'
      : 'QA_WALLET_KEY not set — tx-executing flows need a funded Fuji key',
  );

  test('create L1 — CreateSubnet + CreateChain on the P-Chain', async ({ page }) => {
    test.setTimeout(300_000);

    const exchanges = captureRpc(page);
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(String(err)));

    try {
      // ── Stage 1: CreateSubnetTx ─────────────────────────────────────
      await page.goto('/console/layer-1/create/create-subnet', { waitUntil: 'domcontentloaded' });
      await expect(page.locator('[data-console-tool], [data-console-flow]').first()).toBeVisible({
        timeout: 30_000,
      });

      const createSubnetButton = page.getByRole('button', { name: 'Create Subnet' });
      await expect(createSubnetButton).toBeEnabled({ timeout: 30_000 });
      await createSubnetButton.click();

      // CreateSubnet writes the accepted txID into the subnet ID input.
      const subnetIdInput = page.locator('#create-subnet-id');
      await expect(subnetIdInput).toHaveValue(CB58, { timeout: 90_000 });
      const subnetId = await subnetIdInput.inputValue();
      console.log(`created subnet: ${subnetId}`);

      const subnetStatus = await waitForCommitted(page, subnetId);
      expect(subnetStatus, `subnet tx ${subnetId} should be Committed`).toBe('Committed');

      // ── Stage 2: CreateChainTx ──────────────────────────────────────
      // Same browser context: the create-chain step reads the subnet ID from
      // the persisted createChainStore.
      await page.goto('/console/layer-1/create/create-chain', { waitUntil: 'domcontentloaded' });
      await expect(page.locator('[data-console-tool], [data-console-flow]').first()).toBeVisible({
        timeout: 30_000,
      });

      // Genesis auto-builds from defaults (wallet address becomes the initial
      // allocation/owner); the button enables once it's valid.
      const createChainButton = page.getByRole('button', { name: 'Create Chain' });
      await expect(createChainButton).toBeEnabled({ timeout: 60_000 });
      await createChainButton.click();

      // Success signal: CreateChain writes setChainID(txID) into the persisted
      // store. The localStorage key is versioned + network scoped (e.g.
      // v4-create-chain-store-testnet), so scan for it.
      const readChainID = () =>
        page.evaluate(() => {
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i)!;
            if (!key.includes('create-chain-store')) continue;
            try {
              const chainID = JSON.parse(localStorage.getItem(key)!)?.state?.chainID;
              if (chainID) return chainID as string;
            } catch {}
          }
          return '';
        });
      await expect.poll(readChainID, { timeout: 90_000 }).toMatch(CB58);
      const chainId = await readChainID();
      console.log(`created chain: ${chainId}`);

      const chainStatus = await waitForCommitted(page, chainId);
      expect(chainStatus, `chain tx ${chainId} should be Committed`).toBe('Committed');

      // ── Cross-check: the chain record exists and points at our subnet ──
      // Retried: right after Committed, a load-balanced API replica can
      // briefly serve a getBlockchains list that doesn't include it yet.
      const blockchain = await page.evaluate(
        async ({ chainId, rpc }) => {
          for (let i = 0; i < 30; i++) {
            const res = await fetch(rpc, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'platform.getBlockchains', params: {} }),
            });
            const chains = (await res.json()).result?.blockchains ?? [];
            const found = chains.find((c: { id: string }) => c.id === chainId);
            if (found) return found;
            await new Promise((r) => setTimeout(r, 1000));
          }
          return null;
        },
        { chainId, rpc: P_CHAIN_RPC },
      );
      expect(blockchain, `blockchain ${chainId} should be registered on the P-Chain`).not.toBeNull();
      expect(blockchain.subnetID).toBe(subnetId);
      console.log(`L1 records live on Fuji: subnet=${subnetId} chain=${chainId} name="${blockchain.name}"`);
    } catch (e) {
      dumpRpc(exchanges, pageErrors);
      throw e;
    }
  });

  test('C-Chain deploy — ExampleERC20 to Fuji C-Chain', async ({ page }) => {
    test.setTimeout(120_000);

    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(String(err)));

    try {
      // Academy ERC20 deploy page — the shim is on Fuji C-Chain here, so the
      // contract deploys there. Ordinary EVM deploy (eth_sendTransaction),
      // which the shim handles natively (unlike the atomic txs below).
      await page.goto('/academy/avalanche-l1/l1-native-tokenomics/01-tokens-fundamentals/06-deploy-erc20', {
        waitUntil: 'domcontentloaded',
      });
      await expect(page.locator('[data-console-tool], [data-console-flow]').first()).toBeVisible({
        timeout: 30_000,
      });

      const deployButton = page.getByRole('button', { name: 'Deploy ERC20 Token' });
      await expect(deployButton).toBeEnabled({ timeout: 30_000 });
      await deployButton.click();

      // Success: the tool writes the deployed address into the persisted
      // toolbox store (key v4-toolbox-storage-<chainId>); scan for it.
      const readErc20Addr = () =>
        page.evaluate(() => {
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i)!;
            if (!key.includes('toolbox-storage')) continue;
            try {
              const addr = JSON.parse(localStorage.getItem(key)!)?.state?.exampleErc20Address;
              if (addr) return addr as string;
            } catch {}
          }
          return '';
        });
      await expect.poll(readErc20Addr, { timeout: 90_000 }).toMatch(/^0x[0-9a-fA-F]{40}$/);
      const erc20Address = await readErc20Addr();
      console.log(`deployed ExampleERC20: ${erc20Address}`);

      // Teeth: real bytecode must exist at the address on Fuji C-Chain.
      const code = await page.evaluate(
        async ({ addr, rpc }) => {
          const res = await fetch(rpc, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_getCode', params: [addr, 'latest'] }),
          });
          return (await res.json()).result as string;
        },
        { addr: erc20Address, rpc: C_CHAIN_RPC },
      );
      expect(code, `deployed contract ${erc20Address} should have bytecode on Fuji C-Chain`).not.toBe('0x');
      expect(code.length, 'bytecode should be non-trivial').toBeGreaterThan(2);
      console.log(`ERC20 live on Fuji C-Chain: ${erc20Address} (${(code.length - 2) / 2} bytes)`);
    } catch (e) {
      console.log('--- page errors ---');
      pageErrors.forEach((p) => console.log(p));
      throw e;
    }
  });

  // Cross-chain transfer (C→P) has two atomic legs: a C-Chain (EVM) export
  // and a P-Chain (PVM) import. The shim signs BOTH natively
  // (signAndIssueSingleKey) — the SDK's XP re-sign path can't (it crashes on
  // EVM atomic txs and leaves a PVM import's importedInputs uncredentialed).
  // Verified end-to-end in the browser: both legs issue real txs Fuji
  // accepts and the tool reaches "Start New Transfer". The self-heal + retry
  // below absorb the tool's stateful export→wait→import UI and any leftover
  // pending UTXOs from an interrupted prior run.
  test('cross-chain transfer — C-Chain → P-Chain', async ({ page }) => {
    test.setTimeout(300_000);

    const exchanges = captureRpc(page);
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(String(err)));

    try {
      await page.goto('/console/primary-network/c-p-bridge', { waitUntil: 'domcontentloaded' });
      await expect(page.locator('[data-console-tool], [data-console-flow]').first()).toBeVisible({
        timeout: 30_000,
      });

      // The C-Chain atomic export hangs if the EVM account still has an
      // in-flight tx (e.g. a deploy from an earlier test in this serial file).
      // Wait until pending nonce == latest nonce (no unconfirmed C-Chain tx).
      await page.evaluate(async (rpc) => {
        const w = window as any;
        const addr = (await w.avalanche.request({ method: 'eth_accounts' }))[0];
        const count = (tag: string) =>
          fetch(rpc, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_getTransactionCount', params: [addr, tag] }),
          })
            .then((r) => r.json())
            .then((j) => j.result as string);
        for (let i = 0; i < 30; i++) {
          const [pending, latest] = await Promise.all([count('pending'), count('latest')]);
          if (pending === latest) return;
          await new Promise((r) => setTimeout(r, 1000));
        }
      }, C_CHAIN_RPC);

      const startNew = page.getByRole('button', { name: 'Start New Transfer' });
      const importPending = page.getByRole('button', { name: /Import .* to P-Chain/ });

      // Self-heal: a prior interrupted run can leave an un-imported UTXO, and
      // the tool then shows "Import pending" instead of the Export form. Drain
      // any pending imports first so we always exercise a fresh export below.
      for (let i = 0; i < 5; i++) {
        if (!(await importPending.isVisible().catch(() => false))) break;
        await importPending.click();
        await expect(startNew).toBeVisible({ timeout: 120_000 });
        await startNew.click();
        await page.waitForTimeout(2000); // let the tool re-scan UTXOs
      }

      // Fresh export+import, with retry. The console's prepareExportTxn can
      // STALL (not error) if a recent C-Chain tx — e.g. a deploy from an
      // earlier test — left the client in a bad state; it doesn't recover
      // in-place. So on a stalled attempt we RELOAD the page (re-initializing
      // the wallet client) and re-drain before retrying.
      const exportError = page.getByText(/Export failed/i);

      const drainPending = async () => {
        for (let i = 0; i < 5; i++) {
          if (!(await importPending.isVisible().catch(() => false))) break;
          await importPending.click();
          await expect(startNew).toBeVisible({ timeout: 120_000 });
          await startNew.click();
          await page.waitForTimeout(2000);
        }
      };

      let completed = false;
      for (let attempt = 0; attempt < 3 && !completed; attempt++) {
        if (attempt > 0) {
          await page.reload({ waitUntil: 'domcontentloaded' });
          await expect(page.locator('[data-console-tool], [data-console-flow]').first()).toBeVisible({
            timeout: 30_000,
          });
          await page.waitForTimeout(8000); // let the wallet client re-init
          await drainPending();
        }

        const amountInput = page.locator('input[type="number"]').first();
        const exportButton = page.getByRole('button', { name: /Export .* from/ });
        await expect(amountInput).toBeVisible({ timeout: 30_000 });
        await amountInput.fill('');
        await amountInput.fill('0.02');
        if (!(await exportButton.isEnabled().catch(() => false))) {
          console.log(`export attempt ${attempt + 1}: button not ready; reloading`);
          continue;
        }
        await exportButton.click();

        // The tool exports from C, waits for the UTXOs on P, then AUTO-imports.
        // Both legs call waitForTxn, so reaching "Start New Transfer" means the
        // export AND the P-Chain ImportTx both Committed. Race against the
        // error path so a failure retries instead of burning the full timeout.
        const outcome = await Promise.race([
          startNew.waitFor({ state: 'visible', timeout: 120_000 }).then(() => 'ok'),
          exportError.waitFor({ state: 'visible', timeout: 120_000 }).then(() => 'error'),
        ]).catch(() => 'timeout');

        if (outcome === 'ok') {
          completed = true;
          break;
        }
        console.log(`export attempt ${attempt + 1} did not complete (${outcome}); reloading and retrying`);
      }
      expect(completed, 'cross-chain transfer should reach the completed state').toBeTruthy();

      // Teeth: a P-Chain ImportTx must have committed. Take the LAST issued one
      // (after any drains above) — that's this fresh transfer's import.
      const imports = exchanges.filter(
        (x) => x.method === 'platform.issueTx' && /"txID"/.test(x.response ?? ''),
      );
      expect(imports.length, 'a P-Chain ImportTx should have been issued').toBeGreaterThan(0);
      const importTxId = JSON.parse(imports[imports.length - 1].response!).result.txID as string;
      const importStatus = await waitForCommitted(page, importTxId);
      expect(importStatus, `import tx ${importTxId} should be Committed`).toBe('Committed');
      console.log(`cross-chain C→P complete: import tx ${importTxId} Committed`);
    } catch (e) {
      dumpRpc(exchanges, pageErrors);
      throw e;
    }
  });
});
