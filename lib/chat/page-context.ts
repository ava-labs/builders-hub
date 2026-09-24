/* Which page the visitor has open, and what that page shows.

   The chat client sends only the pathname. This module turns it into a
   page reference; `pageBrief` writes the short "you are here" block the
   system prompt always carries (identity plus a cheap header read), and
   `loadPageData` fetches the page's own data when the model asks for it:
   the decoded call tree of a transaction, a block, an account, the AVAX
   token figures, a docs page. Server only: it talks to the chain RPC, the
   explorer's own API routes and Sourcify. */

import {
  decodeEventLog,
  decodeFunctionData,
  decodeFunctionResult,
  formatUnits,
  parseAbiItem,
  toEventSelector,
  toFunctionSelector,
  type Abi,
  type AbiEvent,
  type AbiFunction,
} from "viem";
import type { L1Chain } from "@/types/stats";
import { resolveCatalogChain, wantsTestnet } from "@/lib/explorer-catalog";
import { isGenesisCode, knownAddress } from "@/lib/evm-explorer";
import { balanceChanges, hexBig, hexInt, type TraceFrame, type TraceResponse } from "@/lib/trace";
import { getVerifiedContractResolvingProxies } from "@/lib/sourcify";
import { decodeEventLog as registryDecodeEvent, decodeFunctionInput as registryDecodeInput } from "@/abi/event-signatures.generated";
import { docsTools } from "@/lib/mcp/tools";
import { HELICON_ACTIVATION } from "@/constants/helicon";

/* ------------------------------------------------------------------ */
/* page references                                                     */

type Network = "mainnet" | "fuji";

export interface ChainScope {
  network: Network;
  slug: string;
  chain: L1Chain | undefined;
  chainId: string | null;
  rpcUrl: string | null;
  /** e.g. /explorer/mainnet/c-chain */
  base: string;
}

export type PageRef =
  | { kind: "evm-tx"; path: string; scope: ChainScope; hash: string }
  | { kind: "evm-block"; path: string; scope: ChainScope; number: number }
  | { kind: "evm-address"; path: string; scope: ChainScope; address: string }
  | { kind: "evm-section"; path: string; scope: ChainScope; section: string }
  | { kind: "network"; path: string; network: Network; section: string }
  | { kind: "icm-message"; path: string; network: Network; id: string }
  | { kind: "pchain"; path: string; network: Network; section: string; id?: string }
  | { kind: "xchain"; path: string; network: Network; section: string; id?: string }
  | { kind: "doc"; path: string }
  | { kind: "site"; path: string };

const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const TX_HASH = /^0x[0-9a-fA-F]{64}$/;

/** the page a pathname addresses; null when the path is not one the
 *  chat should know about (the chat page itself, malformed input) */
export function parsePageRef(raw: unknown): PageRef | null {
  if (typeof raw !== "string" || raw.length > 400 || !raw.startsWith("/")) return null;
  let path = raw.split(/[?#]/)[0].replace(/\/+$/, "") || "/";
  try {
    path = decodeURIComponent(path);
  } catch {
    return null;
  }
  if (/[\s<>"']/.test(path)) return null;
  const seg = path.split("/").filter(Boolean);
  if (seg[0] === "chat") return null;

  if (seg[0] === "explorer") {
    const network: Network = wantsTestnet(seg[1] ?? "") ? "fuji" : "mainnet";
    if (!seg[1]) return { kind: "network", path, network, section: "portal" };
    const second = seg[2];
    if (!second) return { kind: "network", path, network, section: "" };
    if (second === "p-chain" || second === "x-chain") {
      const kind = second === "p-chain" ? "pchain" : "xchain";
      return { kind, path, network, section: seg[3] ?? "", id: seg[4] };
    }
    if (second === "icm" && seg[3]) return { kind: "icm-message", path, network, id: seg[3] };
    if (["token", "chains", "validators", "icm", "apps", "stablecoins"].includes(second) && !seg[3]) {
      return { kind: "network", path, network, section: second };
    }
    const chain = resolveCatalogChain(seg[1], second);
    const scope: ChainScope = {
      network,
      slug: second,
      chain,
      chainId: chain?.chainId ?? null,
      rpcUrl: chain?.rpcUrl ?? null,
      base: `/explorer/${seg[1]}/${second}`,
    };
    const third = seg[3];
    const id = seg[4];
    if (third === "tx" && id && TX_HASH.test(id)) return { kind: "evm-tx", path, scope, hash: id.toLowerCase() };
    if (third === "block" && id && /^\d+$/.test(id)) return { kind: "evm-block", path, scope, number: Number(id) };
    if (third === "address" && id && ADDRESS.test(id)) return { kind: "evm-address", path, scope, address: id };
    return { kind: "evm-section", path, scope, section: seg.slice(3).join("/") };
  }

  if (["docs", "academy", "integrations", "guides", "blog"].includes(seg[0])) return { kind: "doc", path };
  return { kind: "site", path };
}

/* ------------------------------------------------------------------ */
/* fetch helpers                                                       */

async function rpc<T>(url: string, method: string, params: unknown[], timeoutMs = 8_000): Promise<T | null> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { result?: T; error?: unknown };
    return body.error ? null : (body.result ?? null);
  } catch {
    return null;
  }
}

async function getJson<T>(url: string, timeoutMs = 10_000): Promise<T | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), headers: { accept: "application/json" } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

const withTimeout = <T>(p: Promise<T>, ms: number, fallback: T): Promise<T> =>
  Promise.race([p, new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms))]);

/* ------------------------------------------------------------------ */
/* formatting                                                          */

const num = (n: number | bigint) => n.toLocaleString("en-US");
const pct = (a: number, b: number) => (b > 0 ? `${((100 * a) / b).toFixed(a / b < 0.1 ? 1 : 0)}%` : "n/a");
const iso = (unixSeconds: number) => new Date(unixSeconds * 1000).toISOString().replace(".000Z", "Z");

/** a token or coin amount with the noise cut: 6 decimals at most */
function amount(v: bigint, decimals: number): string {
  const neg = v < 0n;
  const s = formatUnits(neg ? -v : v, decimals);
  const [i, f = ""] = s.split(".");
  const frac = f.slice(0, 6).replace(/0+$/, "");
  return `${neg ? "-" : ""}${BigInt(i).toLocaleString("en-US")}${frac ? `.${frac}` : ""}`;
}

const nativeSymbol = (scope: ChainScope) => scope.chain?.networkToken?.symbol ?? "native coin";

function chainName(scope: ChainScope): string {
  const name = scope.chain?.chainName ?? scope.slug;
  return `${name} (${scope.network}${scope.chainId ? `, chain id ${scope.chainId}` : ""})`;
}

/* ------------------------------------------------------------------ */
/* glossary the prompt carries for pages that show gas                 */

const CONTINUOUS_EXECUTION_CHAINS = new Set(["43114", "43113"]);

const heliconLive = (scope: ChainScope, unixSeconds?: number) =>
  !!scope.chainId && CONTINUOUS_EXECUTION_CHAINS.has(scope.chainId) && (unixSeconds === undefined || unixSeconds * 1000 >= HELICON_ACTIVATION[scope.network]);

const GAS_GLOSSARY = `Gas vocabulary on this chain (ACP-194, Continuous Execution, live since the Helicon upgrade):
- Gas reserved: the sum of the gas limits of a block's transactions. It is what fills a block and what the block header reports as gasUsed.
- Gas charged: what the sender pays for, max(gas used, half the gas limit). It is the receipt's gasUsed. Fee = gas charged x effective gas price.
- Gas used: what execution consumed: intrinsic gas + opcode costs. Since Helicon the EVM credits no storage refund, so gas charged equals gas used unless the half-limit floor applied. Only the execution trace knows the split.
- A transaction is FINAL the moment its block is accepted. The state root commits a few blocks later; that is bookkeeping, not finality. Say "state root pending" or "state root committed", never "settled" or "waiting".`;

/* ------------------------------------------------------------------ */
/* the brief: cheap, on every request                                  */

interface RpcTx {
  hash: string;
  blockNumber: string | null;
  from: string;
  to: string | null;
  value: string;
  gas: string;
  input: string;
  nonce: string;
}
interface RpcReceipt {
  status: string;
  gasUsed: string;
  effectiveGasPrice: string;
  contractAddress: string | null;
  logs: { address: string; topics: string[]; data: string }[];
}
interface RpcBlock {
  number: string;
  hash: string;
  parentHash: string;
  timestamp: string;
  gasUsed: string;
  gasLimit: string;
  baseFeePerGas?: string;
  miner: string;
  size?: string;
  blockGasCost?: string;
  extDataGasUsed?: string;
  transactions: (string | RpcTx)[];
}

const explorerLinks = (scope: ChainScope) =>
  `Link things on this chain as ${scope.base}/address/0x..., ${scope.base}/tx/0x..., ${scope.base}/block/N.`;

/** what the system prompt says about the open page. Never throws. */
export async function pageBrief(ref: PageRef, baseUrl: string): Promise<string> {
  const lines: string[] = ["=== CURRENT PAGE ===", `The user has ${ref.path} open on build.avax.network.`];
  try {
    switch (ref.kind) {
      case "evm-tx": {
        lines.push(`It is the page of transaction ${ref.hash} on ${chainName(ref.scope)}.`);
        const head = ref.scope.rpcUrl ? await withTimeout(txHeadline(ref.scope, ref.hash), 3_000, null) : null;
        if (head) lines.push(head.text);
        lines.push(
          "The page shows: a status row (Final or Reverted), the state root row, sender and target, value, gas, then tabs: Call Trace (the decoded internal calls with gas per frame), Events, Balance Changes, State, Gas (a flame graph of gas per call).",
          "Call page_data before you explain what this transaction did, its calls, events, balance changes or gas. Use the contract names and token symbols it returns; never invent addresses or figures.",
          explorerLinks(ref.scope),
        );
        if (heliconLive(ref.scope, head?.timestamp)) lines.push(GAS_GLOSSARY);
        break;
      }
      case "evm-block": {
        lines.push(`It is the page of block #${num(ref.number)} on ${chainName(ref.scope)}.`);
        lines.push(
          "The page shows the block's transactions, a gas map of the block (gas charged per transaction), the proposer node, timing, and the block's lifecycle (accepted, executed, state root committed).",
          "Call page_data before you explain the block, its transactions, its gas or its proposer.",
          explorerLinks(ref.scope),
        );
        if (heliconLive(ref.scope)) lines.push(GAS_GLOSSARY);
        break;
      }
      case "evm-address": {
        lines.push(`It is the page of account ${ref.address} on ${chainName(ref.scope)}.`);
        const known = knownAddress(ref.address);
        if (known) lines.push(`This is a well-known address: ${known.label}. ${known.note}`);
        lines.push(
          "The page shows the balance, token holdings, transactions, token transfers, and for contracts the verified source, ABI and bytecode.",
          "Call page_data before you describe this account, its balance, its code or its recent activity. blockchain_lookup_address gives more when needed.",
          explorerLinks(ref.scope),
        );
        break;
      }
      case "evm-section": {
        const sec = ref.section || "overview";
        lines.push(`It is the ${sec} page of ${chainName(ref.scope)}.`);
        if (ref.scope.chain?.description) lines.push(`About the chain: ${ref.scope.chain.description}`);
        lines.push("Call page_data to load the figures this page shows before you explain them.", explorerLinks(ref.scope));
        if (sec.startsWith("gas") && heliconLive(ref.scope)) lines.push(GAS_GLOSSARY);
        break;
      }
      case "network": {
        const what: Record<string, string> = {
          portal: "the explorer portal (choose a network and chain)",
          "": "the network overview (active addresses, transactions, validators, market cap across all Avalanche chains)",
          token: "the AVAX token page (supply, circulating, staked, locked, rewards, burned across the P-, C- and X-Chains, and fee history)",
          chains: "the list of Avalanche L1 chains",
          validators: "the Primary Network validator dashboard",
          icm: "Interchain Messaging (ICM) traffic between chains",
          apps: "the apps directory",
          stablecoins: "stablecoin supply by issuer and chain",
        };
        lines.push(`It is ${what[ref.section] ?? `the ${ref.section} page`} for Avalanche ${ref.network}.`);
        lines.push(
          ref.section === "token"
            ? "Call page_data before you explain any figure on this page: it returns each metric with the definition the page uses."
            : "Call page_data or metrics_lookup for live figures before you quote numbers.",
        );
        break;
      }
      case "icm-message":
        lines.push(`It is the page of ICM (Interchain Messaging) message ${ref.id} on ${ref.network}: source and destination chain, sender, receiver, delivery status and the transactions on both chains.`);
        break;
      case "pchain": {
        const sec = ref.section || "overview";
        lines.push(`It is the P-Chain ${sec} page${ref.id ? ` for ${ref.id}` : ""} on Avalanche ${ref.network}.`);
        if (sec === "node" && ref.id) lines.push(`Call blockchain_lookup_validator with nodeId "${ref.id}" before you describe this validator (stake, delegators, uptime, term, rewards).`);
        if (sec === "tx" && ref.id) lines.push(`Call blockchain_lookup_transaction with txHash "${ref.id}" and network "${ref.network}" before you explain this transaction.`);
        if (sec === "chain" && ref.id) lines.push(`Call blockchain_lookup_chain with "${ref.id}" before you describe this chain.`);
        break;
      }
      case "xchain":
        lines.push(`It is the X-Chain ${ref.section || "overview"} page${ref.id ? ` for ${ref.id}` : ""} on Avalanche ${ref.network}.`);
        if (ref.section === "tx" && ref.id) lines.push(`Call blockchain_lookup_transaction with txHash "${ref.id}" before you explain it.`);
        break;
      case "doc":
        lines.push("It is a documentation page. Its content follows under CURRENT PAGE CONTENT when it could be loaded; otherwise call page_data to read it. Questions like \"explain this\" or \"what does this mean\" are about that page.");
        break;
      case "site":
        break;
    }
  } catch {
    /* identity only */
  }
  lines.push("=== END CURRENT PAGE ===");
  return lines.join("\n");
}

interface TxHead {
  text: string;
  timestamp?: number;
  tx: RpcTx;
  receipt: RpcReceipt;
  block: RpcBlock | null;
}

/** the transaction's header, from the chain's public RPC */
async function txHeadline(scope: ChainScope, hash: string): Promise<TxHead | null> {
  const url = scope.rpcUrl!;
  const [tx, receipt] = await Promise.all([rpc<RpcTx>(url, "eth_getTransactionByHash", [hash]), rpc<RpcReceipt>(url, "eth_getTransactionReceipt", [hash])]);
  if (!tx || !receipt || !tx.blockNumber) return null;
  const block = await rpc<RpcBlock>(url, "eth_getBlockByNumber", [tx.blockNumber, false]);
  const timestamp = block ? hexInt(block.timestamp) : undefined;
  const sym = nativeSymbol(scope);
  const charged = hexInt(receipt.gasUsed);
  const limit = hexInt(tx.gas);
  const fee = BigInt(receipt.gasUsed) * BigInt(receipt.effectiveGasPrice);
  const known = tx.to ? knownAddress(tx.to) : undefined;
  const text = [
    `Status: ${receipt.status === "0x1" ? "Final (succeeded)" : "Reverted"}. Block #${num(hexInt(tx.blockNumber))}${timestamp ? ` at ${iso(timestamp)}` : ""}.`,
    `From ${tx.from} to ${tx.to ?? `(contract creation${receipt.contractAddress ? `: ${receipt.contractAddress}` : ""})`}${known ? ` (${known.label})` : ""}. Value ${amount(BigInt(tx.value), 18)} ${sym}.`,
    `Gas limit ${num(limit)}, gas charged ${num(charged)} (${pct(charged, limit)} of the limit), fee ${amount(fee, 18)} ${sym} at ${amount(BigInt(receipt.effectiveGasPrice), 9)} n${sym}. ${receipt.logs.length} event${receipt.logs.length === 1 ? "" : "s"}.`,
  ].join("\n");
  return { text, timestamp, tx, receipt, block };
}

/* ------------------------------------------------------------------ */
/* names: tokens, verified contracts, signature database               */

interface TokenInfo {
  symbol: string;
  name: string;
  decimals: number;
}
interface Names {
  sender: string;
  tokens: Map<string, TokenInfo>;
  contracts: Map<string, { name: string | null; abi: Abi | null }>;
  fnSigs: Map<string, string>;
  evSigs: Map<string, string>;
}

const tokenListCache = new Map<string, { at: number; tokens: Map<string, TokenInfo> }>();

async function tokenList(chainId: string, baseUrl: string): Promise<Map<string, TokenInfo>> {
  const hit = tokenListCache.get(chainId);
  if (hit && Date.now() - hit.at < 3_600_000) return hit.tokens;
  const body = await getJson<{ tokens?: Record<string, TokenInfo> }>(`${baseUrl}/api/token-list/${chainId}`, 15_000);
  const tokens = new Map(Object.entries(body?.tokens ?? {}));
  tokenListCache.set(chainId, { at: Date.now(), tokens });
  return tokens;
}

async function loadNames(scope: ChainScope, baseUrl: string, sender: string, addresses: string[], selectors: string[], topics: string[]): Promise<Names> {
  const chainId = scope.chainId ?? "0";
  const tokens = await tokenList(chainId, baseUrl);
  const contracts = new Map<string, { name: string | null; abi: Abi | null }>();
  const targets = [...new Set(addresses.map((a) => a.toLowerCase()))].filter((a) => a !== sender.toLowerCase()).slice(0, 14);
  if (scope.chain?.sourcifySupport !== false && scope.chainId) {
    const found = await Promise.all(
      targets.map((a) =>
        withTimeout(
          getVerifiedContractResolvingProxies(Number(chainId), a).catch(() => null),
          6_000,
          null,
        ),
      ),
    );
    targets.forEach((a, i) => {
      const c = found[i];
      if (c) contracts.set(a, { name: c.name, abi: (c.abi as Abi | null) ?? null });
    });
  }
  const fnSigs = new Map<string, string>();
  const evSigs = new Map<string, string>();
  const needF = [...new Set(selectors.map((s) => s.toLowerCase()))].slice(0, 100);
  const needE = [...new Set(topics.map((s) => s.toLowerCase()))].slice(0, 100);
  if (needF.length || needE.length) {
    const qs = new URLSearchParams();
    if (needF.length) qs.set("function", needF.join(","));
    if (needE.length) qs.set("event", needE.join(","));
    const body = await getJson<{ function?: Record<string, { name: string } | null>; event?: Record<string, { name: string } | null> }>(`${baseUrl}/api/signatures?${qs}`, 10_000);
    for (const [k, v] of Object.entries(body?.function ?? {})) if (v) fnSigs.set(k, v.name);
    for (const [k, v] of Object.entries(body?.event ?? {})) if (v) evSigs.set(k, v.name);
  }
  return { sender, tokens, contracts, fnSigs, evSigs };
}

function nameOf(addr: string | undefined, n: Names): string | null {
  if (!addr) return null;
  const a = addr.toLowerCase();
  if (a === n.sender.toLowerCase()) return "sender";
  return n.tokens.get(a)?.symbol ?? n.contracts.get(a)?.name ?? knownAddress(a)?.label ?? null;
}

/** an address as the text shows it: its name with the address once, or the address */
function who(addr: string | undefined, n: Names, seen: Set<string>): string {
  if (!addr) return "(none)";
  const name = nameOf(addr, n);
  if (!name) return addr;
  const a = addr.toLowerCase();
  if (seen.has(a)) return name;
  seen.add(a);
  return `${name} [${addr}]`;
}

/* ------------------------------------------------------------------ */
/* decoding a frame and a log                                          */

const AMOUNT_NAME = /amount|value|wad|balance|supply|shares|assets|^_?val/i;
const MAX_UINT256 = (1n << 256n) - 1n;

function fmtValue(v: unknown, type: string, paramName: string, contract: string | undefined, n: Names, seen: Set<string>): string {
  if (type === "address" && typeof v === "string") return who(v, n, seen);
  if (typeof v === "bigint") {
    if (v === MAX_UINT256) return "unlimited (max uint256)";
    const tok = contract ? n.tokens.get(contract.toLowerCase()) : undefined;
    if (tok && type.startsWith("uint") && (!paramName || AMOUNT_NAME.test(paramName))) return `${amount(v, tok.decimals)} ${tok.symbol}`;
    return num(v);
  }
  if (typeof v === "boolean") return String(v);
  if (typeof v === "string") {
    if (v.startsWith("0x") && v.length > 66) return `${v.slice(0, 42)}... (+${(v.length - 2) / 2} bytes)`;
    if (type === "uint256" && /^\d+$/.test(v)) {
      if (BigInt(v) === MAX_UINT256) return "unlimited (max uint256)";
      const tok = contract ? n.tokens.get(contract.toLowerCase()) : undefined;
      if (tok && (!paramName || AMOUNT_NAME.test(paramName))) return `${amount(BigInt(v), tok.decimals)} ${tok.symbol}`;
      return num(BigInt(v));
    }
    return v;
  }
  if (Array.isArray(v)) return `[${v.map((x) => fmtValue(x, typeof x === "string" && ADDRESS.test(x) ? "address" : typeof x === "bigint" ? "uint256" : "", "", contract, n, seen)).join(", ")}]`;
  if (v && typeof v === "object") return `(${Object.values(v).map((x) => fmtValue(x, "", "", contract, n, seen)).join(", ")})`;
  return String(v);
}

interface DecodedCall {
  name: string;
  args: string[];
  outputs?: string[];
  guessed?: boolean;
}

function decodeWith(fn: AbiFunction, f: TraceFrame, n: Names, seen: Set<string>, guessed: boolean): DecodedCall | null {
  try {
    const { args } = decodeFunctionData({ abi: [fn], data: f.input as `0x${string}` });
    const out: DecodedCall = {
      name: fn.name,
      guessed,
      args: fn.inputs.map((inp, i) => `${inp.name ? `${inp.name}=` : ""}${fmtValue((args as unknown[] | undefined)?.[i], inp.type, inp.name ?? "", f.to, n, seen)}`),
    };
    if (f.output && f.output !== "0x" && fn.outputs.length) {
      try {
        const res = decodeFunctionResult({ abi: [fn], functionName: fn.name, data: f.output as `0x${string}` });
        const arr = fn.outputs.length === 1 ? [res] : (res as unknown[]);
        out.outputs = fn.outputs.map((o, i) => fmtValue(arr[i], o.type, o.name ?? "", f.to, n, seen));
      } catch {
        /* args only */
      }
    }
    return out;
  } catch {
    return null;
  }
}

/** verified ABI, then the app's registry, then the signature database */
function decodeCall(f: TraceFrame, n: Names, seen: Set<string>): DecodedCall | null {
  if (!f.input || f.input.length < 10) return null;
  const sel = f.input.slice(0, 10).toLowerCase();
  const abi = f.to ? n.contracts.get(f.to.toLowerCase())?.abi : null;
  if (abi) {
    const fn = abi.find((i): i is AbiFunction => i.type === "function" && toFunctionSelector(i) === sel);
    if (fn) {
      const d = decodeWith(fn, f, n, seen, false);
      if (d) return d;
    }
  }
  const reg = registryDecodeInput(f.input);
  if (reg) return { name: reg.name, args: reg.params.map((p) => `${p.name ? `${p.name}=` : ""}${fmtValue(p.value, p.type, p.name, f.to, n, seen)}`) };
  const sig = n.fnSigs.get(sel);
  if (sig) {
    try {
      const fn = parseAbiItem(`function ${sig}`) as AbiFunction;
      return decodeWith(fn, f, n, seen, true) ?? { name: sig.split("(")[0], args: [], guessed: true };
    } catch {
      return { name: sig.split("(")[0], args: [], guessed: true };
    }
  }
  return null;
}

function decodeLog(log: { address: string; topics: string[]; data: string }, n: Names, seen: Set<string>): string {
  const abi = n.contracts.get(log.address.toLowerCase())?.abi;
  const topic0 = (log.topics[0] ?? "").toLowerCase();
  if (abi) {
    const ev = abi.find((i): i is AbiEvent => i.type === "event" && toEventSelector(i) === topic0);
    if (ev) {
      try {
        const { args } = decodeEventLog({ abi: [ev], topics: log.topics as [`0x${string}`, ...`0x${string}`[]], data: log.data as `0x${string}`, strict: false });
        const named = args !== undefined && !Array.isArray(args);
        const params = ev.inputs.map((inp, i) => {
          const v = named ? (args as Record<string, unknown>)[inp.name ?? ""] : (args as unknown[] | undefined)?.[i];
          return `${inp.name ? `${inp.name}=` : ""}${fmtValue(v, inp.type, inp.name ?? "", log.address, n, seen)}`;
        });
        return `${ev.name}(${params.join(", ")})`;
      } catch {
        /* fall through */
      }
    }
  }
  const reg = registryDecodeEvent(log);
  if (reg) return `${reg.name}(${reg.params.map((p) => `${p.name}=${fmtValue(p.value, p.type, p.name, log.address, n, seen)}`).join(", ")})`;
  const sig = n.evSigs.get(topic0);
  const indexed = log.topics.slice(1).map((t) => (/^0x0{24}[0-9a-f]{40}$/i.test(t) ? who(`0x${t.slice(26)}`, n, seen) : num(BigInt(t))));
  return `${sig ? sig.split("(")[0] : `event ${topic0.slice(0, 10)}`}(${indexed.join(", ")}${log.data && log.data !== "0x" ? `${indexed.length ? ", " : ""}data ${(log.data.length - 2) / 2} bytes` : ""})`;
}

/* ------------------------------------------------------------------ */
/* the call tree as text                                               */

const MAX_FRAMES = 140;

function walkTree(root: TraceFrame, n: Names, seen: Set<string>): { lines: string[]; frames: number; events: number; maxDepth: number } {
  const lines: string[] = [];
  let frames = 0;
  let events = 0;
  let maxDepth = 0;
  const walk = (f: TraceFrame, depth: number) => {
    frames++;
    maxDepth = Math.max(maxDepth, depth);
    if (frames > MAX_FRAMES) return;
    const pad = "  ".repeat(depth);
    const d = decodeCall(f, n, seen);
    const target = who(f.to, n, seen);
    const isCreate = f.type.startsWith("CREATE");
    const fn = isCreate ? "new contract" : d ? d.name : f.input && f.input !== "0x" ? `selector ${f.input.slice(0, 10)}` : "transfer";
    const args = d ? `(${d.args.join(", ")})` : "";
    const outs = d?.outputs?.length ? ` -> ${d.outputs.join(", ")}` : "";
    const value = f.value && hexBig(f.value) > 0n ? ` value ${amount(hexBig(f.value), 18)}` : "";
    const fail = f.error ? `  REVERTED${f.revertReason ? `: ${f.revertReason}` : f.error ? ` (${f.error})` : ""}` : "";
    lines.push(`${pad}${f.type} ${target}.${fn}${args}${outs}${value}  [gas ${num(hexInt(f.gasUsed))}]${fail}`);
    const kids = f.calls ?? [];
    const logs = [...(f.logs ?? [])].sort((a, b) => hexInt(a.position) - hexInt(b.position));
    let li = 0;
    for (let ci = 0; ci <= kids.length; ci++) {
      while (li < logs.length && hexInt(logs[li].position) <= ci) {
        events++;
        lines.push(`${pad}  EVENT ${who(logs[li].address, n, seen)}.${decodeLog(logs[li], n, seen)}`);
        li++;
      }
      if (ci < kids.length) walk(kids[ci], depth + 1);
    }
  };
  walk(root, 0);
  if (frames > MAX_FRAMES) lines.push(`... ${num(frames - MAX_FRAMES)} more frames not shown (the tree has ${num(frames)} calls)`);
  return { lines, frames, events, maxDepth };
}

function collect(root: TraceFrame): { addresses: string[]; selectors: string[]; topics: string[] } {
  const addresses = new Set<string>();
  const selectors = new Set<string>();
  const topics = new Set<string>();
  const walk = (f: TraceFrame) => {
    if (f.to) addresses.add(f.to);
    if (f.input && f.input.length >= 10 && !f.type.startsWith("CREATE")) selectors.add(f.input.slice(0, 10));
    for (const l of f.logs ?? []) {
      addresses.add(l.address);
      if (l.topics[0]) topics.add(l.topics[0]);
    }
    (f.calls ?? []).forEach(walk);
  };
  walk(root);
  return { addresses: [...addresses], selectors: [...selectors], topics: [...topics] };
}

/* ------------------------------------------------------------------ */
/* page data loaders                                                   */

const MAX_DATA_CHARS = 18_000;

const clip = (s: string) => (s.length > MAX_DATA_CHARS ? `${s.slice(0, MAX_DATA_CHARS)}\n... (cut for length)` : s);

async function txData(ref: Extract<PageRef, { kind: "evm-tx" }>, baseUrl: string): Promise<string> {
  const { scope, hash } = ref;
  if (!scope.rpcUrl) return `No RPC is configured for ${chainName(scope)}; the page reads this transaction from the indexer only.`;
  const head = await txHeadline(scope, hash);
  if (!head) return `Transaction ${hash} was not found on ${chainName(scope)} (not executed yet, or wrong chain).`;
  const out: string[] = [`Transaction ${hash} on ${chainName(scope)}`, head.text];

  const traceRes = await fetch(`${baseUrl}/api/trace/${scope.chainId}/${hash}`, { signal: AbortSignal.timeout(50_000) }).catch(() => null);
  const trace = traceRes?.ok ? ((await traceRes.json()) as TraceResponse) : null;
  const sym = nativeSymbol(scope);

  if (trace?.gas) {
    const g = trace.gas;
    out.push(`Gas breakdown: limit ${num(g.limit)}; charged ${num(hexInt(head.receipt.gasUsed))} (what the fee is paid on); used by execution ${num(g.used)} = intrinsic ${num(g.intrinsic)} + execution ${num(g.execution)}${g.refund > 0 ? ` - refund ${num(g.refund)}` : " (no storage refund is credited since Helicon)"}.`);
  }

  const root = trace?.call;
  const col = root ? collect(root) : { addresses: head.receipt.logs.map((l) => l.address).concat(head.tx.to ? [head.tx.to] : []), selectors: head.tx.input.length >= 10 ? [head.tx.input.slice(0, 10)] : [], topics: head.receipt.logs.map((l) => l.topics[0]).filter(Boolean) };
  const n = await loadNames(scope, baseUrl, head.tx.from, col.addresses, col.selectors, col.topics);
  const seen = new Set<string>();

  if (root) {
    const tree = walkTree(root, n, seen);
    out.push(`Call tree: ${num(tree.frames)} calls, ${num(tree.events)} events, depth ${tree.maxDepth}. Format: TYPE contract.function(args) -> outputs [gas]. Indentation = nesting. Names in [brackets] are the address behind a name, shown once. "sender" is the transaction sender ${head.tx.from}.`);
    out.push(...tree.lines);
    const changes = balanceChanges(trace!);
    if (changes.length) {
      out.push("Balance changes (fee excluded):");
      for (const c of changes.slice(0, 16)) {
        const tok = c.token ? n.tokens.get(c.token) : null;
        const amt = c.token ? (tok ? `${amount(c.delta, tok.decimals)} ${tok.symbol}` : `${num(c.delta)} units of ${who(c.token, n, seen)}`) : `${amount(c.delta, 18)} ${sym}`;
        out.push(`  ${who(c.address, n, seen)}: ${c.delta > 0n ? "+" : ""}${amt}`);
      }
      if (changes.length > 16) out.push(`  ... ${changes.length - 16} more`);
    }
  } else {
    const reason = traceRes?.status === 404 ? "this chain has no trace node, so internal calls are not available" : "the trace node did not answer";
    out.push(`No execution trace: ${reason}. The receipt's events follow.`);
    const d = head.tx.to && head.tx.input.length >= 10 ? decodeCall({ type: "CALL", from: head.tx.from, to: head.tx.to, input: head.tx.input, gas: head.tx.gas, gasUsed: head.receipt.gasUsed } as TraceFrame, n, seen) : null;
    if (d) out.push(`Top-level call: ${who(head.tx.to!, n, seen)}.${d.name}(${d.args.join(", ")})`);
    for (const l of head.receipt.logs.slice(0, 40)) out.push(`  EVENT ${who(l.address, n, seen)}.${decodeLog(l, n, seen)}`);
  }
  return clip(out.join("\n"));
}

async function blockData(ref: Extract<PageRef, { kind: "evm-block" }>, baseUrl: string): Promise<string> {
  const { scope } = ref;
  if (!scope.rpcUrl) return `No RPC is configured for ${chainName(scope)}.`;
  const hexN = `0x${ref.number.toString(16)}`;
  let block = await rpc<RpcBlock>(scope.rpcUrl, "eth_getBlockByNumber", [hexN, false]);
  if (!block) return `Block #${num(ref.number)} was not found on ${chainName(scope)}.`;
  const txCount = block.transactions.length;
  if (txCount > 0 && txCount <= 40) block = (await rpc<RpcBlock>(scope.rpcUrl, "eth_getBlockByNumber", [hexN, true])) ?? block;
  const ts = hexInt(block.timestamp);
  const reserved = hexInt(block.gasUsed);
  const limit = hexInt(block.gasLimit);
  const sym = nativeSymbol(scope);
  const out: string[] = [
    `Block #${num(ref.number)} on ${chainName(scope)}`,
    `Hash ${block.hash}. Parent ${block.parentHash}. Time ${iso(ts)}.`,
    `${num(txCount)} transaction${txCount === 1 ? "" : "s"}. ${heliconLive(scope, ts) ? "Gas reserved" : "Gas used"} ${num(reserved)} of the ${num(limit)} limit (${pct(reserved, limit)}).${block.baseFeePerGas ? ` Base fee ${amount(BigInt(block.baseFeePerGas), 9)} n${sym}.` : ""}${block.size ? ` Size ${num(hexInt(block.size))} bytes.` : ""}`,
  ];
  const coinbase = knownAddress(block.miner);
  out.push(`Coinbase ${block.miner}${coinbase ? ` (${coinbase.label}: fees are burned, no validator collects them)` : ""}.`);
  if (block.blockGasCost) out.push(`Block gas cost (Avalanche dynamic fee floor) ${num(hexInt(block.blockGasCost))}.`);
  const proposer = await withTimeout(getJson<{ proposerNodeId: string; proposerPChainHeight: number; proposerTimestamp: number }>(`${baseUrl}/api/block-proposer/${scope.chainId}/${ref.number}`, 8_000), 8_500, null);
  if (proposer) out.push(`Proposed by validator ${proposer.proposerNodeId} at P-Chain height ${num(proposer.proposerPChainHeight)} (link: /explorer/${scope.network}/p-chain/node/${proposer.proposerNodeId}).`);
  else out.push("Proposer: not available yet (the primary-network index trails the chain by a moment).");
  const full = block.transactions.filter((t): t is RpcTx => typeof t === "object");
  if (full.length) {
    const seen = new Set<string>();
    const n = await loadNames(scope, baseUrl, "0x0000000000000000000000000000000000000000", full.map((t) => t.to).filter((t): t is string => !!t), full.map((t) => t.input.slice(0, 10)).filter((s) => s.length === 10), []);
    out.push("Transactions (index: hash, from -> to, value, gas limit, method):");
    full.forEach((t, i) => {
      const d = t.to && t.input.length >= 10 ? decodeCall({ type: "CALL", from: t.from, to: t.to, input: t.input, gas: t.gas, gasUsed: "0x0" } as TraceFrame, n, seen) : null;
      out.push(`  ${i}: ${t.hash} ${t.from} -> ${t.to ? who(t.to, n, seen) : "(contract creation)"}, ${amount(BigInt(t.value), 18)} ${sym}, limit ${num(hexInt(t.gas))}${d ? `, ${d.name}` : t.input.length >= 10 ? `, ${t.input.slice(0, 10)}` : ", transfer"}`);
    });
  } else if (txCount > 40) {
    out.push(`The block carries too many transactions to list here; the page's table has them all. First hashes: ${(block.transactions as string[]).slice(0, 5).join(", ")}.`);
  }
  return clip(out.join("\n"));
}

async function addressData(ref: Extract<PageRef, { kind: "evm-address" }>, baseUrl: string): Promise<string> {
  const { scope, address } = ref;
  const out: string[] = [`Account ${address} on ${chainName(scope)}`];
  const sym = nativeSymbol(scope);
  if (scope.rpcUrl) {
    const [bal, nonce, code] = await Promise.all([
      rpc<string>(scope.rpcUrl, "eth_getBalance", [address, "latest"]),
      rpc<string>(scope.rpcUrl, "eth_getTransactionCount", [address, "latest"]),
      rpc<string>(scope.rpcUrl, "eth_getCode", [address, "latest"]),
    ]);
    if (bal) out.push(`Balance ${amount(BigInt(bal), 18)} ${sym}. Nonce (transactions sent) ${num(hexInt(nonce ?? "0x0"))}.`);
    const codeBytes = code && code !== "0x" ? (code.length - 2) / 2 : 0;
    if (codeBytes) out.push(`It is a contract: ${num(codeBytes)} bytes of code.`);
    else out.push("It is an externally owned account (no code).");
  }
  const known = knownAddress(address);
  if (known) out.push(`Well-known address: ${known.label}. ${known.note}`);
  if (scope.chainId && isGenesisCode(scope.chainId, address)) out.push("Its code was written at genesis and only reverts: every call fails, so nothing can be transferred out. Fees sent here are burned.");
  if (scope.chainId) {
    const tok = (await tokenList(scope.chainId, baseUrl)).get(address.toLowerCase());
    if (tok) out.push(`Listed token: ${tok.name} (${tok.symbol}), ${tok.decimals} decimals.`);
    const verified = await withTimeout(getVerifiedContractResolvingProxies(Number(scope.chainId), address).catch(() => null), 8_000, null);
    if (verified) {
      const fns = ((verified.abi as Abi | null) ?? []).filter((i): i is AbiFunction => i.type === "function").map((f) => f.name);
      out.push(`Verified on Sourcify as ${verified.name ?? "an unnamed contract"} (${verified.match}${verified.compilerVersion ? `, ${verified.compilerVersion}` : ""})${verified.proxy ? `; a proxy to ${verified.proxy.implementation}${verified.proxy.implementationName ? ` (${verified.proxy.implementationName})` : ""}` : ""}.`);
      if (fns.length) out.push(`Functions: ${[...new Set(fns)].slice(0, 40).join(", ")}${fns.length > 40 ? ", ..." : ""}.`);
    }
    const [summary, txs] = await Promise.all([
      getJson<{ txCount: number; firstSeen?: number; lastSeen?: number }>(`${baseUrl}/api/evm/${scope.chainId}/address/${address}`, 8_000),
      getJson<{ transactions?: { hash: string; blockNumber: number; from: string; to: string; value: string; gasUsed: number; success: boolean; timestamp: number; methodId?: string }[] }>(`${baseUrl}/api/evm/${scope.chainId}/address/${address}/txs?limit=10`, 8_000),
    ]);
    if (summary) out.push(`Indexed activity: ${num(summary.txCount)} transactions${summary.firstSeen ? `, first seen ${iso(summary.firstSeen)}` : ""}${summary.lastSeen ? `, last seen ${iso(summary.lastSeen)}` : ""}.`);
    if (txs?.transactions?.length) {
      out.push("Latest transactions (time, hash, from -> to, value, status):");
      for (const t of txs.transactions) out.push(`  ${iso(t.timestamp)} ${t.hash} ${t.from.toLowerCase() === address.toLowerCase() ? "sender" : t.from} -> ${t.to ? (t.to.toLowerCase() === address.toLowerCase() ? "this account" : t.to) : "(creation)"}, ${amount(BigInt(t.value), 18)} ${sym}, ${t.success ? "succeeded" : "reverted"}`);
    }
  }
  return clip(out.join("\n"));
}

interface SupplyPayload {
  totalSupply: string;
  circulatingSupply: string;
  totalPBurned: string;
  totalCBurned: string;
  totalXBurned: string;
  totalStaked: string;
  totalLocked: string;
  totalRewards: string;
  genesisUnlock: string;
  l1ValidatorFees?: string;
  lastUpdated?: string;
  price?: number;
  priceChange24h?: number;
}

async function tokenPageData(baseUrl: string): Promise<string> {
  const d = await getJson<SupplyPayload>(`${baseUrl}/api/avax-supply`, 12_000);
  if (!d) return "The supply feed did not answer; the page shows AVAX supply, staking and burn figures from data-api.avax.network.";
  const f = (s: string | number | undefined) => (s === undefined ? "n/a" : `${Math.round(Number(s)).toLocaleString("en-US")} AVAX`);
  const burned = Number(d.totalPBurned) + Number(d.totalCBurned) + Number(d.totalXBurned);
  const total = 720_000_000 - burned;
  return [
    "AVAX token figures as the page shows them (source: data-api.avax.network/v1/avax/supply, price from CoinGecko). Each line: label = value; how the page defines it.",
    `AVAX price = ${d.price ? `$${d.price.toFixed(2)} (${d.priceChange24h && d.priceChange24h > 0 ? "+" : ""}${(d.priceChange24h ?? 0).toFixed(2)}% 24h)` : "n/a"}.`,
    `Total supply = ${f(total)}; the 720,000,000 AVAX cap minus everything burned on the P-, C- and X-Chains.`,
    `Circulating supply = ${f(d.circulatingSupply)}; AVAX unlocked and in the market (vesting and locked allocations excluded).`,
    `Genesis unlock = ${f(d.genesisUnlock)}; AVAX unlocked at the genesis event.`,
    `Total staked = ${f(d.totalStaked)}; AVAX staked by validators and delegated to them on the Primary Network (${pct(Number(d.totalStaked), Number(d.circulatingSupply))} of circulating).`,
    `Total locked = ${f(d.totalLocked)}; AVAX held in locked UTXOs on the P-Chain and X-Chain.`,
    `Total rewards = ${f(d.totalRewards)}; cumulative staking rewards ever minted for validators and delegators (this is the only way new AVAX is created).`,
    `Total burned = ${f(burned)}; P-Chain ${f(d.totalPBurned)}, C-Chain ${f(d.totalCBurned)}, X-Chain ${f(d.totalXBurned)}. Every transaction fee on the three chains is burned, not paid to validators.${d.l1ValidatorFees ? ` L1 validator fees (ACP-77 continuous fees) ${f(d.l1ValidatorFees)}.` : ""}`,
    `Reported supply figure from the feed: ${f(d.totalSupply)}.${d.lastUpdated ? ` Feed updated ${d.lastUpdated}.` : ""}`,
    "Below the figures the page charts daily fees paid on the C-Chain and fees paid through ICM contracts, over the time window selected in the subnav.",
  ].join("\n");
}

async function sectionData(ref: Extract<PageRef, { kind: "evm-section" }>, baseUrl: string): Promise<string> {
  const { scope } = ref;
  const c = scope.chain;
  const out: string[] = [`${chainName(scope)}: ${ref.section || "overview"} page`];
  if (c) {
    out.push(`Chain: ${c.chainName}${c.category ? `, ${c.category}` : ""}${c.networkToken?.symbol ? `, gas token ${c.networkToken.symbol}` : ""}. ${c.description ?? ""}`.trim());
    if (c.website) out.push(`Website ${c.website}.`);
    if (c.blockchainId) out.push(`Blockchain ID ${c.blockchainId}${c.subnetId ? `, subnet ID ${c.subnetId}` : ""}.`);
    if (c.rpcUrl) out.push(`RPC ${c.rpcUrl}.`);
  }
  if (!scope.chainId) return out.join("\n");
  const sec = ref.section.split("/")[0];
  if (sec === "gas") {
    const [hist, market] = await Promise.all([
      getJson<{ days: number; daily: unknown[] }>(`${baseUrl}/api/gas-history/${scope.chainId}?days=7`, 12_000),
      getJson<unknown>(`${baseUrl}/api/gas-market/${scope.chainId}?range=7`, 20_000),
    ]);
    if (hist) out.push(`Gas history, last 7 complete days (JSON): ${JSON.stringify(hist.daily).slice(0, 4_000)}`);
    if (market) out.push(`Gas market, 7 days (JSON): ${JSON.stringify(market).slice(0, 6_000)}`);
    return clip(out.join("\n"));
  }
  const live = await getJson<{ stats?: { tipHeight: number; tipTimestamp: number; txCount24h: number; gasPriceWei: string }; price?: number; blocks?: { number: number; txCount?: number; timestamp: number }[]; transactions?: { hash: string; from: string; to: string; value: string; success: boolean }[] }>(`${baseUrl}/api/explorer/${scope.chainId}`, 12_000);
  if (live?.stats) {
    const s = live.stats;
    out.push(`Live: tip block #${num(s.tipHeight)} at ${iso(s.tipTimestamp)}, ${num(s.txCount24h)} transactions in 24h, gas price ${amount(BigInt(s.gasPriceWei), 9)} n${nativeSymbol(scope)}${live.price ? `, ${nativeSymbol(scope)} price $${live.price}` : ""}.`);
  }
  if (live?.blocks?.length) out.push(`Latest blocks: ${live.blocks.slice(0, 5).map((b) => `#${num(b.number)}${b.txCount !== undefined ? ` (${b.txCount} txs)` : ""}`).join(", ")}.`);
  return clip(out.join("\n"));
}

async function networkData(ref: Extract<PageRef, { kind: "network" }>, baseUrl: string): Promise<string> {
  if (ref.section === "token") return tokenPageData(baseUrl);
  const data = await getJson<{ aggregated?: Record<string, number>; chains?: { chainName: string; chainId: string; activeAddresses: number; txCount: number; tps: number; validatorCount: number }[] }>(`${baseUrl}/api/overview-stats?timeRange=day`, 15_000);
  if (!data?.aggregated) return `Avalanche ${ref.network} ${ref.section || "overview"} page. The overview feed did not answer; call metrics_lookup.`;
  const a = data.aggregated;
  const top = (data.chains ?? []).filter((c) => c.activeAddresses > 0).sort((x, y) => y.activeAddresses - x.activeAddresses).slice(0, 8);
  return [
    `Avalanche ${ref.network}, last 24h across all indexed chains: ${num(a.totalActiveAddresses ?? 0)} active addresses, ${num(a.totalTxCount ?? 0)} transactions, ${(a.totalTps ?? 0).toFixed(2)} TPS, ${num(a.totalValidators ?? 0)} validators, ${num(a.totalICMMessages ?? 0)} ICM messages, ${num(a.activeChains ?? 0)} active chains.`,
    `Top chains by active addresses: ${top.map((c) => `${c.chainName} (${num(c.activeAddresses)} addresses, ${num(c.txCount)} txs)`).join("; ")}.`,
  ].join("\n");
}

/** the docs page's text, through the docs MCP handler */
export async function docPageText(path: string): Promise<string | null> {
  try {
    const r = await withTimeout(docsTools.handlers.docs_fetch({ url: path }), 10_000, null);
    const text = r?.content?.[0]?.text;
    if (!text || r?.isError) return null;
    return text.length > 24_000 ? `${text.slice(0, 24_000)}\n... (page continues)` : text;
  } catch {
    return null;
  }
}

/** everything the page shows, as text the model can explain. Never throws. */
export async function loadPageData(ref: PageRef, baseUrl: string): Promise<string> {
  try {
    switch (ref.kind) {
      case "evm-tx":
        return await txData(ref, baseUrl);
      case "evm-block":
        return await blockData(ref, baseUrl);
      case "evm-address":
        return await addressData(ref, baseUrl);
      case "evm-section":
        return await sectionData(ref, baseUrl);
      case "network":
        return await networkData(ref, baseUrl);
      case "doc":
        return (await docPageText(ref.path)) ?? `The page at ${ref.path} could not be loaded.`;
      case "icm-message":
        return `ICM message ${ref.id} on ${ref.network}. No loader exists for message pages yet; explain from the page brief and ask the user for the detail they need.`;
      case "pchain":
        return ref.section === "node" && ref.id
          ? `Use blockchain_lookup_validator with nodeId "${ref.id}" for this validator's data.`
          : ref.section === "tx" && ref.id
            ? `Use blockchain_lookup_transaction with txHash "${ref.id}" and network "${ref.network}".`
            : `P-Chain ${ref.section || "overview"} page on ${ref.network}. Use the blockchain_lookup_* tools for specific ids.`;
      case "xchain":
        return `X-Chain ${ref.section || "overview"} page on ${ref.network}. Use blockchain_lookup_transaction for a transaction id.`;
      case "site":
        return `A Builders Hub page at ${ref.path}. No page data is available for it.`;
    }
  } catch (e) {
    return `The page data could not be loaded (${e instanceof Error ? e.message : "unknown error"}). Explain from the page brief and say what you could not check.`;
  }
}
