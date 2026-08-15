// Client helpers for the AvalancheGo P-Chain RPC (via /api/pchain-rpc).
// These fill the gaps the indexer leaves: decoded platform-op inputs
// (ConvertSubnetToL1Tx validator sets, manager pointers), subnet/L1
// conversion state, live L1 validator sets, and state-minted reward UTXOs.

import { bech32 } from "@scure/base";

export interface PchainOwner {
  threshold: number | string;
  addresses: string[];
  locktime?: string;
}

/** ConvertSubnetToL1Tx initial validator, as the user submitted it. */
export interface L1InitialValidator {
  nodeID: string; // hex (0x…20 bytes) in the node's json encoding
  weight: number;
  balance: number; // nAVAX
  signer?: { publicKey: string; proofOfPossession: string };
  remainingBalanceOwner?: PchainOwner;
  deactivationOwner?: PchainOwner;
}

/** The decoded unsigned tx from platform.getTx (fields vary by tx type). */
export interface PlatformUnsignedTx {
  subnetID?: string;
  chainID?: string; // ConvertSubnetToL1Tx: chain hosting the validator manager
  address?: string; // ConvertSubnetToL1Tx: validator manager contract
  validators?: L1InitialValidator[];
  chainName?: string;
  vmID?: string;
  genesisData?: unknown;
  balance?: number; // RegisterL1ValidatorTx: initial nAVAX balance
  proofOfPossession?: number[] | string; // RegisterL1ValidatorTx: BLS PoP (json = byte array)
  message?: string; // Register/SetWeight: the signed Warp message, hex
}

export interface SubnetInfo {
  isPermissioned: boolean;
  controlKeys: string[];
  threshold: string;
  conversionID?: string;
  managerChainID?: string;
  managerAddress?: string | null;
}

/** A live delegation riding a Primary Network validator; only present
 *  when platform.getCurrentValidators is asked about specific nodeIDs. */
export interface CurrentDelegator {
  txID: string;
  startTime: string;
  endTime: string;
  weight?: string;
  /** nAVAX this delegation earns if it serves its full period */
  potentialReward?: string;
  rewardOwner?: PchainOwner;
}

/** platform.getCurrentValidators entry — L1 validators carry validationID
 *  and balance; legacy subnet validators carry txID/start/end instead.
 *  Primary Network validators additionally carry the reward plumbing the
 *  indexer doesn't mirror: who gets paid, and the BLS identity. */
export interface CurrentValidator {
  nodeID: string;
  weight: string;
  balance?: string; // nAVAX
  validationID?: string;
  txID?: string;
  startTime?: string;
  /** nAVAX this validation earns if it serves its full period */
  potentialReward?: string;
  /** percentage string (e.g. "2.0000") the validator keeps from delegator rewards */
  delegationFee?: string;
  delegators?: CurrentDelegator[];
  publicKey?: string;
  remainingBalanceOwner?: PchainOwner;
  deactivationOwner?: PchainOwner;
  /** Primary Network: where the validator's own staking reward pays out */
  validationRewardOwner?: PchainOwner;
  /** Primary Network: where the delegation-fee cut pays out */
  delegationRewardOwner?: PchainOwner;
  /** pre-Banff validators carry a single rewardOwner instead of the split pair */
  rewardOwner?: PchainOwner;
  /** BLS public key + proof of possession */
  signer?: { publicKey: string; proofOfPossession: string };
}

/** Total nAVAX staked on the Primary Network right now — the denominator
 *  for a validator's network share. */
export async function getPrimaryTotalStake(network: string): Promise<number | null> {
  const r = await rpc<{ stake?: string; weight?: string }>(network, "platform.getTotalStake", {
    subnetID: PRIMARY_SUBNET_ID,
  });
  const raw = r?.stake ?? r?.weight;
  const n = raw !== undefined ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
}

async function rpc<T>(network: string, method: string, params: object): Promise<T | null> {
  try {
    const res = await fetch(`/api/pchain-rpc/${network}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ method, params }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { result?: T; error?: unknown };
    return json.error ? null : (json.result ?? null);
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Reward UTXOs. Staking rewards are minted directly into P-Chain state
   keyed by the reward tx: they are never outputs OF a transaction, so
   the indexer's emittedUtxos is always empty for reward txs and the only
   source is platform.getRewardUTXOs. The method refuses encoding=json,
   so the hex payload is decoded here: codec(2) txID(32) outputIndex(4)
   assetID(32) typeID(4) amount(8) locktime(8) threshold(4) nAddrs(4)
   addr(20)×n checksum(4).                                              */

export interface RewardUtxo {
  outputIndex: number;
  /** nAVAX */
  amount: number;
  locktime: number;
  threshold: number;
  /** bech32 P-chain addresses (P-avax1… / P-fuji1…) */
  addresses: string[];
}

const BECH32_HRP: Record<string, string> = { mainnet: "avax", fuji: "fuji" };

function decodeRewardUtxo(hex: string, hrp: string): RewardUtxo | null {
  try {
    const raw = hex.startsWith("0x") ? hex.slice(2) : hex;
    const bytes = new Uint8Array(raw.length / 2);
    for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(raw.slice(i * 2, i * 2 + 2), 16);
    const view = new DataView(bytes.buffer);
    let o = 2 + 32; // codec version + txID
    const outputIndex = view.getUint32(o);
    o += 4 + 32; // output index + assetID
    const typeID = view.getUint32(o);
    o += 4;
    if (typeID !== 7) return null; // only secp256k1 transfer outputs expected
    const amount = Number(view.getBigUint64(o));
    o += 8;
    const locktime = Number(view.getBigUint64(o));
    o += 8;
    const threshold = view.getUint32(o);
    o += 4;
    const nAddrs = view.getUint32(o);
    o += 4;
    const addresses: string[] = [];
    for (let i = 0; i < nAddrs; i++) {
      const addr = bytes.slice(o, o + 20);
      o += 20;
      addresses.push(`P-${bech32.encode(hrp, bech32.toWords(addr))}`);
    }
    return { outputIndex, amount, locktime, threshold, addresses };
  } catch {
    return null;
  }
}

export async function getRewardUtxos(network: string, txID: string): Promise<RewardUtxo[] | null> {
  const r = await rpc<{ utxos?: string[] }>(network, "platform.getRewardUTXOs", {
    txID,
    encoding: "hex",
  });
  if (!r?.utxos) return null;
  const hrp = BECH32_HRP[network] ?? network;
  return r.utxos
    .map((u) => decodeRewardUtxo(u, hrp))
    .filter((u): u is RewardUtxo => u !== null)
    .sort((a, b) => a.outputIndex - b.outputIndex);
}

export async function getPlatformTx(network: string, txID: string): Promise<PlatformUnsignedTx | null> {
  const r = await rpc<{ tx?: { unsignedTx?: PlatformUnsignedTx } }>(network, "platform.getTx", {
    txID,
    encoding: "json",
  });
  return r?.tx?.unsignedTx ?? null;
}

export async function getSubnetInfo(network: string, subnetID: string): Promise<SubnetInfo | null> {
  return rpc<SubnetInfo>(network, "platform.getSubnet", { subnetID });
}

export interface L1ValidatorInfo {
  nodeID: string;
  subnetID: string;
  weight?: string | number;
  /** nAVAX prepaid toward the continuous fee */
  balance?: string | number;
}

/** Resolves an ACP-77 validationID to the seat's live nodeID/subnetID.
 *  The node only answers while the seat is active — a removed validator
 *  errors, which surfaces here as null. */
export async function getL1Validator(network: string, validationID: string): Promise<L1ValidatorInfo | null> {
  const r = await rpc<L1ValidatorInfo>(network, "platform.getL1Validator", { validationID });
  return r?.nodeID ? r : null;
}

/** ACP-77 L1 validator fee market: `price` is the continuous fee every L1
 *  validator seat pays right now, in nAVAX per second, burned from the
 *  seat's prepaid balance. */
export interface ValidatorFeeState {
  excess: number;
  /** nAVAX per second per seat */
  price: number;
  timestamp: string;
}

export async function getValidatorFeeState(network: string): Promise<ValidatorFeeState | null> {
  const r = await rpc<{ excess?: number | string; price?: number | string; timestamp?: string }>(
    network,
    "platform.getValidatorFeeState",
    {},
  );
  if (!r || r.price === undefined) return null;
  const price = Number(r.price);
  if (!Number.isFinite(price)) return null;
  return { excess: Number(r.excess ?? 0), price, timestamp: r.timestamp ?? "" };
}

export async function getCurrentValidators(
  network: string,
  subnetID: string,
  nodeIDs?: string[],
): Promise<CurrentValidator[] | null> {
  const r = await rpc<{ validators?: CurrentValidator[] }>(network, "platform.getCurrentValidators", {
    subnetID,
    ...(nodeIDs?.length ? { nodeIDs } : {}),
  });
  return r?.validators ?? null;
}

/** The Primary Network's subnetID — implicit in genesis, so it has no
 *  creating transaction to link to. */
export const PRIMARY_SUBNET_ID = "11111111111111111111111111111111LpoYY";

/** Well-known VM IDs → human names. */
export const VM_NAMES: Record<string, string> = {
  srEXiWaHuhNyGwPUi444Tu47ZEDwxTWrbQiuD7FmgSAQ6X7Dy: "Subnet-EVM",
  mgj786NP7uDwBCcq6YwThhaN8FLyybkCa4zBWTQbNgmK6k9A6: "Coreth (EVM)",
  qBWc8pTPWBB4nkmS4dEcvcapPtA1CvOZfBTS5cAeGrRLbFVpP: "HyperSDK",
};

// --- hex → CB58 NodeID (the node's json encoding returns L1 validator
// nodeIDs as raw hex; explorer routes speak "NodeID-…") -------------------

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function base58(bytes: Uint8Array): string {
  let n = 0n;
  for (const b of bytes) n = (n << 8n) | BigInt(b);
  let out = "";
  while (n > 0n) {
    out = B58[Number(n % 58n)] + out;
    n /= 58n;
  }
  for (const b of bytes) {
    if (b !== 0) break;
    out = "1" + out;
  }
  return out;
}

/** CB58 → 0x-hex payload (checksum dropped, not verified — used only to
 *  match P-Chain blockchain IDs against the catalog's hex encoding). */
export function cb58ToHex(cb58: string): string | null {
  let n = 0n;
  for (const ch of cb58) {
    const i = B58.indexOf(ch);
    if (i < 0) return null;
    n = n * 58n + BigInt(i);
  }
  let leading = 0;
  for (const ch of cb58) {
    if (ch !== "1") break;
    leading++;
  }
  let hex = n.toString(16);
  if (hex.length % 2) hex = "0" + hex;
  if (hex === "00") hex = "";
  hex = "00".repeat(leading) + hex;
  if (hex.length <= 8) return null; // must contain payload beyond the checksum
  return "0x" + hex.slice(0, -8);
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/^0x/, "");
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

export function bytesToHex(bytes: Uint8Array | number[]): string {
  return "0x" + Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** bytes → CB58 (payload + 4-byte sha256 checksum). */
export async function bytesToCb58(bytes: Uint8Array): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes as BufferSource));
  const withChecksum = new Uint8Array(bytes.length + 4);
  withChecksum.set(bytes);
  withChecksum.set(digest.slice(-4), bytes.length);
  return base58(withChecksum);
}

/** "0x4a81…0762" → "NodeID-…". */
export async function hexToNodeId(hex: string): Promise<string> {
  return `NodeID-${await bytesToCb58(hexToBytes(hex))}`;
}

// --- ACP-77 Warp message decoding ----------------------------------------
// RegisterL1ValidatorTx / SetL1ValidatorWeightTx carry a signed Warp
// message whose AddressedCall payload holds the actual inputs. The codec
// is AvalancheGo's: big-endian, u32 length prefixes.

export interface DecodedRegisterL1Validator {
  kind: "register";
  sourceChainId: string; // CB58 — the chain whose manager emitted the message
  sourceAddress: string; // hex — the validator manager contract
  subnetId: string; // CB58
  nodeId: string; // NodeID-…
  blsPublicKey: string; // hex, 48 bytes
  expiry: number; // unix seconds
  weight: number;
  remainingBalanceOwner: { threshold: number; addresses: string[] };
  disableOwner: { threshold: number; addresses: string[] };
}

export interface DecodedL1ValidatorWeight {
  kind: "weight";
  sourceChainId: string;
  sourceAddress: string;
  validationId: string; // CB58
  nonce: number;
  weight: number;
}

export type DecodedL1WarpMessage = DecodedRegisterL1Validator | DecodedL1ValidatorWeight;

class ByteReader {
  private view: DataView;
  private off = 0;
  constructor(private bytes: Uint8Array) {
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }
  u16() {
    const v = this.view.getUint16(this.off);
    this.off += 2;
    return v;
  }
  u32() {
    const v = this.view.getUint32(this.off);
    this.off += 4;
    return v;
  }
  u64(): number {
    const v = this.view.getBigUint64(this.off);
    this.off += 8;
    return Number(v);
  }
  take(n: number): Uint8Array {
    const v = this.bytes.slice(this.off, this.off + n);
    this.off += n;
    if (v.length !== n) throw new Error("short read");
    return v;
  }
}

async function readOwner(r: ByteReader): Promise<{ threshold: number; addresses: string[] }> {
  const threshold = r.u32();
  const count = r.u32();
  const addresses: string[] = [];
  for (let i = 0; i < count; i++) addresses.push(await bytesToCb58(r.take(20)));
  return { threshold, addresses };
}

/** Decode the signed Warp message of a Register/SetWeight L1 tx. Returns
 *  null on anything unexpected — the panel is additive, never a blocker. */
export async function decodeL1WarpMessage(messageHex: string): Promise<DecodedL1WarpMessage | null> {
  try {
    const r = new ByteReader(hexToBytes(messageHex));
    r.u16(); // warp codec version
    r.u32(); // networkID
    const sourceChainId = await bytesToCb58(r.take(32));
    r.u32(); // payload length
    r.u16(); // addressed-call codec version
    if (r.u32() !== 1) return null; // AddressedCall typeID
    const sourceAddress = bytesToHex(r.take(r.u32()));
    r.u32(); // inner payload length
    r.u16(); // payload codec version
    const typeId = r.u32();

    if (typeId === 1) {
      // RegisterL1ValidatorMessage
      const subnetId = await bytesToCb58(r.take(32));
      const nodeId = `NodeID-${await bytesToCb58(r.take(r.u32()))}`;
      const blsPublicKey = bytesToHex(r.take(48));
      const expiry = r.u64();
      const remainingBalanceOwner = await readOwner(r);
      const disableOwner = await readOwner(r);
      const weight = r.u64();
      return {
        kind: "register",
        sourceChainId,
        sourceAddress,
        subnetId,
        nodeId,
        blsPublicKey,
        expiry,
        weight,
        remainingBalanceOwner,
        disableOwner,
      };
    }
    if (typeId === 3) {
      // L1ValidatorWeightMessage
      const validationId = await bytesToCb58(r.take(32));
      const nonce = r.u64();
      const weight = r.u64();
      return { kind: "weight", sourceChainId, sourceAddress, validationId, nonce, weight };
    }
    return null;
  } catch {
    return null;
  }
}
