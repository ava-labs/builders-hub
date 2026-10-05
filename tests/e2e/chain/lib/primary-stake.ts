// Primary Network stake reads and the stake record of the ledger, for the stake test files
// (chain/primary-stake-acp236.e2e.ts, chain/primary-stake-fixed.e2e.ts, chain/primary-stake-reads.e2e.ts),
// teardown.ts and preflight.ts.
//
// A Primary Network stake locks 1 AVAX for at least 12 h, and the P-Chain allows no early exit. So a stake file first
// checks that no earlier stake can change the balances that it checks (assertStakeRoom), and it keeps its stake in one
// ledger record, `primaryStake` (PrimaryStakeRecord): the mock NodeID, the tx ID, the cycle or the end time, and the
// time the P-Chain gives the stake back (unlockAt). teardown.ts reads that record to stop an auto-renewed validator
// that still renews, and preflight.ts prints each unlock time. teardown.ts's L1 pass skips these ledgers: they hold no
// validation ID.
//
// Reads go through chain.ts: public Fuji endpoints only, 2 requests per second, a stop at the first 429, and past the
// public API's cache (freshParams).

import { existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { NANO_AVAX, chainShows, formatNanoAvax, pBalance, pCurrentValidators, pStaked } from './chain.ts';
import { RUN_DIR, findLedgerFiles, readLedger, updateLedger } from './ledger.ts';

/** The ledger of the ACP-236 file. Archived as archive/stake-acp236-<runId>.json. */
export const STAKE_ACP236_LEDGER = join(RUN_DIR, 'stake-acp236.json');
/** The ledger of the fixed-duration file. */
export const STAKE_FIXED_LEDGER = join(RUN_DIR, 'stake-fixed.json');

/**
 * The Stake page's note while it shows the values of its own accepted tx and the API read does not show them yet
 * (Stake.tsx ACCEPTED_TX_NOTE). The success screen shows it too.
 */
export const ACCEPTED_TX_NOTE =
  'The P-Chain accepted the transaction. The validator list can take a few minutes to show it.';

/**
 * The Stake page's error when the config tx cannot find the validator in the API's cached validator list, right after
 * the add (Stake.tsx, utils/primaryValidatorLookup.ts VALIDATOR_NOT_LISTED_YET).
 */
export const VALIDATOR_NOT_LISTED_YET =
  'The validator list does not show this validator yet. Try again in a few minutes.';

// ---------------------------------------------------------------------------------------------------------------------
// Primary Network validators (platform.getCurrentValidators)
// ---------------------------------------------------------------------------------------------------------------------

/** An owner as the P-Chain API writes it. The addresses are 'P-fuji1...'. */
export interface PApiOwner {
  locktime: string;
  threshold: string;
  addresses: string[];
}

/**
 * A Primary Network validator as platform.getCurrentValidators writes it (avalanchego vms/platformvm/api/validator.go,
 * PermissionlessValidator). nextPeriod, autoCompoundRewardShares and validatorAuthority are there only for an ACP-236
 * auto-renewed validator.
 */
export interface PrimaryValidator {
  /** The tx that added the validator: an AddPermissionlessValidatorTx or an AddAutoRenewedValidatorTx. */
  txID: string;
  nodeID: string;
  /** Unix seconds. For an auto-renewed validator: the start and the end of the current cycle. */
  startTime: string;
  endTime: string;
  /** nAVAX. */
  weight: string;
  /** nAVAX. The public API leaves it out today; the Stake page reads it first when it is there. */
  stakeAmount?: string;
  /** Percent with 4 decimals, for example '2.0000'. */
  delegationFee?: string;
  validationRewardOwner?: PApiOwner;
  delegationRewardOwner?: PApiOwner;
  signer?: { publicKey: string; proofOfPossession: string };
  /** The owner that can send SetAutoRenewedValidatorConfigTx. */
  validatorAuthority?: PApiOwner;
  /** Seconds of the next cycle. '0': the validator stops at the end of the current cycle. */
  nextPeriod?: string;
  /** Parts per million of each cycle's reward that the P-Chain restakes. */
  autoCompoundRewardShares?: string;
}

const NODE_IDS_PER_CALL = 50;

/**
 * The current Primary Network validators among `nodeIds`. A NodeID that does not validate is not in the list. Sends
 * no request for an empty list: platform.getCurrentValidators with no NodeID returns every Fuji validator.
 */
export async function pPrimaryValidators(nodeIds: readonly string[]): Promise<PrimaryValidator[]> {
  const found: PrimaryValidator[] = [];
  for (let i = 0; i < nodeIds.length; i += NODE_IDS_PER_CALL) {
    found.push(...(await pCurrentValidators<PrimaryValidator>({ nodeIDs: nodeIds.slice(i, i + NODE_IDS_PER_CALL) })));
  }
  return found;
}

/** The current Primary Network validator with this NodeID, or null when the NodeID does not validate. */
export async function pPrimaryValidator(nodeId: string): Promise<PrimaryValidator | null> {
  return (await pPrimaryValidators([nodeId])).find((v) => v.nodeID === nodeId) ?? null;
}

/** Every current Primary Network validator of Fuji, in one read. */
export async function pAllPrimaryValidators(): Promise<PrimaryValidator[]> {
  return pCurrentValidators<PrimaryValidator>({});
}

/** True for an ACP-236 auto-renewed validator: the Stake page's own test (Stake.tsx). */
export const isAutoRenewed = (v: PrimaryValidator) => v.nextPeriod !== undefined || !!v.validatorAuthority;

/** Unix seconds as an ISO time. */
export function isoFromUnix(seconds: string | number | bigint): string {
  return new Date(Number(seconds) * 1000).toISOString();
}

/**
 * 0.05 AVAX: how far the unlocked balance may be from the expected value after a stake tx. Far below the 1 AVAX stake,
 * so the check still proves where the stake went. Above an L1 balance refund or a bridge fee, so another tx of the
 * key in the same minutes does not fail it. The signer's totals give the exact fee.
 */
const UNLOCKED_SLACK = NANO_AVAX / 20n;

/**
 * Polls the unlocked P-Chain balance of `address` until it is within `slack` of `expected` (a node can lag the tx),
 * and returns it. `expected` is the balance before the tx, less the stake and the fee that the wallet signed.
 */
export async function chainShowsUnlocked(
  label: string,
  address: string,
  expected: bigint,
  slack = UNLOCKED_SLACK,
): Promise<bigint> {
  const range = `${formatNanoAvax(expected)} AVAX, within ${formatNanoAvax(slack)}`;
  return chainShows(`${label} (${range})`, async () => {
    const balance = await pBalance(address);
    const off = balance > expected ? balance - expected : expected - balance;
    return off <= slack ? balance : null;
  });
}

// ---------------------------------------------------------------------------------------------------------------------
// The ledger record of a stake
// ---------------------------------------------------------------------------------------------------------------------

export interface PrimaryStakeRecord {
  /** 'auto-renewed': AddAutoRenewedValidatorTx (ACP-236). 'fixed': AddPermissionlessValidatorTx with an end time. */
  kind: 'auto-renewed' | 'fixed';
  nodeId: string;
  /** nAVAX. */
  stake: string;
  /** The tx that added the validator. A SetAutoRenewedValidatorConfigTx names it, and a teardown stop needs it. */
  txId?: string;
  /** Unix seconds: the start and the end of the first cycle, or of the fixed stake. */
  startTime?: string;
  endTime?: string;
  /** Auto-renewed only: the nextPeriod that the P-Chain shows after the test's last tx, in seconds. '0' after a stop. */
  nextPeriod?: string;
  autoCompoundRewardShares?: string;
  /** When the P-Chain gives the stake back (ISO): the end time, or the end of the current cycle once renewal stops. */
  unlockAt?: string;
  /** What the run (or teardown.ts) did last. */
  state: 'planned' | 'staked' | 'updated' | 'stopped';
}

/** Merges the patch into the ledger's stake record and returns the record. The first patch names the kind. */
export function setPrimaryStake(
  path: string,
  patch: Partial<PrimaryStakeRecord> & Pick<PrimaryStakeRecord, 'state'>,
): PrimaryStakeRecord {
  const ledger = updateLedger((l) => {
    const merged = { ...l.primaryStake, ...patch };
    if (!merged.kind || !merged.nodeId || !merged.stake) {
      throw new Error('The first stake record needs kind, nodeId and stake.');
    }
    l.primaryStake = merged as PrimaryStakeRecord;
  }, path);
  return ledger.primaryStake!;
}

/** One stake record of a ledger file. */
export interface LedgerStake extends PrimaryStakeRecord {
  file: string;
  runId: string;
}

/** Every stake record in the ledgers under `paths` (default chain/.run and its archive). */
export function ledgerStakes(paths: readonly string[] = [RUN_DIR]): LedgerStake[] {
  const stakes: LedgerStake[] = [];
  for (const file of findLedgerFiles(paths)) {
    const ledger = readLedger(file);
    if (ledger.primaryStake?.nodeId) stakes.push({ ...ledger.primaryStake, file, runId: ledger.runId });
  }
  return stakes;
}

/** A Primary Network validator that a ledger under chain/.run names, and that still validates. */
export interface ActiveStake {
  nodeId: string;
  /** The ledger that names the NodeID. */
  file: string;
  validator: PrimaryValidator;
}

/**
 * The Primary Network validators that an earlier run left active: every NodeID of every ledger under `paths` (the
 * `validators` entries and the stake records), asked in a few platform.getCurrentValidators calls. The L1 mock
 * validators of tier 1 never validate the Primary Network, so only a stake can match. CI starts with an empty
 * chain/.run, so there this finds nothing; platform.getStake covers CI.
 */
export async function activeStakes(paths: readonly string[] = [RUN_DIR]): Promise<ActiveStake[]> {
  const files = new Map<string, string>();
  for (const file of findLedgerFiles(paths)) {
    const ledger = readLedger(file);
    for (const v of ledger.validators) files.set(v.nodeId, file);
    if (ledger.primaryStake?.nodeId) files.set(ledger.primaryStake.nodeId, file);
  }
  const active = await pPrimaryValidators([...files.keys()]);
  return active.map((validator) => ({ nodeId: validator.nodeID, file: files.get(validator.nodeID) ?? '', validator }));
}

/** One line about an active stake: the NodeID, the stake, the end of the current cycle, the renewal, the ledger. */
export function describeActiveStake({ nodeId, file, validator: v }: ActiveStake): string {
  const renews = v.nextPeriod && v.nextPeriod !== '0' ? `, renews every ${Number(v.nextPeriod) / 3600} h` : '';
  const where = file ? ` (${relative(process.cwd(), file)})` : '';
  return `${nodeId} validates with ${formatNanoAvax(BigInt(v.weight))} AVAX until ${isoFromUnix(v.endTime)}${renews}${where}`;
}

/**
 * How long a stake run can take, with margin: the member caps of the longer stake file (stake-acp236, 41 min). An
 * earlier stake that ends inside this window would change the balances that the run checks.
 */
const STAKE_RUN_WINDOW_S = 60 * 60;

/**
 * Throws unless a new stake can run next to the stakes that the key has now, and returns the nAVAX that the key
 * stakes now (platform.getStake): the base of the run's own stake check. The unlocked balance check of each stake
 * file covers the AVAX that the new stake needs. This check makes sure that only the run's own txs change the
 * balances that the run checks. An earlier stake can stay locked when all of these hold:
 * - a ledger under `paths` names it, and the stakes that the ledgers name add up to platform.getStake. CI starts with
 *   an empty chain/.run, so there any earlier stake stops the run;
 * - it does not renew: a fixed-duration validator, or an auto-renewed one with nextPeriod 0;
 * - it ends more than STAKE_RUN_WINDOW_S from now.
 * The error names each stake and the time the P-Chain returns it.
 */
export async function assertStakeRoom(pAddress: string, paths: readonly string[] = [RUN_DIR]): Promise<bigint> {
  const active = await activeStakes(paths);
  const staked = await pStaked(pAddress);
  const named = active.reduce((sum, { validator }) => sum + BigInt(validator.weight), 0n);
  const windowEnd = Math.floor(Date.now() / 1000) + STAKE_RUN_WINDOW_S;
  const problems: string[] = [];
  if (named !== staked) {
    problems.push(
      `platform.getStake: ${formatNanoAvax(staked)} AVAX staked by ${pAddress}. The local ledgers name ` +
        `${formatNanoAvax(named)} AVAX of it, so the run cannot know when the rest comes back.`,
    );
  }
  for (const stake of active) {
    const { nextPeriod, endTime } = stake.validator;
    if (nextPeriod && nextPeriod !== '0') {
      problems.push(`${describeActiveStake(stake)}. It renews: stop it first (node chain/lib/teardown.ts).`);
    } else if (Number(endTime) <= windowEnd) {
      problems.push(`${describeActiveStake(stake)}. It comes back during this run.`);
    }
  }
  if (problems.length) {
    throw new Error(
      `An earlier Primary Network stake could change the balances that this run checks.\n- ` +
        `${problems.join('\n- ')}\nRun again after the unlock time.`,
    );
  }
  return staked;
}

/** The stake of the last run that this run can finish (resumableStake). */
export interface ResumableStake {
  /** The run that sent the add. Its mock validator is seeded with this run ID. */
  runId: string;
  nodeId: string;
  /** The AddAutoRenewedValidatorTx ID. */
  txId: string;
}

/**
 * The ACP-236 stake of the last run that this run can finish, or undefined. A run that stopped after the add and
 * before its config txs leaves 1 AVAX locked for the 12 h cycle, and no run can add a new stake until then. So member
 * 1 resumes it when all of these hold: the ledger at `path` (not yet archived) has an add step with a tx ID for the
 * stake record's NodeID, no other step sent a tx, and the P-Chain lists that tx as the NodeID's current validator with
 * the add's config (`expected`). The signer then checks the tx itself (adoptAutoRenewedValidator).
 */
export async function resumableStake(
  addStep: string,
  expected: { nextPeriod: string; shares: string },
  path = STAKE_ACP236_LEDGER,
): Promise<ResumableStake | undefined> {
  if (!existsSync(path)) return undefined;
  const ledger = readLedger(path);
  const add = ledger.sends.find((s) => s.step === addStep);
  const txId = add?.txIds[0];
  const nodeId = ledger.primaryStake?.nodeId;
  if (!add || !txId || !nodeId || add.inputs.nodeId !== nodeId) return undefined;
  if (ledger.sends.some((s) => s.step !== addStep && s.txIds.length > 0)) return undefined;
  const v = await pPrimaryValidator(nodeId);
  const sameConfig = v?.nextPeriod === expected.nextPeriod && v.autoCompoundRewardShares === expected.shares;
  return v?.txID === txId && sameConfig ? { runId: ledger.runId, nodeId, txId } : undefined;
}
