import type { Browser } from '@e2e-dev/web';
import { expect, type Locator, type Screen } from 'e2e';
import { join } from 'node:path';
import { auditSends } from './lib/audit.ts';
import { note, openAsReturningVisitor, pageAlert, toolHeading, waitForPage } from './lib/console.ts';
import { connectCore, describe, test } from './lib/fixtures.ts';
import { RUN_DIR, archiveLedger, runIdFromEnv, updateLedger } from './lib/ledger.ts';
import { createMockValidator, nodeCredentialsJson, type MockValidator } from './lib/mock-validator.ts';
import {
  isAutoRenewed,
  pAllPrimaryValidators,
  pPrimaryValidator,
  pPrimaryValidators,
  type PrimaryValidator,
} from './lib/primary-stake.ts';
import type { Signer } from './wallet/signer.ts';

// The read-only checks of the Stake page (/console/primary-network/stake, components/toolbox/console/primary-network/
// Stake.tsx). This file sends no transaction and locks no AVAX.
//
// The page needs a connected wallet (toolRequirements WalletConnected), so it runs here and not in the main suite.
// When a NodeID is entered, the page reads platform.getCurrentValidators from the browser and shows one of these:
//   - an auto-renewed validator (ACP-236) of another wallet: a read-only view with no 'Update Config' button;
//   - a fixed-duration validator: 'Existing Validator', which cannot be changed;
//   - a NodeID that does not validate: the stake form, which checks its values before it asks the wallet.
// Node reads the same validators from the P-Chain, and each member compares what the page shows with that read.
//
// The signer has no stake capability in this file (allowPrimaryStake is never called), so it refuses every stake
// type. If the page asks the wallet for a tx, the request shows in signer.sends or signer.refusals, and the last
// member fails.
//
// The validators are live Fuji data. A member with no candidate validator skips with the reason.
//
//   export E2E_CHAIN_FUJI_KEY_FILE=~/.config/e2e-chain/fuji.key   # mode 0600
//   npm run test:chain -- --tag stake-reads

const runId = runIdFromEnv();

const STAKE = '/console/primary-network/stake';
const TOOL_TITLE = 'Stake on Primary Network';
// The ledger of this file. Its name does not match .run/stake-*.json, the ledgers of the stake files that lock AVAX.
const LEDGER = join(RUN_DIR, 'primary-stake-reads.json');
// A picked validator must stay current while the file runs: its stake or its current cycle ends more than 1 h from now.
const MIN_LEFT_SECONDS = 3_600;
// The page's lookup is one request from the browser to the public P-Chain API.
const LOOKUP_TIMEOUT = 90_000;

// The state of this run. The runner imports this file once for the serial group, so its members share it.
const run: {
  // The signer before the first member. In one process the signer is shared across test files (lib/fixtures.ts), so
  // the checks of this file read only what came after the mark.
  mark?: WalletMark;
  autoRenewed?: PrimaryValidator;
  fixed?: PrimaryValidator;
  // Why member 1 found no candidate.
  noAutoRenewed?: string;
  noFixed?: string;
} = {};

function need<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`An earlier member did not record ${what}.`);
  return value;
}

// Skips the member when member 1 found no candidate validator. test.skip throws, so the value is set after it.
function candidate(value: PrimaryValidator | undefined, reason: string | undefined): PrimaryValidator {
  test.skip(!value, `no candidate validator on Fuji: ${reason ?? 'member 1 did not pick one'}`);
  return value as PrimaryValidator;
}

// One validator, read again right after the page showed it, so both reads see the same cycle. The read goes past the
// public API's cache (lib/primary-stake.ts), so it is the chain's answer and not the one the page got.
async function primaryValidator(nodeID: string): Promise<PrimaryValidator> {
  const validator = await pPrimaryValidator(nodeID);
  if (!validator) throw new Error(`The P-Chain no longer lists ${nodeID} as a Primary Network validator.`);
  return validator;
}

// The page writes each authority address with the 'P-' prefix.
const authorityOf = (v: PrimaryValidator) =>
  (v.validatorAuthority?.addresses ?? []).map((a) => (a.startsWith('P-') ? a : `P-${a}`));

// The two validators of members 2 and 3, from one read of every Primary Network validator:
//   - auto-renewed: an ACP-236 validator whose authority does not hold this wallet's address;
//   - fixed: a fixed-duration validator.
// Each must end more than MIN_LEFT_SECONDS from now. Of each kind the one that ends last is picked: it stays current
// the longest. With no candidate, the reason says what the read found.
function pickValidators(
  validators: PrimaryValidator[],
  walletAddress: string,
): Pick<typeof run, 'autoRenewed' | 'fixed' | 'noAutoRenewed' | 'noFixed'> {
  const now = Math.floor(Date.now() / 1000);
  const current = validators.filter((v) => Number(v.endTime) > now + MIN_LEFT_SECONDS);
  const latestFirst = (a: PrimaryValidator, b: PrimaryValidator) => Number(b.endTime) - Number(a.endTime);
  const left = `more than ${MIN_LEFT_SECONDS / 3600} h left`;

  const allAuto = validators.filter(isAutoRenewed);
  const currentAuto = current.filter(isAutoRenewed);
  const autoRenewed = currentAuto.filter((v) => !authorityOf(v).includes(walletAddress)).sort(latestFirst)[0];
  const fixed = current.filter((v) => !isAutoRenewed(v)).sort(latestFirst)[0];
  return {
    autoRenewed,
    fixed,
    noAutoRenewed: autoRenewed
      ? undefined
      : `${allAuto.length} auto-renewed validators, ${currentAuto.length} with ${left}, ` +
        `none with an authority other than ${walletAddress}`,
    noFixed: fixed ? undefined : `${validators.length - allAuto.length} fixed validators, none with ${left}`,
  };
}

// One line about a validator for the run output: public IDs and times only.
function describeValidator(v: PrimaryValidator): string {
  const ends = new Date(Number(v.endTime) * 1000).toISOString();
  const authority = authorityOf(v);
  return `${v.nodeID} (tx ${v.txID}, ends ${ends}${authority.length ? `, authority ${authority.join(', ')}` : ''})`;
}

// The tool card. It has no role or accessible name: Container.tsx marks it with data-console-tool (the tool title).
// The value checks look only inside it, so a balance in the header cannot match.
const toolCard = (browser: Browser): Locator => browser.locator(`[data-console-tool="${TOOL_TITLE}"]`);

// The JSON field of the 'API Response' tab (AddValidatorControls.tsx).
const credentialsField = (screen: Screen): Locator => screen.getByRole('textbox', /^Paste the JSON response/);

// Clicks 'Add Validator' under the credentials field. The page takes one validator: it then disables the button and
// clears the field. A credentials error shows next to the field instead. The added NodeID is not checked as text: the
// page shows it twice while the stake step is open (the summary and the CLI command), and a text query must match one
// element.
async function addCredentials(screen: Screen): Promise<void> {
  const add = screen.getByRole('button', 'Add Validator');
  await add.click();
  await expect(add).toBeDisabled();
  await expect(credentialsField(screen)).toHaveValue('');
}

// The stake as the page writes it: nAVAX / 1e9, then toLocaleString() in the browser's locale (Stake.tsx). The
// browser formats it, so the text matches the page's in any locale.
async function stakeText(browser: Browser, v: PrimaryValidator): Promise<string> {
  const nano = Number(v.stakeAmount ?? v.weight);
  return `${await browser.evaluate((n: number) => (n / 1e9).toLocaleString(), nano)} AVAX`;
}

// How many sends and refusals the signer had at a point of the run.
interface WalletMark {
  sends: number;
  refusals: number;
}

const walletMark = (signer: Signer): WalletMark => ({ sends: signer.sends.length, refusals: signer.refusals.length });

// Fails when the wallet sent a tx or refused a request after the mark. The signer has no stake capability here, so a
// stake request from the page is a refusal.
function expectNoWalletTx(signer: Signer, mark: WalletMark, when: string): void {
  expect(signer.sends.slice(mark.sends), `the wallet sent a tx ${when}`).toEqual([]);
  expect(signer.refusals.slice(mark.refusals), `the wallet refused a request ${when}`).toEqual([]);
}

describe('Stake page: read-only checks', { serial: true, retries: 0, tags: ['chain', 'stake-reads'] }, () => {
  test(
    'opens the Stake page and picks the Fuji validators',
    { timeout: 4 * 60_000 },
    async ({ app, browser, screen, wallet }) => {
      const { signer } = wallet;
      archiveLedger(LEDGER);
      updateLedger((ledger) => {
        ledger.runId = runId;
        ledger.baseUrl = app.baseUrl;
      }, LEDGER);
      // An earlier test file in the same process can have left a capability on. With none, the signer refuses every
      // stake type.
      signer.revokeAll();
      run.mark = walletMark(signer);
      note(`run ${runId}, wallet P ${signer.pChainAddress}, ledger ${LEDGER}`);

      await openAsReturningVisitor(app, browser, STAKE);
      await connectCore(screen);
      await expect(toolHeading(screen, TOOL_TITLE)).toBeVisible();
      // The button names the network that the page reads from the wallet. The page enables it when it has the
      // wallet's P-Chain address.
      await expect(screen.getByRole('button', 'Stake Fuji Validator')).toBeEnabled();

      // One read of every Primary Network validator.
      const validators = await pAllPrimaryValidators();
      expect(validators.length, 'the Fuji P-Chain lists no Primary Network validator').toBeGreaterThan(0);
      Object.assign(run, pickValidators(validators, signer.pChainAddress));

      const autoCount = validators.filter(isAutoRenewed).length;
      note(`${validators.length} Primary Network validators, ${autoCount} auto-renewed`);
      note(`auto-renewed: ${run.autoRenewed ? describeValidator(run.autoRenewed) : `none (${run.noAutoRenewed})`}`);
      note(`fixed: ${run.fixed ? describeValidator(run.fixed) : `none (${run.noFixed})`}`);
    },
  );

  test(
    "shows another wallet's auto-renewed validator as read-only",
    { timeout: 3 * 60_000 },
    async ({ browser, screen, wallet }) => {
      const foreign = candidate(run.autoRenewed, run.noAutoRenewed);
      const card = toolCard(browser);
      const before = walletMark(wallet.signer);

      await screen.getByRole('button', /^Manage Auto-Renewal/).click();
      await screen.getByRole('textbox', 'Node ID').fill(foreign.nodeID);
      await waitForPage(
        browser,
        `the page's read-only view of ${foreign.nodeID}`,
        screen.getByRole('heading', 'Auto-Renewed Validator'),
        LOOKUP_TIMEOUT,
      );
      await expect(screen.getByText(/The connected wallet is not this validator's authority/)).toBeVisible();
      // Only the authority gets the config form. The page shows neither button to another wallet.
      await expect(screen.getByRole('button', 'Update Config')).toHaveCount(0);
      await expect(screen.getByRole('button', 'Stop Auto-Renewal')).toHaveCount(0);

      // The chain check: what the page shows is what the P-Chain holds for this NodeID.
      const chain = await primaryValidator(foreign.nodeID);
      expect(isAutoRenewed(chain), `${foreign.nodeID} is no longer auto-renewed on the P-Chain`).toBe(true);
      const authority = authorityOf(chain);
      expect(authority).not.toContain(wallet.signer.pChainAddress);
      const hours = Math.round(Number(chain.nextPeriod ?? 0) / 3600);
      const percent = Number(chain.autoCompoundRewardShares ?? 0) / 10_000;
      note(
        `chain: ${chain.nodeID} weight ${chain.weight}, nextPeriod ${chain.nextPeriod} s, autoCompoundRewardShares ` +
          `${chain.autoCompoundRewardShares}, authority ${authority.join(', ')}`,
      );
      await expect(card.getByText(await stakeText(browser, chain))).toBeVisible();
      await expect(card.getByText(`${hours} hours`)).toBeVisible();
      await expect(card.getByText(`${percent}%`)).toBeVisible();
      await expect(card.getByText(authority.join(', '))).toBeVisible();
      expectNoWalletTx(wallet.signer, before, 'on the read-only view');
    },
  );

  test(
    'shows a fixed-duration validator as an existing validator',
    { timeout: 3 * 60_000 },
    async ({ browser, screen, wallet }) => {
      const fixed = candidate(run.fixed, run.noFixed);
      const card = toolCard(browser);
      const before = walletMark(wallet.signer);

      await screen.getByRole('button', /^Stake a Validator/).click();
      // The page looks up the NodeID only. A fresh mock gives the BLS key and the proof, which the form requires.
      const credentials: MockValidator = { ...createMockValidator({ label: 'fixed-lookup' }), nodeID: fixed.nodeID };
      await credentialsField(screen).fill(nodeCredentialsJson(credentials));
      await addCredentials(screen);
      await waitForPage(
        browser,
        `the page's view of the fixed validator ${fixed.nodeID}`,
        screen.getByRole('heading', 'Existing Validator'),
        LOOKUP_TIMEOUT,
      );
      await expect(screen.getByText(/Fixed-duration stake can't be modified/)).toBeVisible();
      // No submit step: the page offers no stake for a node that validates.
      await expect(screen.getByRole('button', 'Stake Fuji Validator')).toHaveCount(0);

      // The chain check: the stake and the end time that the page shows are the P-Chain's.
      const chain = await primaryValidator(fixed.nodeID);
      expect(isAutoRenewed(chain), `${fixed.nodeID} is auto-renewed on the P-Chain now`).toBe(false);
      note(`chain: ${chain.nodeID} weight ${chain.weight}, endTime ${chain.endTime}`);
      // 'Validating Until' is new Date(endTime * 1000).toLocaleString() in the browser (Stake.tsx).
      const until = await browser.evaluate((s: number) => new Date(s * 1000).toLocaleString(), Number(chain.endTime));
      await expect(card.getByText(await stakeText(browser, chain))).toBeVisible();
      await expect(card.getByText(until)).toBeVisible();
      expectNoWalletTx(wallet.signer, before, 'on the existing-validator view');
    },
  );

  test(
    'refuses a stake form with a short end time or cycle',
    { timeout: 3 * 60_000 },
    async ({ app, browser, screen, wallet }) => {
      const { signer } = wallet;
      const before = walletMark(signer);
      // A NodeID that no node has: the page finds no validator and shows the stake form.
      const mock = createMockValidator({ label: 'reads' });
      expect(await pPrimaryValidators([mock.nodeID]), `${mock.nodeID} validates on Fuji`).toEqual([]);

      // The page has no control that clears an added validator, so open the page again. The Console connects the
      // wallet again by itself.
      await app.open(STAKE);
      await expect(screen.getByRole('button', /P-Chain.*AVAX$/)).toBeVisible({ timeout: 60_000 });
      await expect(toolHeading(screen, TOOL_TITLE)).toBeVisible();

      await screen.getByRole('button', /^Stake a Validator/).click();
      await credentialsField(screen).fill(nodeCredentialsJson(mock));
      await addCredentials(screen);
      const submit = screen.getByRole('button', 'Stake Fuji Validator');
      // The page disables the button while its lookup of the NodeID runs.
      await expect(submit).toBeEnabled({ timeout: LOOKUP_TIMEOUT });

      // Fixed duration with an end 1 h from now. The Fuji minimum is 12 h (Stake.tsx, NETWORK_CONFIG.fuji).
      await screen.getByRole('button', /^Fixed Duration/).click();
      // A datetime-local input has no ARIA role, so the field is found by its visible label 'End time'.
      const endTime = screen.getByLabel('End time');
      // The value is local time in the page's time zone, in the form that Stake.tsx writes for its default.
      const oneHour = await browser.evaluate((ms: number) => {
        const d = new Date(Date.now() + ms);
        return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
      }, 3_600_000);
      await endTime.fill(oneHour);
      await expect(endTime).toHaveValue(oneHour);
      await submit.click();
      await expect(pageAlert(screen, 'End time must be at least 12 hours from now')).toBeVisible();
      expectNoWalletTx(signer, before, 'for a fixed stake that ends in 1 h');

      // Auto-renewed with a 6 h cycle. The Fuji minimum is 12 h.
      await screen.getByRole('button', /^Auto-Renewed/).click();
      await expect(pageAlert(screen, 'End time must be at least 12 hours from now')).toBeHidden();
      const cycle = screen.getByRole('spinbutton', 'Cycle Period');
      await cycle.fill('6');
      await expect(cycle).toHaveValue('6');
      await submit.click();
      await expect(pageAlert(screen, 'Cycle period must be between 12 hours and 1 year')).toBeVisible();
      expectNoWalletTx(signer, before, 'for an auto-renewed stake with a 6 h cycle');
    },
  );

  test('the wallet sent nothing and refused nothing', { timeout: 2 * 60_000 }, async ({ wallet }) => {
    const { signer } = wallet;
    const mark = need(run.mark, 'the signer mark');
    expectNoWalletTx(signer, mark, 'in this file');
    // auditSends counts every send and refusal of the signer. When an earlier test file of this process used the
    // shared signer, its sends would fail the audit here, so the checks above, which read only this file's part, stand
    // alone.
    if (mark.sends > 0 || mark.refusals > 0) {
      note(
        `the signer is shared with an earlier test file (${mark.sends} sends, ${mark.refusals} refusals before ` +
          'this file): no auditSends table; this file sent nothing and the wallet refused nothing',
      );
      signer.revokeAll();
      return;
    }
    const record = auditSends(signer, { ledgerPath: LEDGER, expect: {} });
    note(`sends audit: ${record.types.length} tx types, ${record.refusals} refusals`);
  });
});
