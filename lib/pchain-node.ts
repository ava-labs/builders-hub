// Client helpers for the AvalancheGo P-Chain RPC (via /api/pchain-rpc).
// These fill the gaps the indexer leaves: decoded platform-op inputs
// (ConvertSubnetToL1Tx validator sets, manager pointers), subnet/L1
// conversion state, and live L1 validator sets.

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

/** platform.getCurrentValidators entry — L1 validators carry validationID
 *  and balance; legacy subnet validators carry txID/start/end instead. */
export interface CurrentValidator {
  nodeID: string;
  weight: string;
  balance?: string; // nAVAX
  validationID?: string;
  startTime?: string;
  publicKey?: string;
  remainingBalanceOwner?: PchainOwner;
  deactivationOwner?: PchainOwner;
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
