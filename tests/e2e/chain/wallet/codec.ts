import {
  avaxSerial,
  BigIntPr,
  Int,
  NodeId,
  pvmSerial,
  Short,
  TransferableOutput,
  utils,
  type Common,
  type Credential,
  type OutputOwners,
} from '@avalabs/avalanchejs';

// Reads and writes the txs that the e2e wallet signs: P-Chain txs and C-Chain atomic txs, with avalanchejs 5.1.0.
//
// Every decode is strict: the tx must encode back to exactly the bytes it came from. So the signer checks the same tx
// that it signs, and the signature covers the page's bytes.
//
// One tx type needs a fix. avalanchejs 5.1.0 writes AddAutoRenewedValidatorTx (ACP-236) in a layout that avalanchego
// does not read: the NodeID has no 4-byte length, and a weight field follows the delegation shares. In avalanchego
// (vms/platformvm/txs/add_auto_renewed_validator_tx.go) ValidatorNodeID is a byte slice (a 4-byte length, then 20
// bytes), and the tx has no weight: the weight is the sum of the stake outputs. @avalanche-sdk/client 0.1.3 patches
// toBytes (methods/wallet/pChain/addAutoRenewedValidatorTxCompat.ts), so the Console sends the avalanchego layout.
// This module reads and writes that layout. A real Fuji AddAutoRenewedValidatorTx decodes with it (selftest.ts, the
// replay check). If avalanchejs changes its layout, the strict decode refuses the tx: it does not sign other bytes.

type Vm = 'PVM' | 'EVM';
type Codec = ReturnType<ReturnType<typeof utils.getManagerForVM>['getDefaultCodec']>;

const CODEC_VERSION = 0;
// avalanchego vms/platformvm/txs/codec.go, RegisterHeliconTypes: AddAutoRenewedValidatorTx is type 40.
const ADD_AUTO_RENEWED_TYPE_ID = 40;
const NODE_ID_LENGTH = 20;

function u32(n: number): Uint8Array {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, n);
  return bytes;
}

function readU32(bytes: Uint8Array): number {
  if (bytes.length < 4) throw new Error('the tx is too short');
  return new DataView(bytes.buffer, bytes.byteOffset, 4).getUint32(0);
}

function concat(...parts: Uint8Array[]): Uint8Array {
  return Uint8Array.from(Buffer.concat(parts));
}

function codecOf(vm: Vm): Codec {
  return utils.getManagerForVM(vm).getDefaultCodec();
}

// The fields of an AddAutoRenewedValidatorTx in the avalanchego layout, after the codec version and the type ID.
// Returns the tx with its weight set to the stake sum, and the bytes after the tx.
function unpackAutoRenewed(body: Uint8Array, codec: Codec): [pvmSerial.AddAutoRenewedValidatorTx, Uint8Array] {
  const [baseTx, afterBase] = avaxSerial.BaseTx.fromBytes(body, codec);
  const nodeIdLength = readU32(afterBase);
  if (nodeIdLength !== NODE_ID_LENGTH) throw new Error(`the NodeID has ${nodeIdLength} bytes, not ${NODE_ID_LENGTH}`);
  const [nodeId, afterNode] = NodeId.fromBytes(afterBase.subarray(4));
  const [signer, afterSigner] = codec.UnpackPrefix<pvmSerial.Signer>(afterNode);
  if (!(signer instanceof pvmSerial.Signer)) throw new Error('the signer is not a BLS proof of possession');
  const stake: TransferableOutput[] = [];
  let rest = afterSigner.subarray(4);
  for (let i = readU32(afterSigner); i > 0; i--) {
    const [out, next] = TransferableOutput.fromBytes(rest, codec);
    stake.push(out);
    rest = next;
  }
  const [validatorRewardsOwner, r1] = codec.UnpackPrefix<OutputOwners>(rest);
  const [delegatorRewardsOwner, r2] = codec.UnpackPrefix<OutputOwners>(r1);
  const [owner, r3] = codec.UnpackPrefix<OutputOwners>(r2);
  const [shares, r4] = Int.fromBytes(r3);
  const [autoCompoundRewardShares, r5] = Int.fromBytes(r4);
  const [period, after] = BigIntPr.fromBytes(r5);
  const weight = stake.reduce((sum, out) => sum + out.amount(), 0n);
  const tx = new pvmSerial.AddAutoRenewedValidatorTx(
    baseTx,
    nodeId,
    signer,
    stake,
    validatorRewardsOwner,
    delegatorRewardsOwner,
    owner,
    shares,
    new BigIntPr(weight),
    autoCompoundRewardShares,
    period,
  );
  return [tx, after];
}

// The fields of an AddAutoRenewedValidatorTx in the avalanchego layout. The weight field is not written.
function packAutoRenewed(tx: pvmSerial.AddAutoRenewedValidatorTx, codec: Codec): Uint8Array {
  return concat(
    tx.baseTx.toBytes(codec),
    u32(NODE_ID_LENGTH),
    tx.nodeId.toBytes(),
    codec.PackPrefix(tx.signer),
    u32(tx.stake.length),
    ...tx.stake.map((out) => out.toBytes(codec)),
    codec.PackPrefix(tx.validatorRewardsOwner),
    codec.PackPrefix(tx.delegatorRewardsOwner),
    codec.PackPrefix(tx.owner),
    tx.shares.toBytes(),
    tx.autoCompoundRewardShares.toBytes(),
    tx.period.toBytes(),
  );
}

// One tx at the start of `bytes` (codec version, type ID, fields), and the bytes after it.
function unpackTx(vm: Vm, bytes: Uint8Array): [Common.Transaction, Uint8Array] {
  const [codec, body] = utils.getManagerForVM(vm).getCodecFromBuffer(bytes);
  if (vm === 'PVM' && readU32(body) === ADD_AUTO_RENEWED_TYPE_ID) return unpackAutoRenewed(body.subarray(4), codec);
  return codec.UnpackPrefix<Common.Transaction>(body);
}

/** The unsigned bytes of a tx, as avalanchego reads them (the codec version, the type ID, then the fields). */
export function encodeTx(tx: Common.Transaction): Uint8Array {
  if (pvmSerial.isAddAutoRenewedValidatorTx(tx)) {
    return concat(
      new Short(CODEC_VERSION).toBytes(),
      u32(ADD_AUTO_RENEWED_TYPE_ID),
      packAutoRenewed(tx, codecOf('PVM')),
    );
  }
  return utils.packTx(tx);
}

/**
 * Reads an unsigned tx: a P-Chain tx ('PVM') or a C-Chain atomic tx ('EVM'). Throws when bytes follow the tx, or
 * when the tx does not encode back to the same bytes.
 */
export function decodeTx(vm: Vm, bytes: Uint8Array): Common.Transaction {
  const [tx, rest] = unpackTx(vm, bytes);
  if (rest.length > 0) throw new Error(`${rest.length} bytes follow the tx`);
  if (!utils.bytesEqual(encodeTx(tx), bytes)) throw new Error(`the ${tx._type} does not encode back to the same bytes`);
  return tx;
}

/**
 * A signed tx (platform.getTx or avax.getAtomicTx, hex encoding, without the 4-byte checksum): the tx, its unsigned
 * bytes and its credentials. Throws when bytes follow the credentials.
 */
export function readSignedTx(
  vm: Vm,
  signed: Uint8Array,
): { tx: Common.Transaction; unsignedBytes: Uint8Array; credentials: Credential[] } {
  const [, afterTx] = unpackTx(vm, signed);
  const unsignedBytes = signed.subarray(0, signed.length - afterTx.length);
  const codec = codecOf(vm);
  const credentials: Credential[] = [];
  let rest = afterTx.subarray(4);
  for (let i = readU32(afterTx); i > 0; i--) {
    const [credential, next] = codec.UnpackPrefix<Credential>(rest);
    credentials.push(credential);
    rest = next;
  }
  if (rest.length > 0) throw new Error(`${rest.length} bytes follow the credentials`);
  return { tx: decodeTx(vm, unsignedBytes), unsignedBytes, credentials };
}

/** The signed tx: the unsigned bytes, then the credentials (avalanchego's SignedTx layout). */
export function signedTxBytes(vm: Vm, unsignedBytes: Uint8Array, credentials: Credential[]): Uint8Array {
  return concat(unsignedBytes, codecOf(vm).PackPrefixList(credentials));
}
