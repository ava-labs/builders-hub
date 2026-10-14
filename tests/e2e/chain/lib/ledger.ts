// The run ledger: what a Console chain test file sent. Each file has its own ledger under chain/.run (gitignored):
// tier 1 uses ledger.json, the other files pass their own path (pos.json, bridge-cp.json, stake-acp236.json, ...).
//
// A test writes the ledger before each send (the step and its inputs) and after it (tx IDs and outputs). With it:
//   - before a send, a member reads the chain and sends nothing when the result is already there (sendOnce);
//   - teardown.ts finds the validators to disable, even when a run was cancelled in the middle.
//
// Each run makes a new L1: its first member moves the last ledger to .run/archive/ (archiveLedger). Locally,
// teardown.ts reads chain/.run and its archive. In CI the job's teardown step reads the ledger, and then the ledger is
// an artifact that no later run reads. To tear down what a CI run left, download the artifact and pass its folder to
// teardown.ts.
//
// Every write reads the file, changes it and renames a temporary file over it, so a crash never leaves half a file.
// Tests run in one worker (chain/e2e.config.ts), so no two processes write at the same time.
//
// The ledger holds public data only: tx IDs, addresses, IDs. Each write refuses a ledger that contains the test key.
//
// `node chain/lib/ledger.ts show` prints the ledger. `node chain/lib/ledger.ts new` archives it by hand.

import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AuditRecord } from './audit.ts';
import { chainShows, readFujiKeyIfSet } from './chain.ts';
import type { PrimaryStakeRecord } from './primary-stake.ts';

export const RUN_DIR = fileURLToPath(new URL('../.run/', import.meta.url));
export const LEDGER_PATH = resolve(process.env.E2E_CHAIN_LEDGER ?? join(RUN_DIR, 'ledger.json'));

export type ChainName = 'P' | 'C' | 'L1';

/** pending: written before the send. sent: a tx ID is known. landed: the chain shows the result. failed: it did not. */
export type SendStatus = 'pending' | 'sent' | 'landed' | 'failed';

export interface LedgerSend {
  /** Unique per run, for example 'create-subnet', 'deploy-validator-messages', 'convert-to-l1'. */
  step: string;
  chain: ChainName;
  status: SendStatus;
  /** What the test entered or chose: weights, balances, node IDs. No secrets. */
  inputs: Record<string, unknown>;
  /** Every tx of the step, in order (a C-Chain hash or a P-Chain tx ID). */
  txIds: string[];
  /** What the step produced: a contract address, a block number, a registration expiry. */
  outputs?: Record<string, unknown>;
  /** Warp deliveries: how many attempts chain/lib/warp.ts needed. */
  attempts?: number;
  /** How long the test waited for Glacier before the step, in ms. */
  glacierLagMs?: number;
  error?: string;
  startedAt: string;
  updatedAt: string;
}

export interface LedgerL1 {
  subnetId?: string;
  blockchainId?: string;
  evmChainId?: number;
  /** Where the Validator Manager runs. Tier 1: 'C'. */
  managerChain?: ChainName;
  /** The address the Console uses for the manager: the TransparentUpgradeableProxy. */
  validatorManager?: string;
  validatorManagerImplementation?: string;
  validatorMessagesLibrary?: string;
  proxyAdmin?: string;
  conversionTxId?: string;
}

export interface LedgerValidator {
  /** 'V0' (converted), 'V1' (added), 'V2' (initiated only). Unique per run. */
  label: string;
  nodeId: string;
  validationId?: string;
  subnetId?: string;
  weight?: string;
  /** The P-Chain balance at the start, in nAVAX. */
  balance?: string;
  blsPublicKey?: string;
  /** C-Chain block of initiateValidatorRegistration (V2: the 'From block' of Remove Expired Registration). */
  blockNumber?: string;
  /** Unix seconds (from InitiatedValidatorRegistration). */
  registrationExpiry?: string;
  /** What the run did last: 'initial', 'initiated', 'registered', 'removed', 'disabled'. */
  state?: string;
}

export interface LedgerTeardown {
  validationId: string;
  subnetId?: string;
  /** disabled: this teardown sent the DisableL1ValidatorTx. The others say why it sent nothing. */
  result: 'disabled' | 'would-disable' | 'inactive' | 'not-found' | 'not-owner' | 'failed';
  txId?: string;
  /** The balance refunded, in nAVAX. */
  refunded?: string;
  error?: string;
  at: string;
}

export interface Ledger {
  version: 1;
  /** CI: '<GITHUB_RUN_ID>-<GITHUB_RUN_ATTEMPT>'. Local: 'local-<time>'. */
  runId: string;
  network: 'fuji';
  baseUrl?: string;
  createdAt: string;
  updatedAt: string;
  l1: LedgerL1;
  validators: LedgerValidator[];
  sends: LedgerSend[];
  teardown: LedgerTeardown[];
  /** The Primary Network stake of a stake test file (lib/primary-stake.ts). teardown.ts and preflight.ts read it. */
  primaryStake?: PrimaryStakeRecord;
  /** The sends audit of the test file's last member (lib/audit.ts). */
  audit?: AuditRecord;
}

const now = () => new Date().toISOString();

/** The run ID from the CI environment, or a local one. */
export function runIdFromEnv(): string {
  const { GITHUB_RUN_ID, GITHUB_RUN_ATTEMPT } = process.env;
  return GITHUB_RUN_ID ? `${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT ?? '1'}` : `local-${now().replace(/[:.]/g, '-')}`;
}

function emptyLedger(): Ledger {
  const at = now();
  return {
    version: 1,
    runId: runIdFromEnv(),
    network: 'fuji',
    baseUrl: process.env.E2E_BASE_URL ?? 'https://build.avax.network',
    createdAt: at,
    updatedAt: at,
    l1: {},
    validators: [],
    sends: [],
    teardown: [],
  };
}

/** True for an object with the shape of a ledger. */
export function isLedger(value: unknown): value is Ledger {
  const v = value as Partial<Ledger> | null;
  return !!v && v.version === 1 && typeof v.runId === 'string' && Array.isArray(v.sends) && Array.isArray(v.validators);
}

/** Reads the ledger. A missing file reads as a new, empty ledger (not written until the first change). */
export function readLedger(path = LEDGER_PATH): Ledger {
  if (!existsSync(path)) return emptyLedger();
  const value: unknown = JSON.parse(readFileSync(path, 'utf8'));
  if (!isLedger(value)) throw new Error(`${path} is not a chain test ledger.`);
  return { ...value, teardown: value.teardown ?? [] };
}

/** Throws when the serialized ledger contains the test key, with or without 0x. The error does not name the key. */
function assertNoKey(text: string): void {
  const key = readFujiKeyIfSet()?.slice(2).toLowerCase();
  if (key && text.toLowerCase().includes(key)) {
    throw new Error('Refusing to write the ledger: it contains the test key.');
  }
}

function writeLedger(ledger: Ledger, path: string): void {
  const text = `${JSON.stringify(ledger, (_, v) => (typeof v === 'bigint' ? v.toString() : v), 2)}\n`;
  assertNoKey(text);
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, text);
  renameSync(tmp, path);
}

/** Reads the ledger, lets `change` edit it, and writes it back. Returns the new ledger. */
export function updateLedger(change: (ledger: Ledger) => void, path = LEDGER_PATH): Ledger {
  const ledger = readLedger(path);
  change(ledger);
  ledger.updatedAt = now();
  writeLedger(ledger, path);
  return ledger;
}

// ---------------------------------------------------------------------------------------------------------------------
// Sends
// ---------------------------------------------------------------------------------------------------------------------

export function findSend(step: string, path = LEDGER_PATH): LedgerSend | undefined {
  return readLedger(path).sends.find((s) => s.step === step);
}

function withSend(step: string, path: string, change: (send: LedgerSend) => void): LedgerSend {
  let result: LedgerSend | undefined;
  updateLedger((ledger) => {
    const send = ledger.sends.find((s) => s.step === step);
    if (!send) throw new Error(`The ledger has no step '${step}'. Call beginSend first.`);
    change(send);
    send.updatedAt = now();
    result = send;
  }, path);
  return result!;
}

/**
 * Writes the step before its send. A step that is already in the ledger keeps its tx IDs (a retry of a step that
 * failed after its first tx), and gets the new inputs and the status 'pending'.
 */
export function beginSend(step: string, chain: ChainName, inputs: Record<string, unknown> = {}, path = LEDGER_PATH) {
  let result: LedgerSend | undefined;
  updateLedger((ledger) => {
    const at = now();
    let send = ledger.sends.find((s) => s.step === step);
    if (!send) {
      send = { step, chain, status: 'pending', inputs, txIds: [], startedAt: at, updatedAt: at };
      ledger.sends.push(send);
    } else {
      Object.assign(send, { chain, inputs, status: 'pending', error: undefined, updatedAt: at });
    }
    result = send;
  }, path);
  return result!;
}

/** Writes the result of the step after the chain check. */
export function finishSend(
  step: string,
  result: {
    status: 'landed' | 'failed';
    outputs?: Record<string, unknown>;
    attempts?: number;
    glacierLagMs?: number;
    error?: string;
  },
  path = LEDGER_PATH,
): LedgerSend {
  return withSend(step, path, (send) => {
    send.status = result.status;
    if (result.outputs) send.outputs = { ...send.outputs, ...result.outputs };
    if (result.attempts !== undefined) send.attempts = result.attempts;
    if (result.glacierLagMs !== undefined) send.glacierLagMs = result.glacierLagMs;
    send.error = result.error;
  });
}

export interface SendOnceOptions {
  step: string;
  chain: ChainName;
  inputs?: Record<string, unknown>;
  /**
   * Reads the chain: true when the result of the step is there. It gets the step's ledger entry (with any tx IDs
   * from an earlier try), so it can check a tx ID or an address that an earlier try wrote.
   */
  landed: (previous: LedgerSend | undefined) => Promise<boolean>;
  /** Does the send (clicks the button) and returns the tx IDs and outputs it saw. */
  send: () => Promise<{ txIds?: string[]; outputs?: Record<string, unknown> } | void>;
  /**
   * Waits until the chain shows the result (for example waitForPTx), and returns false or throws when it does not.
   * Default: polls `landed` for up to 90 s (chainShows), because a node of the public API can lag the tx.
   */
  confirm?: (sent: LedgerSend) => Promise<boolean>;
  path?: string;
}

/**
 * One send that the run does at most once. When the chain already shows the step's result, it sends nothing and
 * returns 'skipped' (the ledger then says 'landed'). Otherwise it writes the step, sends, writes the tx IDs, waits
 * until the chain shows the result (`confirm`) and writes the result. A failed check or send writes 'failed' and
 * throws.
 */
export async function sendOnce(options: SendOnceOptions): Promise<{ result: 'skipped' | 'sent'; send: LedgerSend }> {
  const { step, chain, inputs = {}, landed, send, confirm, path = LEDGER_PATH } = options;
  const previous = findSend(step, path);
  if (await landed(previous)) {
    if (!previous) beginSend(step, chain, inputs, path);
    return { result: 'skipped', send: finishSend(step, { status: 'landed' }, path) };
  }
  beginSend(step, chain, inputs, path);
  try {
    const out = (await send()) ?? {};
    const sent = withSend(step, path, (s) => {
      for (const txId of out.txIds ?? []) if (!s.txIds.includes(txId)) s.txIds.push(txId);
      if (out.outputs) s.outputs = { ...s.outputs, ...out.outputs };
      s.status = 'sent';
    });
    const ok = confirm
      ? await confirm(sent)
      : await chainShows(`the chain shows the result of '${step}'`, () => landed(sent));
    if (!ok) throw new Error(`The chain does not show the result of '${step}'.`);
    return { result: 'sent', send: finishSend(step, { status: 'landed' }, path) };
  } catch (error) {
    finishSend(step, { status: 'failed', error: error instanceof Error ? error.message : String(error) }, path);
    throw error;
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// The L1 and its validators
// ---------------------------------------------------------------------------------------------------------------------

/** Merges IDs and addresses into the ledger's L1 record. */
export function setL1(patch: Partial<LedgerL1>, path = LEDGER_PATH): LedgerL1 {
  return updateLedger((ledger) => {
    ledger.l1 = { ...ledger.l1, ...patch };
  }, path).l1;
}

/** Adds the validator with this label, or merges the patch into it. */
export function upsertValidator(
  label: string,
  patch: Partial<Omit<LedgerValidator, 'label'>>,
  path = LEDGER_PATH,
): LedgerValidator {
  let result: LedgerValidator | undefined;
  updateLedger((ledger) => {
    let validator = ledger.validators.find((v) => v.label === label);
    if (!validator) {
      if (!patch.nodeId) throw new Error(`A new validator '${label}' needs a nodeId.`);
      validator = { label, nodeId: patch.nodeId };
      ledger.validators.push(validator);
    }
    Object.assign(validator, patch);
    result = validator;
  }, path);
  return result!;
}

// ---------------------------------------------------------------------------------------------------------------------
// Files: archive, and every ledger under a folder (teardown.ts)
// ---------------------------------------------------------------------------------------------------------------------

/**
 * Moves the ledger to archive/<name>-<runId>.json next to it (ledger.json becomes archive/ledger-<runId>.json), so the
 * caller starts a new L1. Each test file has its own ledger, and the files of one CI run share a run ID, so the name
 * keeps the file's own name. An archive of that name that exists already is never overwritten: the new one gets the
 * time as a suffix. Returns the new path.
 */
export function archiveLedger(path = LEDGER_PATH): string | undefined {
  if (!existsSync(path)) return undefined;
  const { runId } = readLedger(path);
  const name = `${basename(path, '.json')}-${runId}`;
  let target = join(dirname(path), 'archive', `${name}.json`);
  if (existsSync(target)) target = join(dirname(target), `${name}-${now().replace(/[:.]/g, '-')}.json`);
  mkdirSync(dirname(target), { recursive: true });
  renameSync(path, target);
  return target;
}

/** Every ledger file under the given files and folders (recursive), each read once. */
export function findLedgerFiles(paths: readonly string[]): string[] {
  const found = new Set<string>();
  const visit = (path: string) => {
    if (!existsSync(path)) return;
    if (statSync(path).isDirectory()) {
      for (const name of readdirSync(path)) visit(join(path, name));
      return;
    }
    if (!path.endsWith('.json')) return;
    try {
      if (isLedger(JSON.parse(readFileSync(path, 'utf8')))) found.add(resolve(path));
    } catch {
      // Not JSON, or not a ledger: skip it.
    }
  };
  for (const path of paths) visit(resolve(path));
  return [...found].sort();
}

// `node chain/lib/ledger.ts show` prints the ledger; `node chain/lib/ledger.ts new` archives it by hand.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const command = process.argv[2];
  if (command === 'new') {
    const target = archiveLedger();
    console.log(target ? `Moved the ledger to ${target}.` : 'There is no ledger.');
  } else if (command === 'show') {
    console.log(existsSync(LEDGER_PATH) ? readFileSync(LEDGER_PATH, 'utf8') : 'There is no ledger.');
  } else {
    console.error('Usage: node chain/lib/ledger.ts new | show');
    process.exitCode = 2;
  }
}
