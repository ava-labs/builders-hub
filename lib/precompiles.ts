/* The stateful precompiles: contracts built into the EVM at fixed
   addresses. Subnet-EVM reserves 0x0200…0000 to 0x0200…0005 on every L1;
   the C-Chain (coreth) carries only the Warp Messenger. A precompile
   answers to an interface like any contract, but it has no source to
   verify, so its ABI comes from here: contracts/precompiles holds
   Subnet-EVM's own (avalanchego graft/subnet-evm/precompile, the I*.abi
   files). Pure: no fetches, safe on the server and in the browser. */

import { decodeEventLog, decodeFunctionData, type Abi, type Hex } from "viem";
import AllowList from "@/contracts/precompiles/AllowList.json";
import FeeManager from "@/contracts/precompiles/FeeManager.json";
import NativeMinter from "@/contracts/precompiles/NativeMinter.json";
import RewardManager from "@/contracts/precompiles/RewardManager.json";
import WarpMessenger from "@/contracts/precompiles/WarpMessenger.json";

export interface Precompile {
  label: string;
  note: string;
  /** the interface its calls and logs decode against */
  abi: Abi;
}

const WARP = "0x0200000000000000000000000000000000000005";

const PRECOMPILES: Record<string, Precompile> = {
  "0x0200000000000000000000000000000000000000": {
    label: "Contract Deployer Allow List",
    note: "Built into Subnet-EVM. It sets which addresses can deploy contracts on this L1.",
    abi: AllowList.abi as Abi,
  },
  "0x0200000000000000000000000000000000000001": {
    label: "Native Minter",
    note: "Built into Subnet-EVM. Its admins and enabled addresses mint this L1's native coin.",
    abi: NativeMinter.abi as Abi,
  },
  "0x0200000000000000000000000000000000000002": {
    label: "Transaction Allow List",
    note: "Built into Subnet-EVM. It sets which addresses can send transactions on this L1.",
    abi: AllowList.abi as Abi,
  },
  "0x0200000000000000000000000000000000000003": {
    label: "Fee Manager",
    note: "Built into Subnet-EVM. Its admins and enabled addresses set this L1's fee config.",
    abi: FeeManager.abi as Abi,
  },
  "0x0200000000000000000000000000000000000004": {
    label: "Reward Manager",
    note: "Built into Subnet-EVM. It sends this L1's fees to a reward address or to the block producers, or burns them.",
    abi: RewardManager.abi as Abi,
  },
  [WARP]: {
    label: "Warp Messenger",
    note: "Built into the chain's EVM. It sends and verifies Avalanche Warp Messages, which carry Interchain Messaging.",
    abi: WarpMessenger.abi as Abi,
  },
};

/** the C-Chain, mainnet and Fuji */
const C_CHAIN = new Set(["43114", "43113"]);

/** the precompile at this address, when this chain carries one there */
export function precompileAt(chainId: string | number | null | undefined, addr: string | null | undefined): Precompile | undefined {
  if (chainId == null || !addr) return undefined;
  const a = addr.toLowerCase();
  if (C_CHAIN.has(String(chainId)) && a !== WARP) return undefined;
  return PRECOMPILES[a];
}

/** an allow-list role by its number (Subnet-EVM precompile/allowlist/role.go);
 *  the function that gives a role is "set" and its name */
export const ROLES = ["None", "Enabled", "Admin", "Manager"];

/** the fee config's fields in the ABI's order, with the Console's names */
export const FEE_FIELDS = [
  { name: "gasLimit", label: "Gas limit" },
  { name: "targetBlockRate", label: "Target block rate" },
  { name: "minBaseFee", label: "Min base fee" },
  { name: "targetGas", label: "Target gas" },
  { name: "baseFeeChangeDenominator", label: "Base fee change denominator" },
  { name: "minBlockGasCost", label: "Min block gas cost" },
  { name: "maxBlockGasCost", label: "Max block gas cost" },
  { name: "blockGasCostStep", label: "Block gas cost step" },
] as const;

/** how a precompile parameter reads, by its name in the ABIs: an amount
 *  of the native coin, a role, a gas price, seconds, or as it is */
export function paramUnit(name: string): "native" | "role" | "gasPrice" | "seconds" | null {
  if (name === "amount") return "native";
  if (name === "role" || name === "oldRole") return "role";
  if (name === "minBaseFee") return "gasPrice";
  if (name === "targetBlockRate") return "seconds";
  return null;
}

/** one change a precompile made in a transaction. `at` is the precompile,
 *  `by` is its caller: the sender, or a contract the sender called. A fee
 *  change holds every field of the config; `was` is null when only the
 *  call, not the log, says what changed. */
export type PrecompileAct =
  | { kind: "mint"; at: string; by: string; to: string; amount: bigint }
  | { kind: "role"; at: string; by: string; account: string; role: number; was: number | null }
  | { kind: "fees"; at: string; by: string; fields: { name: string; was: bigint | null; now: bigint }[] }
  | { kind: "rewardAddress"; at: string; by: string; to: string; was: string | null }
  | { kind: "feeRecipients"; at: string; by: string }
  | { kind: "burnFees"; at: string; by: string }
  | { kind: "warp"; at: string; by: string };

interface Log {
  address: string;
  topics: string[];
  data: string;
}

const lower = (v: unknown) => String(v).toLowerCase();

/** the change one precompile log records */
function actOfLog(at: string, abi: Abi, log: Log): PrecompileAct | null {
  let ev: { eventName?: string; args?: unknown };
  try {
    ev = decodeEventLog({ abi, topics: log.topics as [Hex, ...Hex[]], data: log.data as Hex });
  } catch {
    return null;
  }
  const a = (ev.args ?? {}) as Record<string, unknown>;
  const by = lower(a.sender);
  switch (ev.eventName) {
    case "NativeCoinMinted":
      return { kind: "mint", at, by, to: lower(a.recipient), amount: a.amount as bigint };
    case "RoleSet":
      return { kind: "role", at, by, account: lower(a.account), role: Number(a.role), was: Number(a.oldRole) };
    case "FeeConfigChanged": {
      const was = a.oldFeeConfig as Record<string, bigint>;
      const now = a.newFeeConfig as Record<string, bigint>;
      return { kind: "fees", at, by, fields: FEE_FIELDS.map((f) => ({ name: f.name, was: was[f.name], now: now[f.name] })) };
    }
    case "RewardAddressChanged":
      return { kind: "rewardAddress", at, by, to: lower(a.newRewardAddress), was: lower(a.oldRewardAddress) };
    case "FeeRecipientsAllowed":
      return { kind: "feeRecipients", at, by };
    case "RewardsDisabled":
      return { kind: "burnFees", at, by };
    case "SendWarpMessage":
      return { kind: "warp", at, by };
  }
  return null;
}

/** the change a direct call to a precompile makes, read from its calldata */
function actOfCall(at: string, abi: Abi, by: string, input: string): PrecompileAct | null {
  let call;
  try {
    call = decodeFunctionData({ abi, data: input as Hex });
  } catch {
    return null;
  }
  const args = (call.args ?? []) as readonly unknown[];
  const fn = call.functionName;
  const role = fn.startsWith("set") ? ROLES.indexOf(fn.slice(3)) : -1;
  if (role >= 0) return { kind: "role", at, by, account: lower(args[0]), role, was: null };
  switch (fn) {
    case "mintNativeCoin":
      return { kind: "mint", at, by, to: lower(args[0]), amount: args[1] as bigint };
    case "setFeeConfig":
      return { kind: "fees", at, by, fields: FEE_FIELDS.map((f, i) => ({ name: f.name, was: null, now: args[i] as bigint })) };
    case "setRewardAddress":
      return { kind: "rewardAddress", at, by, to: lower(args[0]), was: null };
    case "allowFeeRecipients":
      return { kind: "feeRecipients", at, by };
    case "disableRewards":
      return { kind: "burnFees", at, by };
    case "sendWarpMessage":
      return { kind: "warp", at, by };
  }
  return null;
}

/** What the chain's precompiles changed in a transaction. Their logs say
 *  it, calls made through a contract included; Subnet-EVM has emitted
 *  them since Durango. Before that a precompile logged nothing, so a
 *  direct call that succeeded is read from its calldata. A reverted
 *  transaction changed nothing. */
export function precompileActs(
  chainId: string | number,
  tx: { from: string; to?: string | null; input: string; success: boolean; logs: Log[] },
): PrecompileAct[] {
  if (!tx.success) return [];
  const fromLogs = tx.logs.flatMap((log) => {
    const p = precompileAt(chainId, log.address);
    const act = p ? actOfLog(log.address.toLowerCase(), p.abi, log) : null;
    return act ? [act] : [];
  });
  if (fromLogs.length) return fromLogs;
  const p = precompileAt(chainId, tx.to);
  const act = p && tx.to ? actOfCall(tx.to.toLowerCase(), p.abi, tx.from.toLowerCase(), tx.input) : null;
  return act ? [act] : [];
}
