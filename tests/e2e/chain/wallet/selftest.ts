// Self-test of the e2e Core wallet. It sends no transaction and opens no browser.
//
//   cd tests/e2e
//   export E2E_CHAIN_FUJI_KEY_FILE=~/.config/e2e-chain/fuji.key
//   node chain/wallet/selftest.ts
//
// Optional: E2E_CHAIN_C_ADDRESS and E2E_CHAIN_P_ADDRESS, the addresses the key must give.
//
// Network reads (public endpoints, through chain.ts throttledFetch: one slot every 500 ms, a stop at the first 429):
// eth_blockNumber and eth_getBalance on the Fuji C-Chain, and platform.getSubnet on the Fuji P-Chain. A guard on the
// signer's fetch refuses issueTx and eth_sendRawTransaction. Each other check runs on a stub signer, whose network is
// a list of answers in this file. A refusal check also proves that the refusal made no network call and added exactly
// one entry to signer.refusals.
//
// The capability checks (allowPrimaryStake, allowBridge) build each tx as the Console does: the avalanchejs 5.1.0
// builders that @avalanche-sdk/client 0.1.3 calls, and for AddAutoRenewedValidatorTx the SDK's byte fix. Then
// fuji-txs.json replays real Fuji txs of the same types: each decodes and encodes back to its bytes, and the txs of
// this key sign again to the same bytes and tx ID.
//
// The teardown (chain/lib/teardown.ts) signs its txs in Node with the same key. Its sign functions run here with fixed
// chain reads: each tx is built and signed, and nothing is sent. The P-Chain import signs a real Fuji ImportTx of
// fuji-txs.json again to the same bytes.
//
// The provider runs here in a node:vm page, from the same function source that the engine gets as an init script.
// The browser half (the init script before the app's scripts, the Core connect flow, a reload) needs a real browser:
// a chain test with the `wallet` fixture and connectCore from chain/lib/fixtures.ts.

import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inspect } from 'node:util';
import vm from 'node:vm';
import {
  Address,
  avaxSerial,
  BigIntPr,
  BlsSignature,
  Bytes,
  Common,
  Credential,
  evm,
  evmSerial,
  Id,
  Input,
  Int,
  L1Validator,
  OutputOwners,
  PChainOwner,
  pvm,
  pvmSerial,
  secp256k1,
  Signature,
  Stringpr,
  TransferableInput,
  TransferableOutput,
  TransferOutput,
  utils,
  Utxo,
  type Context,
} from '@avalabs/avalanchejs';
import { secp256k1 as nobleSecp256k1 } from '@noble/curves/secp256k1.js';
import { keccak256, parseTransaction, recoverTransactionAddress, type Hex } from 'viem';
import type { WebRoute } from '@e2e-dev/web';
import {
  importFeeOf,
  importGasLimit,
  importSelection,
  importsToClear,
  inputFee,
  notOursReason,
  pImportGas,
  readAtomicUtxo,
  type AtomicUtxo,
  type ImportRule,
} from '../lib/atomic.ts';
import { auditSends } from '../lib/audit.ts';
import { importProblems } from '../lib/bridge-cp.ts';
import { FUJI, NANO_AVAX, readFujiKey, RpcError, throttledFetch } from '../lib/chain.ts';
import { readLedger, updateLedger } from '../lib/ledger.ts';
import { createMockValidator } from '../lib/mock-validator.ts';
import {
  ATOMIC_FEE_CAP,
  importFee,
  P_FEE_CAP,
  signDisableTx,
  signImportTx,
  signStopTx,
  type TeardownReads,
  type TeardownSignedTx,
} from '../lib/teardown.ts';
import { answerWalletRequest, WALLET_ROUTE, walletRouteHandler } from './bridge.ts';
import { readSignedTx, signedTxBytes } from './codec.ts';
import { coreProvider, WALLET_PATH } from './provider.ts';
import { createSignerFromEnv, ERR, Signer, USER_REJECTED_MESSAGE, type SignedPChainTx } from './signer.ts';

const FOREIGN_P_ADDRESS = 'P-fuji1ywzvrftfqexh5g6qa9zyrytj6pqdfetza2hqln';
const FOREIGN_P_BYTES = utils.bech32ToBytes(FOREIGN_P_ADDRESS);
const MILLI_AVAX = NANO_AVAX / 1_000n;
// The Fuji X-Chain: a destination that is not the C-Chain or the P-Chain.
const FUJI_X_CHAIN_ID = '2JVSBoinj9C2J33VntvzYtVJNZdN2NKiwwKjcumHUWEb5DbBrm';

const sha256 = (bytes: Uint8Array) => new Uint8Array(createHash('sha256').update(bytes).digest());
const randomBytes = (n: number) => crypto.getRandomValues(new Uint8Array(n));
const randomId = () => utils.base58check.encode(randomBytes(32));

let failures = 0;
async function check(name: string, run: () => Promise<void> | void) {
  try {
    await run();
    console.log(`ok    ${name}`);
  } catch (err) {
    failures++;
    console.log(`FAIL  ${name}: ${err instanceof Error ? err.message : String(err)}`);
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

// Expects the promise to fail with an RpcError of this code, and the message to match.
async function rejects(promise: Promise<unknown>, code: number, match?: RegExp): Promise<string> {
  try {
    await promise;
  } catch (err) {
    assert(err instanceof RpcError, `expected an RpcError, got ${String(err)}`);
    assert(err.code === code, `expected code ${code}, got ${err.code}: ${err.message}`);
    if (match) assert(match.test(err.message), `message ${JSON.stringify(err.message)} does not match ${match}`);
    return err.message;
  }
  throw new Error(`expected a rejection with code ${code}`);
}

// Expects a refusal: the request fails with `code` (4001 by default) and a message that matches, wallet.refusals
// grows by exactly one entry with that reason, and (with `urls`) the refusal made no network call.
async function refused(
  wallet: Signer,
  request: () => Promise<unknown>,
  match: RegExp,
  { code = ERR.userRejected, urls }: { code?: number; urls?: string[] } = {},
): Promise<void> {
  const before = wallet.refusals.length;
  const calls = urls?.length ?? 0;
  await rejects(request(), code, match);
  assert(wallet.refusals.length === before + 1, `signer.refusals grew by ${wallet.refusals.length - before}, not 1`);
  const { reason } = wallet.refusals[before];
  assert(match.test(reason), `refusal reason ${JSON.stringify(reason)} does not match ${match}`);
  if (urls) assert(urls.length === calls, `the refusal made a network call: ${urls.slice(calls).join(', ')}`);
}

// ---- the signer under test ----

const networkCalls: string[] = [];
// The signer's fetch for this test: chain.ts throttledFetch, with no sends.
const guardedFetch = async (url: string, init: RequestInit): Promise<Response> => {
  const body = typeof init.body === 'string' ? init.body : '';
  const method = (JSON.parse(body || '{}') as { method?: string }).method ?? '?';
  if (/issueTx|sendRawTransaction/.test(method)) throw new Error(`selftest refuses to send (${method})`);
  networkCalls.push(method);
  return throttledFetch(url, init);
};

const logs: string[] = [];
const signer = createSignerFromEnv({
  fetch: guardedFetch,
  log: (line) => logs.push(line),
  lookupAttempts: 2,
  lookupDelayMs: 1_000,
});
const keyHex = readFujiKey().slice(2).toLowerCase();
const ourCompressed = utils.hexToBuffer(signer.publicKey);
const ourPBytes = secp256k1.publicKeyBytesToAddress(ourCompressed);
const ourEvmBytes = utils.hexToBuffer(signer.address);

type Answer = unknown | Error | ((params: unknown) => unknown);

// A signer whose network is a stub: each call is answered from `answers`, and any other call fails. An answer is a
// value, an Error (a JSON-RPC error), or a function of the params. `urls` records the URL of each call.
function stubSigner(answers: Record<string, Answer>, urls: string[] = []): Signer {
  const stub = async (url: string, init: RequestInit): Promise<Response> => {
    urls.push(url);
    const body = JSON.parse(String(init.body ?? '{}')) as { id: number; method: string; params: unknown };
    if (!(body.method in answers)) throw new Error(`stub has no answer for ${body.method}`);
    const entry = answers[body.method];
    const answer = typeof entry === 'function' ? (entry as (params: unknown) => unknown)(body.params) : entry;
    return Response.json(
      answer instanceof Error
        ? { jsonrpc: '2.0', id: body.id, error: { code: -32000, message: answer.message } }
        : { jsonrpc: '2.0', id: body.id, result: answer },
    );
  };
  return createSignerFromEnv({ fetch: stub, log: () => undefined, lookupAttempts: 1 });
}

// A stub signer with no answers, and the list of the calls it tried. A refusal must leave the list empty.
function offline(): { wallet: Signer; urls: string[] } {
  const urls: string[] = [];
  return { wallet: stubSigner({}, urls), urls };
}

// A stub signer that issues: platform.issueTx and avax.issueTx answer, and `issued` collects each signed tx hex with
// the URL it went to. `nonce` is the pending EVM nonce that eth_getTransactionCount gives.
function issuingSigner({ nonce = 7 } = {}) {
  const urls: string[] = [];
  const issued: { url: string; hex: string }[] = [];
  const issue = (url: string) => (params: unknown) => {
    issued.push({ url, hex: (params as { tx: string }).tx });
    return {};
  };
  const wallet = stubSigner(
    {
      'platform.issueTx': issue(FUJI.pRpc),
      'avax.issueTx': issue(FUJI.cAvax),
      eth_getTransactionCount: () => `0x${nonce.toString(16)}`,
    },
    urls,
  );
  return { wallet, urls, issued };
}

// ---- dummy unsigned txs ----

function feeInput(amount = MILLI_AVAX, sigIndices = [0]) {
  return TransferableInput.fromNative(randomId(), 0, FUJI.avaxAssetId, amount, sigIndices);
}

function output(amount: bigint, owner = ourPBytes, locktime = 0n, assetId: string = FUJI.avaxAssetId) {
  return TransferableOutput.fromNative(assetId, amount, [owner], locktime);
}

// Fee inputs of 0.001 AVAX each, by default two of them and no change: a fee of 0.002 AVAX.
function baseTx({
  inputs = [feeInput(), feeInput()],
  outputs = [] as TransferableOutput[],
  networkId = 5,
}: { inputs?: TransferableInput[]; outputs?: TransferableOutput[]; networkId?: number } = {}) {
  return avaxSerial.BaseTx.fromNative(networkId, FUJI.pBlockchainId, outputs, inputs, new Uint8Array());
}

const u32 = (n: number) => {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, n);
  return bytes;
};
const concat = (...parts: Uint8Array[]) => Uint8Array.from(Buffer.concat(parts));
const varBytes = (bytes: Uint8Array) => concat(u32(bytes.length), bytes);

// The bytes that the Console sends for an AddAutoRenewedValidatorTx: the avalanchejs 5.1.0 layout, with the fix that
// @avalanche-sdk/client 0.1.3 applies (methods/wallet/pChain/addAutoRenewedValidatorTxCompat.ts): a 4-byte length
// before the NodeID, and no weight field. Written here from the SDK, not from codec.ts, so the wallet's decoder gets
// independent input.
function consoleAutoRenewedHex(tx: pvmSerial.AddAutoRenewedValidatorTx): string {
  const codec = utils.getManagerForVM('PVM').getDefaultCodec();
  const js = tx.toBytes(codec);
  const baseLength = tx.baseTx.toBytes(codec).length;
  const prefixed = concat(js.subarray(0, baseLength), u32(20), js.subarray(baseLength));
  // The tail: weight (8 bytes), auto-compound shares (4) and period (8).
  const weightAt = prefixed.length - 20;
  assert(utils.bytesEqual(prefixed.subarray(weightAt, weightAt + 8), tx.weight.toBytes()), 'the weight is not there');
  const body = concat(prefixed.subarray(0, weightAt), prefixed.subarray(weightAt + 8));
  return utils.bufferToHex(concat(new Uint8Array(2), u32(40), body));
}

const hexOf = (tx: Common.Transaction) =>
  pvmSerial.isAddAutoRenewedValidatorTx(tx) ? consoleAutoRenewedHex(tx) : utils.bufferToHex(utils.packTx(tx));

function createSubnetTx({ base = baseTx(), owner = ourPBytes } = {}) {
  return new pvmSerial.CreateSubnetTx(base, OutputOwners.fromNative([owner]));
}

function createChainTx(subnetId: string, auth: number[]) {
  return new pvmSerial.CreateChainTx(
    baseTx({ inputs: [feeInput()] }),
    Id.fromString(subnetId),
    new Stringpr('e2e'),
    Id.fromString(randomId()),
    [],
    new Bytes(new Uint8Array([1, 2, 3])),
    Input.fromNative(auth),
  );
}

function disableTx(validationId: string) {
  return new pvmSerial.DisableL1ValidatorTx(
    baseTx({ inputs: [feeInput()] }),
    Id.fromString(validationId),
    Input.fromNative([0]),
  );
}

// The fee is 0.001 AVAX on top of the balance.
function increaseTx(validationId: string, balance: bigint) {
  return new pvmSerial.IncreaseL1ValidatorBalanceTx(
    baseTx({ inputs: [feeInput(balance + MILLI_AVAX)] }),
    Id.fromString(validationId),
    new BigIntPr(balance),
  );
}

// A validator with a real BLS key and proof of possession (the P-Chain checks them), as tier 1 makes it.
function mockValidator() {
  const { nodeID, publicKey, proofOfPossession } = createMockValidator();
  const pop = new pvmSerial.ProofOfPossession(utils.hexToBuffer(publicKey), utils.hexToBuffer(proofOfPossession));
  return { nodeID, pop };
}

function convertTx({ remaining = ourPBytes, deactivation = ourPBytes, balance = 20n * MILLI_AVAX } = {}) {
  const v = mockValidator();
  const validator = L1Validator.fromNative(
    v.nodeID,
    100n,
    balance,
    v.pop,
    PChainOwner.fromNative([remaining], 1),
    PChainOwner.fromNative([deactivation], 1),
  );
  return new pvmSerial.ConvertSubnetToL1Tx(
    baseTx({ inputs: [feeInput(balance + MILLI_AVAX)] }),
    Id.fromString(randomId()),
    Id.fromString(FUJI.cBlockchainId),
    new Bytes(randomBytes(20)),
    [validator],
    Input.fromNative([0]),
  );
}

// A signed Warp message that holds a RegisterL1ValidatorMessage with these owners (layout: signer.ts,
// registrationOwners). The signature part is zeros: the wallet does not check it, the P-Chain does.
function registrationMessage(remaining: Uint8Array, disable: Uint8Array): Uint8Array {
  const owner = (address: Uint8Array) => concat(u32(1), u32(1), address);
  const zeros = (n: number) => new Uint8Array(n);
  const message = concat(
    zeros(2),
    u32(1),
    zeros(32),
    varBytes(zeros(20)),
    zeros(48),
    zeros(8),
    owner(remaining),
    owner(disable),
    zeros(8),
  );
  const call = concat(zeros(2), u32(1), varBytes(zeros(20)), varBytes(message));
  const unsigned = concat(zeros(2), u32(5), utils.base58check.decode(FUJI.cBlockchainId), varBytes(call));
  return concat(unsigned, u32(0), varBytes(zeros(1)), zeros(96));
}

function registerTx({ remaining = ourPBytes, disable = ourPBytes, balance = 20n * MILLI_AVAX } = {}) {
  return new pvmSerial.RegisterL1ValidatorTx(
    baseTx({ inputs: [feeInput(balance + MILLI_AVAX)] }),
    new BigIntPr(balance),
    BlsSignature.fromSignatureBytes(mockValidator().pop.signature),
    new Bytes(registrationMessage(remaining, disable)),
  );
}

function evmExportTx(from: string) {
  return new evmSerial.ExportTx(
    new Int(5),
    Id.fromString(FUJI.cBlockchainId),
    Id.fromString(FUJI.pBlockchainId),
    [
      new evmSerial.Input(
        Address.fromHex(from),
        new BigIntPr(MILLI_AVAX),
        Id.fromString(FUJI.avaxAssetId),
        new BigIntPr(7n),
      ),
    ],
    [],
  );
}

// ---- txs as the Console builds them (allowPrimaryStake, allowBridge) ----

// Fuji's IDs and a fixed fee state, so the builders run with no network call.
const CONTEXT: Context.Context = {
  networkID: FUJI.networkId,
  hrp: FUJI.hrp,
  xBlockchainID: FUJI_X_CHAIN_ID,
  pBlockchainID: FUJI.pBlockchainId,
  cBlockchainID: FUJI.cBlockchainId,
  avaxAssetID: FUJI.avaxAssetId,
  baseTxFee: 0n,
  createAssetTxFee: 0n,
  platformFeeConfig: {
    weights: Common.createDimensions({ bandwidth: 1, dbRead: 1_000, dbWrite: 1_000, compute: 4 }),
    maxCapacity: 1_000_000n,
    maxPerSecond: 100_000n,
    targetPerSecond: 50_000n,
    minPrice: 1n,
    excessConversionConstant: 2_164_043n,
  },
};
const FEE_STATE: pvm.FeeState = { capacity: 1_000_000n, excess: 0n, price: 10n, timestamp: new Date().toISOString() };

// An unlocked AVAX UTXO of this wallet (or of `owner`): a P-Chain UTXO, or an atomic UTXO in shared memory.
function utxo(amount: bigint, owner = ourPBytes) {
  return new Utxo(
    new avaxSerial.UTXOID(Id.fromString(randomId()), new Int(0)),
    Id.fromString(FUJI.avaxAssetId),
    new TransferOutput(new BigIntPr(amount), OutputOwners.fromNative([owner])),
  );
}

const spendFrom = (amount: bigint) => ({ feeState: FEE_STATE, fromAddressesBytes: [ourPBytes], utxos: [utxo(amount)] });
const nowSeconds = () => BigInt(Math.floor(Date.now() / 1000));

// The stake test's mock validator: allowPrimaryStake registers its NodeID.
const STAKE_NODE = createMockValidator();
const pop = {
  publicKey: utils.hexToBuffer(STAKE_NODE.publicKey),
  signature: utils.hexToBuffer(STAKE_NODE.proofOfPossession),
};

// Stake.tsx, 'Auto-Renewed': prepareAddAutoRenewedValidatorTxn with the wallet as every owner.
function autoRenewedTx({
  nodeId = STAKE_NODE.nodeID,
  weight = NANO_AVAX,
  period = 43_200n,
  rewards = ourPBytes,
  delegation = ourPBytes,
  authority = ourPBytes,
  autoCompound = 0,
} = {}) {
  return pvm
    .newAddAutoRenewedValidatorTx(
      {
        ...spendFrom(3n * NANO_AVAX),
        nodeId,
        weight,
        period,
        rewardAddresses: [rewards],
        delegatorRewardsOwner: [delegation],
        ownerAddresses: [authority],
        shares: 20_000,
        autoCompoundRewardShares: autoCompound,
        threshold: 1,
        locktime: 0n,
        ...pop,
      },
      CONTEXT,
    )
    .getTx() as pvmSerial.AddAutoRenewedValidatorTx;
}

// The same tx with other stake outputs.
function withStake(tx: pvmSerial.AddAutoRenewedValidatorTx, stake: TransferableOutput[]) {
  return new pvmSerial.AddAutoRenewedValidatorTx(
    tx.baseTx,
    tx.nodeId,
    tx.signer,
    stake,
    tx.validatorRewardsOwner,
    tx.delegatorRewardsOwner,
    tx.owner,
    tx.shares,
    tx.weight,
    tx.autoCompoundRewardShares,
    tx.period,
  );
}

// Stake.tsx, 'Fixed Duration': prepareAddPermissionlessValidatorTxn (start 0, as the SDK sends it).
function fixedStakeTx({
  end = nowSeconds() + 44_100n,
  weight = NANO_AVAX,
  rewards = ourPBytes,
  delegation = ourPBytes,
  subnetId = FUJI.primaryNetworkId as string,
} = {}) {
  return pvm
    .newAddPermissionlessValidatorTx(
      {
        ...spendFrom(3n * NANO_AVAX),
        nodeId: STAKE_NODE.nodeID,
        start: 0n,
        end,
        weight,
        rewardAddresses: [rewards],
        delegatorRewardsOwner: [delegation],
        shares: 20_000,
        subnetId,
        threshold: 1,
        locktime: 0n,
        ...pop,
      },
      CONTEXT,
    )
    .getTx() as pvmSerial.AddPermissionlessValidatorTx;
}

// The same fixed stake with other stake outputs.
function withFixedStake(tx: pvmSerial.AddPermissionlessValidatorTx, stake: TransferableOutput[]) {
  return new pvmSerial.AddPermissionlessValidatorTx(
    tx.baseTx,
    tx.subnetValidator,
    tx.signer,
    stake,
    tx.validatorRewardsOwner,
    tx.delegatorRewardsOwner,
    tx.shares,
  );
}

// Stake.tsx, 'Update Config' and 'Stop Auto-Renewal': prepareSetAutoRenewedValidatorConfigTxn.
function configTx(validatorTxId: string, { auth = [0], period = 46_800n, autoCompound = 500_000 } = {}) {
  return pvm
    .newSetAutoRenewedValidatorConfigTx(
      { ...spendFrom(NANO_AVAX / 10n), validatorTxId, auth, autoCompoundRewardShares: autoCompound, period },
      CONTEXT,
    )
    .getTx() as pvmSerial.SetAutoRenewedValidatorConfigTx;
}

// CrossChainTransfer.tsx, P-Chain to C-Chain: pChain.prepareExportTxn to the wallet's C-fuji address (same bytes).
function pExportTx({ amount = 10n * MILLI_AVAX, destination = FUJI.cBlockchainId as string, to = ourPBytes } = {}) {
  return pvm
    .newExportTx(
      { ...spendFrom(NANO_AVAX / 10n), destinationChainId: destination, outputs: [output(amount, to)] },
      CONTEXT,
    )
    .getTx() as pvmSerial.ExportTx;
}

// CrossChainTransfer.tsx, the P-Chain import: pChain.prepareImportTxn from the C-Chain's shared memory.
function pImportTx({ amount = 10n * MILLI_AVAX } = {}) {
  return pvm
    .newImportTx(
      {
        feeState: FEE_STATE,
        fromAddressesBytes: [ourPBytes],
        utxos: [utxo(amount)],
        sourceChainId: FUJI.cBlockchainId,
        toAddressesBytes: [ourPBytes],
      },
      CONTEXT,
    )
    .getTx();
}

// CrossChainTransfer.tsx, C-Chain to P-Chain: cChain.prepareExportTxn (newExportTxFromBaseFee; 1 nAVAX at 10 wei).
function cExportTx({
  amount = 10n * MILLI_AVAX,
  fee = 1n,
  nonce = 7n,
  from = ourEvmBytes,
  destination = FUJI.pBlockchainId as string,
} = {}) {
  return evm.newExportTx(CONTEXT, amount, destination, from, [ourPBytes], fee, nonce).getTx();
}

// CrossChainTransfer.tsx, the C-Chain import: cChain.prepareImportTxn from the P-Chain's shared memory.
function cImportTx({ amount = 10n * MILLI_AVAX, fee = 1n, to = ourEvmBytes } = {}) {
  return evm.newImportTx(CONTEXT, to, [ourPBytes], [utxo(amount)], FUJI.pBlockchainId, fee).getTx();
}

const cHexOf = (tx: Common.Transaction) => utils.bufferToHex(utils.packTx(tx));

// ---- signed tx checks ----

// A signed tx hex (with checksum) must hold the same unsigned tx, the expected credential layout, and only
// signatures that recover to this wallet's key over sha256 of the unsigned tx. Returns the tx ID.
function verifySignedHex(vmName: 'PVM' | 'EVM', signedHex: string, unsignedHex: string, layout: number[][]): string {
  const bytes = utils.hexToBuffer(signedHex);
  const body = bytes.slice(0, -4);
  assert(utils.bytesEqual(sha256(body).slice(-4), bytes.slice(-4)), 'bad checksum');
  const { unsignedBytes, credentials } = readSignedTx(vmName, body);
  assert(utils.bufferToHex(unsignedBytes) === unsignedHex, 'the signed tx holds a different unsigned tx');
  assert(credentials.length === layout.length, `${credentials.length} credentials, expected ${layout.length}`);
  const hash = sha256(unsignedBytes);
  credentials.forEach((credential, i) => {
    const signatures = credential.getSignatures();
    assert(signatures.length === layout[i].length, `credential ${i} has ${signatures.length} signatures`);
    for (const signature of signatures) {
      const recovered = secp256k1.recoverPublicKey(hash, utils.hexToBuffer(signature));
      assert(utils.bytesEqual(recovered, ourCompressed), `credential ${i} signature recovers to another key`);
    }
  });
  return utils.base58check.encode(sha256(body));
}

function verifySigned(signed: SignedPChainTx, unsignedHex: string, layout: number[][]) {
  assert(
    JSON.stringify(signed.credentials) === JSON.stringify(layout),
    `layout ${JSON.stringify(signed.credentials)}, expected ${JSON.stringify(layout)}`,
  );
  assert(verifySignedHex('PVM', signed.signedTxHex, unsignedHex, layout) === signed.txId, 'tx ID mismatch');
}

// ---- the checks ----

console.log(`signer: C ${signer.address}, P ${signer.pChainAddress}`);

await check('the key gives the expected addresses', () => {
  const c = process.env.E2E_CHAIN_C_ADDRESS;
  const p = process.env.E2E_CHAIN_P_ADDRESS;
  // CI sets neither: the comparison is for a local run that wants to confirm which key it loaded.
  if (!c && !p) return console.log('  skipped: set E2E_CHAIN_C_ADDRESS or E2E_CHAIN_P_ADDRESS to compare');
  if (c) assert(signer.address === c, `C address ${signer.address}, expected ${c}`);
  if (p) assert(signer.pChainAddress === p, `P address ${signer.pChainAddress}, expected ${p}`);
});

await check('no key in inspect, JSON or the provider script', () => {
  assert(keyHex.length === 64, 'the key is not 32 bytes of hex');
  const views = [
    inspect(signer, { showHidden: true, depth: 10, getters: true }),
    JSON.stringify(signer),
    coreProvider.toString(),
  ];
  for (const view of views) assert(!view.toLowerCase().includes(keyHex), 'the key shows in a view of the signer');
});

await check('eth_accounts and eth_requestAccounts', async () => {
  for (const method of ['eth_accounts', 'eth_requestAccounts']) {
    const accounts = await signer.handle({ method });
    assert(JSON.stringify(accounts) === JSON.stringify([signer.address]), `${method}: ${JSON.stringify(accounts)}`);
  }
});

await check('eth_chainId and wallet_getEthereumChain are Fuji', async () => {
  assert((await signer.handle({ method: 'eth_chainId' })) === '0xa869', 'eth_chainId is not 0xa869');
  const chain = (await signer.handle({ method: 'wallet_getEthereumChain', params: [] })) as Record<string, unknown>;
  assert(chain.chainId === '0xa869' && chain.isTestnet === true, `wallet_getEthereumChain: ${JSON.stringify(chain)}`);
  assert(Array.isArray(chain.rpcUrls) && typeof chain.chainName === 'string', 'wallet_getEthereumChain shape');
});

await check('avalanche_getAccountPubKey gives the P-Chain and C-Chain addresses the Console derives', async () => {
  const keys = (await signer.handle({ method: 'avalanche_getAccountPubKey', params: [] })) as {
    xp: string;
    evm: string;
  };
  assert(typeof keys.xp === 'string' && typeof keys.evm === 'string', 'missing xp or evm');
  // components/toolbox/coreViem/methods/getPChainAddress.ts
  const compressed = nobleSecp256k1.Point.fromHex(keys.xp.replace(/^0x/, '')).toBytes(true);
  const pAddress = utils.format('P', 'fuji', secp256k1.publicKeyBytesToAddress(compressed));
  assert(pAddress === signer.pChainAddress, `P address from xp ${pAddress}`);
  // The EVM address of the evm key is the wallet's account.
  const ethAddress = utils.bufferToHex(secp256k1.publicKeyToEthAddress(utils.hexToBuffer(keys.evm)));
  assert(ethAddress.toLowerCase() === signer.address.toLowerCase(), `EVM address from evm ${ethAddress}`);
});

// ---- refusals: chains ----

await check('chain allowlist: no switch to or add of 43114, chain 1 or a chain the test did not allow', async () => {
  const before = networkCalls.length;
  await refused(
    signer,
    () => signer.handle({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0xa86a' }] }),
    /chain 43114/,
  );
  for (const chainId of ['0xa86a', '0x1', '0x3039']) {
    await refused(
      signer,
      () =>
        signer.handle({
          method: 'wallet_addEthereumChain',
          params: [{ chainId, rpcUrls: ['https://evil.invalid/rpc'], isTestnet: true }],
        }),
      new RegExp(`add chain ${Number(chainId)}:`),
    );
  }
  assert(signer.chainId === 43113, 'the wallet left Fuji');
  assert(networkCalls.length === before, 'a refused chain request made a network call');
});

await check('allowChain: the page adds the chain, and the wallet calls only the URL the test gave', async () => {
  const urls: string[] = [];
  const wallet = stubSigner({ eth_chainId: '0x3039', eth_blockNumber: '0x1' }, urls);
  wallet.allowChain(0x3039, 'https://l1.test/rpc');
  wallet.allowChain(0x303a, 'https://l1b.test/rpc');
  await wallet.handle({
    method: 'wallet_addEthereumChain',
    params: [{ chainId: '0x3039', chainName: 'e2e L1', rpcUrls: ['https://evil.invalid/rpc'] }],
  });
  assert(wallet.chainId === 0x3039, 'the wallet did not switch to the added chain');
  const chain = (await wallet.handle({ method: 'wallet_getEthereumChain' })) as { rpcUrls: string[] };
  assert(JSON.stringify(chain.rpcUrls) === '["https://l1.test/rpc"]', `rpcUrls ${JSON.stringify(chain.rpcUrls)}`);
  await wallet.handle({ method: 'eth_blockNumber', params: [] });
  assert(
    urls.every((url) => url === 'https://l1.test/rpc'),
    `the wallet called ${urls.join(', ')}`,
  );
  // An allowed chain that the page has not added yet: 4902, so the page adds it, as with Core.
  await rejects(
    wallet.handle({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x303a' }] }),
    ERR.unknownChain,
  );
  let mainnet: unknown;
  try {
    wallet.allowChain(43114, 'https://api.avax.network/ext/bc/C/rpc');
  } catch (err) {
    mainnet = err;
  }
  assert(mainnet instanceof Error, 'allowChain took the mainnet C-Chain');
});

await check('no personal_sign or eth_signTypedData_v4', async () => {
  const { wallet, urls } = offline();
  const unsupported = { code: ERR.unsupported, urls };
  await refused(
    wallet,
    () => wallet.handle({ method: 'personal_sign', params: ['0x1234', wallet.address] }),
    /personal_sign/,
    unsupported,
  );
  const typed = JSON.stringify({
    domain: { chainId: 43114 },
    types: { EIP712Domain: [{ name: 'chainId', type: 'uint256' }], M: [{ name: 'a', type: 'uint256' }] },
    primaryType: 'M',
    message: { a: 1 },
  });
  await refused(
    wallet,
    () => wallet.handle({ method: 'eth_signTypedData_v4', params: [wallet.address, typed] }),
    /eth_signTypedData_v4/,
    unsupported,
  );
  await refused(wallet, () => wallet.handle({ method: 'eth_sign', params: [] }), /eth_sign/, unsupported);
  await refused(
    wallet,
    () => wallet.handle({ method: 'wallet_watchAsset', params: {} }),
    /wallet_watchAsset/,
    unsupported,
  );
});

// ---- refusals: EVM sends ----

await check('eth_sendTransaction refuses another from address, a value and a fee above 0.002 AVAX', async () => {
  const { wallet, urls } = offline();
  const send = (tx: Record<string, unknown>) => () =>
    wallet.handle({ method: 'eth_sendTransaction', params: [{ from: wallet.address, to: wallet.address, ...tx }] });
  await refused(wallet, send({ from: '0x0000000000000000000000000000000000000001' }), /not this wallet/, {
    code: ERR.unauthorized,
    urls,
  });
  await refused(wallet, send({ value: '0x1' }), /value 1 wei/, { urls });
  // 2,000,000 gas x 2 gwei = 0.004 AVAX.
  await refused(
    wallet,
    send({ gas: '0x1e8480', maxFeePerGas: '0x77359400', maxPriorityFeePerGas: '0x1' }),
    /more than 0\.002 AVAX/,
    { urls },
  );
  await refused(wallet, send({ gas: '0x1e8480', gasPrice: '0x77359400' }), /more than 0\.002 AVAX/, { urls });
  assert(wallet.sends.length === 0, 'a refused send was recorded');
});

await check('eth_sendTransaction: the EVM total of gas x max fee stops at 0.01 AVAX per signer', async () => {
  const urls: string[] = [];
  const wallet = stubSigner(
    { eth_getTransactionCount: '0x0', eth_sendRawTransaction: (params: unknown) => keccak256((params as Hex[])[0]) },
    urls,
  );
  // 950,000 gas x 2 gwei = 0.0019 AVAX: 5 fit in 0.01 AVAX, the 6th does not.
  const send = () =>
    wallet.handle({
      method: 'eth_sendTransaction',
      params: [{ to: wallet.address, gas: '0xe7ef0', maxFeePerGas: '0x77359400', maxPriorityFeePerGas: '0x1' }],
    });
  for (let i = 0; i < 5; i++) await send();
  await refused(wallet, send, /reserved 0\.0095 of its 0\.01 AVAX/, { urls });
  assert(wallet.totals().evmReserved === 9_500_000_000_000_000n, `evmReserved ${wallet.totals().evmReserved}`);
  assert(wallet.sends.length === 5, `the stub wallet recorded ${wallet.sends.length} sends`);
});

// ---- refusals: P-Chain and C-Chain atomic txs ----

const sendXP = (wallet: Signer, transactionHex: string, chainAlias = 'P') =>
  wallet.handle({ method: 'avalanche_sendTransaction', params: { transactionHex, chainAlias } });

await check('the default signer refuses BaseTx and each capability type, with the list of what it signs', async () => {
  const { wallet, urls } = offline();
  const foreign = [output(MILLI_AVAX, FOREIGN_P_BYTES)];
  const txs: [string, Common.Transaction][] = [
    ['pvm.BaseTx', new pvmSerial.BaseTx(baseTx({ outputs: foreign }))],
    ['pvm.ExportTx', new pvmSerial.ExportTx(baseTx(), Id.fromString(FUJI.cBlockchainId), foreign)],
    ['pvm.ImportTx', new pvmSerial.ImportTx(baseTx(), Id.fromString(FUJI.cBlockchainId), [feeInput()])],
    ['pvm.AddAutoRenewedValidatorTx', autoRenewedTx()],
    ['pvm.SetAutoRenewedValidatorConfigTx', configTx(randomId())],
    ['pvm.AddPermissionlessValidator', fixedStakeTx()],
  ];
  for (const [type, tx] of txs) {
    await refused(
      wallet,
      () => sendXP(wallet, hexOf(tx)),
      new RegExp(`P-Chain tx type ${type}: the wallet signs only pvm\\.CreateSubnetTx, .*pvm\\.DisableL1ValidatorTx$`),
      { urls },
    );
  }
});

await check('the default signer refuses C-Chain atomic txs and the X-Chain, with their type', async () => {
  const { wallet, urls } = offline();
  await refused(
    wallet,
    () => sendXP(wallet, hexOf(evmExportTx(wallet.address)), 'C'),
    /chain C \(evm\.ExportTx\).*enabled: none/,
    { urls },
  );
  await refused(wallet, () => sendXP(wallet, cHexOf(cImportTx()), 'C'), /chain C \(evm\.ImportTx\)/, { urls });
  await refused(wallet, () => sendXP(wallet, '0x00', 'X'), /chain X/, { urls });
});

await check('P-Chain: network ID 1 is refused before any network call', async () => {
  const before = networkCalls.length;
  const base = baseTx({ networkId: 1 });
  await refused(signer, () => signer.signPChainTx(hexOf(createSubnetTx({ base }))), /network ID 1:/);
  assert(networkCalls.length === before, 'the refused tx made a network call');
});

await check('P-Chain outputs: change to this wallet only, unlocked', async () => {
  const { wallet, urls } = offline();
  const withOutput = (out: TransferableOutput) =>
    hexOf(createSubnetTx({ base: baseTx({ inputs: [feeInput(2n * MILLI_AVAX)], outputs: [out] }) }));
  await refused(
    wallet,
    () => wallet.signPChainTx(withOutput(output(MILLI_AVAX, FOREIGN_P_BYTES))),
    new RegExp(`it pays ${FOREIGN_P_ADDRESS}`),
    { urls },
  );
  await refused(wallet, () => wallet.signPChainTx(withOutput(output(MILLI_AVAX, ourPBytes, 1n))), /an output/, {
    urls,
  });
  // Change of 0.0015 AVAX from 0.002 in: the tx spends the 0.0005 AVAX fee.
  const signed = await wallet.signPChainTx(withOutput(output((3n * MILLI_AVAX) / 2n)));
  assert(signed.spent === MILLI_AVAX / 2n, `spent ${signed.spent}`);
  assert(urls.length === 0, `CreateSubnetTx made a network call: ${urls.join(', ')}`);
});

await check('P-Chain caps: a fee above 0.01 AVAX, a validator balance above 0.05 AVAX', async () => {
  const { wallet, urls } = offline();
  const base = baseTx({ inputs: [feeInput(20n * MILLI_AVAX)] });
  await refused(wallet, () => wallet.signPChainTx(hexOf(createSubnetTx({ base }))), /a fee of 0\.02 AVAX/, { urls });
  await refused(
    wallet,
    () => wallet.signPChainTx(hexOf(increaseTx(randomId(), 60n * MILLI_AVAX))),
    /a validator balance of 0\.06 AVAX/,
    { urls },
  );
});

await check('P-Chain owners: the subnet owner and the validator owners must be this wallet', async () => {
  const { wallet, urls } = offline();
  const refusals: [Common.Transaction, RegExp][] = [
    [createSubnetTx({ owner: FOREIGN_P_BYTES }), /subnet owner/],
    [convertTx({ remaining: FOREIGN_P_BYTES }), /remaining balance owner/],
    [convertTx({ deactivation: FOREIGN_P_BYTES }), /deactivation owner/],
    [registerTx({ remaining: FOREIGN_P_BYTES }), /remaining balance owner/],
    [registerTx({ disable: FOREIGN_P_BYTES }), /disable owner/],
  ];
  for (const [tx, match] of refusals) await refused(wallet, () => wallet.signPChainTx(hexOf(tx)), match, { urls });
});

await check('IncreaseL1ValidatorBalanceTx for a validator whose balance goes to another owner is refused', async () => {
  const foreign = stubSigner({
    'platform.getL1Validator': { remainingBalanceOwner: { threshold: '1', addresses: [FOREIGN_P_ADDRESS] } },
  });
  await refused(
    foreign,
    () => foreign.signPChainTx(hexOf(increaseTx(randomId(), 10n * MILLI_AVAX))),
    /returns its balance to another owner/,
  );
});

await check('the P-Chain spend cap: 0.2 AVAX per signer', async () => {
  const wallet = stubSigner({
    'platform.getL1Validator': { remainingBalanceOwner: { threshold: '1', addresses: [signer.pChainAddress] } },
    'platform.issueTx': {},
  });
  // Each top-up spends 0.051 AVAX (0.05 balance, 0.001 fee): 3 fit in 0.2 AVAX, the 4th does not.
  for (let i = 0; i < 3; i++) await sendXP(wallet, hexOf(increaseTx(randomId(), 50n * MILLI_AVAX)));
  await refused(
    wallet,
    () => sendXP(wallet, hexOf(increaseTx(randomId(), 50n * MILLI_AVAX))),
    /spends 0\.051 AVAX, and this signer has spent 0\.153 of its 0\.2 AVAX/,
  );
  assert(wallet.sends.length === 3, `the stub wallet recorded ${wallet.sends.length} sends`);
});

// ---- the tier 1 txs that the wallet signs ----

await check('CreateSubnetTx: one credential per fee input, each signed by the key', async () => {
  const unsignedHex = hexOf(createSubnetTx());
  const signed = await signer.signPChainTx(unsignedHex);
  verifySigned(signed, unsignedHex, [[0], [0]]);
  assert(signed.spent === 2n * MILLI_AVAX, `spent ${signed.spent}`);
});

await check('CreateChainTx: fee credential, then the subnet auth credential', async () => {
  const owned = stubSigner({ 'platform.getSubnet': { controlKeys: [signer.pChainAddress], threshold: '1' } });
  const unsignedHex = hexOf(createChainTx(randomId(), [0]));
  verifySigned(await owned.signPChainTx(unsignedHex), unsignedHex, [[0], [0]]);
});

await check(
  'ConvertSubnetToL1Tx and RegisterL1ValidatorTx: the balance is in the tx, the fee is the rest',
  async () => {
    const owned = stubSigner({ 'platform.getSubnet': { controlKeys: [signer.pChainAddress], threshold: '1' } });
    for (const [tx, layout] of [
      [convertTx(), [[0], [0]]],
      [registerTx(), [[0]]],
    ] as const) {
      const unsignedHex = hexOf(tx);
      const signed = await owned.signPChainTx(unsignedHex);
      verifySigned(signed, unsignedHex, layout as unknown as number[][]);
      assert(signed.spent === 21n * MILLI_AVAX, `${signed.txType} spent ${signed.spent}`);
    }
  },
);

await check('IncreaseL1ValidatorBalanceTx for a validator that returns its balance to this wallet', async () => {
  const owned = stubSigner({
    'platform.getL1Validator': { remainingBalanceOwner: { threshold: '1', addresses: [signer.pChainAddress] } },
  });
  const unsignedHex = hexOf(increaseTx(randomId(), 10n * MILLI_AVAX));
  verifySigned(await owned.signPChainTx(unsignedHex), unsignedHex, [[0]]);
});

await check('subnet auth with 2 control keys: index 1 is ours, index 0 is refused', async () => {
  const twoKeys = stubSigner({
    'platform.getSubnet': { controlKeys: [FOREIGN_P_ADDRESS, signer.pChainAddress], threshold: '1' },
  });
  const ours = hexOf(createChainTx(randomId(), [1]));
  verifySigned(await twoKeys.signPChainTx(ours), ours, [[0], [1]]);
  await refused(twoKeys, () => twoKeys.signPChainTx(hexOf(createChainTx(randomId(), [0]))), /not this wallet/, {
    code: ERR.unauthorized,
  });
});

await check('subnet auth throws when the owner lookup fails (stub)', async () => {
  const missing = stubSigner({ 'platform.getSubnet': new Error('not found') });
  await rejects(missing.signPChainTx(hexOf(createChainTx(randomId(), [0]))), ERR.internal, /owner lookup .* failed/);
  assert(missing.refusals.length === 0, 'a failed lookup was logged as a refusal');
});

await check('subnet auth throws when the owner lookup fails (Fuji, unknown subnet)', async () => {
  await rejects(signer.signPChainTx(hexOf(createChainTx(randomId(), [0]))), ERR.internal, /not found/);
});

await check('DisableL1ValidatorTx: fee credential, then the disable auth from platform.getL1Validator', async () => {
  const owned = stubSigner({
    'platform.getL1Validator': {
      deactivationOwner: { locktime: '0', threshold: '1', addresses: [signer.pChainAddress] },
    },
  });
  const unsignedHex = hexOf(disableTx(randomId()));
  verifySigned(await owned.signPChainTx(unsignedHex), unsignedHex, [[0], [0]]);
});

await check('DisableL1ValidatorTx for a validator another key owns is refused (stub)', async () => {
  const foreign = stubSigner({
    'platform.getL1Validator': { deactivationOwner: { threshold: '1', addresses: [FOREIGN_P_ADDRESS] } },
  });
  await refused(foreign, () => foreign.signPChainTx(hexOf(disableTx(randomId()))), /not this wallet/, {
    code: ERR.unauthorized,
  });
});

// ---- allowPrimaryStake: Primary Network stakes ----

await check('allowPrimaryStake: one NodeID per signer, a valid NodeID only, revokeAll turns it off', async () => {
  const { wallet } = offline();
  const throws = (run: () => void, match: RegExp) => {
    try {
      run();
    } catch (err) {
      assert(match.test(String(err)), `${String(err)} does not match ${match}`);
      return;
    }
    throw new Error(`expected a throw matching ${match}`);
  };
  throws(() => wallet.allowPrimaryStake('NodeID-nope'), /not a NodeID|bytes/);
  wallet.allowPrimaryStake(STAKE_NODE.nodeID);
  wallet.allowPrimaryStake(STAKE_NODE.nodeID);
  throws(() => wallet.allowPrimaryStake(createMockValidator().nodeID), /one NodeID per signer/);
  wallet.revokeAll();
  await refused(
    wallet,
    () => sendXP(wallet, hexOf(autoRenewedTx())),
    /P-Chain tx type pvm\.AddAutoRenewedValidatorTx:/,
  );
});

await check('AddAutoRenewedValidatorTx as the Console builds it: fee credentials only, 1 AVAX staked', async () => {
  const { wallet, issued } = issuingSigner();
  wallet.allowPrimaryStake(STAKE_NODE.nodeID);
  const tx = autoRenewedTx();
  const unsignedHex = hexOf(tx);
  const txId = (await sendXP(wallet, unsignedHex)) as string;
  const layout = tx.baseTx.inputs.map(() => [0]);
  assert(issued.length === 1 && issued[0].url === FUJI.pRpc, `issued ${JSON.stringify(issued.map((i) => i.url))}`);
  assert(
    verifySignedHex('PVM', issued[0].hex, unsignedHex, layout) === txId,
    'the returned tx ID is not the signed tx',
  );
  const totals = wallet.totals();
  assert(totals.pStaked === NANO_AVAX, `pStaked ${totals.pStaked}`);
  assert(totals.pSpent > 0n && totals.pSpent < MILLI_AVAX, `pSpent ${totals.pSpent} (the fee only)`);
  assert(wallet.sends[0]?.txType === 'pvm.AddAutoRenewedValidatorTx', `sends ${JSON.stringify(wallet.sends)}`);
  console.log(`      fee ${totals.pSpent} nAVAX at a price of ${FEE_STATE.price}`);

  // Update Config (13 h, 50 %) and Stop Auto-Renewal (period 0) for that validator: fee credentials, then auth [0].
  for (const period of [46_800n, 0n]) {
    const config = configTx(txId, { period, autoCompound: period ? 500_000 : 0 });
    const configHex = hexOf(config);
    await sendXP(wallet, configHex);
    verifySignedHex('PVM', issued.at(-1)!.hex, configHex, [...config.getInputs().map(() => [0]), [0]]);
  }
  assert(wallet.totals().pStaked === NANO_AVAX, 'a config tx changed the stake');
});

await check('AddPermissionlessValidator (fixed duration) as the Console builds it: fee credentials only', async () => {
  const { wallet, issued } = issuingSigner();
  wallet.allowPrimaryStake(STAKE_NODE.nodeID);
  const tx = fixedStakeTx();
  const unsignedHex = hexOf(tx);
  const txId = (await sendXP(wallet, unsignedHex)) as string;
  const layout = tx.getInputs().map(() => [0]);
  assert(
    verifySignedHex('PVM', issued[0].hex, unsignedHex, layout) === txId,
    'the returned tx ID is not the signed tx',
  );
  assert(wallet.totals().pStaked === NANO_AVAX, `pStaked ${wallet.totals().pStaked}`);
});

await check(
  'allowPrimaryStake refusals: owners, NodeID, period, end time, weight, a second stake, config',
  async () => {
    const { wallet, urls } = offline();
    wallet.allowPrimaryStake(STAKE_NODE.nodeID);
    const sign = (tx: Common.Transaction) => () => wallet.signPChainTx(hexOf(tx));
    const fine = autoRenewedTx();
    const cases: [string, Common.Transaction, RegExp][] = [
      [
        'a foreign stake owner',
        withStake(fine, [output(NANO_AVAX, FOREIGN_P_BYTES)]),
        /a stake output is not unlocked AVAX to this wallet/,
      ],
      [
        'a locked stake output',
        withStake(fine, [output(NANO_AVAX, ourPBytes, 1n)]),
        /a stake output is not unlocked AVAX/,
      ],
      [
        'a foreign reward owner',
        autoRenewedTx({ rewards: FOREIGN_P_BYTES }),
        /the validation reward owner is not this wallet/,
      ],
      [
        'a foreign delegation reward owner',
        autoRenewedTx({ delegation: FOREIGN_P_BYTES }),
        /the delegation reward owner is not this wallet/,
      ],
      [
        'a foreign authority',
        autoRenewedTx({ authority: FOREIGN_P_BYTES }),
        /the validator authority is not this wallet/,
      ],
      ['a cycle of 336 h', autoRenewedTx({ period: 1_209_600n }), /a cycle of 1209600 s \(cap 46800 s, 13 h\)/],
      ['weight 2 AVAX', autoRenewedTx({ weight: 2n * NANO_AVAX }), /a stake of 2 AVAX \(cap 1\)/],
      ['another NodeID', autoRenewedTx({ nodeId: createMockValidator().nodeID }), /NodeID .* is not NodeID/],
      ['auto-compound above 100 %', autoRenewedTx({ autoCompound: 1_000_001 }), /auto-compound shares 1000001/],
      [
        'a fixed end time 1 day + 5 min out',
        fixedStakeTx({ end: nowSeconds() + 86_700n }),
        /an end time \d+ s from now \(cap 46800 s/,
      ],
      [
        'a fixed foreign reward owner',
        fixedStakeTx({ rewards: FOREIGN_P_BYTES }),
        /the validation reward owner is not this wallet/,
      ],
      [
        'a fixed foreign delegation reward owner',
        fixedStakeTx({ delegation: FOREIGN_P_BYTES }),
        /the delegation reward owner is not this wallet/,
      ],
      [
        'a fixed stake on another subnet',
        fixedStakeTx({ subnetId: randomId() }),
        /subnet .* is not the Primary Network/,
      ],
      [
        'a fixed foreign stake owner',
        withFixedStake(fixedStakeTx(), [output(NANO_AVAX, FOREIGN_P_BYTES)]),
        /a stake output is not unlocked AVAX to this wallet/,
      ],
      [
        'a fixed locked stake output',
        withFixedStake(fixedStakeTx(), [output(NANO_AVAX, ourPBytes, 1n)]),
        /a stake output is not unlocked AVAX/,
      ],
      ['a fixed weight of 2 AVAX', fixedStakeTx({ weight: 2n * NANO_AVAX }), /a stake of 2 AVAX \(cap 1\)/],
      [
        'a config for a tx this signer did not send',
        configTx(randomId()),
        /is not an AddAutoRenewedValidatorTx that this signer sent/,
      ],
    ];
    for (const [name, tx, match] of cases) {
      try {
        await refused(wallet, sign(tx), match, { urls });
      } catch (err) {
        throw new Error(`${name}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  },
);

await check('allowPrimaryStake: a second stake, and config auth or period out of range, are refused', async () => {
  const { wallet, urls } = issuingSigner();
  wallet.allowPrimaryStake(STAKE_NODE.nodeID);
  const txId = (await sendXP(wallet, hexOf(autoRenewedTx()))) as string;
  const calls = { urls };
  await refused(wallet, () => sendXP(wallet, hexOf(autoRenewedTx())), /staked 1 of its 1 AVAX/, calls);
  await refused(wallet, () => sendXP(wallet, hexOf(fixedStakeTx())), /staked 1 of its 1 AVAX/, calls);
  await refused(wallet, () => sendXP(wallet, hexOf(configTx(txId, { auth: [1] }))), /auth indices \[1\]/, calls);
  await refused(
    wallet,
    () => sendXP(wallet, hexOf(configTx(txId, { period: 1_209_600n }))),
    /a cycle of 1209600 s/,
    calls,
  );
  await refused(wallet, () => sendXP(wallet, hexOf(configTx(txId, { period: 3_600n }))), /a cycle of 3600 s/, calls);
  assert(wallet.sends.length === 1, `the stub wallet recorded ${wallet.sends.length} sends`);
});

// A committed AddAutoRenewedValidatorTx as platform.getTx returns it (hex, with the checksum), and its tx ID. The
// credentials are zero signatures: adoptAutoRenewedValidator reads the bytes and their hash, not the signatures.
function committedAdd(tx: pvmSerial.AddAutoRenewedValidatorTx): { txId: string; hex: string } {
  const unsigned = utils.hexToBuffer(consoleAutoRenewedHex(tx));
  const zero = () => new Credential([new Signature(new Uint8Array(65))]);
  const body = signedTxBytes('PVM', unsigned, tx.baseTx.inputs.map(zero));
  return { txId: utils.base58check.encode(sha256(body)), hex: utils.bufferToHex(utils.addChecksum(body)) };
}

// A signer that answers platform.getTxStatus and platform.getTx for one committed add, and issues.
function adoptingSigner(committed: { txId: string; hex: string }, status = 'Committed') {
  const urls: string[] = [];
  const issued: string[] = [];
  const wallet = stubSigner(
    {
      'platform.getTxStatus': { status },
      'platform.getTx': { tx: committed.hex, encoding: 'hex' },
      'platform.issueTx': (params: unknown) => {
        issued.push((params as { tx: string }).tx);
        return {};
      },
    },
    urls,
  );
  return { wallet, urls, issued };
}

await check(
  'adoptAutoRenewedValidator: an add of an earlier run, then Update Config and Stop sign for it',
  async () => {
    const committed = committedAdd(autoRenewedTx());
    const { wallet, urls, issued } = adoptingSigner(committed);
    // Without the stake capability: refused, with no network call.
    await refused(wallet, () => wallet.adoptAutoRenewedValidator(committed.txId), /allowPrimaryStake was not called/, {
      urls,
    });
    wallet.allowPrimaryStake(STAKE_NODE.nodeID);
    await wallet.adoptAutoRenewedValidator(committed.txId);
    assert(wallet.adopted.length === 1 && wallet.adopted[0].hash === committed.txId, 'the adoption is not recorded');
    assert(wallet.adopted[0].nodeId === STAKE_NODE.nodeID, `adopted NodeID ${wallet.adopted[0].nodeId}`);
    assert(wallet.totals().pStaked === NANO_AVAX, `pStaked ${wallet.totals().pStaked}: the adopted stake counts`);
    assert(wallet.sends.length === 0, 'an adoption is not a send');
    for (const period of [46_800n, 0n]) {
      const config = configTx(committed.txId, { period, autoCompound: period ? 500_000 : 0 });
      const configHex = hexOf(config);
      await sendXP(wallet, configHex);
      verifySignedHex('PVM', issued.at(-1)!, configHex, [...config.getInputs().map(() => [0]), [0]]);
    }
    // The adopted stake fills the cap: a new stake is refused before any call.
    const calls = urls.length;
    await refused(wallet, () => sendXP(wallet, hexOf(autoRenewedTx())), /staked 1 of its 1 AVAX/);
    assert(urls.length === calls, `the refused stake made a call: ${urls.slice(calls).join(', ')}`);
  },
);

await check(
  'adoptAutoRenewedValidator refusals: not committed, another NodeID, foreign owners, a long cycle',
  async () => {
    const cases: [string, pvmSerial.AddAutoRenewedValidatorTx, RegExp, string?][] = [
      ['a tx that is not committed', autoRenewedTx(), /its status is Processing, not Committed/, 'Processing'],
      ['another NodeID', autoRenewedTx({ nodeId: createMockValidator().nodeID }), /NodeID .* is not NodeID/],
      ['a foreign authority', autoRenewedTx({ authority: FOREIGN_P_BYTES }), /the validator authority is not this/],
      ['a foreign reward owner', autoRenewedTx({ rewards: FOREIGN_P_BYTES }), /the validation reward owner is not/],
      ['a cycle of 336 h', autoRenewedTx({ period: 1_209_600n }), /a cycle of 1209600 s \(cap 46800 s, 13 h\)/],
    ];
    for (const [name, tx, match, status] of cases) {
      const { wallet } = adoptingSigner(committedAdd(tx), status);
      wallet.allowPrimaryStake(STAKE_NODE.nodeID);
      try {
        await refused(wallet, () => wallet.adoptAutoRenewedValidator(committedAdd(tx).txId), match);
      } catch (err) {
        throw new Error(`${name}: ${err instanceof Error ? err.message : String(err)}`);
      }
      assert(wallet.adopted.length === 0 && wallet.totals().pStaked === 0n, `${name}: adopted`);
      // A config for the refused add stays refused.
      await refused(wallet, () => wallet.signPChainTx(hexOf(configTx(committedAdd(tx).txId))), /that this signer sent/);
    }
    // Bytes that do not hash to the asked tx ID are an error, not an adoption.
    const { wallet } = adoptingSigner(committedAdd(autoRenewedTx()));
    wallet.allowPrimaryStake(STAKE_NODE.nodeID);
    await rejects(wallet.adoptAutoRenewedValidator(randomId()), ERR.invalidParams, /do not hash to the tx ID/);
    assert(wallet.adopted.length === 0, 'adopted other bytes');
  },
);

// ---- allowBridge: atomic txs ----

await check('P-Chain ExportTx and ImportTx as the Console builds them: credential layouts, counts', async () => {
  const { wallet, issued } = issuingSigner();
  wallet.allowBridge();
  const exportTx = pExportTx();
  const exportHex = hexOf(exportTx);
  const exportId = (await sendXP(wallet, exportHex)) as string;
  assert(
    verifySignedHex(
      'PVM',
      issued[0].hex,
      exportHex,
      exportTx.getInputs().map(() => [0]),
    ) === exportId,
    'export ID',
  );
  const importTx = pImportTx() as pvmSerial.ImportTx;
  const importHex = hexOf(importTx);
  const importId = (await sendXP(wallet, importHex)) as string;
  // The base inputs (none: the import pays its fee), then the imported input.
  const layout = [...importTx.getInputs().map(() => [0]), ...importTx.ins.map(() => [0])];
  assert(verifySignedHex('PVM', issued[1].hex, importHex, layout) === importId, 'import ID');
  const totals = wallet.totals();
  assert(
    totals.atomicCount === 2 && totals.atomicExported === 10n * MILLI_AVAX,
    `totals ${JSON.stringify(totals, (_, v) => (typeof v === 'bigint' ? `${v}` : v))}`,
  );
});

await check(
  'C-Chain ExportTx and ImportTx as the Console builds them: issued to the C-Chain avax API only',
  async () => {
    const { wallet, urls, issued } = issuingSigner({ nonce: 7 });
    wallet.allowBridge();
    const exportHex = cHexOf(cExportTx({ nonce: 7n }));
    const exportId = (await sendXP(wallet, exportHex, 'C')) as string;
    assert(verifySignedHex('EVM', issued[0].hex, exportHex, [[0]]) === exportId, 'export ID');
    const importTx = cImportTx() as evmSerial.ImportTx;
    const importHex = cHexOf(importTx);
    const importId = (await sendXP(wallet, importHex, 'C')) as string;
    assert(
      verifySignedHex(
        'EVM',
        issued[1].hex,
        importHex,
        importTx.importedInputs.map(() => [0]),
      ) === importId,
      'import ID',
    );
    assert(
      issued.every((i) => i.url === FUJI.cAvax),
      `issued to ${issued.map((i) => i.url).join(', ')}`,
    );
    assert(JSON.stringify(urls) === JSON.stringify([FUJI.cRpc, FUJI.cAvax, FUJI.cAvax]), `urls ${urls.join(', ')}`);
    const kinds = wallet.sends.map((s) => `${s.kind}:${s.chainAlias}:${s.txType}`).join(' ');
    assert(kinds === 'atomic:C:evm.ExportTx atomic:C:evm.ImportTx', `sends ${kinds}`);
  },
);

await check('allowBridge refusals: destination, owner, asset, lock, amount, fee, nonce, X-Chain', async () => {
  const { wallet, urls } = offline();
  wallet.allowBridge();
  const calls = { urls };
  const p = (tx: Common.Transaction) => () => sendXP(wallet, hexOf(tx));
  const c = (tx: Common.Transaction) => () => sendXP(wallet, cHexOf(tx), 'C');
  const exported = pExportTx();
  const withOuts = (outs: TransferableOutput[]) => new pvmSerial.ExportTx(exported.baseTx, exported.destination, outs);
  await refused(
    wallet,
    p(pExportTx({ destination: FUJI_X_CHAIN_ID })),
    /destination .* is not the Fuji C-Chain/,
    calls,
  );
  await refused(wallet, p(pExportTx({ to: FOREIGN_P_BYTES })), /an exported output is not unlocked AVAX/, calls);
  await refused(
    wallet,
    p(withOuts([output(10n * MILLI_AVAX, ourPBytes, 0n, randomId())])),
    /an exported output is not unlocked AVAX/,
    calls,
  );
  await refused(
    wallet,
    p(withOuts([output(10n * MILLI_AVAX, ourPBytes, 1n)])),
    /an exported output is not unlocked AVAX/,
    calls,
  );
  await refused(wallet, p(pExportTx({ amount: 60n * MILLI_AVAX })), /exports 0\.06 AVAX \(cap 0\.05\)/, calls);
  // 0.012 AVAX in, 0.01 AVAX out: a fee of 0.002 AVAX.
  const costly = new pvmSerial.ExportTx(
    baseTx({ inputs: [feeInput(12n * MILLI_AVAX)] }),
    Id.fromString(FUJI.cBlockchainId),
    [output(10n * MILLI_AVAX)],
  );
  await refused(wallet, p(costly), /a fee of 0\.002 AVAX \(cap 0\.001\)/, calls);
  await refused(wallet, c(cExportTx({ destination: FUJI_X_CHAIN_ID })), /destination .* is not the P-Chain/, calls);
  await refused(
    wallet,
    c(cExportTx({ from: randomBytes(20) })),
    /the EVM input is 0x[0-9a-f]+, not this wallet/,
    calls,
  );
  await refused(
    wallet,
    c(cExportTx({ amount: 60n * MILLI_AVAX })),
    /an EVM input of 0\.060000001 AVAX \(cap 0\.051\)/,
    calls,
  );
  await refused(wallet, c(cExportTx({ fee: 2n * MILLI_AVAX })), /a fee of 0\.002 AVAX \(cap 0\.001\)/, calls);
  await refused(
    wallet,
    c(cImportTx({ to: randomBytes(20) })),
    /an output pays 0x[0-9a-f]+, not AVAX to this wallet/,
    calls,
  );
  await refused(wallet, c(cImportTx({ fee: 2n * MILLI_AVAX })), /a fee of 0\.002 AVAX \(cap 0\.001\)/, calls);
  await refused(wallet, () => sendXP(wallet, cHexOf(cImportTx()), 'X'), /chain X/, calls);
  assert(wallet.sends.length === 0, 'a refused atomic tx was recorded');
});

await check('allowBridge: an EVM input nonce below the next nonce is refused', async () => {
  // The wallet's own memory: after nonce 7, nonce 7 again is refused with no network call.
  const memory = issuingSigner({ nonce: 7 });
  memory.wallet.allowBridge();
  await sendXP(memory.wallet, cHexOf(cExportTx({ nonce: 7n })), 'C');
  await refused(
    memory.wallet,
    () => sendXP(memory.wallet, cHexOf(cExportTx({ nonce: 7n })), 'C'),
    /nonce 7, below the next nonce 8/,
    { urls: memory.urls },
  );
  // A refusal before the signature gives its count back.
  assert(memory.wallet.totals().atomicCount === 1, `atomicCount ${memory.wallet.totals().atomicCount}, not 1`);
  // The pending count: 9 pending, nonce 7 is refused after one eth_getTransactionCount and no issue.
  const pending = issuingSigner({ nonce: 9 });
  pending.wallet.allowBridge();
  await rejects(
    sendXP(pending.wallet, cHexOf(cExportTx({ nonce: 7n })), 'C'),
    ERR.userRejected,
    /nonce 7, below the next nonce 9/,
  );
  assert(JSON.stringify(pending.urls) === JSON.stringify([FUJI.cRpc]), `calls ${pending.urls.join(', ')}`);
  assert(pending.issued.length === 0 && pending.wallet.refusals.length === 1, 'the low nonce was issued');
  assert(pending.wallet.totals().atomicCount === 0, `atomicCount ${pending.wallet.totals().atomicCount}, not 0`);
});

await check('allowBridge: a 7th atomic tx, and more than 0.1 AVAX exported, are refused', async () => {
  const count = issuingSigner();
  count.wallet.allowBridge();
  for (let i = 0; i < 6; i++) await sendXP(count.wallet, hexOf(pImportTx()));
  await refused(
    count.wallet,
    () => sendXP(count.wallet, hexOf(pImportTx())),
    /this signer has sent 6 atomic txs \(cap 6\)/,
    { urls: count.urls },
  );
  const total = issuingSigner();
  total.wallet.allowBridge();
  for (let i = 0; i < 2; i++) await sendXP(total.wallet, hexOf(pExportTx({ amount: 50n * MILLI_AVAX })));
  await refused(total.wallet, () => sendXP(total.wallet, cHexOf(cExportTx()), 'C'), /exported 0\.1 of its 0\.1 AVAX/, {
    urls: total.urls,
  });
});

await check(
  'allowBridge: a C-Chain and a P-Chain atomic tx at the same time cannot both take the last slot',
  async () => {
    // Count 5 of 6. The C-Chain export waits for eth_getTransactionCount after its check; the P-Chain import checks in
    // that wait. The C-Chain tx counts at its check, so exactly one of the two is refused.
    const { wallet, issued } = issuingSigner({ nonce: 7 });
    wallet.allowBridge();
    for (let i = 0; i < 5; i++) await sendXP(wallet, hexOf(pImportTx()));
    const results = await Promise.allSettled([
      sendXP(wallet, cHexOf(cExportTx({ nonce: 7n })), 'C'),
      sendXP(wallet, hexOf(pImportTx())),
    ]);
    const rejected = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
    assert(rejected.length === 1, `${rejected.length} of the two were refused, not 1`);
    assert(/this signer has sent 6 atomic txs \(cap 6\)/.test(String(rejected[0].reason)), String(rejected[0].reason));
    assert(wallet.totals().atomicCount === 6 && issued.length === 6, `atomicCount ${wallet.totals().atomicCount}`);
  },
);

// ---- rejectNext: the test answers as a user who clicks Reject ----

await check('rejectNext: one request of the method gets 4001, before any network call; the next one goes', async () => {
  const { wallet, urls, issued } = issuingSigner();
  wallet.allowBridge();
  const other = wallet.rejectNext('eth_sendTransaction');
  const handle = wallet.rejectNext('avalanche_sendTransaction');
  // A function, so that TypeScript does not keep the value of one assert for the next.
  const used = () => `${handle.used} ${other.used}`;
  assert(used() === '0 0', 'the handle is used before a request');
  const message = await rejects(sendXP(wallet, hexOf(pExportTx())), ERR.userRejected);
  assert(message === USER_REJECTED_MESSAGE, `message ${JSON.stringify(message)}`);
  assert(used() === '1 0', `used, other: ${used()}`);
  assert(urls.length + issued.length === 0, `the rejection made calls: ${urls.join(', ')}`);
  assert(wallet.refusals.length === 0, 'a user rejection went into signer.refusals');
  assert(wallet.userRejections.map((r) => r.method).join() === 'avalanche_sendTransaction', 'userRejections');
  assert(wallet.totals().atomicCount === 0, 'a user rejection counted as an atomic tx');
  // The next click goes through.
  await sendXP(wallet, hexOf(pExportTx()));
  assert(issued.length === 1 && wallet.sends.length === 1, `issued ${issued.length}`);
  // An armed rejection stays armed until a request of its method takes it; cancel() drops it; revokeAll drops all.
  assert(wallet.armedRejections().join() === 'eth_sendTransaction', `armed ${wallet.armedRejections().join()}`);
  other.cancel();
  assert(wallet.armedRejections().length === 0 && other.used === 0, 'cancel() left the rejection armed');
  wallet.rejectNext('eth_sendTransaction');
  wallet.revokeAll();
  assert(wallet.armedRejections().length === 0, 'revokeAll left a rejection armed');
});

await check('rejectNext: an EVM send gets 4001 before the from, value and fee checks', async () => {
  const { wallet, urls } = offline();
  wallet.rejectNext('eth_sendTransaction');
  // A send that the wallet would refuse: the user rejection answers first and adds no refusal.
  const tx = { from: signer.address, to: signer.address, value: '0x1' };
  await rejects(wallet.handle({ method: 'eth_sendTransaction', params: [tx] }), ERR.userRejected, /^User rejected/);
  assert(urls.length === 0 && wallet.refusals.length === 0, 'the rejection made a call or a refusal');
});

await check(
  'rejectNext with times: two requests, both rejected; armed until cancel(); the audit fails on it',
  async () => {
    const summary = process.env.GITHUB_STEP_SUMMARY;
    delete process.env.GITHUB_STEP_SUMMARY;
    const dir = mkdtempSync(join(tmpdir(), 'e2e-reject-'));
    try {
      const { wallet, urls } = offline();
      const tx = { from: signer.address, to: signer.address, value: '0x1' };
      const send = () => wallet.handle({ method: 'eth_sendTransaction', params: [tx] });
      // Each request until cancel(): a page that sends twice gets two rejections, and nothing is signed.
      const net = wallet.rejectNext('eth_sendTransaction', { times: Infinity });
      await rejects(send(), ERR.userRejected, /^User rejected/);
      await rejects(send(), ERR.userRejected, /^User rejected/);
      // A function, so that TypeScript does not keep the value of one assert for the next.
      const tally = () => `${wallet.userRejections.length} user rejections, ${wallet.refusals.length} refusals`;
      assert(net.used === 2, `used ${net.used}, expected 2`);
      assert(tally() === '2 user rejections, 0 refusals', tally());
      assert(wallet.sends.length === 0 && urls.length === 0, 'a rejected request made a call or a send');
      assert(wallet.armedRejections().join() === 'eth_sendTransaction', 'the rejection is not armed after 2 requests');
      // The audit fails while it is armed, and drops it.
      try {
        auditSends(wallet, { ledgerPath: join(dir, 'ledger.json'), expect: {} });
        throw new Error('the audit passed with an armed rejection');
      } catch (err) {
        assert(/a user rejection of eth_sendTransaction is still armed/.test(String(err)), String(err));
      }
      assert(wallet.armedRejections().length === 0, 'the audit left the rejection armed');
      // times: 2 rejects two requests and then disarms; cancel() disarms at once. The next request goes to the wallet's
      // own checks, which refuse this tx: a refusal, not a user rejection.
      const two = wallet.rejectNext('eth_sendTransaction', { times: 2 });
      await rejects(send(), ERR.userRejected, /^User rejected/);
      assert(wallet.armedRejections().length === 1, 'times: 2 disarmed after one request');
      await rejects(send(), ERR.userRejected, /^User rejected/);
      assert(two.used === 2 && wallet.armedRejections().length === 0, `times: 2 used ${two.used}, still armed`);
      wallet.rejectNext('eth_sendTransaction', { times: Infinity }).cancel();
      await send().catch(() => undefined);
      assert(tally() === '4 user rejections, 1 refusals', `after cancel(): ${tally()}`);
      for (const times of [0, -1, 1.5, Number.NaN]) {
        let threw = false;
        try {
          wallet.rejectNext('eth_sendTransaction', { times });
        } catch {
          threw = true;
        }
        assert(threw, `rejectNext took times: ${times}`);
      }
    } finally {
      if (summary !== undefined) process.env.GITHUB_STEP_SUMMARY = summary;
      rmSync(dir, { recursive: true, force: true });
    }
  },
);

// ---- real Fuji txs of the capability types ----

interface Fixture {
  id: string;
  vm: 'PVM' | 'EVM';
  type: string;
  note: string;
  hex: string;
}

await check('real Fuji txs: each decodes and encodes back; this key signs its own again to the same tx', async () => {
  const { txs } = JSON.parse(readFileSync(new URL('./fuji-txs.json', import.meta.url), 'utf8')) as { txs: Fixture[] };
  assert(txs.length > 0, 'fuji-txs.json has no txs');
  for (const fixture of txs) {
    const what = `${fixture.type} ${fixture.id}`;
    const bytes = utils.hexToBuffer(fixture.hex);
    const body = bytes.slice(0, -4);
    assert(utils.bytesEqual(sha256(body).slice(-4), bytes.slice(-4)), `${what}: bad checksum`);
    assert(utils.base58check.encode(sha256(body)) === fixture.id, `${what}: the bytes are not this tx`);
    const { tx, unsignedBytes } = readSignedTx(fixture.vm, body);
    assert(tx._type === fixture.type, `${what}: decoded as ${tx._type}`);
    const alias = fixture.vm === 'PVM' ? 'P' : 'C';
    if (fixture.note.startsWith('this key')) {
      // The nonce of the real C-Chain export is the pending count that the stub gives.
      const nonce = evmSerial.isExportTx(tx) ? Number(tx.ins[0].nonce.value()) : 0;
      const { wallet, issued } = issuingSigner({ nonce });
      wallet.allowBridge();
      const txId = await sendXP(wallet, utils.bufferToHex(unsignedBytes), alias);
      assert(txId === fixture.id, `${what}: signed again as ${String(txId)}`);
      assert(issued[0].hex.toLowerCase() === fixture.hex.toLowerCase(), `${what}: signed again to other bytes`);
    } else {
      // Another key's stake: the rules read it and refuse it at the first owner check, with no network call.
      const { wallet, urls } = offline();
      const nodeId = pvmSerial.isAddPermissionlessValidatorTx(tx)
        ? tx.subnetValidator.validator.nodeId.toString()
        : pvmSerial.isAddAutoRenewedValidatorTx(tx)
          ? tx.nodeId.toString()
          : STAKE_NODE.nodeID;
      wallet.allowPrimaryStake(nodeId);
      await refused(
        wallet,
        () => sendXP(wallet, utils.bufferToHex(unsignedBytes), alias),
        /not unlocked AVAX change to this wallet \(it pays P-fuji1/,
        { urls },
      );
    }
  }
  console.log(`      ${txs.length} txs: ${[...new Set(txs.map((t) => t.type))].join(', ')}`);
});

// ---- teardown.ts: the txs it signs in Node ----

const KEY = readFujiKey();

// The fixed chain reads of the teardown's sign functions: the key's P-Chain UTXOs, the fee state and the C-Chain base
// fee in nAVAX per gas. `calls` lists each read. A UTXO read for another address fails.
function teardownReads({ utxos = [utxo(NANO_AVAX / 10n)], price = FEE_STATE.price, baseFee = 1n } = {}) {
  const calls: string[] = [];
  const reads: TeardownReads = {
    pUtxos: async (address) => {
      calls.push('pUtxos');
      assert(address === signer.pChainAddress, `the teardown read the UTXOs of ${address}`);
      return utxos;
    },
    feeState: async () => {
      calls.push('feeState');
      return { ...FEE_STATE, price };
    },
    cBaseFeeNanoAvax: async () => {
      calls.push('cBaseFee');
      return baseFee;
    },
  };
  return { reads, calls };
}

// A tx that the teardown signed: the checksum, the credential layout, the tx ID, and each signature recovers to the
// key (verifySignedHex), so to the key's own P-Chain address. Returns the tx.
function verifyTeardownTx(vmName: 'PVM' | 'EVM', signed: TeardownSignedTx, layout: number[][]): Common.Transaction {
  const body = utils.hexToBuffer(signed.hex).slice(0, -4);
  const { tx, unsignedBytes, credentials } = readSignedTx(vmName, body);
  const txId = verifySignedHex(vmName, signed.hex, utils.bufferToHex(unsignedBytes), layout);
  assert(txId === signed.txId, `the teardown gave tx ID ${signed.txId}, the bytes give ${txId}`);
  const recovered = secp256k1.recoverPublicKey(
    sha256(unsignedBytes),
    utils.hexToBuffer(credentials[0].getSignatures()[0]),
  );
  assert(
    utils.bytesEqual(secp256k1.publicKeyBytesToAddress(recovered), ourPBytes),
    'the signer is not the key address',
  );
  return tx;
}

// Expects the promise to fail with a message that matches.
async function throws(promise: Promise<unknown>, match: RegExp): Promise<void> {
  try {
    await promise;
  } catch (err) {
    assert(match.test(String(err)), `${String(err)} does not match ${match}`);
    return;
  }
  throw new Error(`expected an error that matches ${match}`);
}

const sumIn = (inputs: readonly TransferableInput[]) => inputs.reduce((sum, input) => sum + input.amount(), 0n);
const sumOut = (outputs: readonly TransferableOutput[]) => outputs.reduce((sum, out) => sum + out.amount(), 0n);

// A P-Chain owner as the P-Chain API writes it.
const apiOwner = (addresses: string[], threshold = 1) => ({ locktime: '0', threshold: String(threshold), addresses });

// A price that takes the fee of a tx (`fee` at FEE_STATE.price) to twice `cap`.
const priceAbove = (fee: bigint, cap: bigint) => (2n * cap * FEE_STATE.price) / fee + 1n;

// One UTXO in shared memory that this key can import, or not (atomic.ts readAtomicUtxo decides).
function atomicUtxo(
  amount: bigint,
  { owners = [ourPBytes], threshold = 1, locktime = 0n, assetId = FUJI.avaxAssetId as string } = {},
): AtomicUtxo {
  const out = new TransferOutput(new BigIntPr(amount), OutputOwners.fromNative(owners, locktime, threshold));
  const u = new Utxo(new avaxSerial.UTXOID(Id.fromString(randomId()), new Int(0)), Id.fromString(assetId), out);
  return readAtomicUtxo(u, ourPBytes);
}

// A tx of fuji-txs.json by type, decoded.
function fujiTx(type: string): { fixture: Fixture; tx: Common.Transaction } {
  const { txs } = JSON.parse(readFileSync(new URL('./fuji-txs.json', import.meta.url), 'utf8')) as { txs: Fixture[] };
  const fixture = txs.find((t) => t.type === type && t.note.startsWith('this key'));
  assert(fixture, `fuji-txs.json has no ${type} of this key`);
  return { fixture, tx: readSignedTx(fixture.vm, utils.hexToBuffer(fixture.hex).slice(0, -4)).tx };
}

await check('teardown DisableL1ValidatorTx: the key auth index, a fee under the cap, signed by the key', async () => {
  const { reads, calls } = teardownReads();
  const validationId = randomId();
  const validator = {
    validationId,
    deactivationOwner: { threshold: 1, addresses: [FOREIGN_P_ADDRESS, signer.pChainAddress] },
  };
  const signed = await signDisableTx(validator, KEY, CONTEXT, reads);
  // One fee input, then the disable auth: one signature each.
  const tx = verifyTeardownTx('PVM', signed, [[0], [1]]);
  assert(pvmSerial.isDisableL1ValidatorTx(tx), `the teardown signed a ${tx._type}`);
  assert(tx.validationId.toString() === validationId, 'the tx disables another validator');
  const auth = (tx.disableAuth as Input).values();
  assert(JSON.stringify(auth) === '[1]', `disable auth ${JSON.stringify(auth)}: the key is at index 1 of the owner`);
  const burned = sumIn(tx.baseTx.inputs) - sumOut(tx.baseTx.outputs);
  assert(burned === signed.burned && burned > 0n && burned <= P_FEE_CAP, `burned ${burned}, reported ${signed.burned}`);
  assert(calls.join() === 'pUtxos,feeState', `reads: ${calls.join()}`);

  // An owner that the key does not satisfy alone, and a fee above the cap, sign nothing.
  const owner = (addresses: string[], threshold: number) => ({
    validationId,
    deactivationOwner: { threshold, addresses },
  });
  const ours = signer.pChainAddress;
  await throws(signDisableTx(owner([FOREIGN_P_ADDRESS, ours], 2), KEY, CONTEXT, reads), /alone cannot disable/);
  await throws(signDisableTx(owner([FOREIGN_P_ADDRESS], 1), KEY, CONTEXT, reads), /alone cannot disable/);
  const costly = teardownReads({ price: priceAbove(burned, P_FEE_CAP) }).reads;
  await throws(signDisableTx(owner([ours], 1), KEY, CONTEXT, costly), /would burn .* AVAX, above the cap of 0\.01/);
});

await check('teardown SetAutoRenewedValidatorConfigTx: period 0, the key auth index, a fee under the cap', async () => {
  const { reads, calls } = teardownReads();
  const validator = {
    txID: randomId(),
    nodeID: STAKE_NODE.nodeID,
    validatorAuthority: apiOwner([FOREIGN_P_ADDRESS, signer.pChainAddress]),
  };
  const signed = await signStopTx(validator, KEY, CONTEXT, reads);
  const tx = verifyTeardownTx('PVM', signed, [[0], [1]]);
  assert(pvmSerial.isSetAutoRenewedValidatorConfigTx(tx), `the teardown signed a ${tx._type}`);
  assert(tx.txId.toString() === validator.txID, 'the tx names another validator tx');
  assert(tx.period.value() === 0n && tx.autoCompoundRewardShares.value() === 0, 'not a stop: period or shares not 0');
  const auth = (tx.auth as Input).values();
  assert(JSON.stringify(auth) === '[1]', `auth ${JSON.stringify(auth)}: the key is at index 1 of the authority`);
  const burned = sumIn(tx.baseTx.inputs) - sumOut(tx.baseTx.outputs);
  assert(burned === signed.burned && burned > 0n && burned <= P_FEE_CAP, `burned ${burned}, reported ${signed.burned}`);
  assert(calls.join() === 'pUtxos,feeState', `reads: ${calls.join()}`);

  const authority = (addresses: string[], threshold: number) => ({
    ...validator,
    validatorAuthority: apiOwner(addresses, threshold),
  });
  const ours = signer.pChainAddress;
  await throws(
    signStopTx(authority([FOREIGN_P_ADDRESS, ours], 2), KEY, CONTEXT, reads),
    /is not the validator authority/,
  );
  await throws(signStopTx(authority([FOREIGN_P_ADDRESS], 1), KEY, CONTEXT, reads), /is not the validator authority/);
  const costly = teardownReads({ price: priceAbove(burned, P_FEE_CAP) }).reads;
  await throws(signStopTx(authority([ours], 1), KEY, CONTEXT, costly), /above the cap of 0\.01/);
});

await check('teardown P-Chain ImportTx: signs a real Fuji import again to the same bytes; the fee; dust', async () => {
  // The real import took the UTXO that the real C-Chain export put in shared memory (output 0 of the export).
  const exported = fujiTx('evm.ExportTx');
  assert(evmSerial.isExportTx(exported.tx), 'the evm.ExportTx fixture does not decode as one');
  const out = exported.tx.exportedOutputs[0];
  const stranded = readAtomicUtxo(
    new Utxo(new avaxSerial.UTXOID(Id.fromString(exported.fixture.id), new Int(0)), out.assetId, out.output),
    ourPBytes,
  );
  assert(stranded.ours, 'the exported UTXO is not the key unlocked AVAX');
  const real = fujiTx('pvm.ImportTx');
  assert(pvmSerial.isImportTx(real.tx), 'the pvm.ImportTx fixture does not decode as one');
  const realFee = sumIn(real.tx.ins) - sumOut(real.tx.baseTx.outputs);
  // Fuji's gas price when the real import went out: its fee over its gas at a price of 1.
  const gas = pvm.calculateFee(real.tx, CONTEXT.platformFeeConfig.weights, 1n);
  assert(realFee % gas === 0n, `the real fee ${realFee} is not a whole number of gas ${gas}`);
  const { reads, calls } = teardownReads({ price: realFee / gas });

  const signed = await signImportTx('P', [stranded], KEY, CONTEXT, reads);
  verifyTeardownTx('PVM', signed, [[0]]);
  assert(signed.hex.toLowerCase() === real.fixture.hex.toLowerCase(), 'the teardown signed other bytes');
  assert(signed.txId === real.fixture.id, `tx ID ${signed.txId}, the real import is ${real.fixture.id}`);
  assert(signed.burned === realFee && realFee <= ATOMIC_FEE_CAP, `burned ${signed.burned}, the real fee ${realFee}`);
  const estimate = await importFee('P', [stranded], CONTEXT, reads);
  assert(estimate === realFee, `importFee ${estimate}, the real fee ${realFee}`);
  assert(calls.join() === 'feeState,feeState', `reads: ${calls.join()}`);

  // Dust: AVAX not above the fee. An import would burn all of it, or the builder refuses it, so the teardown pass
  // leaves it (result 'dust').
  const dust = atomicUtxo(1_000n);
  assert((await importFee('P', [dust], CONTEXT, reads)) > dust.amount, 'dust is above the fee');
  await throws(signImportTx('P', [dust], KEY, CONTEXT, reads), /Insufficient funds/);
  // The same import shape (one input, one change output) has the same gas.
  const costly = teardownReads({ price: priceAbove(gas * FEE_STATE.price, ATOMIC_FEE_CAP) }).reads;
  await throws(signImportTx('P', [atomicUtxo(NANO_AVAX / 50n)], KEY, CONTEXT, costly), /above the cap of 0\.001/);
});

await check('teardown C-Chain ImportTx: the real Fuji UTXO, to the key C-Chain address, the fee; dust', async () => {
  // The UTXO that the real C-Chain import took: its input names it, and the key alone owns it.
  const real = fujiTx('evm.ImportTx');
  assert(evmSerial.isImportTx(real.tx), 'the evm.ImportTx fixture does not decode as one');
  const input = real.tx.importedInputs[0];
  const owned = new TransferOutput(new BigIntPr(input.amount()), OutputOwners.fromNative([ourPBytes]));
  const stranded = readAtomicUtxo(new Utxo(input.utxoID, input.assetId, owned), ourPBytes);
  const { reads, calls } = teardownReads({ baseFee: 2n });

  const signed = await signImportTx('C', [stranded], KEY, CONTEXT, reads);
  const tx = verifyTeardownTx('EVM', signed, [[0]]);
  assert(evmSerial.isImportTx(tx), `the teardown signed a ${tx._type}`);
  assert(tx.sourceChain.toString() === FUJI.pBlockchainId, 'the import is not from the P-Chain');
  const codec = utils.getManagerForVM('EVM').getDefaultCodec();
  assert(
    tx.importedInputs.length === 1 && utils.bytesEqual(tx.importedInputs[0].toBytes(codec), input.toBytes(codec)),
    'the import does not take the real UTXO with the key signature index',
  );
  const [credit] = tx.Outs;
  assert(
    tx.Outs.length === 1 && credit.address.toHex() === signer.address.toLowerCase(),
    'the import pays another address',
  );
  const fee = input.amount() - credit.amount.value();
  const estimate = await importFee('C', [stranded], CONTEXT, reads);
  assert(fee === signed.burned && fee === estimate, `fee ${fee}, reported ${signed.burned}, importFee ${estimate}`);
  assert(fee > 0n && fee <= ATOMIC_FEE_CAP, `fee ${fee} nAVAX`);
  assert(calls.join() === 'cBaseFee,cBaseFee', `reads: ${calls.join()}`);

  // Dust: AVAX not above the fee. An import would pay less than the fee, so the teardown pass leaves it.
  const dust = atomicUtxo(fee / 2n);
  assert((await importFee('C', [dust], CONTEXT, reads)) > dust.amount, 'dust is above the fee');
  // The fee is gas x 2 nAVAX: a base fee of 2 x cap / gas takes the same import shape to twice the cap.
  const costly = teardownReads({ baseFee: (2n * ATOMIC_FEE_CAP) / (fee / 2n) + 1n }).reads;
  await throws(signImportTx('C', [atomicUtxo(NANO_AVAX / 50n)], KEY, CONTEXT, costly), /above the cap of 0\.001/);
});

// The page's rule at a price of 1 (lib/atomic.ts ImportRule): 2,961 gas per P-Chain input, 1,088 per C-Chain input.
const PRICE_1: ImportRule = { context: CONTEXT, price: 1n };

await check('importProblems: only the key AVAX above the cap stops the bridge; other UTXOs and dust are listed', () => {
  const small = atomicUtxo(NANO_AVAX / 100n);
  const others = [
    atomicUtxo(NANO_AVAX, { owners: [ourPBytes, FOREIGN_P_BYTES], threshold: 2 }),
    atomicUtxo(NANO_AVAX, { locktime: 2n ** 40n }),
    atomicUtxo(NANO_AVAX, { owners: [FOREIGN_P_BYTES] }),
    atomicUtxo(NANO_AVAX, { assetId: randomId() }),
  ];
  assert(others.every((u) => notOursReason(u)) && !notOursReason(small), 'atomic.ts sorted a UTXO wrong');
  const mixed = importProblems('P', [small, ...others], PRICE_1);
  assert(mixed.problems.length === 0, `problems: ${mixed.problems.join('; ')}`);
  assert(mixed.ignored.length === others.length, `ignored: ${mixed.ignored.join('; ')}`);
  assert(
    mixed.ignored.every((line, i) => line.includes(others[i].utxoId)),
    'the list does not name each UTXO',
  );
  const large = importProblems('C', [small, atomicUtxo(NANO_AVAX / 20n)], PRICE_1);
  assert(large.problems.length === 1 && /above the wallet's import cap/.test(large.problems[0]), large.problems.join());
  // Dust, as teardown.ts pass 3 sorts it: the key's AVAX on a side is not above the import fee. The bridge test leaves
  // it and lists it. One nAVAX more is not dust.
  const twoInputs = importFeeOf('C', [atomicUtxo(1n), atomicUtxo(1n)], PRICE_1);
  assert(twoInputs === 12_318n, `the fee of two C-Chain inputs at a price of 1 is ${twoInputs}, not 12,318 nAVAX`);
  const dust = importProblems('C', [atomicUtxo(2_000n), atomicUtxo(3_000n), others[0]], PRICE_1);
  assert(dust.problems.length === 0 && dust.dust.length === 2, `dust: ${dust.dust.length}, ${dust.problems.join()}`);
  assert(dust.ignored.length === 2 && /not above the import fee/.test(dust.ignored[1]), dust.ignored.join('; '));
  const oneInput = importFeeOf('C', [atomicUtxo(1n)], PRICE_1);
  const above = importProblems('C', [atomicUtxo(oneInput + 1n)], PRICE_1);
  assert(above.dust.length === 0 && above.ignored.length === 0, `above the fee: ${above.ignored.join('; ')}`);
  // A UTXO that does not hold more than the fee of its own input is dust, next to an import that pays its fee.
  const tiny = atomicUtxo(inputFee('C', small, PRICE_1));
  const beside = importProblems('C', [tiny, small], PRICE_1);
  assert(beside.dust.length === 1 && beside.dust[0] === tiny, `dust: ${beside.dust.map((u) => u.amount).join()}`);
  assert(/not above the fee of its own input/.test(beside.ignored.join()), beside.ignored.join('; '));
  const alone = importProblems('P', [atomicUtxo(2_961n)], PRICE_1);
  assert(alone.dust.length === 1 && /not above the fee of its own input/.test(alone.ignored[0]), alone.ignored[0]);
  // Without a rule, the key's AVAX is not sorted.
  assert(importProblems('P', [atomicUtxo(1n)]).dust.length === 0, 'without a rule, a UTXO was dust');
  // Many foreign UTXOs: ten lines and a count.
  const flood = importProblems(
    'C',
    Array.from({ length: 15 }, () => atomicUtxo(1n, { owners: [FOREIGN_P_BYTES] })),
  );
  assert(flood.ignored.length === 11 && /5 more UTXOs/.test(flood.ignored[10]), flood.ignored.join('; '));
});

await check('importSelection: the page rule (dust out, largest first, the gas limit of each side)', () => {
  // The review case of round 4: 100 one-nAVAX UTXOs do not dilute a 0.002 AVAX export at a C-Chain price of 25.
  const export2m = atomicUtxo(2n * MILLI_AVAX);
  const dust = Array.from({ length: 100 }, () => atomicUtxo(1n));
  const c25: ImportRule = { context: CONTEXT, price: 25n };
  const c = importSelection('C', [...dust, export2m], c25);
  assert(c.length === 1 && c[0] === export2m, `C selection: ${c.length} UTXOs`);
  assert(importFeeOf('C', c, c25) < export2m.amount, 'the 0.002 AVAX export does not pay its fee');
  assert(importsToClear('C', [...dust, export2m], c25) === 1, 'more than one C-Chain import');
  // The P-Chain flood of round 4: 337 one-nAVAX UTXOs and a 0.1 AVAX export. Only the export enters.
  const export100m = atomicUtxo(NANO_AVAX / 10n);
  const flood = Array.from({ length: 337 }, () => atomicUtxo(1n));
  const p = importSelection('P', [...flood, export100m], PRICE_1);
  assert(p.length === 1 && p[0] === export100m, `P selection: ${p.length} UTXOs`);
  // 400 UTXOs that pay for their input: one P-Chain import takes the 168 largest (500,000 gas, half of maxCapacity).
  const many = Array.from({ length: 400 }, () => atomicUtxo(MILLI_AVAX));
  const capped = importSelection('P', [...many, export100m], PRICE_1);
  const limit = importGasLimit('P', CONTEXT);
  assert(limit === 500_000n, `P limit ${limit}`);
  assert(capped.length === 168 && capped[0] === export100m, `P selection: ${capped.length} UTXOs`);
  assert(pImportGas(capped, CONTEXT) <= limit, `P gas ${pImportGas(capped, CONTEXT)}`);
  assert(pImportGas([...capped, many[0]], CONTEXT) > limit, 'one more P-Chain input still fits');
  assert(importsToClear('P', [...many, export100m], PRICE_1) === 3, 'not 3 P-Chain imports for 401 UTXOs');
});

// ---- the sends audit ----

await check('auditSends: exact counts, the ledger, the refusals, the caps, and revokeAll', async () => {
  const summary = process.env.GITHUB_STEP_SUMMARY;
  delete process.env.GITHUB_STEP_SUMMARY;
  const dir = mkdtempSync(join(tmpdir(), 'e2e-audit-'));
  try {
    const ledgerPath = join(dir, 'ledger.json');
    const { wallet } = issuingSigner();
    wallet.allowBridge();
    await sendXP(wallet, hexOf(pExportTx()));
    const at = new Date().toISOString();
    const step = (name: string, txIds: string[]) => ({
      step: name,
      chain: 'P' as const,
      status: 'landed' as const,
      inputs: {},
      txIds,
      startedAt: at,
      updatedAt: at,
    });
    updateLedger((ledger) => void ledger.sends.push(step('export', [wallet.sends[0].hash])), ledgerPath);
    const record = auditSends(wallet, { ledgerPath, expect: { 'pvm.ExportTx': 1 } });
    assert(record.problems.length === 0, `problems: ${record.problems.join('; ')}`);
    assert(readLedger(ledgerPath).sends.length === 1, 'the audit changed the sends of the ledger');
    assert('audit' in readLedger(ledgerPath), 'the ledger has no audit record');

    // revokeAll: the next export is refused, and the audit sees that refusal unless the test allows it.
    await refused(wallet, () => sendXP(wallet, hexOf(pExportTx())), /P-Chain tx type pvm\.ExportTx:/);
    const failing = (options: Parameters<typeof auditSends>[1], ...matches: RegExp[]) => {
      try {
        auditSends(wallet, options);
      } catch (err) {
        for (const match of matches) assert(match.test(String(err)), `${String(err)} does not match ${match}`);
        return;
      }
      throw new Error(`the audit passed, expected ${matches.join(', ')}`);
    };
    failing(
      { ledgerPath, expect: { 'pvm.ExportTx': 2 } },
      /pvm\.ExportTx: the wallet sent 1, the test expects 2/,
      /an unexpected refusal: avalanche_sendTransaction pvm\.ExportTx/,
    );
    auditSends(wallet, { ledgerPath, expect: { 'pvm.ExportTx': 1 }, allowRefusals: [/P-Chain tx type pvm\.ExportTx/] });
    failing({ ledgerPath, expect: {}, allowRefusals: [/pvm\.ExportTx/] }, /the test expects 0/);

    // A user rejection that the test armed and no request took fails the audit, and the audit drops it.
    wallet.rejectNext('eth_sendTransaction');
    failing(
      { ledgerPath, expect: { 'pvm.ExportTx': 1 }, allowRefusals: [/pvm\.ExportTx/] },
      /a user rejection of eth_sendTransaction is still armed/,
    );
    assert(wallet.armedRejections().length === 0, 'the audit left a rejection armed');

    // A send that the ledger does not hold, and a ledger tx that this signer did not send.
    updateLedger((ledger) => void (ledger.sends = [step('other', [randomId()])]), ledgerPath);
    failing(
      { ledgerPath, expect: { 'pvm.ExportTx': 1 }, allowRefusals: [/pvm\.ExportTx/] },
      /is not in the ledger/,
      /which this signer did not send/,
    );
  } finally {
    if (summary !== undefined) process.env.GITHUB_STEP_SUMMARY = summary;
    rmSync(dir, { recursive: true, force: true });
  }
});

await check('a read goes to the Fuji C-Chain RPC', async () => {
  const block = await signer.handle({ method: 'eth_blockNumber', params: [] });
  assert(
    typeof block === 'string' && /^0x[0-9a-f]+$/.test(block) && BigInt(block) > 0n,
    `eth_blockNumber: ${String(block)}`,
  );
  const balance = await signer.handle({ method: 'eth_getBalance', params: [signer.address, 'latest'] });
  assert(typeof balance === 'string' && /^0x[0-9a-f]+$/.test(balance), `eth_getBalance: ${String(balance)}`);
  console.log(`      block ${BigInt(block)}, C-Chain balance ${Number(BigInt(balance)) / 1e18} AVAX`);
});

await check('eth_sendTransaction (stub node): accessList, type, gas and nonce reach the signed tx', async () => {
  const raws: Hex[] = [];
  let pending = 5;
  let refuseOnce = false;
  const wallet = stubSigner({
    eth_getTransactionCount: () => `0x${pending.toString(16)}`,
    eth_estimateGas: '0x5208',
    eth_maxPriorityFeePerGas: '0x1',
    eth_gasPrice: '0x64',
    eth_getBlockByNumber: { baseFeePerGas: '0xa0' },
    eth_sendRawTransaction: (params: unknown) => {
      const raw = (params as Hex[])[0];
      if (refuseOnce) {
        refuseOnce = false;
        return new Error('nonce too low: next nonce 9, tx nonce 7');
      }
      raws.push(raw);
      return keccak256(raw);
    },
  });
  const accessList = [
    { address: '0x0200000000000000000000000000000000000005', storageKeys: [`0x${'ab'.repeat(32)}`] },
  ] as const;
  const send = (tx: Record<string, unknown>) =>
    wallet.handle({ method: 'eth_sendTransaction', params: [{ from: signer.address.toLowerCase(), ...tx }] });

  // A Warp delivery as the Console sends it: accessList, the nonce pinned to the pending count, no gas, value 0.
  const hash = await send({ to: signer.address, data: '0x1234', accessList, nonce: '0x5', value: '0x0' });
  let tx = parseTransaction(raws[0]);
  assert(hash === keccak256(raws[0]), 'the hash is not the hash of the signed tx');
  assert(
    tx.type === 'eip1559' && tx.chainId === 43113 && tx.nonce === 5,
    `type ${tx.type} chain ${tx.chainId} nonce ${tx.nonce}`,
  );
  assert(JSON.stringify(tx.accessList) === JSON.stringify(accessList), `accessList ${JSON.stringify(tx.accessList)}`);
  assert(tx.gas === 25_200n, `gas ${tx.gas}, expected the estimate + 20 %`);
  assert(
    tx.maxFeePerGas === 321n && tx.maxPriorityFeePerGas === 1n,
    `fees ${tx.maxFeePerGas}/${tx.maxPriorityFeePerGas}`,
  );
  assert(!tx.value, `value ${tx.value}`);
  const from = await recoverTransactionAddress({ serializedTransaction: raws[0] as never });
  assert(from === signer.address, `signed by ${from}`);

  // The node still counts 5 pending: the wallet remembers it sent 5 and uses 6. A stale page nonce (3) loses.
  await send({ to: signer.address, nonce: '0x3' });
  tx = parseTransaction(raws[1]);
  assert(tx.nonce === 6 && tx.accessList === undefined, `second send nonce ${tx.nonce}`);

  // Legacy with the page's gas and gasPrice; then a "nonce too low" from the node gets one retry with a new nonce.
  pending = 9;
  refuseOnce = true;
  await send({ to: signer.address, type: '0x0', gas: '0x7530', gasPrice: '0x2' });
  tx = parseTransaction(raws[2]);
  assert(
    tx.type === 'legacy' && tx.gas === 30_000n && tx.gasPrice === 2n,
    `legacy ${tx.type} ${tx.gas} ${tx.gasPrice}`,
  );
  assert(tx.nonce === 10, `retry nonce ${tx.nonce}, expected 10`);
  assert(wallet.sends.length === 3 && wallet.sends.every((s) => s.kind === 'evm'), 'the stub wallet records 3 sends');
});

// A page for the provider in node:vm: only browser globals, so the provider fails if it uses anything from its
// module. `fetch` stands in for the wallet route.
type VmPage = Record<string, unknown> & { announced: { info: { rdns: string; name: string; uuid: string } }[] };
function vmPage(
  fetchImpl: (url: string, init: RequestInit) => Promise<Response>,
  { protocol = 'https:', child = false } = {},
): VmPage {
  const target = new EventTarget();
  const announced: VmPage['announced'] = [];
  target.addEventListener('eip6963:announceProvider', (event) => announced.push((event as CustomEvent).detail));
  const page: VmPage = {
    announced,
    console,
    crypto,
    CustomEvent,
    Symbol,
    location: { protocol },
    addEventListener: target.addEventListener.bind(target),
    dispatchEvent: target.dispatchEvent.bind(target),
    fetch: fetchImpl,
  };
  page.window = page;
  page.top = child ? {} : page;
  // The engine calls the function with no argument, as `(source)()`.
  vm.runInNewContext(`(${coreProvider.toString()})()`, page);
  return page;
}

await check('the provider source posts to WALLET_PATH and holds no address', () => {
  const source = coreProvider.toString();
  assert(source.includes(`'${WALLET_PATH}'`), `the provider does not post to ${WALLET_PATH}`);
  assert(!source.toLowerCase().includes(signer.address.slice(2).toLowerCase()), 'the provider holds the address');
});

await check('the provider in a page: Core announce, requests, events, errors', async () => {
  const wallet = stubSigner({ eth_chainId: '0x3039' });
  wallet.allowChain(0x3039, 'https://l1.test/rpc');
  const page = vmPage(async (url, init) => {
    assert(url === WALLET_PATH, `the provider posted to ${url}`);
    return Response.json(await answerWalletRequest(wallet, JSON.parse(String(init.body))));
  });

  type Provider = {
    isAvalanche: boolean;
    chainId: string | null;
    selectedAddress: string | null;
    request(args: { method: string; params?: unknown }): Promise<unknown>;
    on(event: string, fn: (value: unknown) => void): unknown;
  };
  const provider = page.ethereum as Provider;
  assert(
    provider && page.avalanche === provider && provider.isAvalanche === true,
    'window.ethereum and window.avalanche',
  );
  const { announced } = page;
  const count = () => announced.length;
  assert(count() === 1, `${count()} announcements at load`);
  assert(announced[0].info.rdns === 'app.core' && announced[0].info.name === 'Core', 'announce info');
  assert(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(announced[0].info.uuid), 'uuid');
  (page.dispatchEvent as (event: Event) => boolean)(new Event('eip6963:requestProvider'));
  assert(count() === 2 && (announced[1] as { provider?: unknown }).provider === provider, 'announce again');

  // The state is unknown until the first answer, which sets it with no event.
  const changes: unknown[] = [];
  const accountChanges: unknown[] = [];
  provider.on('chainChanged', (id) => changes.push(id));
  provider.on('accountsChanged', (accounts) => accountChanges.push(accounts));
  assert(provider.chainId === null && provider.selectedAddress === null, 'state before the first answer');
  assert((await provider.request({ method: 'eth_chainId' })) === '0xa869', 'eth_chainId through the provider');
  assert(provider.chainId === '0xa869' && provider.selectedAddress === null, 'state after the first answer');
  assert(changes.length === 0 && accountChanges.length === 0, 'the first answer emitted an event');

  // No account before the site is connected, as Core does.
  const before = (await provider.request({ method: 'eth_accounts' })) as string[];
  assert(Array.isArray(before) && before.length === 0, `eth_accounts before connect: ${JSON.stringify(before)}`);
  let unauthorized: (Error & { code?: number }) | undefined;
  await provider.request({ method: 'avalanche_getAccountPubKey' }).catch((err) => {
    unauthorized = err;
  });
  assert(unauthorized?.code === ERR.unauthorized, `avalanche_getAccountPubKey before connect: ${unauthorized?.code}`);
  const gateRefusals = wallet.refusals.length;
  assert(gateRefusals === 0, 'the connect gate was logged as a refusal');
  const accounts = (await provider.request({ method: 'eth_requestAccounts' })) as string[];
  assert(accounts[0] === signer.address, 'eth_requestAccounts through the provider');
  assert(provider.selectedAddress === signer.address, 'selectedAddress after connect');
  assert(
    JSON.stringify(accountChanges) === JSON.stringify([[signer.address]]),
    `accountsChanged ${JSON.stringify(accountChanges)}`,
  );
  const after = (await provider.request({ method: 'eth_accounts' })) as string[];
  assert(after[0] === signer.address, 'eth_accounts after connect');

  const add = { chainId: '0x3039', chainName: 'e2e L1', rpcUrls: ['https://l1.invalid/rpc'], isTestnet: true };
  await provider.request({ method: 'wallet_addEthereumChain', params: [add] });
  await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0xa869' }] });
  await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x3039' }] });
  assert(
    JSON.stringify(changes) === JSON.stringify(['0x3039', '0xa869', '0x3039']),
    `chainChanged ${JSON.stringify(changes)}`,
  );
  const l1 = (await provider.request({ method: 'wallet_getEthereumChain' })) as { chainId: string; isTestnet: boolean };
  assert(l1.chainId === '0x3039' && l1.isTestnet === true, 'the added chain is the wallet chain');

  let refusal: (Error & { code?: number }) | undefined;
  await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0xa86a' }] }).catch((err) => {
    refusal = err;
  });
  assert(refusal?.code === ERR.userRejected, `a mainnet switch gave code ${refusal?.code}`);
  assert(wallet.refusals.length === 1, `signer.refusals has ${wallet.refusals.length} entries, expected 1`);

  // Disconnect takes the grant back.
  await provider.request({ method: 'wallet_revokePermissions', params: [{ eth_accounts: {} }] });
  const revoked = (await provider.request({ method: 'eth_accounts' })) as string[];
  assert(revoked.length === 0 && provider.selectedAddress === null, 'eth_accounts after revoke');
  assert(
    JSON.stringify(accountChanges) === JSON.stringify([[signer.address], []]),
    `accountsChanged after revoke: ${JSON.stringify(accountChanges)}`,
  );
});

await check('the provider stays out of a child frame and a non-http document', () => {
  const never = async (): Promise<Response> => {
    throw new Error('no request expected');
  };
  const child = vmPage(never, { child: true });
  assert(child.ethereum === undefined && child.avalanche === undefined, 'a child frame got a provider');
  assert(child.announced.length === 0, 'a child frame announced');
  const blank = vmPage(never, { protocol: 'about:' });
  assert(blank.avalanche === undefined && blank.announced.length === 0, 'about:blank got a provider');
});

// A fake WebRoute: it records what the handler fulfilled. Any other decision fails the check.
function fakeRoute(request: Partial<WebRoute['request']>) {
  const out: { status?: number; json?: unknown } = {};
  const route: WebRoute = {
    request: { url: 'https://build.avax.network/__e2e/wallet', method: 'POST', headers: {}, ...request },
    fulfill: async (response) => {
      assert(out.status === undefined, 'fulfilled twice');
      out.status = response.status ?? 200;
      out.json = 'json' in response ? response.json : undefined;
    },
    continue: async () => {
      throw new Error('the wallet route continued a request');
    },
    fallback: async () => {
      throw new Error('the wallet route fell back');
    },
    abort: async () => {
      throw new Error('the wallet route aborted a request');
    },
  };
  return { route, out };
}

await check('the wallet route: pattern, same-origin requests only, no network', async () => {
  for (const url of ['https://build.avax.network/__e2e/wallet', 'http://localhost:3000/__e2e/wallet?x=1']) {
    assert(WALLET_ROUTE.test(url), `the route misses ${url}`);
  }
  for (const url of ['https://build.avax.network/__e2e/wallet2', 'https://build.avax.network/console']) {
    assert(!WALLET_ROUTE.test(url), `the route matches ${url}`);
  }

  const { wallet } = offline();
  const requests: string[] = [];
  const handler = walletRouteHandler(wallet, 'https://build.avax.network', requests);
  const app = { origin: 'https://build.avax.network', 'content-type': 'application/json' };
  const call = async (request: Partial<WebRoute['request']>) => {
    const { route, out } = fakeRoute(request);
    await handler(route);
    return out;
  };

  const connect = await call({ headers: app, postData: JSON.stringify({ method: 'eth_requestAccounts' }) });
  assert(connect.status === 200, `eth_requestAccounts: HTTP ${connect.status}`);
  const ok = await call({ headers: app, postData: JSON.stringify({ method: 'eth_accounts' }) });
  const reply = ok.json as { result?: string[]; chainId?: string; accounts?: string[] };
  assert(ok.status === 200 && reply.result?.[0] === wallet.address, `eth_accounts: ${JSON.stringify(ok)}`);
  assert(reply.chainId === '0xa869' && reply.accounts?.[0] === wallet.address, 'the reply carries the state');

  const body = JSON.stringify({ method: 'eth_requestAccounts' });
  const refusals: [string, Partial<WebRoute['request']>, number][] = [
    ['another site URL', { url: 'https://evil.invalid/__e2e/wallet', headers: app, postData: body }, 403],
    ['another site Origin', { headers: { origin: 'https://evil.invalid' }, postData: body }, 403],
    ['no Origin', { headers: {}, postData: body }, 403],
    ['a GET', { method: 'GET', headers: app }, 405],
    ['no JSON', { headers: app, postData: 'nope' }, 400],
  ];
  for (const [name, request, status] of refusals) {
    const out = await call(request);
    const json = out.json as { result?: unknown; accounts?: unknown };
    assert(out.status === status, `${name}: HTTP ${out.status}, expected ${status}`);
    assert(json.result === undefined && json.accounts === undefined, `${name}: the refusal carries wallet data`);
  }
  const seen = JSON.stringify(requests);
  assert(seen === JSON.stringify(['eth_requestAccounts', 'eth_accounts']), `the route passed on ${seen}`);
  // The 3 refusals of another origin go into signer.refusals, with the method of the body.
  const logged = wallet.refusals.map((r) => `${r.method}: ${r.reason}`);
  assert(logged.length === 3, `signer.refusals: ${JSON.stringify(logged)}`);
  assert(
    logged.every((line) => /^eth_requestAccounts: no wallet (on|for a request from) /.test(line)),
    `signer.refusals: ${JSON.stringify(logged)}`,
  );
});

console.log(`network calls: ${networkCalls.join(', ')}`);
console.log(`wallet log: ${logs.length ? logs.join(' | ') : '(none)'}`);
assert(signer.sends.length === 0, 'the self-test sent a transaction');
console.log(failures ? `${failures} check(s) failed` : 'all checks passed; no transaction sent');
process.exit(failures ? 1 : 0);
