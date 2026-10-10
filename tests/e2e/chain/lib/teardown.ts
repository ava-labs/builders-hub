// Teardown: gives back what a failed or cancelled chain test run left on Fuji. Three passes; each reads the chain
// first, and sends a tx only for what the test key alone owns.
//
//   node chain/lib/teardown.ts --dry-run          # print what each pass would send; sends nothing
//   node chain/lib/teardown.ts                    # send the txs
//   node chain/lib/teardown.ts [--dry-run] <ledger file or folder> ...
//
// 1. L1 validators. For each L1 of the ledgers under the given paths (default chain/.run), it asks the P-Chain for the
//    current validators (platform.getCurrentValidators), plus each validation ID in the ledgers. It disables each
//    validator with a balance above 0 whose deactivation owner is the test key (DisableL1ValidatorTx). The balance
//    comes back to the key instead of burning (512 nAVAX/s per validator on Fuji).
// 2. Primary Network stakes. A ledger stake record (lib/primary-stake.ts) of an ACP-236 auto-renewed validator that
//    still renews (nextPeriod above 0) gets a SetAutoRenewedValidatorConfigTx with period 0. The validator then stops
//    at the end of its current cycle, and the P-Chain gives the stake back. A fixed-duration stake ends by itself, so
//    the pass only prints its unlock time. Without this pass the stake still comes back: a mock validator has no
//    uptime, and the P-Chain ends an auto-renewed validator with too little uptime at the end of its cycle (avalanchego
//    vms/platformvm/docs/validators_auto_renewed.md, "Abort Path").
// 3. Shared memory. An export puts AVAX in shared memory; a bridge run that stops before the import leaves it there.
//    The pass imports the key's unlocked AVAX on each side to the key's own address: a P-Chain ImportTx from the
//    C-Chain, and a C-Chain ImportTx from the P-Chain. Each import takes the page's next selection (atomic.ts
//    importSelection) at the price that the pass pays: the UTXOs that hold more than the fee of their own input, the
//    largest first, as many as fit in the gas limit of one import. A later run imports the rest. This pass needs no
//    ledger: it reads only the key's address. Do not run it while a bridge test runs: the page imports the same UTXOs,
//    and the chain accepts only one import. Anyone can export to the key's address, so the pass only prints what it
//    cannot import: a UTXO that is not the key's unlocked AVAX (locked, another asset, more owners), and dust: a UTXO
//    that does not hold more than the fee of its own input, or a side whose selection is not above the import fee
//    (result 'dust'). Neither is a failure.
//
// It signs in Node with the test key (E2E_CHAIN_FUJI_KEY_FILE or E2E_CHAIN_FUJI_KEY) and avalanchejs, on Fuji only,
// and never prints the key. Each tx must burn at most its fee cap: 0.01 AVAX on the P-Chain, 0.001 AVAX for an import.
//
// The workflow runs it after the tests with `if: always()`, because a failed or cancelled run can stop before the
// Console's own Disable, Stop Auto-Renewal or import step. It is a CLI and not an afterAll hook: a cancel skips
// afterAll.
//
// A dry run with the key set also builds and signs each tx, but does not send it. Without the key it uses
// E2E_CHAIN_P_ADDRESS (if set) for the owner checks and the shared memory reads; without either, the owner checks are
// skipped and pass 3 does not run. A real run needs the key.
// Exit code 1 when a tx that the key could send failed.
//
// The sign functions (signDisableTx, signStopTx, signImportTx) take their chain reads as a parameter (TeardownReads).
// chain/wallet/selftest.ts gives them fixed answers, so it builds and signs each tx with no network call.

import { appendFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Common, evm, pvm, secp256k1, utils, Utxo, type Context, type UnsignedTx } from '@avalabs/avalanchejs';
import type { Hex } from 'viem';
import {
  type AtomicUtxo,
  type ImportRule,
  type ImportSide,
  cAtomicTxHeight,
  importFeeOf,
  importSelection,
  isOurAvax,
  notOursReason,
  strandedUtxos,
  sumOf,
  worthImporting,
} from './atomic.ts';
import {
  FUJI,
  NANO_AVAX,
  assertFuji,
  chainShows,
  formatNanoAvax,
  jsonRpc,
  keyAddresses,
  pL1Validator,
  pL1Validators,
  readFujiKey,
  readFujiKeyIfSet,
  waitForPTx,
  type L1Validator,
  type POwner,
} from './chain.ts';
import { RUN_DIR, findLedgerFiles, readLedger, updateLedger, type LedgerTeardown } from './ledger.ts';
import {
  type LedgerStake,
  type PApiOwner,
  type PrimaryValidator,
  isAutoRenewed,
  isoFromUnix,
  ledgerStakes,
  pPrimaryValidator,
  setPrimaryStake,
} from './primary-stake.ts';

/** The fee cap of a P-Chain tx of the teardown (the signer's P-Chain fee cap). */
export const P_FEE_CAP = NANO_AVAX / 100n;
/** The fee cap of an import (the signer's atomic fee cap). */
export const ATOMIC_FEE_CAP = NANO_AVAX / 1_000n;
const WEI_PER_NAVAX = 1_000_000_000n;

interface Candidate {
  validationId: string;
  subnetId?: string;
  label?: string;
  /** The ledger files that name this validator or its L1. */
  files: Set<string>;
}

interface Outcome extends LedgerTeardown {
  nodeId?: string;
  label?: string;
  balance?: string;
}

interface StakeOutcome {
  nodeId: string;
  file: string;
  kind: LedgerStake['kind'];
  /**
   * stopped: this teardown sent the stop. would-stop: the dry run would. ends: the stake ends by itself at unlockAt
   * (a fixed stake, or renewal already stopped). not-found: the P-Chain lists no validator with this NodeID (the
   * stake came back, or the add never landed). other-tx: the P-Chain validator is not the ledger's tx. not-owner: the
   * test key is not the validator authority.
   */
  result: 'stopped' | 'would-stop' | 'ends' | 'not-found' | 'other-tx' | 'not-owner' | 'failed';
  txId?: string;
  unlockAt?: string;
  error?: string;
}

interface AtomicOutcome {
  /** The chain that imports. */
  side: ImportSide;
  /** The UTXOs of the key's unlocked AVAX, and their sum in nAVAX. */
  utxos: number;
  amount: bigint;
  /** UTXOs that the pass leaves: locked, another asset, or other owners. */
  skipped: string[];
  /** The key's own UTXOs above the gas limit of one import (importSelection): a later run imports them. */
  later: number;
  /** The key's own UTXOs that do not hold more than the fee of their own input (worthImporting): they stay. */
  small: number;
  /** The import fee estimate in nAVAX (importFeeOf), when the selection holds the key's AVAX. */
  fee?: bigint;
  /** dust: no UTXO pays for its own input, or the selection is not above the import fee, so the pass leaves it. */
  result: 'imported' | 'would-import' | 'none' | 'dust' | 'failed';
  txId?: string;
  error?: string;
}

// ---------------------------------------------------------------------------------------------------------------------
// Txs signed in Node
// ---------------------------------------------------------------------------------------------------------------------

/**
 * The chain reads of the sign functions: the key's P-Chain UTXOs, the P-Chain fee state, and the C-Chain base fee in
 * nAVAX per gas. LIVE_READS reads Fuji. selftest.ts gives fixed answers.
 */
export interface TeardownReads {
  pUtxos(address: string): Promise<Utxo[]>;
  feeState(): Promise<pvm.FeeState>;
  cBaseFeeNanoAvax(): Promise<bigint>;
}

/** The Fuji reads of the sign functions, through the throttled requests of chain.ts. */
export const LIVE_READS: TeardownReads = { pUtxos, feeState, cBaseFeeNanoAvax };

/** A tx that the teardown signed: the hex that issueTx takes, its ID, and the nAVAX it burns (checkFee). */
export interface TeardownSignedTx {
  hex: string;
  txId: string;
  burned: bigint;
}

/** The avalanchejs context for Fuji, read through the throttled requests of chain.ts. */
export async function fujiContext(): Promise<Context.Context> {
  const blockchainId = async (alias: string) =>
    (await jsonRpc<{ blockchainID: string }>(FUJI.infoRpc, 'info.getBlockchainID', { alias })).blockchainID;
  const { assetID } = await jsonRpc<{ assetID: string }>(FUJI.pRpc, 'platform.getStakingAssetID', {});
  const fee = await jsonRpc<pvm.FeeConfigResponse>(FUJI.pRpc, 'platform.getFeeConfig', {});
  const [bandwidth, dbRead, dbWrite, compute] = fee.weights;
  return {
    networkID: FUJI.networkId,
    hrp: FUJI.hrp,
    xBlockchainID: await blockchainId('X'),
    pBlockchainID: FUJI.pBlockchainId,
    cBlockchainID: await blockchainId('C'),
    avaxAssetID: assetID,
    // X-Chain fees: the P-Chain builder does not read them.
    baseTxFee: 0n,
    createAssetTxFee: 0n,
    platformFeeConfig: {
      weights: Common.createDimensions({ bandwidth, dbRead, dbWrite, compute }),
      maxCapacity: BigInt(fee.maxCapacity),
      maxPerSecond: BigInt(fee.maxPerSecond),
      targetPerSecond: BigInt(fee.targetPerSecond),
      minPrice: BigInt(fee.minPrice),
      excessConversionConstant: BigInt(fee.excessConversionConstant),
    },
  };
}

async function feeState(): Promise<pvm.FeeState> {
  const raw = await jsonRpc<pvm.FeeStateResponse>(FUJI.pRpc, 'platform.getFeeState', {});
  return {
    capacity: BigInt(raw.capacity),
    excess: BigInt(raw.excess),
    price: BigInt(raw.price),
    timestamp: raw.timestamp,
  };
}

async function pUtxos(address: string): Promise<Utxo[]> {
  const manager = utils.getManagerForVM('PVM');
  const result = await jsonRpc<{ utxos: string[] }>(FUJI.pRpc, 'platform.getUTXOs', {
    addresses: [address],
    limit: 1024,
    encoding: 'hex',
  });
  return result.utxos.map((hex) => manager.unpack(utils.hexToBuffer(hex), Utxo));
}

/** The index of the key's address in an owner that the key alone satisfies (threshold 1), or -1. */
function soleAuthIndex(owner: Pick<POwner, 'addresses'> & { threshold: number | string }, address: string): number {
  return Number(owner.threshold) === 1 ? owner.addresses.indexOf(address) : -1;
}

/** Throws when the tx burns more AVAX than `cap` (the fee; an L1 balance spend does not count). Returns the burn. */
function checkFee(tx: UnsignedTx, context: Context.Context, cap: bigint, what: string): bigint {
  const burned =
    utils
      .getBurnedAmountByTx(tx.getTx() as Parameters<typeof utils.getBurnedAmountByTx>[0], context)
      .get(context.avaxAssetID) ?? 0n;
  if (burned > cap) {
    throw new Error(`${what} would burn ${formatNanoAvax(burned)} AVAX, above the cap of ${formatNanoAvax(cap)}.`);
  }
  return burned;
}

/**
 * Signs the tx with the test key and returns the signed tx as hex, with its ID. Every input and every auth belong to
 * the one key, so one signature over the unsigned bytes fills every credential slot.
 */
async function signWithKey(tx: UnsignedTx, key: Hex): Promise<{ hex: string; txId: string }> {
  const unsigned = tx.toBytes();
  const privateKey = Uint8Array.from(Buffer.from(key.slice(2), 'hex'));
  const signature = await secp256k1.sign(unsigned, privateKey);
  // Check the signature before it fills the slots: it must recover to the key's own public key.
  const digest = createHash('sha256').update(unsigned).digest();
  const recovered = secp256k1.recoverPublicKey(Uint8Array.from(digest), signature);
  if (Buffer.compare(Buffer.from(recovered), Buffer.from(secp256k1.getPublicKey(privateKey))) !== 0) {
    throw new Error('The signature does not recover to the test key.');
  }
  tx.getSigIndices().forEach((slots, credential) =>
    slots.forEach((_, slot) => tx.addSignatureAt(signature, credential, slot)),
  );
  const signed = tx.getSignedTx().toBytes();
  const txId = utils.base58check.encode(Uint8Array.from(createHash('sha256').update(signed).digest()));
  return { hex: utils.bufferToHex(utils.addChecksum(signed)), txId };
}

/** A DisableL1ValidatorTx for a validator whose deactivation owner is the key alone. */
export async function signDisableTx(
  validator: Pick<L1Validator, 'validationId' | 'deactivationOwner'>,
  key: Hex,
  context: Context.Context,
  reads: TeardownReads = LIVE_READS,
): Promise<TeardownSignedTx> {
  const { p } = keyAddresses(key);
  const authIndex = soleAuthIndex(validator.deactivationOwner, p);
  if (authIndex < 0) throw new Error(`${p} alone cannot disable ${validator.validationId}.`);
  const tx = pvm.newDisableL1ValidatorTx(
    {
      fromAddressesBytes: [utils.bech32ToBytes(p)],
      utxos: await reads.pUtxos(p),
      feeState: await reads.feeState(),
      validationId: validator.validationId,
      disableAuth: [authIndex],
    },
    context,
  );
  const burned = checkFee(tx, context, P_FEE_CAP, 'The DisableL1ValidatorTx');
  return { ...(await signWithKey(tx, key)), burned };
}

/**
 * A SetAutoRenewedValidatorConfigTx with period 0 (Stake.tsx's 'Stop Auto-Renewal' sends the same: period 0,
 * auto-compound 0). The validator stops at the end of its current cycle.
 */
export async function signStopTx(
  validator: Pick<PrimaryValidator, 'txID' | 'nodeID'> & { validatorAuthority: PApiOwner },
  key: Hex,
  context: Context.Context,
  reads: TeardownReads = LIVE_READS,
): Promise<TeardownSignedTx> {
  const { p } = keyAddresses(key);
  const authIndex = soleAuthIndex(validator.validatorAuthority, p);
  if (authIndex < 0) throw new Error(`${p} alone is not the validator authority of ${validator.nodeID}.`);
  const tx = pvm.newSetAutoRenewedValidatorConfigTx(
    {
      fromAddressesBytes: [utils.bech32ToBytes(p)],
      utxos: await reads.pUtxos(p),
      feeState: await reads.feeState(),
      validatorTxId: validator.txID,
      auth: [authIndex],
      autoCompoundRewardShares: 0,
      period: 0n,
    },
    context,
  );
  const burned = checkFee(tx, context, P_FEE_CAP, 'The SetAutoRenewedValidatorConfigTx');
  return { ...(await signWithKey(tx, key)), burned };
}

/** The C-Chain base fee in nAVAX per gas, doubled and rounded up: an import that pays it is accepted at once. */
async function cBaseFeeNanoAvax(): Promise<bigint> {
  const wei = BigInt(await jsonRpc<string>(FUJI.cRpc, 'eth_baseFee', []));
  return (2n * wei + WEI_PER_NAVAX - 1n) / WEI_PER_NAVAX;
}

/**
 * An import of the key's own unlocked AVAX to the key's own address on `side`: a P-Chain ImportTx from the C-Chain,
 * or a C-Chain ImportTx from the P-Chain. The import pays its fee from the imported AVAX.
 */
export async function signImportTx(
  side: ImportSide,
  utxos: AtomicUtxo[],
  key: Hex,
  context: Context.Context,
  reads: TeardownReads = LIVE_READS,
): Promise<TeardownSignedTx> {
  const { c, p } = keyAddresses(key);
  const from = [utils.bech32ToBytes(p)];
  const atomics = utxos.map((u) => u.utxo);
  const tx =
    side === 'P'
      ? pvm.newImportTx(
          {
            feeState: await reads.feeState(),
            fromAddressesBytes: from,
            utxos: atomics,
            sourceChainId: context.cBlockchainID,
            toAddressesBytes: from,
          },
          context,
        )
      : evm.newImportTxFromBaseFee(
          context,
          utils.hexToBuffer(c),
          from,
          atomics,
          context.pBlockchainID,
          await reads.cBaseFeeNanoAvax(),
        );
  const burned = checkFee(tx, context, ATOMIC_FEE_CAP, `The ${side}-Chain ImportTx`);
  return { ...(await signWithKey(tx, key)), burned };
}

/**
 * The fee price of an import on `side`, as signImportTx pays it. P-Chain: the gas price (feeState). C-Chain: twice the
 * base fee in nAVAX per gas (cBaseFeeNanoAvax).
 */
export async function importPrice(side: ImportSide, reads: TeardownReads = LIVE_READS): Promise<bigint> {
  return side === 'P' ? (await reads.feeState()).price : await reads.cBaseFeeNanoAvax();
}

/**
 * The fee in nAVAX of an import of the key's own AVAX in `utxos`, as signImportTx pays it (atomic.ts importFeeOf at
 * importPrice). P-Chain: the dynamic fee of an ImportTx with one change output (pvm.calculateFee). C-Chain: the gas of
 * the ImportTx times the price (as evm.newImportTxFromBaseFee). A side whose AVAX is not above it is dust: an import
 * would burn all of it. Below the fee, the P-Chain builder refuses the import, and a C-Chain import would pay less
 * than the fee.
 */
export async function importFee(
  side: ImportSide,
  utxos: AtomicUtxo[],
  context: Context.Context,
  reads: TeardownReads = LIVE_READS,
): Promise<bigint> {
  return importFeeOf(side, utxos, { context, price: await importPrice(side, reads) });
}

// ---------------------------------------------------------------------------------------------------------------------
// The CLI
// ---------------------------------------------------------------------------------------------------------------------

function parseArgs(argv: string[]): { dryRun: boolean; paths: string[] } {
  const dryRun = argv.includes('--dry-run');
  const unknown = argv.filter((a) => a.startsWith('-') && a !== '--dry-run');
  if (argv.includes('--help') || unknown.length) {
    console.error('Usage: node chain/lib/teardown.ts [--dry-run] [ledger file or folder ...]');
    process.exit(unknown.length ? 2 : 0);
  }
  const paths = argv.filter((a) => !a.startsWith('-'));
  return { dryRun, paths: paths.length ? paths : [RUN_DIR] };
}

/** What every pass needs: the run mode, the key (a real run has it), the owner address, and the context once. */
interface Run {
  dryRun: boolean;
  key?: Hex;
  owner?: string;
  context(): Promise<Context.Context>;
}

async function collectCandidates(files: string[]): Promise<Map<string, Candidate>> {
  const candidates = new Map<string, Candidate>();
  const add = (validationId: string, file: string, subnetId?: string, label?: string) => {
    const c = candidates.get(validationId) ?? { validationId, files: new Set<string>() };
    c.subnetId ??= subnetId;
    c.label ??= label;
    c.files.add(file);
    candidates.set(validationId, c);
  };
  const subnets = new Map<string, Set<string>>();
  for (const file of files) {
    const ledger = readLedger(file);
    for (const v of ledger.validators) {
      if (v.validationId) add(v.validationId, file, v.subnetId ?? ledger.l1.subnetId, v.label);
    }
    if (ledger.l1.subnetId) subnets.set(ledger.l1.subnetId, (subnets.get(ledger.l1.subnetId) ?? new Set()).add(file));
  }
  // Validators that a run added but never wrote to the ledger (it stopped in the middle).
  for (const [subnetId, ledgerFiles] of subnets) {
    for (const v of await pL1Validators(subnetId)) {
      for (const file of ledgerFiles) add(v.validationId, file, subnetId);
    }
  }
  return candidates;
}

/** Pass 1: disable each L1 validator of the ledgers that is still active and that the key owns. */
async function l1Pass(run: Run, files: string[]): Promise<Outcome[]> {
  const candidates = await collectCandidates(files);
  console.log(`\nPass 1, L1 validators. To check: ${candidates.size}`);
  const outcomes: { candidate: Candidate; outcome: Outcome }[] = [];
  for (const candidate of candidates.values()) {
    const at = new Date().toISOString();
    const base = { validationId: candidate.validationId, subnetId: candidate.subnetId, label: candidate.label, at };
    let outcome: Outcome;
    let txId: string | undefined;
    try {
      const v = await pL1Validator(candidate.validationId);
      if (!v) {
        outcome = { ...base, result: 'not-found' };
      } else if (v.balance === 0n) {
        outcome = { ...base, nodeId: v.nodeId, result: 'inactive' };
      } else if (run.owner && soleAuthIndex(v.deactivationOwner, run.owner) < 0) {
        outcome = { ...base, nodeId: v.nodeId, balance: v.balance.toString(), result: 'not-owner' };
      } else if (run.dryRun) {
        if (run.key) await signDisableTx(v, run.key, await run.context());
        outcome = { ...base, nodeId: v.nodeId, balance: v.balance.toString(), result: 'would-disable' };
      } else {
        const signed = await signDisableTx(v, run.key!, await run.context());
        txId = await issueP(signed, `DisableL1ValidatorTx for ${v.validationId}`);
        // A node behind the load balancer can lag the commit (chainShows): poll before calling it a failure.
        await chainShows(`tx ${txId} committed, and the P-Chain shows ${v.validationId} inactive`, async () => {
          const after = await pL1Validator(v.validationId);
          return !after || after.balance === 0n;
        });
        outcome = { ...base, nodeId: v.nodeId, txId, refunded: v.balance.toString(), result: 'disabled' };
      }
    } catch (error) {
      // A tx that was sent but not confirmed keeps its ID, so a person can look it up.
      outcome = { ...base, txId, result: 'failed', error: errorText(error) };
    }
    outcomes.push({ candidate, outcome });
    const balance = outcome.balance ?? outcome.refunded;
    const label = outcome.label ? ` (${outcome.label})` : '';
    const amount = balance ? `, balance ${formatNanoAvax(BigInt(balance))} AVAX` : '';
    const why = outcome.error ? `: ${outcome.error}` : '';
    console.log(`${outcome.result.padEnd(13)} ${candidate.validationId}${label}${amount}${why}`);
  }

  if (!run.dryRun) {
    for (const file of files) {
      const entries = outcomes
        .filter(({ candidate }) => candidate.files.has(file))
        .map(({ outcome: { nodeId: _n, label: _l, balance: _b, ...entry } }) => entry);
      if (entries.length) updateLedger((ledger) => void ledger.teardown.push(...entries), file);
    }
  }
  return outcomes.map((o) => o.outcome);
}

/** Pass 2: stop the renewal of each ledger's auto-renewed stake that still renews, and print each unlock time. */
async function stakePass(run: Run, paths: string[]): Promise<StakeOutcome[]> {
  const stakes = ledgerStakes(paths);
  console.log(`\nPass 2, Primary Network stakes. To check: ${stakes.length}`);
  const outcomes: StakeOutcome[] = [];
  for (const stake of stakes) {
    const base = { nodeId: stake.nodeId, file: stake.file, kind: stake.kind };
    let outcome: StakeOutcome;
    let txId: string | undefined;
    try {
      const v = await pPrimaryValidator(stake.nodeId);
      const unlockAt = v ? isoFromUnix(v.endTime) : undefined;
      if (!v) {
        outcome = { ...base, result: 'not-found' };
      } else if (stake.txId && v.txID !== stake.txId) {
        outcome = { ...base, txId: v.txID, result: 'other-tx' };
      } else if (!isAutoRenewed(v) || v.nextPeriod === '0') {
        outcome = { ...base, txId: v.txID, unlockAt, result: 'ends' };
        if (!run.dryRun && stake.unlockAt !== unlockAt) setPrimaryStake(stake.file, { state: stake.state, unlockAt });
      } else if (!v.validatorAuthority || (run.owner && soleAuthIndex(v.validatorAuthority, run.owner) < 0)) {
        outcome = { ...base, txId: v.txID, unlockAt, result: 'not-owner' };
      } else if (run.dryRun) {
        if (run.key) await signStopTx({ ...v, validatorAuthority: v.validatorAuthority }, run.key, await run.context());
        outcome = { ...base, txId: v.txID, unlockAt, result: 'would-stop' };
      } else {
        const authority = v.validatorAuthority;
        const signed = await signStopTx({ ...v, validatorAuthority: authority }, run.key!, await run.context());
        txId = await issueP(signed, `SetAutoRenewedValidatorConfigTx (stop) for ${v.nodeID}`);
        const after = await chainShows(`the P-Chain shows ${v.nodeID} with nextPeriod 0`, async () => {
          const now = await pPrimaryValidator(v.nodeID);
          return !now || now.nextPeriod === '0' ? (now ?? v) : null;
        });
        const at = isoFromUnix(after.endTime);
        setPrimaryStake(stake.file, { state: 'stopped', nextPeriod: '0', autoCompoundRewardShares: '0', unlockAt: at });
        outcome = { ...base, txId, unlockAt: at, result: 'stopped' };
      }
    } catch (error) {
      outcome = { ...base, txId, result: 'failed', error: errorText(error) };
    }
    outcomes.push(outcome);
    const unlock = outcome.unlockAt ? `, unlocks at ${outcome.unlockAt}` : '';
    const why = outcome.error ? `: ${outcome.error}` : '';
    console.log(
      `${outcome.result.padEnd(13)} ${stake.nodeId} (${stake.kind}, ${relative(process.cwd(), stake.file)})${unlock}${why}`,
    );
  }
  return outcomes;
}

/** The most UTXOs that pass 3 names one by one for each side. */
const LEFT_LINES = 20;

/** Pass 3: import the key's unlocked AVAX that waits in shared memory, on each side, to the key's own address. */
async function atomicPass(run: Run): Promise<AtomicOutcome[]> {
  if (!run.owner) {
    console.log('\nPass 3, shared memory: skipped (no key and no E2E_CHAIN_P_ADDRESS).');
    return [];
  }
  console.log(`\nPass 3, shared memory of ${run.owner}`);
  const stranded = await strandedUtxos(run.owner);
  const outcomes: AtomicOutcome[] = [];
  for (const side of ['P', 'C'] as const) {
    const ours = stranded[side].filter(isOurAvax);
    const others = stranded[side].filter((u) => !isOurAvax(u));
    const skipped = others.map((u) => u.utxoId);
    let base = { side, utxos: 0, amount: 0n, skipped, later: 0, small: 0 };
    let outcome: AtomicOutcome;
    let txId: string | undefined;
    try {
      // The page's rule at the price that this pass pays (atomic.ts importSelection). A UTXO that does not hold more
      // than the fee of its own input stays. One import takes the largest of the others that fit in its gas limit.
      const rule: ImportRule | undefined = ours.length
        ? { context: await run.context(), price: await importPrice(side) }
        : undefined;
      const worth = rule ? worthImporting(side, ours, rule) : [];
      const next = rule ? importSelection(side, ours, rule) : [];
      const [later, small] = [worth.length - next.length, ours.length - worth.length];
      base = { ...base, utxos: next.length, amount: sumOf(next), later, small };
      const fee = rule && next.length ? importFeeOf(side, next, rule) : undefined;
      if (!rule) {
        outcome = { ...base, result: 'none' };
      } else if (fee === undefined || base.amount <= fee) {
        // Anyone can export dust to the key's address. An import would burn more than it adds, so it stays.
        outcome = { ...base, utxos: ours.length, amount: sumOf(ours), later: 0, small: 0, fee, result: 'dust' };
      } else if (run.dryRun) {
        if (run.key) await signImportTx(side, next, run.key, await run.context());
        outcome = { ...base, fee, result: 'would-import' };
      } else {
        const signed = await signImportTx(side, next, run.key!, await run.context());
        txId = side === 'P' ? await issueP(signed, 'P-Chain ImportTx') : await issueCAtomic(signed);
        await chainShows(`shared memory holds none of the imported UTXOs on the ${side}-Chain side`, async () => {
          const left = new Set((await strandedUtxos(run.owner!))[side].map((u) => u.utxoId));
          return next.every((u) => !left.has(u.utxoId)) ? true : null;
        });
        outcome = { ...base, fee, txId, result: 'imported' };
      }
    } catch (error) {
      outcome = { ...base, txId, result: 'failed', error: errorText(error) };
    }
    outcomes.push(outcome);
    const left = skipped.length ? `, ${skipped.length} UTXO(s) left that the key cannot import alone` : '';
    const later = outcome.later ? `, ${outcome.later} UTXO(s) above the gas limit left for a later run` : '';
    const small = outcome.small ? `, ${outcome.small} UTXO(s) not above the fee of their own input: left` : '';
    const why = outcome.error ? `: ${outcome.error}` : '';
    console.log(
      `${outcome.result.padEnd(13)} ${side}-Chain import of ${formatNanoAvax(outcome.amount)} AVAX in ${outcome.utxos} ` +
        `UTXO(s)${dustText(outcome) ? `, ${dustText(outcome)}: left` : ''}${small}${later}${left}${why}`,
    );
    // Anyone can export many UTXOs to the key's address: print the first ones and the count of the rest.
    for (const u of others.slice(0, LEFT_LINES)) {
      console.log(`${'left'.padEnd(13)} ${side}-Chain UTXO ${u.utxoId}: ${notOursReason(u)}`);
    }
    if (others.length > LEFT_LINES) console.log(`${'left'.padEnd(13)} ${others.length - LEFT_LINES} more UTXO(s)`);
  }
  return outcomes;
}

/** Why a 'dust' outcome left the key's AVAX on its side, or '' for another outcome. */
function dustText(o: AtomicOutcome): string {
  if (o.result !== 'dust') return '';
  return o.fee === undefined
    ? 'no UTXO holds more than the fee of its own input'
    : `not above the import fee of ${formatNanoAvax(o.fee)} AVAX`;
}

/** Issues a signed P-Chain tx and waits until it is committed. Returns the tx ID. */
async function issueP(signed: { hex: string; txId: string }, what: string): Promise<string> {
  const { txID } = await jsonRpc<{ txID: string }>(FUJI.pRpc, 'platform.issueTx', { tx: signed.hex, encoding: 'hex' });
  console.log(`Sent ${what}: ${txID}.`);
  await waitForPTx(txID);
  return txID;
}

/** Issues a signed C-Chain atomic tx and waits until a C-Chain block holds it. Returns the tx ID. */
async function issueCAtomic(signed: { hex: string; txId: string }): Promise<string> {
  const { txID } = await jsonRpc<{ txID: string }>(FUJI.cAvax, 'avax.issueTx', { tx: signed.hex, encoding: 'hex' });
  console.log(`Sent C-Chain ImportTx: ${txID}.`);
  await chainShows(`the C-Chain accepted atomic tx ${txID}`, () => cAtomicTxHeight(txID), 180_000);
  return txID;
}

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));

async function main(): Promise<void> {
  const { dryRun, paths } = parseArgs(process.argv.slice(2));
  const files = findLedgerFiles(paths);
  const where = files.length
    ? files.map((f) => relative(process.cwd(), f)).join(', ')
    : `none under ${paths.join(', ')}`;
  console.log(`${dryRun ? 'Dry run. ' : ''}Ledgers: ${where}`);

  // A real run needs the key. A dry run uses it when it is set.
  const key = dryRun ? readFujiKeyIfSet() : readFujiKey();
  const owner = key ? keyAddresses(key).p : process.env.E2E_CHAIN_P_ADDRESS;
  console.log(`Owner: ${owner ?? 'not known (no key and no E2E_CHAIN_P_ADDRESS): the owner checks are skipped'}`);

  await assertFuji();
  let context: Promise<Context.Context> | undefined;
  const run: Run = { dryRun, key, owner, context: () => (context ??= fujiContext()) };

  const l1 = await l1Pass(run, files);
  const stakes = await stakePass(run, paths);
  const atomic = await atomicPass(run);

  writeSummary(dryRun, l1, stakes, atomic);
  const failed =
    l1.filter((o) => o.result === 'failed').length + [...stakes, ...atomic].filter((o) => o.result === 'failed').length;
  if (failed) {
    console.error(`${failed} teardown tx(s) failed.`);
    process.exitCode = 1;
  }
}

/** Three tables in the GitHub job summary, when the step runs in Actions. */
function writeSummary(dryRun: boolean, l1: Outcome[], stakes: StakeOutcome[], atomic: AtomicOutcome[]): void {
  const file = process.env.GITHUB_STEP_SUMMARY;
  if (!file) return;
  const code = (text?: string) => (text ? `\`${text}\`` : '');
  const table = (header: string[], rows: string[][], empty: string) =>
    rows.length
      ? [
          `| ${header.join(' | ')} |`,
          `|${header.map(() => '---|').join('')}`,
          ...rows.map((r) => `| ${r.join(' | ')} |`),
        ].join('\n')
      : empty;
  const l1Rows = l1.map((o) => {
    const balance = o.balance ?? o.refunded;
    return [
      o.label ?? '',
      code(o.validationId),
      o.result,
      balance ? `${formatNanoAvax(BigInt(balance))} AVAX` : '',
      code(o.txId),
      o.error ?? '',
    ];
  });
  const stakeRows = stakes.map((o) => [
    code(o.nodeId),
    o.kind,
    o.result,
    o.unlockAt ?? '',
    code(o.txId),
    o.error ?? '',
  ]);
  const atomicRows = atomic.map((o) => [
    `${o.side}-Chain`,
    `${formatNanoAvax(o.amount)} AVAX in ${o.utxos}`,
    o.result,
    String(o.skipped.length + o.later + o.small),
    code(o.txId),
    o.result === 'dust' ? dustText(o) : (o.error ?? ''),
  ]);
  const sections = [
    `### Chain test teardown${dryRun ? ' (dry run)' : ''}`,
    '#### L1 validators',
    table(['Validator', 'Validation ID', 'Result', 'Balance', 'Tx', 'Error'], l1Rows, 'No validator to check.'),
    '#### Primary Network stakes',
    table(['NodeID', 'Kind', 'Result', 'Unlocks at', 'Tx', 'Error'], stakeRows, 'No stake to check.'),
    '#### Shared memory',
    table(['Import to', 'AVAX in UTXOs', 'Result', 'UTXOs left', 'Tx', 'Error or note'], atomicRows, 'Not read.'),
  ];
  appendFileSync(file, `${sections.join('\n\n')}\n\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    console.error(errorText(error));
    process.exit(1);
  });
}
