// Self-test of the e2e Core wallet. It sends no transaction and opens no browser.
//
//   cd tests/e2e
//   export E2E_CHAIN_FUJI_KEY_FILE=~/.config/e2e-chain/fuji.key
//   node chain/wallet/selftest.ts
//
// Optional: E2E_CHAIN_C_ADDRESS and E2E_CHAIN_P_ADDRESS, the addresses the key must give.
//
// Network reads (public endpoints, through chain.ts throttledFetch: one slot every 500 ms, a stop at the first 429):
// eth_blockNumber and eth_getBalance on the Fuji C-Chain, and platform.getL1Validator and platform.getSubnet on the
// Fuji P-Chain. A guard on the signer's fetch refuses issueTx and eth_sendRawTransaction. Each refusal check runs
// with no network call: on the real signer it counts the calls, on a stub signer it records them.
//
// The provider runs here in a node:vm page, from the same function source that the engine gets as an init script.
// The browser half (the init script before the app's scripts, the Core connect flow, a reload) needs a real browser:
// a chain test with the `wallet` fixture and connectCore from chain/lib/fixtures.ts.

import { createHash } from 'node:crypto';
import { inspect } from 'node:util';
import vm from 'node:vm';
import {
  Address,
  avaxSerial,
  BigIntPr,
  BlsSignature,
  Bytes,
  evmSerial,
  Id,
  Input,
  Int,
  L1Validator,
  OutputOwners,
  PChainOwner,
  pvmSerial,
  secp256k1,
  Stringpr,
  TransferableInput,
  TransferableOutput,
  utils,
  type Common,
} from '@avalabs/avalanchejs';
import { secp256k1 as nobleSecp256k1 } from '@noble/curves/secp256k1.js';
import { keccak256, parseTransaction, recoverTransactionAddress, type Hex } from 'viem';
import type { WebRoute } from '@e2e-dev/web';
import { FUJI, NANO_AVAX, readFujiKey, RpcError, throttledFetch } from '../lib/chain.ts';
import { createMockValidator } from '../lib/mock-validator.ts';
import { answerWalletRequest, WALLET_ROUTE, walletRouteHandler } from './bridge.ts';
import { coreProvider, WALLET_PATH } from './provider.ts';
import { createSignerFromEnv, ERR, Signer, type SignedPChainTx } from './signer.ts';

// A real Fuji L1 validator that another key owns (deactivationOwner P-fuji1ywzvrftfqexh5g6qa9zyrytj6pqdfetza2hqln).
const FOREIGN_VALIDATION_ID = '2wTscvX3JUsMbZHFRd9t8Ywz2q9j2BmETg8cTvgUHgawjbSvZX';
const FOREIGN_P_ADDRESS = 'P-fuji1ywzvrftfqexh5g6qa9zyrytj6pqdfetza2hqln';
const FOREIGN_P_BYTES = utils.bech32ToBytes(FOREIGN_P_ADDRESS);
const MILLI_AVAX = NANO_AVAX / 1_000n;

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

// A signer whose network is a stub: each call is answered from `answers`, and any other call fails. An answer is a
// value, an Error (a JSON-RPC error), or a function of the params. `urls` records the URL of each call.
function stubSigner(answers: Record<string, unknown>, urls: string[] = []): Signer {
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

// ---- dummy unsigned txs ----

function feeInput(amount = MILLI_AVAX, sigIndices = [0]) {
  return TransferableInput.fromNative(randomId(), 0, FUJI.avaxAssetId, amount, sigIndices);
}

function output(amount: bigint, owner = ourPBytes, locktime = 0n) {
  return TransferableOutput.fromNative(FUJI.avaxAssetId, amount, [owner], locktime);
}

// Fee inputs of 0.001 AVAX each, by default two of them and no change: a fee of 0.002 AVAX.
function baseTx({
  inputs = [feeInput(), feeInput()],
  outputs = [] as TransferableOutput[],
  networkId = 5,
}: { inputs?: TransferableInput[]; outputs?: TransferableOutput[]; networkId?: number } = {}) {
  return avaxSerial.BaseTx.fromNative(networkId, FUJI.pBlockchainId, outputs, inputs, new Uint8Array());
}

const hexOf = (tx: Common.Transaction) => utils.bufferToHex(utils.packTx(tx));

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

const u32 = (n: number) => {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, n);
  return bytes;
};
const concat = (...parts: Uint8Array[]) => Uint8Array.from(Buffer.concat(parts));
const varBytes = (bytes: Uint8Array) => concat(u32(bytes.length), bytes);

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

// The signed tx must hold the same unsigned tx, the expected credential layout, and only signatures that recover
// to this wallet's key over sha256 of the unsigned tx.
function verifySigned(signed: SignedPChainTx, unsignedHex: string, layout: number[][]) {
  const bytes = utils.hexToBuffer(signed.signedTxHex);
  const body = bytes.slice(0, -4);
  assert(utils.bytesEqual(sha256(body).slice(-4), bytes.slice(-4)), 'bad checksum');
  const tx = utils.getManagerForVM('PVM').unpack(body, avaxSerial.SignedTx);
  const unsigned = utils.packTx(tx.unsignedTx);
  assert(utils.bufferToHex(unsigned) === unsignedHex, 'the signed tx holds a different unsigned tx');
  const credentials = tx.getCredentials();
  assert(
    JSON.stringify(signed.credentials) === JSON.stringify(layout),
    `layout ${JSON.stringify(signed.credentials)}, expected ${JSON.stringify(layout)}`,
  );
  assert(credentials.length === layout.length, `${credentials.length} credentials, expected ${layout.length}`);
  const hash = sha256(unsigned);
  credentials.forEach((credential, i) => {
    const signatures = credential.getSignatures();
    assert(signatures.length === layout[i].length, `credential ${i} has ${signatures.length} signatures`);
    for (const signature of signatures) {
      const recovered = secp256k1.recoverPublicKey(hash, utils.hexToBuffer(signature));
      assert(utils.bytesEqual(recovered, ourCompressed), `credential ${i} signature recovers to another key`);
    }
  });
  assert(signed.txId === utils.base58check.encode(sha256(body)), 'tx ID mismatch');
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
  await rejects(
    signer.handle({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0xa86a' }] }),
    ERR.userRejected,
    /chain 43114/,
  );
  for (const chainId of ['0xa86a', '0x1', '0x3039']) {
    await rejects(
      signer.handle({
        method: 'wallet_addEthereumChain',
        params: [{ chainId, rpcUrls: ['https://evil.invalid/rpc'], isTestnet: true }],
      }),
      ERR.userRejected,
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
  await rejects(wallet.handle({ method: 'personal_sign', params: ['0x1234', wallet.address] }), ERR.unsupported);
  const typed = JSON.stringify({
    domain: { chainId: 43114 },
    types: { EIP712Domain: [{ name: 'chainId', type: 'uint256' }], M: [{ name: 'a', type: 'uint256' }] },
    primaryType: 'M',
    message: { a: 1 },
  });
  await rejects(wallet.handle({ method: 'eth_signTypedData_v4', params: [wallet.address, typed] }), ERR.unsupported);
  await rejects(wallet.handle({ method: 'eth_sign', params: [] }), ERR.unsupported, /eth_sign/);
  await rejects(wallet.handle({ method: 'wallet_watchAsset', params: {} }), ERR.unsupported, /wallet_watchAsset/);
  assert(urls.length === 0, `a refused method made a network call: ${urls.join(', ')}`);
});

// ---- refusals: EVM sends ----

await check('eth_sendTransaction refuses another from address, a value and a fee above 0.002 AVAX', async () => {
  const { wallet, urls } = offline();
  const send = (tx: Record<string, unknown>) =>
    wallet.handle({ method: 'eth_sendTransaction', params: [{ from: wallet.address, to: wallet.address, ...tx }] });
  await rejects(send({ from: '0x0000000000000000000000000000000000000001' }), ERR.unauthorized);
  await rejects(send({ value: '0x1' }), ERR.userRejected, /value 1 wei/);
  // 2,000,000 gas x 2 gwei = 0.004 AVAX.
  await rejects(
    send({ gas: '0x1e8480', maxFeePerGas: '0x77359400', maxPriorityFeePerGas: '0x1' }),
    ERR.userRejected,
    /more than 0\.002 AVAX/,
  );
  await rejects(send({ gas: '0x1e8480', gasPrice: '0x77359400' }), ERR.userRejected, /more than 0\.002 AVAX/);
  assert(urls.length === 0, `a refused send made a network call: ${urls.join(', ')}`);
  assert(wallet.sends.length === 0, 'a refused send was recorded');
});

// ---- refusals: P-Chain and C-Chain atomic txs ----

const sendXP = (wallet: Signer, transactionHex: string, chainAlias = 'P') =>
  wallet.handle({ method: 'avalanche_sendTransaction', params: { transactionHex, chainAlias } });

await check('P-Chain: BaseTx, ExportTx and ImportTx are refused with their type', async () => {
  const { wallet, urls } = offline();
  const foreign = [output(MILLI_AVAX, FOREIGN_P_BYTES)];
  const txs: [string, Common.Transaction][] = [
    ['pvm.BaseTx', new pvmSerial.BaseTx(baseTx({ outputs: foreign }))],
    ['pvm.ExportTx', new pvmSerial.ExportTx(baseTx(), Id.fromString(FUJI.cBlockchainId), foreign)],
    ['pvm.ImportTx', new pvmSerial.ImportTx(baseTx(), Id.fromString(FUJI.cBlockchainId), [feeInput()])],
  ];
  for (const [type, tx] of txs) {
    await rejects(sendXP(wallet, hexOf(tx)), ERR.userRejected, new RegExp(`P-Chain tx type ${type}:`));
  }
  assert(urls.length === 0, `a refused tx made a network call: ${urls.join(', ')}`);
});

await check('C-Chain atomic txs are refused with their type', async () => {
  const { wallet, urls } = offline();
  await rejects(sendXP(wallet, hexOf(evmExportTx(wallet.address)), 'C'), ERR.userRejected, /chain C \(evm\.ExportTx\)/);
  await rejects(sendXP(wallet, '0x00', 'X'), ERR.userRejected, /chain X/);
  assert(urls.length === 0, `a refused tx made a network call: ${urls.join(', ')}`);
});

await check('P-Chain: network ID 1 is refused before any network call', async () => {
  const before = networkCalls.length;
  const base = baseTx({ networkId: 1 });
  await rejects(signer.signPChainTx(hexOf(createSubnetTx({ base }))), ERR.userRejected, /network ID 1:/);
  assert(networkCalls.length === before, 'the refused tx made a network call');
});

await check('P-Chain outputs: change to this wallet only, unlocked', async () => {
  const { wallet, urls } = offline();
  const withOutput = (out: TransferableOutput) =>
    hexOf(createSubnetTx({ base: baseTx({ inputs: [feeInput(2n * MILLI_AVAX)], outputs: [out] }) }));
  await rejects(
    wallet.signPChainTx(withOutput(output(MILLI_AVAX, FOREIGN_P_BYTES))),
    ERR.userRejected,
    new RegExp(`it pays ${FOREIGN_P_ADDRESS}`),
  );
  await rejects(wallet.signPChainTx(withOutput(output(MILLI_AVAX, ourPBytes, 1n))), ERR.userRejected, /an output/);
  // Change of 0.0015 AVAX from 0.002 in: the tx spends the 0.0005 AVAX fee.
  const signed = await wallet.signPChainTx(withOutput(output((3n * MILLI_AVAX) / 2n)));
  assert(signed.spent === MILLI_AVAX / 2n, `spent ${signed.spent}`);
  assert(urls.length === 0, `CreateSubnetTx made a network call: ${urls.join(', ')}`);
});

await check('P-Chain caps: a fee above 0.01 AVAX, a validator balance above 0.05 AVAX', async () => {
  const { wallet, urls } = offline();
  const base = baseTx({ inputs: [feeInput(20n * MILLI_AVAX)] });
  await rejects(wallet.signPChainTx(hexOf(createSubnetTx({ base }))), ERR.userRejected, /a fee of 0\.02 AVAX/);
  await rejects(
    wallet.signPChainTx(hexOf(increaseTx(randomId(), 60n * MILLI_AVAX))),
    ERR.userRejected,
    /a validator balance of 0\.06 AVAX/,
  );
  assert(urls.length === 0, `a refused tx made a network call: ${urls.join(', ')}`);
});

await check('P-Chain owners: the subnet owner and the validator owners must be this wallet', async () => {
  const { wallet, urls } = offline();
  await rejects(
    wallet.signPChainTx(hexOf(createSubnetTx({ owner: FOREIGN_P_BYTES }))),
    ERR.userRejected,
    /subnet owner/,
  );
  const refusals: [Common.Transaction, RegExp][] = [
    [convertTx({ remaining: FOREIGN_P_BYTES }), /remaining balance owner/],
    [convertTx({ deactivation: FOREIGN_P_BYTES }), /deactivation owner/],
    [registerTx({ remaining: FOREIGN_P_BYTES }), /remaining balance owner/],
    [registerTx({ disable: FOREIGN_P_BYTES }), /disable owner/],
  ];
  for (const [tx, match] of refusals) await rejects(wallet.signPChainTx(hexOf(tx)), ERR.userRejected, match);
  assert(urls.length === 0, `a refused tx made a network call: ${urls.join(', ')}`);
});

await check('IncreaseL1ValidatorBalanceTx for a validator whose balance goes to another owner is refused', async () => {
  const foreign = stubSigner({
    'platform.getL1Validator': { remainingBalanceOwner: { threshold: '1', addresses: [FOREIGN_P_ADDRESS] } },
  });
  await rejects(
    foreign.signPChainTx(hexOf(increaseTx(randomId(), 10n * MILLI_AVAX))),
    ERR.userRejected,
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
  await rejects(
    sendXP(wallet, hexOf(increaseTx(randomId(), 50n * MILLI_AVAX))),
    ERR.userRejected,
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
  await rejects(twoKeys.signPChainTx(hexOf(createChainTx(randomId(), [0]))), ERR.unauthorized, /not this wallet/);
});

await check('subnet auth throws when the owner lookup fails (stub)', async () => {
  const missing = stubSigner({ 'platform.getSubnet': new Error('not found') });
  await rejects(missing.signPChainTx(hexOf(createChainTx(randomId(), [0]))), ERR.internal, /owner lookup .* failed/);
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

await check('DisableL1ValidatorTx for a validator another key owns is refused (Fuji)', async () => {
  await rejects(signer.signPChainTx(hexOf(disableTx(FOREIGN_VALIDATION_ID))), ERR.unauthorized, /not this wallet/);
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

  let refused: (Error & { code?: number }) | undefined;
  await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0xa86a' }] }).catch((err) => {
    refused = err;
  });
  assert(refused?.code === ERR.userRejected, `a mainnet switch gave code ${refused?.code}`);

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

  const requests: string[] = [];
  const handler = walletRouteHandler(signer, 'https://build.avax.network', requests);
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
  assert(ok.status === 200 && reply.result?.[0] === signer.address, `eth_accounts: ${JSON.stringify(ok)}`);
  assert(reply.chainId === '0xa869' && reply.accounts?.[0] === signer.address, 'the reply carries the state');

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
});

console.log(`network calls: ${networkCalls.join(', ')}`);
console.log(`wallet log: ${logs.length ? logs.join(' | ') : '(none)'}`);
assert(signer.sends.length === 0, 'the self-test sent a transaction');
console.log(failures ? `${failures} check(s) failed` : 'all checks passed; no transaction sent');
process.exit(failures ? 1 : 0);
