// The sends audit. The last member of each chain test file calls auditSends. It compares what the wallet sent with
// what the test expected and with the ledger, and it fails on any difference:
//   - the number of sends of a tx type is not the expected number (an exact count, per type);
//   - the wallet sent a tx that the ledger does not hold (a send that no test step wrote down);
//   - the ledger holds a sent or landed tx that this signer did not send, and did not adopt from an earlier run
//     (signer.adopted: an AddAutoRenewedValidatorTx that a resumed run takes over);
//   - the wallet refused a request that the test did not expect (signer.refusals);
//   - a user rejection that the test armed (signer.rejectNext) is still armed: the page never sent that request, or
//     the test did not cancel a rejection of `times: Infinity`;
//   - a total of the signer passes its cap (SIGNER_CAPS). The signer refuses before that, so this is a second check;
//   - a problem that the caller found (`problems`), for example a ledger step that does not match the step table
//     (expectedSends).
// It writes one table (each tx type and each total) to the ledger (`audit`) and to the GitHub job summary. Then it
// turns off every capability of the signer (revokeAll), also when the audit fails, so a later test file in the same
// process does not inherit one. A member that fails before the audit turns them off through revokeOnFailure.

import { appendFileSync } from 'node:fs';
import { basename } from 'node:path';
import { formatNanoAvax, NANO_AVAX } from './chain.ts';
import { readLedger, updateLedger, type Ledger } from './ledger.ts';
import { SIGNER_CAPS, type Signer, type SignerTotals } from '../wallet/signer.ts';

export interface AuditOptions {
  /** The ledger of the test file, for example chain/.run/pos.json. */
  ledgerPath: string;
  /** The exact number of sends per tx type: 'eth_sendTransaction' or an avalanchejs type such as 'pvm.ExportTx'. */
  expect: Record<string, number>;
  /** The refusals that the test causes on purpose. Each pattern is tested against '<method> <txType> <reason>'. */
  allowRefusals?: RegExp[];
  /** Problems that the caller found, for example the problems of expectedSends. Each one fails the audit. */
  problems?: string[];
}

export interface AuditRecord {
  at: string;
  /** The sends per tx type, and the expected number. */
  types: { txType: string; sent: number; expected: number }[];
  /** The signer's totals and caps, as AVAX (atomicCount as a count). */
  totals: { name: keyof SignerTotals; value: string; cap: string }[];
  refusals: number;
  /** The methods that the test made the wallet reject as the user (signer.rejectNext), in order. */
  userRejections: string[];
  /** The tx IDs that the signer adopted from an earlier run (signer.adopted). */
  adopted: string[];
  problems: string[];
}

// Hex hashes compare in lower case. CB58 tx IDs are case-sensitive.
const normalize = (id: string) => (/^0x/i.test(id) ? id.toLowerCase() : id);

const TOTAL_NAMES: Record<keyof SignerTotals, string> = {
  pSpent: 'P-Chain fees and L1 balances',
  pStaked: 'Primary Network stake',
  evmReserved: 'EVM gas x max fee',
  atomicCount: 'Atomic txs',
  atomicExported: 'Atomic exports',
};

function formatTotal(name: keyof SignerTotals, value: bigint | number): string {
  if (name === 'atomicCount') return String(value);
  // evmReserved is in wei; the others are in nAVAX.
  const nano = name === 'evmReserved' ? BigInt(value) / NANO_AVAX : BigInt(value);
  return `${formatNanoAvax(nano)} AVAX`;
}

/** Checks the wallet's sends and refusals at the end of a test file. Throws with every problem it found. */
export function auditSends(
  signer: Signer,
  { ledgerPath, expect, allowRefusals = [], problems: callerProblems = [] }: AuditOptions,
): AuditRecord {
  try {
    const problems: string[] = [...callerProblems];

    const sent = new Map<string, number>();
    for (const send of signer.sends) sent.set(send.txType, (sent.get(send.txType) ?? 0) + 1);
    const types = [...new Set([...sent.keys(), ...Object.keys(expect)])].sort().map((txType) => ({
      txType,
      sent: sent.get(txType) ?? 0,
      expected: expect[txType] ?? 0,
    }));
    for (const { txType, sent: count, expected } of types) {
      if (count !== expected) problems.push(`${txType}: the wallet sent ${count}, the test expects ${expected}`);
    }

    const ledger = readLedger(ledgerPath);
    const ledgerIds = new Set(ledger.sends.flatMap((step) => step.txIds.map(normalize)));
    for (const send of signer.sends) {
      if (!ledgerIds.has(normalize(send.hash))) problems.push(`${send.txType} ${send.hash} is not in the ledger`);
    }
    const sentIds = new Set([...signer.sends, ...signer.adopted].map((send) => normalize(send.hash)));
    for (const step of ledger.sends) {
      if (step.status !== 'sent' && step.status !== 'landed') continue;
      for (const id of step.txIds) {
        if (!sentIds.has(normalize(id)))
          problems.push(`ledger step '${step.step}' holds ${id}, which this signer did not send or adopt`);
      }
    }

    for (const refusal of signer.refusals) {
      const text = [refusal.method, refusal.txType, refusal.reason].filter(Boolean).join(' ');
      if (!allowRefusals.some((pattern) => pattern.test(text))) problems.push(`an unexpected refusal: ${text}`);
    }

    for (const method of signer.armedRejections()) {
      problems.push(
        `a user rejection of ${method} is still armed: the page did not send the ${method} that the test armed ` +
          '(rejectNext), or the test did not cancel it',
      );
    }

    const values = signer.totals();
    const totals = (Object.keys(SIGNER_CAPS) as (keyof SignerTotals)[]).map((name) => {
      const value = values[name];
      const cap = SIGNER_CAPS[name];
      if (value > cap)
        problems.push(`${TOTAL_NAMES[name]}: ${formatTotal(name, value)} passes the cap ${formatTotal(name, cap)}`);
      return { name, value: formatTotal(name, value), cap: formatTotal(name, cap) };
    });

    const record: AuditRecord = {
      at: new Date().toISOString(),
      types,
      totals,
      refusals: signer.refusals.length,
      userRejections: signer.userRejections.map((rejection) => rejection.method),
      adopted: signer.adopted.map((adoption) => adoption.hash),
      problems,
    };
    updateLedger((l) => {
      l.audit = record;
    }, ledgerPath);
    writeSummary(basename(ledgerPath), record);

    if (problems.length > 0) throw new Error(`The sends audit failed:\n- ${problems.join('\n- ')}`);
    return record;
  } finally {
    signer.revokeAll();
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// The sends of each ledger step
// ---------------------------------------------------------------------------------------------------------------------

/**
 * What one ledger step sends: one tx of `txType`. A Warp step (`warp`) makes one send per try that sent, and
 * lib/warp.ts tries at most 4 times.
 */
export interface StepSend {
  txType: string;
  warp?: true;
}

/** The ledger steps of a test file, by step name. */
export type StepTable = Readonly<Record<string, StepSend>>;

const EVM = 'eth_sendTransaction';

/** The 9 create members of lib/create-l1.ts: the same steps for each validator type. */
export const CREATE_L1_SENDS: StepTable = {
  'create-subnet': { txType: 'pvm.CreateSubnetTx' },
  'deploy-validator-messages': { txType: EVM },
  'deploy-validator-manager': { txType: EVM },
  'deploy-proxy-admin': { txType: EVM },
  'deploy-proxy': { txType: EVM },
  'initialize-validator-manager': { txType: EVM },
  'create-chain': { txType: 'pvm.CreateChainTx' },
  'convert-to-l1': { txType: 'pvm.ConvertSubnetToL1Tx' },
  'init-validator-set': { txType: EVM, warp: true },
};

/** chain/poa-cchain.e2e.ts (tier 1): the create flow, add V1, change its weight, top up V0, remove V1, disable V0. */
export const TIER1_SENDS: StepTable = {
  ...CREATE_L1_SENDS,
  'add-v1-initiate': { txType: EVM },
  'add-v1-register': { txType: 'pvm.RegisterL1ValidatorTx', warp: true },
  'add-v1-complete': { txType: EVM, warp: true },
  'weight-v1-initiate': { txType: EVM },
  'weight-v1-pchain': { txType: 'pvm.SetL1ValidatorWeightTx', warp: true },
  'weight-v1-complete': { txType: EVM, warp: true },
  'top-up-v0': { txType: 'pvm.IncreaseL1ValidatorBalanceTx' },
  'remove-v1-initiate': { txType: EVM },
  'remove-v1-pchain': { txType: 'pvm.SetL1ValidatorWeightTx', warp: true },
  'remove-v1-complete': { txType: EVM, warp: true },
  'disable-v0': { txType: 'pvm.DisableL1ValidatorTx' },
};

/** chain/pos-erc20-cchain.e2e.ts: the create flow, the six PoS steps, then the staking tools. */
export const POS_ERC20_SENDS: StepTable = {
  ...CREATE_L1_SENDS,
  'deploy-erc20-token': { txType: EVM },
  'deploy-erc20-staking-manager': { txType: EVM },
  'deploy-reward-calculator': { txType: EVM },
  'initialize-staking-manager': { txType: EVM },
  'enable-minting': { txType: EVM },
  'transfer-ownership': { txType: EVM },
  'stake-v1-approve': { txType: EVM },
  'stake-v1-initiate': { txType: EVM },
  'stake-v1-register': { txType: 'pvm.RegisterL1ValidatorTx', warp: true },
  'stake-v1-complete': { txType: EVM, warp: true },
  'delegate-approve': { txType: EVM },
  'delegate-initiate': { txType: EVM },
  'delegate-pchain': { txType: 'pvm.SetL1ValidatorWeightTx', warp: true },
  'delegate-complete': { txType: EVM, warp: true },
  'undelegate-initiate': { txType: EVM },
  'undelegate-pchain': { txType: 'pvm.SetL1ValidatorWeightTx', warp: true },
  'undelegate-complete': { txType: EVM, warp: true },
  'remove-v1-initiate': { txType: EVM },
  'remove-v1-pchain': { txType: 'pvm.SetL1ValidatorWeightTx', warp: true },
  'remove-v1-complete': { txType: EVM, warp: true },
  'claim-fees': { txType: EVM },
  'disable-v0': { txType: 'pvm.DisableL1ValidatorTx' },
};

/**
 * The exact count per tx type that the audit expects, from the ledger: one send for each plain step, 1 to 4 for each
 * Warp step. Each step of the table must be in the ledger and landed, with no step outside the table. Give `problems`
 * to auditSends, so they fail the audit and show in its table.
 */
export function expectedSends(
  ledger: Ledger,
  steps: StepTable,
): { counts: Record<string, number>; problems: string[] } {
  const counts: Record<string, number> = {};
  const problems: string[] = [];
  for (const [step, { txType, warp }] of Object.entries(steps)) {
    const send = ledger.sends.find((s) => s.step === step);
    if (!send) {
      problems.push(`${step}: not in the ledger`);
      continue;
    }
    if (send.status !== 'landed') problems.push(`${step}: ${send.status}, not landed`);
    const n = send.txIds.length;
    if (warp ? n < 1 || n > 4 : n !== 1) problems.push(`${step}: ${n} sends, expected ${warp ? '1 to 4' : '1'}`);
    counts[txType] = (counts[txType] ?? 0) + n;
  }
  for (const send of ledger.sends) {
    if (!(send.step in steps)) problems.push(`${send.step}: a ledger step that the audit does not know`);
  }
  return { counts, problems };
}

/**
 * Throws when the signer already sent, refused or rejected a request in this process. The audit counts each of them,
 * so a test file with an audit needs the signer to itself. lib/fixtures.ts gives one signer to each process, so call
 * this first in member 1, before any send.
 */
export function requireOwnSigner(signer: Signer, tag: string): void {
  const { sends, refusals, userRejections } = signer;
  if (sends.length + refusals.length + userRejections.length > 0) {
    throw new Error(
      `The signer already has ${sends.length} sends, ${refusals.length} refusals and ${userRejections.length} user ` +
        `rejections from another test file in this process. Run this file alone: npm run test:chain -- --tag ${tag}`,
    );
  }
}

/**
 * Wraps a test member's body: when the body throws, it turns off every capability of the signer (revokeAll) and
 * throws again, so a later test file in the same process does not inherit one. The audit turns them off on the
 * passing path. Use it as test(name, options, revokeOnFailure(async ({ wallet }) => { ... })).
 */
export function revokeOnFailure<C extends { wallet: { signer: Signer } }>(
  body: (context: C) => Promise<void>,
): (context: C) => Promise<void> {
  return async (context) => {
    try {
      await body(context);
    } catch (error) {
      context.wallet.signer.revokeAll();
      throw error;
    }
  };
}

// One table in the GitHub job summary: each tx type, then each total. Nothing outside GitHub Actions.
function writeSummary(ledgerName: string, record: AuditRecord): void {
  const file = process.env.GITHUB_STEP_SUMMARY;
  if (!file) return;
  const rows = [
    `### Wallet sends audit (${ledgerName}): ${record.problems.length ? 'failed' : 'passed'}`,
    '',
    '| Item | Value | Expected or cap |',
    '|---|---|---|',
    ...record.types.map(({ txType, sent, expected }) => `| \`${txType}\` | ${sent} | ${expected} |`),
    ...record.totals.map(({ name, value, cap }) => `| ${TOTAL_NAMES[name]} | ${value} | ${cap} |`),
    `| Refusals | ${record.refusals} | |`,
    `| User rejections (test) | ${record.userRejections.length} | |`,
    ...record.adopted.map((id) => `| Adopted from an earlier run | \`${id}\` | |`),
    '',
    ...record.problems.map((problem) => `- ${problem}`),
    '',
  ];
  appendFileSync(file, `${rows.join('\n')}\n`);
}
