// Teardown: disables every L1 validator of the chain test ledgers that is still active, so its P-Chain balance comes
// back to the test key instead of burning (512 nAVAX/s per validator on Fuji).
//
//   node chain/lib/teardown.ts --dry-run          # print what it would disable; sends nothing
//   node chain/lib/teardown.ts                    # send a DisableL1ValidatorTx for each one
//   node chain/lib/teardown.ts [--dry-run] <ledger file or folder> ...
//
// It reads every ledger under the given paths (default chain/.run), and for each L1 there it asks the P-Chain for
// the current validators (platform.getCurrentValidators), plus each validation ID in the ledger. A validator is
// disabled when platform.getL1Validator shows a balance above 0 and the test key is its deactivation owner.
// It signs in Node with the test key (E2E_CHAIN_FUJI_KEY_FILE or E2E_CHAIN_FUJI_KEY) and avalanchejs, on Fuji only,
// and never prints the key.
//
// The workflow runs it after the tests with `if: always()`, because a failed or cancelled run can stop before the
// Console's Disable step. It is a CLI and not an afterAll hook: a cancel skips afterAll.
//
// A dry run with the key set also builds and signs each tx, but does not send it. Without the key it uses
// E2E_CHAIN_P_ADDRESS (if set) for the owner check.
// Exit code 1 when a validator that the key owns could not be disabled.

import { appendFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Common, pvm, secp256k1, utils, Utxo, type Context, type UnsignedTx } from '@avalabs/avalanchejs';
import {
  FUJI,
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
} from './chain.ts';
import { RUN_DIR, findLedgerFiles, readLedger, updateLedger, type LedgerTeardown } from './ledger.ts';

type Hex = `0x${string}`;

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

// ---------------------------------------------------------------------------------------------------------------------
// The DisableL1ValidatorTx
// ---------------------------------------------------------------------------------------------------------------------

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

/**
 * Builds and signs a DisableL1ValidatorTx with the test key, and returns the signed tx as hex. Every input and the
 * disable auth belong to the one key, so one signature over the unsigned bytes fills every credential slot.
 */
export async function signDisableTx(
  validator: Pick<L1Validator, 'validationId' | 'deactivationOwner'>,
  key: Hex,
  context: Context.Context,
): Promise<string> {
  const { p } = keyAddresses(key);
  const authIndex = validator.deactivationOwner.addresses.indexOf(p);
  if (authIndex < 0 || validator.deactivationOwner.threshold !== 1) {
    throw new Error(`${p} alone cannot disable ${validator.validationId}.`);
  }
  const tx: UnsignedTx = pvm.newDisableL1ValidatorTx(
    {
      fromAddressesBytes: [utils.bech32ToBytes(p)],
      utxos: await pUtxos(p),
      feeState: await feeState(),
      validationId: validator.validationId,
      disableAuth: [authIndex],
    },
    context,
  );
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
  return utils.bufferToHex(utils.addChecksum(tx.getSignedTx().toBytes()));
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

async function main(): Promise<void> {
  const { dryRun, paths } = parseArgs(process.argv.slice(2));
  const files = findLedgerFiles(paths);
  if (!files.length) {
    console.log(`No ledger under ${paths.join(', ')}. Nothing to tear down.`);
    return;
  }
  console.log(`${dryRun ? 'Dry run. ' : ''}Ledgers: ${files.map((f) => relative(process.cwd(), f)).join(', ')}`);

  // A real run needs the key. A dry run uses it when it is set.
  const key = dryRun ? readFujiKeyIfSet() : readFujiKey();
  const owner = key ? keyAddresses(key).p : process.env.E2E_CHAIN_P_ADDRESS;
  console.log(`Owner: ${owner ?? 'not known (no key and no E2E_CHAIN_P_ADDRESS): the owner check is skipped'}`);

  await assertFuji();
  const candidates = await collectCandidates(files);
  console.log(`Validators to check: ${candidates.size}`);
  let context: Context.Context | undefined;

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
      } else if (owner && !(v.deactivationOwner.threshold === 1 && v.deactivationOwner.addresses.includes(owner))) {
        outcome = { ...base, nodeId: v.nodeId, balance: v.balance.toString(), result: 'not-owner' };
      } else if (dryRun) {
        if (key) {
          context ??= await fujiContext();
          await signDisableTx(v, key, context);
        }
        outcome = { ...base, nodeId: v.nodeId, balance: v.balance.toString(), result: 'would-disable' };
      } else {
        context ??= await fujiContext();
        const signed = await signDisableTx(v, key!, context);
        ({ txID: txId } = await jsonRpc<{ txID: string }>(FUJI.pRpc, 'platform.issueTx', {
          tx: signed,
          encoding: 'hex',
        }));
        console.log(`Sent DisableL1ValidatorTx ${txId} for ${v.validationId}.`);
        await waitForPTx(txId);
        // A node behind the load balancer can lag the commit (chainShows): poll before calling it a failure.
        await chainShows(`tx ${txId} committed, and the P-Chain shows ${v.validationId} inactive`, async () => {
          const after = await pL1Validator(v.validationId);
          return !after || after.balance === 0n;
        });
        outcome = { ...base, nodeId: v.nodeId, txId, refunded: v.balance.toString(), result: 'disabled' };
      }
    } catch (error) {
      // A tx that was sent but not confirmed keeps its ID, so a person can look it up.
      outcome = { ...base, txId, result: 'failed', error: error instanceof Error ? error.message : String(error) };
    }
    outcomes.push({ candidate, outcome });
    const balance = outcome.balance ?? outcome.refunded;
    const label = outcome.label ? ` (${outcome.label})` : '';
    const amount = balance ? `, balance ${formatNanoAvax(BigInt(balance))} AVAX` : '';
    const why = outcome.error ? `: ${outcome.error}` : '';
    console.log(`${outcome.result.padEnd(13)} ${candidate.validationId}${label}${amount}${why}`);
  }

  if (!dryRun) {
    for (const file of files) {
      const entries = outcomes
        .filter(({ candidate }) => candidate.files.has(file))
        .map(({ outcome: { nodeId: _n, label: _l, balance: _b, ...entry } }) => entry);
      if (entries.length) updateLedger((ledger) => void ledger.teardown.push(...entries), file);
    }
  }

  writeSummary(
    dryRun,
    outcomes.map((o) => o.outcome),
  );
  const failed = outcomes.filter((o) => o.outcome.result === 'failed');
  if (failed.length) {
    console.error(`${failed.length} validator(s) could not be disabled.`);
    process.exitCode = 1;
  }
}

/** A table in the GitHub job summary, when the step runs in Actions. */
function writeSummary(dryRun: boolean, outcomes: Outcome[]): void {
  const file = process.env.GITHUB_STEP_SUMMARY;
  if (!file) return;
  const rows = outcomes.map((o) => {
    const balance = o.balance ?? o.refunded;
    const amount = balance ? `${formatNanoAvax(BigInt(balance))} AVAX` : '';
    const tx = o.txId ? `\`${o.txId}\`` : '';
    return `| ${o.label ?? ''} | \`${o.validationId}\` | ${o.result} | ${amount} | ${tx} | ${o.error ?? ''} |`;
  });
  const table = rows.length
    ? ['| Validator | Validation ID | Result | Balance | Tx | Error |', '|---|---|---|---|---|---|', ...rows].join('\n')
    : 'No validator to check.';
  appendFileSync(file, `### Chain test teardown${dryRun ? ' (dry run)' : ''}\n\n${table}\n\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
