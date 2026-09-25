import { toHexBlockchainId } from "@/lib/icm-message";

/**
 * Translate a stats-api ICM page into the shape the feed's row component reads.
 */

export const DEFAULT_ICM_PAGE = 25;
export const MAX_ICM_PAGE = 100;

/**
 * ClickHouse either answers or it does not, so there is no middle state.
 * "unavailable" is a real answer the UI has to show rather than quietly render as "no messages".
 */
export type IcmFeedStatus = "ok" | "unavailable";

/** A single ICM message, in the shape the feed's row component reads. */
export interface IcmFeedMessage {
  hash: string;
  from: string;
  to: string | null;
  value: string;
  blockNumber: string;
  timestamp: string;
  isCrossChain: true;
  sourceBlockchainId?: string;
  destinationBlockchainId?: string;
}

export interface IcmFeedPage {
  status: IcmFeedStatus;
  messages: IcmFeedMessage[];
  /** Pass back as `beforeBlock` for the next page; null when nothing is older. */
  nextBeforeBlock: number | null;
  exhausted: boolean;
}

export interface StatsFeedMessage {
  hash: string;
  from: string;
  to?: string;
  /** wei, decimal string */
  value: string;
  blockNumber: number;
  /** unix seconds */
  timestamp: number;
  direction: "in" | "out";
  messageId?: string;
  counterpartyBlockchainId?: string;
}

export interface StatsFeedPage {
  chainId: number;
  messages: StatsFeedMessage[];
  nextBeforeBlock: number | null;
  exhausted: boolean;
}

export function weiToEther(wei: string): string {
  try {
    return (Number(BigInt(wei)) / 1e18).toFixed(6);
  } catch {
    return "0.000000";
  }
}

export function mapStatsFeedPage(page: StatsFeedPage, blockchainId?: string): IcmFeedPage {
  const own = blockchainId ? toHexBlockchainId(blockchainId) : undefined;

  const messages: IcmFeedMessage[] = page.messages.map((m) => {
    const other = m.counterpartyBlockchainId
      ? toHexBlockchainId(m.counterpartyBlockchainId)
      : undefined;
    const outgoing = m.direction === "out";
    return {
      hash: m.hash,
      from: m.from,
      to: m.to ?? null,
      value: weiToEther(m.value),
      blockNumber: String(m.blockNumber),
      timestamp: new Date(m.timestamp * 1000).toISOString(),
      isCrossChain: true,
      sourceBlockchainId: outgoing ? own : other,
      destinationBlockchainId: outgoing ? other : own,
    };
  });

  return {
    status: "ok",
    messages,
    nextBeforeBlock: page.nextBeforeBlock,
    exhausted: page.exhausted,
  };
}
