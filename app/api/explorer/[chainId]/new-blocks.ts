/* A chain's new blocks for the All Networks boards, the explorer route's
   blocksOnly diet: the headers after the last block a board has (tx
   hashes, no bodies, no ICM scan) and, when asked, the newest few of their
   transactions, each with its receipt's status. Three reads of the chain's
   RPC: its height, the headers in one batch, and the transactions with
   their receipts in one batch. */

/** a header as the boards read it */
export interface NewBlock {
  number: string;
  hash: string;
  /** ISO time */
  timestamp: string;
  transactionCount: number;
  /** with thousands separators */
  gasUsed: string;
  gasLimit: string;
  /** Avalanche headers carry the time in ms */
  timestampMilliseconds?: number;
}

/** a transaction as a board row shows it */
export interface NewestTx {
  hash: string;
  blockNumber: number;
  txIndex: number;
  /** the block's time, epoch ms */
  timestampMs: number;
  from: string;
  /** "" for contract creation */
  to: string;
  /** wei, decimal string */
  value: string;
  /** 4-byte selector, "" for plain transfers */
  methodId: string;
  success: boolean;
}

export interface NewBlocks {
  blocks: NewBlock[];
  latestBlock: number;
  /** newest first; only when asked for */
  txs?: NewestTx[];
}

/* headers a read returns: the newest after `last`, or the newest when no `last` is given */
const MAX_BLOCKS = 10;
const FIRST_BLOCKS = 6;
const MAX_TXS = 5;

interface RpcHeader {
  number: string;
  hash: string;
  timestamp: string;
  timestampMilliseconds?: string;
  /** a header's transactions are their hashes */
  transactions: string[];
  gasUsed: string;
  gasLimit: string;
}

interface RpcTx {
  hash: string;
  from: string;
  to: string | null;
  value: string;
  input: string;
  transactionIndex: string;
}

const hex = (v: string) => parseInt(v, 16);

/* one JSON-RPC batch: a result for each call, in call order; null for a call that failed */
async function rpcBatch(rpcUrl: string, calls: { method: string; params: unknown[] }[]): Promise<unknown[]> {
  const res = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(calls.map((c, id) => ({ jsonrpc: "2.0", id, ...c }))),
  });
  if (!res.ok) throw new Error(`RPC request failed: ${res.status}`);
  const out = (await res.json()) as { id: number; result?: unknown }[];
  const byId = new Map((Array.isArray(out) ? out : []).map((r) => [r.id, r.result ?? null]));
  return calls.map((_, id) => byId.get(id) ?? null);
}

/* The newest `n` transactions of the headers, newest first, with their
   receipts. A receipt is there as soon as its block is, so each row comes
   with its status. A transaction whose body or receipt does not come back
   is left out, and a batch that fails gives none: the blocks still go out. */
async function newestTxs(rpcUrl: string, headers: RpcHeader[], n: number): Promise<NewestTx[]> {
  const picked = headers.flatMap((b) => [...b.transactions].reverse().map((hash) => ({ hash, block: b }))).slice(0, n);
  if (!picked.length) return [];
  let got: unknown[];
  try {
    got = await rpcBatch(rpcUrl, [
      ...picked.map(({ hash }) => ({ method: "eth_getTransactionByHash", params: [hash] })),
      ...picked.map(({ hash }) => ({ method: "eth_getTransactionReceipt", params: [hash] })),
    ]);
  } catch {
    return [];
  }
  return picked.flatMap(({ block }, i) => {
    const tx = got[i] as RpcTx | null;
    const receipt = got[picked.length + i] as { status: string } | null;
    if (!tx || !receipt) return [];
    return [
      {
        hash: tx.hash,
        blockNumber: hex(block.number),
        txIndex: hex(tx.transactionIndex),
        timestampMs: block.timestampMilliseconds ? hex(block.timestampMilliseconds) : hex(block.timestamp) * 1000,
        from: tx.from,
        to: tx.to ?? "",
        value: BigInt(tx.value).toString(),
        methodId: tx.input && tx.input.length >= 10 ? tx.input.slice(0, 10).toLowerCase() : "",
        success: receipt.status === "0x1",
      },
    ];
  });
}

/** the chain's blocks after `last` (its newest when `last` is not given), newest first, and their newest `txs` transactions */
export async function readNewBlocks(rpcUrl: string, last: number | undefined, txs: number): Promise<NewBlocks> {
  const [height] = await rpcBatch(rpcUrl, [{ method: "eth_blockNumber", params: [] }]);
  if (typeof height !== "string") throw new Error("no block number");
  const latest = hex(height);
  if (last !== undefined && last >= latest) return { blocks: [], latestBlock: latest };
  const count = last !== undefined && last > 0 ? Math.min(latest - last, MAX_BLOCKS) : FIRST_BLOCKS;
  const numbers = Array.from({ length: count }, (_, i) => latest - i).filter((n) => n >= 0);
  const read = await rpcBatch(
    rpcUrl,
    numbers.map((n) => ({ method: "eth_getBlockByNumber", params: [`0x${n.toString(16)}`, false] })),
  );
  const headers = read.filter((b): b is RpcHeader => b !== null);
  const blocks = headers.map((b) => ({
    number: hex(b.number).toString(),
    hash: b.hash,
    timestamp: new Date(hex(b.timestamp) * 1000).toISOString(),
    transactionCount: b.transactions?.length || 0,
    gasUsed: hex(b.gasUsed).toLocaleString(),
    gasLimit: hex(b.gasLimit).toLocaleString(),
    timestampMilliseconds: b.timestampMilliseconds ? hex(b.timestampMilliseconds) : undefined,
  }));
  const want = Math.min(Math.max(txs, 0), MAX_TXS);
  return want > 0 ? { blocks, latestBlock: latest, txs: await newestTxs(rpcUrl, headers, want) } : { blocks, latestBlock: latest };
}
