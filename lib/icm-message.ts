/**
 * One ICM (Teleporter) message, as stats-api's /icm-api/message/{id} reports it.
 *
 * The API answers from our own raw_logs, so it sees only the hops that landed on
 * a chain we index. A message sent from an L1 we don't ingest into the C-Chain
 * comes back with its delivery side filled in and no send — that is a complete
 * answer about what we know, not a partial one. The UI says which side is
 * missing rather than implying the message is stuck.
 */

import { CB58ToHex } from "@avalanche-sdk/client/utils";
import l1ChainsData from "@/constants/l1-chains.json";
import type { L1Chain } from "@/types/stats";

export type IcmStatus = "executed" | "executionFailed" | "delivered" | "sent";

export interface IcmEvent {
  event: string;
  evmChainId: number;
  txHash: string;
  blockNumber: number;
  timestamp: number;
  logIndex: number;
  contractAddress: string;
  counterpartyBlockchainId?: string;
  deliverer?: string;
}

export interface IcmMessage {
  messageId: string;
  status: IcmStatus;
  deliveryTxHash?: string;
  deliveredOnEvmChainId?: number;
  deliverer?: string;
  sourceBlockchainId?: string;
  sourceEvmChainId?: number;
  sendTxHash?: string;
  destinationBlockchainId?: string;
  destinationEvmChainId?: number;
  /** only set on "sent": false means the destination is a chain we cannot see */
  destinationIndexed?: boolean;
  events: IcmEvent[];
}

/** The TeleporterMessenger address is the same on every chain, and these are the four lifecycle events. */
export const TELEPORTER_ADDRESS = "0x253b2784c75e510dd0ff1da844684a1ac0aa5fcf";

export const ICM_EVENT_BY_TOPIC: Record<string, string> = {
  "0x2a211ad4a59ab9d003852404f9c57c690704ee755f3c79d2c2812ad32da99df8": "SendCrossChainMessage",
  "0x292ee90bbaf70b5d4936025e09d56ba08f3e421156b6a568cf3c2840d9343e34": "ReceiveCrossChainMessage",
  "0x34795cc6b122b9a0ae684946319f1e14a577b4e8f9b3dda9ac94c21a54d3188c": "MessageExecuted",
  "0x4619adc1017b82e02eaefac01a43d50d6d8de4460774bc370c3ff0210d40c985": "MessageExecutionFailed",
};

export const ICM_STATUS_LABEL: Record<IcmStatus, string> = {
  executed: "Executed",
  executionFailed: "Execution failed",
  delivered: "Delivered",
  sent: "In flight",
};

/** Chain resolution */

export interface IcmChain {
  evmChainId?: number;
  name: string;
  href?: string;
  logoURI?: string;
  blockchainId?: string;
}

function hexKey(id: string): string | null {
  const hex = toHexBlockchainId(id);
  return hex ? hex.slice(2).toUpperCase() : null;
}

/**
 * A blockchain ID in the form the catalog stores: 0x-prefixed lowercase hex.
 * Accepts either encoding, since the API speaks CB58 and l1-chains.json is hex.
 */
export function toHexBlockchainId(id: string): string | undefined {
  try {
    const hex = id.startsWith("0x") || id.startsWith("0X") ? id.slice(2) : CB58ToHex(id).slice(2);
    return /^[0-9a-fA-F]{64}$/.test(hex) ? `0x${hex.toLowerCase()}` : undefined;
  } catch {
    return undefined;
  }
}

const CATALOG = l1ChainsData as L1Chain[];

const byEvmId = new Map<number, L1Chain>();
const byBlockchainHex = new Map<string, L1Chain>();
for (const c of CATALOG) {
  const id = Number(c.chainId);
  if (Number.isFinite(id) && !byEvmId.has(id)) byEvmId.set(id, c);
  const key = c.blockchainId ? hexKey(c.blockchainId) : null;
  if (key && !byBlockchainHex.has(key)) byBlockchainHex.set(key, c);
}

function entryHref(c: L1Chain): string | undefined {
  if (c.isIndexed === false || !c.slug) return undefined;
  return `/explorer/${c.isTestnet === true ? "fuji" : "mainnet"}/${c.slug}`;
}

/**
 * Name one end of a hop. Prefers the EVM chain ID the API resolved; falls back
 * to the blockchain ID, which is all we have when the chain is one we don't
 * index. Returns null only when neither identifier was reported.
 */
export function resolveIcmChain(evmChainId?: number, blockchainId?: string): IcmChain | null {
  const entry =
    (evmChainId ? byEvmId.get(evmChainId) : undefined) ??
    (blockchainId ? byBlockchainHex.get(hexKey(blockchainId) ?? "") : undefined);

  if (entry) {
    return {
      evmChainId: Number(entry.chainId) || evmChainId,
      name: entry.chainName,
      href: entryHref(entry),
      logoURI: entry.chainLogoURI || undefined,
      blockchainId,
    };
  }
  if (evmChainId) return { evmChainId, name: `Chain ${evmChainId}`, blockchainId };
  if (blockchainId) return { name: "Unknown chain", blockchainId };
  return null;
}

/** A transaction's URL on a chain, when that chain has an explorer route here. */
export function icmTxHref(chain: IcmChain | null, txHash?: string): string | undefined {
  if (!chain?.href || !txHash) return undefined;
  return `${chain.href}/tx/${txHash}`;
}

/** Identifiers */

/** Accepts a message ID with or without 0x; returns lowercase 0x-prefixed. */
export function normalizeMessageId(raw: string): string | null {
  const s = raw.trim().replace(/^0[xX]/, "").toLowerCase();
  return /^[0-9a-f]{64}$/.test(s) ? `0x${s}` : null;
}
