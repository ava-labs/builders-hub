"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, X } from "lucide-react";
import {
  decodeAbiParameters,
  decodeFunctionData,
  decodeFunctionResult,
  encodeAbiParameters,
  keccak256,
  parseAbiItem,
  parseAbiParameters,
  toFunctionSelector,
  type Abi,
  type AbiFunction,
  type AbiParameter,
} from "viem";
import { cn } from "@/lib/utils";
import { Board, HashChip, SectionHeader } from "@/components/explorer-v2/ui";
import { truncate } from "@/components/explorer-v2/format";
import { Tabs, EmptyRow } from "./AddressTables";
import { TokenMark, NativeMark } from "./TokenMark";
import { usePrice, usdOfWei } from "./hooks";
import { useVerifiedContracts, decodeEventWithAbi, type SourcifyContract } from "@/lib/sourcify-client";
import { decodeEventLog as registryDecodeEvent, decodeFunctionInput as registryDecodeInput } from "@/abi/event-signatures.generated";
import { formatTokenAmount, usdOfToken, useSignatures, useTokenList, useTokenPrices, type SignatureHit, type TokenMap } from "@/lib/token-list";
import { knownAddress } from "@/lib/evm-explorer";
import {
  balanceChanges,
  contractsIn,
  flatten,
  hexBig,
  hexInt,
  logsIn,
  storageChanges,
  wordLabel,
  type FlatFrame,
  type TraceFrame,
  type TraceResponse,
} from "@/lib/trace";

/* The execution, dissected, in four views a developer actually reaches
   for: the call tree with its events in place (what happened, in order),
   the balance changes (who ended up with what), the storage written
   (which state moved, with mapping keys recovered so a slot reads as
   balance[account], not a hash), and where the gas went. Names come from
   the token list, Sourcify, the selector registry, then the signature
   database; anything still unknown stays honest hex. */

type Tab = "calls" | "balances" | "state" | "gas";
const LABELS: Record<Tab, string> = { calls: "Call Trace", balances: "Balance Changes", state: "State", gas: "Gas" };

const CALL_OPS = new Set(["CALL", "STATICCALL", "DELEGATECALL", "CALLCODE", "CREATE", "CREATE2"]);

/* The trace reads like highlighted code: one hue per kind of thing, the
   same in every tab, light and dark. Contract names stay ink; the brand
   red is kept for reverts. */
const C = {
  fn: "text-violet-700 dark:text-violet-300",
  addr: "text-teal-700 dark:text-teal-300",
  num: "text-amber-700 dark:text-amber-300",
  yes: "text-emerald-700 dark:text-emerald-300",
  no: "text-red-700 dark:text-red-300",
  bytes: "text-zinc-500 dark:text-zinc-400",
  str: "text-sky-700 dark:text-sky-300",
  punct: "text-zinc-300 dark:text-zinc-700",
  param: "text-zinc-400 dark:text-zinc-500",
  type: {
    CALL: "text-zinc-500 dark:text-zinc-400",
    STATICCALL: "text-sky-600 dark:text-sky-400",
    DELEGATECALL: "text-fuchsia-600 dark:text-fuchsia-400",
    CALLCODE: "text-fuchsia-600 dark:text-fuchsia-400",
    CREATE: "text-emerald-600 dark:text-emerald-400",
    CREATE2: "text-emerald-600 dark:text-emerald-400",
    SELFDESTRUCT: "text-red-600 dark:text-red-400",
  } as Record<string, string>,
};

type Kind = "address" | "number" | "bool" | "bytes" | "string" | "tuple" | "name";
interface Val {
  kind: Kind;
  text: string;
  /** full value when `text` had to be shortened */
  title?: string;
  /** an address that resolves to a name: rendered as the name, full address on hover */
  href?: string;
}

function V({ v, className }: { v: Val; className?: string }) {
  const cls =
    v.kind === "address" ? C.addr
    : v.kind === "number" ? C.num
    : v.kind === "bool" ? (v.text === "true" ? C.yes : C.no)
    : v.kind === "bytes" ? C.bytes
    : v.kind === "string" ? C.str
    : v.kind === "name" ? "font-medium text-zinc-900 dark:text-zinc-50"
    : "text-zinc-600 dark:text-zinc-300";
  const inner = <span className={cn("break-all tabular-nums", cls, className)} title={v.title}>{v.text}</span>;
  return v.href ? <Link href={v.href} className="hover:underline underline-offset-4" onClick={(e) => e.stopPropagation()}>{inner}</Link> : inner;
}

/* ------------------------------------------------------------------ */
/* data                                                                */

export type TraceState = "loading" | "ready" | "none" | "error";

export function useTrace(chainId: string, hash: string, enabled: boolean): { trace: TraceResponse | null; state: TraceState } {
  const [trace, setTrace] = useState<TraceResponse | null>(null);
  const [state, setState] = useState<TraceState>(enabled ? "loading" : "none");
  useEffect(() => {
    setTrace(null);
    if (!enabled) {
      setState("none");
      return;
    }
    setState("loading");
    const controller = new AbortController();
    fetch(`/api/trace/${chainId}/${hash}`, { signal: controller.signal })
      .then(async (r) => {
        if (r.status === 404) return setState("none");
        if (!r.ok) return setState("error");
        setTrace((await r.json()) as TraceResponse);
        setState("ready");
      })
      .catch(() => !controller.signal.aborted && setState("error"));
    return () => controller.abort();
  }, [chainId, hash, enabled]);
  return { trace, state };
}

/* ------------------------------------------------------------------ */
/* naming and decoding                                                 */

interface Names {
  tokens: TokenMap;
  contracts: Map<string, SourcifyContract>;
  sigs: { fn: Map<string, SignatureHit>; ev: Map<string, SignatureHit> };
  chainId: string;
  base: string;
  sender: string;
}

function nameOf(addr: string | undefined, n: Names): string | null {
  if (!addr) return null;
  const a = addr.toLowerCase();
  if (a === n.sender.toLowerCase()) return "sender";
  return n.tokens.get(a)?.symbol ?? n.contracts.get(a)?.name ?? knownAddress(a)?.label ?? null;
}

/** a party in the trace: token mark, verified name, fixture, or a stub */
function Who({ addr, n, className }: { addr: string | undefined; n: Names; className?: string }) {
  if (!addr) return <span className={cn("text-zinc-400 dark:text-zinc-500", className)}>∅</span>;
  const a = addr.toLowerCase();
  const tok = n.tokens.get(a);
  const label = nameOf(addr, n);
  return (
    <Link href={`${n.base}/address/${addr}`} className={cn("inline-flex min-w-0 items-center gap-1.5 hover:text-[#E6212F]", className)} title={addr} onClick={(e) => e.stopPropagation()}>
      {tok ? (
        <TokenMark address={addr} chainId={n.chainId} token={tok} size={13} />
      ) : label ? (
        <span className={cn("truncate", label === "sender" ? "text-zinc-500 dark:text-zinc-400" : "font-medium text-zinc-900 dark:text-zinc-50")}>{label}</span>
      ) : (
        <span className={cn("break-all", C.addr)}>{addr}</span>
      )}
    </Link>
  );
}

interface Decoded {
  name: string;
  args: { name: string; type: string; value: Val }[];
  outputs?: { name: string; type: string; value: Val }[];
  /** the name came from the signature database, not an ABI */
  guessed?: boolean;
}

/** uint parameters that are token amounts, by the names ERC-20s and DEXes use */
const AMOUNT_NAME = /amount|value|wad|balance|supply|shares|assets|^_?val/i;

const tokenAmount = (v: bigint, paramName: string, contract: string | undefined, n: Names): string | null => {
  const tok = contract ? n.tokens.get(contract.toLowerCase()) : undefined;
  if (!tok) return null;
  if (paramName && !AMOUNT_NAME.test(paramName)) return null;
  return `${formatTokenAmount(v, tok.decimals)} ${tok.symbol}`;
};

/** an address as a value: its name when it has one (full address on
 *  hover), else the full address. Never truncated. */
function addrVal(a: string, n: Names): Val {
  const name = nameOf(a, n);
  return name
    ? { kind: "name", text: name, title: a, href: `${n.base}/address/${a}` }
    : { kind: "address", text: a, href: `${n.base}/address/${a}` };
}

/** a decoded ABI value as a typed token */
const toVal = (v: unknown, type: string, n: Names, paramName = "", contract?: string): Val => {
  if (type === "address" && typeof v === "string") return addrVal(v, n);
  if (typeof v === "bigint") {
    const scaled = type.startsWith("uint") ? tokenAmount(v, paramName, contract, n) : null;
    return { kind: "number", text: scaled ?? v.toLocaleString("en-US"), title: scaled ? v.toString() : undefined };
  }
  if (typeof v === "boolean") return { kind: "bool", text: String(v) };
  if (typeof v === "string" && v.startsWith("0x")) {
    // bytes: one word shown, the rest counted
    return v.length > 66 ? { kind: "bytes", text: `${v.slice(0, 66)}… +${(v.length - 66) / 2} bytes`, title: v } : { kind: "bytes", text: v };
  }
  if (Array.isArray(v)) {
    const inner = v.map((x) => toVal(x, typeof x === "string" && /^0x[0-9a-fA-F]{40}$/.test(x) ? "address" : typeof x === "bigint" ? "uint256" : "", n, "", contract).text);
    return { kind: "tuple", text: `(${inner.join(", ")})` };
  }
  if (typeof v === "object" && v !== null) return toVal(Object.values(v), "tuple", n, paramName, contract);
  return { kind: "string", text: String(v) };
};

/** a registry/database value that arrived as a string */
function strVal(value: string, type: string, name: string, contract: string | undefined, n: Names): Val {
  if (type === "address") return addrVal(value, n);
  if (type.startsWith("uint") && /^\d+$/.test(value)) {
    try {
      const scaled = tokenAmount(BigInt(value), name, contract, n);
      return { kind: "number", text: scaled ?? BigInt(value).toLocaleString("en-US"), title: scaled ? value : undefined };
    } catch {
      return { kind: "number", text: value };
    }
  }
  if (type.startsWith("int") && /^-?\d+$/.test(value)) return { kind: "number", text: BigInt(value).toLocaleString("en-US") };
  if (type === "bool") return { kind: "bool", text: value };
  if (value.startsWith("0x")) return value.length > 66 ? { kind: "bytes", text: `${value.slice(0, 66)}… +${(value.length - 66) / 2} bytes`, title: value } : { kind: "bytes", text: value };
  return { kind: "string", text: value };
}

function decodeWithFn(fn: AbiFunction, f: TraceFrame, n: Names, guessed: boolean): Decoded | null {
  try {
    const { args } = decodeFunctionData({ abi: [fn], data: f.input as `0x${string}` });
    const decoded: Decoded = {
      name: fn.name,
      guessed,
      args: fn.inputs.map((inp, i) => ({ name: inp.name ?? "", type: inp.type, value: toVal((args as unknown[] | undefined)?.[i], inp.type, n, inp.name ?? "", f.to) })),
    };
    if (f.output && f.output !== "0x" && fn.outputs.length) {
      try {
        const res = decodeFunctionResult({ abi: [fn], functionName: fn.name, data: f.output as `0x${string}` });
        const arr = fn.outputs.length === 1 ? [res] : (res as unknown[]);
        decoded.outputs = fn.outputs.map((o, i) => ({ name: o.name ?? "", type: o.type, value: toVal(arr[i], o.type, n, o.name ?? "", f.to) }));
      } catch {
        /* args only */
      }
    }
    return decoded;
  } catch {
    return null;
  }
}

/** ABI (args and return) → registry (args) → signature database (args) → nothing */
function decodeCall(f: TraceFrame, n: Names): Decoded | null {
  if (!f.input || f.input.length < 10) return null;
  const sel = f.input.slice(0, 10).toLowerCase();
  const abi = f.to ? n.contracts.get(f.to.toLowerCase())?.abi : null;
  if (abi) {
    const fn = (abi as Abi).find((i): i is AbiFunction => i.type === "function" && toFunctionSelector(i) === sel);
    if (fn) {
      const d = decodeWithFn(fn, f, n, false);
      if (d) return d;
    }
  }
  const reg = registryDecodeInput(f.input);
  if (reg) return { name: reg.name, args: reg.params.map((p) => ({ name: p.name, type: p.type, value: strVal(p.value, p.type, p.name, f.to, n) })) };
  const hit = n.sigs.fn.get(sel);
  if (hit) {
    try {
      const fn = parseAbiItem(`function ${hit.name}`) as AbiFunction;
      const d = decodeWithFn(fn, f, n, true);
      if (d) return d;
      return { name: hit.name.split("(")[0], args: [], guessed: true };
    } catch {
      return { name: hit.name.split("(")[0], args: [], guessed: true };
    }
  }
  return null;
}

interface DecodedEvent {
  name: string;
  params: { name: string; type: string; value: string }[];
  guessed?: boolean;
}

/** split "a,(b,c),d" on top-level commas */
function splitTypes(list: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of list) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      out.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

const isDynamic = (t: string) => t === "string" || t === "bytes" || t.endsWith("]") || t.startsWith("(");

/** k-subsets of indices, addresses-first so the conventional layout is tried first */
function* indexedCandidates(types: string[], k: number): Generator<number[]> {
  const idx = types.map((_, i) => i);
  const score = (i: number) => (types[i] === "address" ? 0 : isDynamic(types[i]) ? 2 : 1);
  const ordered = [...idx].sort((a, b) => score(a) - score(b) || a - b);
  const combo = (start: number, chosen: number[]): number[][] => {
    if (chosen.length === k) return [chosen];
    const out: number[][] = [];
    for (let i = start; i < ordered.length; i++) out.push(...combo(i + 1, [...chosen, ordered[i]]));
    return out;
  };
  for (const c of combo(0, [])) yield c.sort((a, b) => a - b);
}

/** decode a log from a signature with no indexed markers: the log's topic
 *  count says how many params were indexed; the split is accepted only when
 *  re-encoding the non-indexed values reproduces the data exactly */
function decodeFromSignature(sig: string, log: { topics: string[]; data: string }): DecodedEvent | null {
  const m = sig.match(/^([^(]+)\((.*)\)$/);
  if (!m) return null;
  const name = m[1];
  const types = m[2] ? splitTypes(m[2]) : [];
  const k = log.topics.length - 1;
  if (k > types.length) return null;
  const data = (log.data && log.data !== "0x" ? log.data : "0x") as `0x${string}`;
  for (const indexed of indexedCandidates(types, k)) {
    const rest = types.filter((_, i) => !indexed.includes(i));
    try {
      const params = rest.length ? (parseAbiParameters(rest.join(", ")) as readonly AbiParameter[]) : [];
      const values = params.length ? decodeAbiParameters(params, data) : [];
      const again = params.length ? encodeAbiParameters(params, values as never) : "0x";
      if (again.toLowerCase() !== data.toLowerCase()) continue;
      // a fit: assemble in signature order
      const out: DecodedEvent["params"] = [];
      let ti = 1;
      let di = 0;
      types.forEach((t, i) => {
        if (indexed.includes(i)) {
          const topic = log.topics[ti++];
          out.push({ name: "", type: t, value: isDynamic(t) ? topic : topicValue(topic, t) });
        } else {
          out.push({ name: "", type: t, value: plain(values[di++]) });
        }
      });
      return { name, params: out, guessed: true };
    } catch {
      /* next candidate */
    }
  }
  return { name, params: [], guessed: true };
}

/** a 32-byte topic as its static type */
function topicValue(topic: string, type: string): string {
  if (type === "address") return `0x${topic.slice(26)}`;
  if (type === "bool") return BigInt(topic) === 0n ? "false" : "true";
  if (type.startsWith("int")) {
    const bits = Number(type.slice(3) || 256);
    const v = BigInt(topic);
    return (v >= 1n << BigInt(bits - 1) ? v - (1n << BigInt(bits)) : v).toString();
  }
  if (type.startsWith("uint")) return BigInt(topic).toString();
  return topic;
}

const plain = (v: unknown): string =>
  typeof v === "bigint" ? v.toString() : typeof v === "boolean" ? String(v) : Array.isArray(v) ? `(${v.map(plain).join(", ")})` : typeof v === "object" && v !== null ? plain(Object.values(v)) : String(v);

function decodeLog(log: { address: string; topics: string[]; data: string }, n: Names): DecodedEvent | null {
  const abi = n.contracts.get(log.address.toLowerCase())?.abi;
  const viaAbi = decodeEventWithAbi(abi, log);
  if (viaAbi) return viaAbi;
  const reg = registryDecodeEvent(log);
  if (reg) return { name: reg.name, params: reg.params };
  const hit = n.sigs.ev.get((log.topics[0] ?? "").toLowerCase());
  if (hit) return decodeFromSignature(hit.name, log);
  return null;
}

/* ------------------------------------------------------------------ */
/* storage: recover mapping keys                                       */

const pad32 = (hex: string) => `0x${hex.replace(/^0x/, "").toLowerCase().padStart(64, "0")}` as `0x${string}`;
const slotHash = (key: string, base: string) => keccak256(encodeAbiParameters([{ type: "bytes32" }, { type: "bytes32" }], [pad32(key), pad32(base)]));

interface SlotLabel {
  base: number;
  keys: string[]; // one key for mapping(k), two for mapping(k1)(k2)
}

/** which mapping slot and keys a storage key came from, if the key is an
 *  address the execution touched and the mapping lives in one of the first
 *  MAX_BASE slots. Nested mappings (allowance[owner][spender]) too. */
function labelSlots(keysWanted: Set<string>, addresses: string[], maxBase = 32): Map<string, SlotLabel> {
  const out = new Map<string, SlotLabel>();
  const addrs = [...new Set(addresses.map((a) => a.toLowerCase()))].slice(0, 24);
  const firstLevel: { hash: `0x${string}`; base: number; key: string }[] = [];
  for (let base = 0; base < maxBase; base++) {
    for (const a of addrs) {
      const h = slotHash(a, `0x${base.toString(16)}`);
      firstLevel.push({ hash: h, base, key: a });
      if (keysWanted.has(h)) out.set(h, { base, keys: [a] });
    }
  }
  if (out.size < keysWanted.size) {
    for (const f of firstLevel) {
      for (const b of addrs) {
        const h = slotHash(b, f.hash);
        if (keysWanted.has(h)) out.set(h, { base: f.base, keys: [f.key, b] });
      }
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */

export function EvmTrace({
  trace,
  state,
  chainId,
  base,
  sender,
  symbol,
}: {
  trace: TraceResponse | null;
  state: TraceState;
  chainId: string;
  base: string;
  sender: string;
  symbol: string;
}) {
  const [tab, setTab] = useState<Tab>("calls");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const frames = useMemo(() => (trace ? flatten(trace.call) : []), [trace]);
  const logs = useMemo(() => (trace ? logsIn(trace.call) : []), [trace]);
  const contracts = useMemo(() => (trace ? contractsIn(trace.call) : []), [trace]);
  const verified = useVerifiedContracts(chainId, contracts);
  const tokens = useTokenList(chainId);

  // selectors and topics nothing local can name go to the signature database
  const unknownSel = useMemo(() => {
    const out = new Set<string>();
    for (const f of frames) {
      const fr = f.frame;
      if (!fr.input || fr.input.length < 10) continue;
      const sel = fr.input.slice(0, 10).toLowerCase();
      const abi = fr.to ? verified.get(fr.to.toLowerCase())?.abi : null;
      const inAbi = abi ? (abi as Abi).some((i) => i.type === "function" && toFunctionSelector(i as AbiFunction) === sel) : false;
      if (!inAbi && !registryDecodeInput(fr.input)) out.add(sel);
    }
    return [...out];
  }, [frames, verified]);
  const unknownTopics = useMemo(() => {
    const out = new Set<string>();
    for (const { log } of logs) {
      const abi = verified.get(log.address.toLowerCase())?.abi;
      if (!decodeEventWithAbi(abi, log) && !registryDecodeEvent(log) && log.topics[0]) out.add(log.topics[0].toLowerCase());
    }
    return [...out];
  }, [logs, verified]);
  const sigs = useSignatures(unknownSel, unknownTopics);

  const n: Names = { tokens, contracts: verified, sigs, chainId, base, sender };

  const changes = useMemo(() => (trace ? balanceChanges(trace) : []), [trace]);
  const storage = useMemo(() => (trace ? storageChanges(trace) : []), [trace]);
  const { price } = usePrice(chainId);
  const usd = price?.price ?? null;
  const prices = useTokenPrices(chainId, changes.map((c) => c.token).filter((t): t is string => !!t));

  // every address the execution mentions, for recovering mapping keys
  const slotLabels = useMemo(() => {
    if (!trace || storage.length === 0) return new Map<string, SlotLabel>();
    const addrs = new Set<string>();
    const walk = (f: TraceFrame) => {
      addrs.add(f.from);
      if (f.to) addrs.add(f.to);
      for (const l of f.logs ?? []) for (const t of l.topics.slice(1)) if (/^0x0{24}[0-9a-f]{40}$/i.test(t)) addrs.add(`0x${t.slice(26)}`);
      (f.calls ?? []).forEach(walk);
    };
    walk(trace.call);
    for (const a of Object.keys(trace.prestate?.post ?? {})) addrs.add(a);
    return labelSlots(new Set(storage.map((s) => s.slot.toLowerCase())), [...addrs]);
  }, [trace, storage]);

  if (state === "none") return null;

  const toggle = (id: string) =>
    setCollapsed((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const hidden = (f: FlatFrame) => {
    const parts = f.id.split(".");
    for (let i = 1; i < parts.length; i++) if (collapsed.has(parts.slice(0, i).join("."))) return true;
    return false;
  };
  const totalGas = trace ? hexInt(trace.call.gasUsed) : 0;
  const errors = frames.filter((f) => f.frame.error).length;

  /** a storage word: an amount on a token contract, else an address,
   *  an integer, or the full hex */
  const slotValue = (contract: string, word: string | null): Val => {
    if (!word) return { kind: "string", text: "∅" };
    const tok = tokens.get(contract);
    if (tok) {
      try {
        return { kind: "number", text: `${formatTokenAmount(BigInt(word), tok.decimals)} ${tok.symbol}`, title: word };
      } catch {
        /* fall through */
      }
    }
    const label = wordLabel(word);
    if (label.startsWith("0x") && label.length === 42) return addrVal(label, n);
    if (/^[\d,]+$/.test(label)) return { kind: "number", text: label, title: word };
    return { kind: "bytes", text: word, title: word };
  };

  return (
    <section className="flex flex-col gap-4">
      <SectionHeader
        label="Execution"
        action={
          trace ? (
            <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
              {frames.length} calls · depth {Math.max(...frames.map((f) => f.depth)) + 1}
              {errors ? <span className="text-[#E6212F]"> · {errors} reverted</span> : null}
            </span>
          ) : undefined
        }
      />
      {state === "loading" && (
        <Board divide={false}>
          <div className="px-5 py-6 font-mono text-[11px] text-zinc-400 md:px-6 dark:text-zinc-500">tracing execution…</div>
        </Board>
      )}
      {state === "error" && (
        <Board divide={false}>
          <div className="px-5 py-6 font-mono text-[11px] text-zinc-400 md:px-6 dark:text-zinc-500">the trace node did not answer</div>
        </Board>
      )}
      {trace && (
        <>
          <Tabs tabs={["calls", "balances", "state", "gas"]} active={tab} onChange={setTab} labels={LABELS} />

          {tab === "calls" && (
            <Board divide={false}>
              <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 md:px-6 dark:border-zinc-800 dark:text-zinc-500">
                <span className="flex gap-6">
                  <button onClick={() => setCollapsed(new Set())} className="hover:text-zinc-900 dark:hover:text-zinc-100">expand all</button>
                  <button onClick={() => setCollapsed(new Set(frames.filter((f) => f.children.length && f.depth > 0).map((f) => f.id)))} className="hover:text-zinc-900 dark:hover:text-zinc-100">collapse</button>
                </span>
                <span>gas</span>
              </div>
              {frames.map((f) => {
                if (hidden(f)) return null;
                const fr = f.frame;
                const d = decodeCall(fr, n);
                const value = hexBig(fr.value);
                const gas = hexInt(fr.gasUsed);
                const frameLogs = logs.filter((l) => l.frameId === f.id);
                const isCollapsed = collapsed.has(f.id);
                // one rail per ancestor, centred under that ancestor's chevron
                const rails = (count: number) =>
                  Array.from({ length: count }).map((_, i) => (
                    <span key={i} aria-hidden className="absolute inset-y-0 w-px bg-zinc-200 dark:bg-zinc-800" style={{ left: `${28 + i * 22}px` }} />
                  ));
                return (
                  <div key={f.id} className="border-b border-zinc-100 last:border-b-0 dark:border-zinc-900">
                    <div
                      className={cn(
                        "relative flex min-h-9 items-center gap-3 py-1.5 pr-5 font-mono text-[12px] transition-colors md:pr-6",
                        f.children.length ? "cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900" : "hover:bg-zinc-50/60 dark:hover:bg-zinc-900/60",
                      )}
                      style={{ paddingLeft: `${20 + f.depth * 22}px` }}
                      onClick={() => f.children.length && toggle(f.id)}
                      title={f.children.length ? `${f.children.length} nested call${f.children.length === 1 ? "" : "s"} · click to ${isCollapsed ? "expand" : "collapse"}` : undefined}
                    >
                      {rails(f.depth)}
                      <span className={cn("flex h-4 w-4 shrink-0 items-center justify-center text-zinc-400", !f.children.length && "invisible")} aria-hidden>
                        {isCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      </span>
                      <span className={cn("w-[5.5rem] shrink-0 text-[9px] font-bold uppercase tracking-[0.14em]", C.type[fr.type] ?? C.type.CALL)}>
                        {fr.type.toLowerCase()}
                      </span>
                      <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-1.5 text-zinc-600 dark:text-zinc-300">
                        <Who addr={fr.to} n={n} />
                        {d ? (
                          <>
                            <span className={C.punct}>.</span>
                            <span className={cn(C.fn, d.guessed && "underline decoration-dotted decoration-current underline-offset-4")} title={d.guessed ? "name from the signature database, no verified ABI" : undefined}>
                              {d.name}
                            </span>
                            <span className={C.punct}>(</span>
                            {d.args.map((a, i) => (
                              <span key={i} className="inline-flex flex-wrap items-baseline gap-1">
                                {a.name && <span className={cn("text-[10px]", C.param)}>{a.name}=</span>}
                                <V v={a.value} />
                                {i < d.args.length - 1 && <span className={C.punct}>,</span>}
                              </span>
                            ))}
                            <span className={C.punct}>)</span>
                            {d.outputs && d.outputs.length > 0 && (
                              <>
                                <span className={C.punct}>→</span>
                                {d.outputs.map((o, i) => (
                                  <span key={i} className="inline-flex items-baseline gap-1">
                                    <V v={o.value} />
                                    {i < d.outputs!.length - 1 && <span className={C.punct}>,</span>}
                                  </span>
                                ))}
                              </>
                            )}
                          </>
                        ) : fr.input && fr.input !== "0x" ? (
                          <>
                            <span className={C.punct}>.</span>
                            <span className={C.fn} title={fr.input}>{fr.input.slice(0, 10)}</span>
                            <V v={toVal(`0x${fr.input.slice(10)}`, "bytes", n)} className="text-[11px]" />
                          </>
                        ) : (
                          <span className="text-zinc-400 dark:text-zinc-500">{fr.type.startsWith("CREATE") ? "new contract" : "transfer"}</span>
                        )}
                        {value > 0n && (
                          <span className={cn("ml-1", C.num)}>
                            {(Number(value) / 1e18).toLocaleString("en-US", { maximumFractionDigits: 6 })} <span className="text-[10px] text-zinc-400 dark:text-zinc-500">{symbol}</span>
                          </span>
                        )}
                        {fr.error && (
                          <span className="ml-1 inline-flex items-center gap-1 text-[#E6212F]">
                            <X className="h-3 w-3" strokeWidth={2.5} />
                            {fr.revertReason ?? fr.error}
                          </span>
                        )}
                      </span>
                      <span className="flex w-28 shrink-0 items-center justify-end gap-2 tabular-nums text-zinc-500 dark:text-zinc-400" title={`${Math.round(f.share * 100)}% of the transaction's gas · ${f.selfGas.toLocaleString("en-US")} spent in this frame itself`}>
                        <span className="h-1 w-10 bg-zinc-100 dark:bg-zinc-900">
                          <span className="block h-full bg-[#A2AFB2] dark:bg-zinc-600" style={{ width: `${Math.max(2, Math.round(f.share * 100))}%` }} />
                        </span>
                        {gas.toLocaleString("en-US")}
                      </span>
                    </div>
                    {frameLogs.map(({ log }, i) => {
                      const ev = decodeLog(log, n);
                      return (
                        <div key={i} className="relative flex min-h-7 items-center gap-2 py-1 pr-5 font-mono text-[11px] text-zinc-500 transition-colors hover:bg-zinc-50/60 md:pr-6 dark:text-zinc-400 dark:hover:bg-zinc-900/60" style={{ paddingLeft: `${20 + (f.depth + 1) * 22 + 16}px` }}>
                          {rails(f.depth + 1)}
                          <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-rose-600 dark:text-rose-400">event</span>
                          <Who addr={log.address} n={n} />
                          <span className={C.punct}>.</span>
                          {ev ? (
                            <span className="flex flex-wrap items-center gap-x-1.5">
                              <span className={cn(C.fn, ev.guessed && "underline decoration-dotted decoration-current underline-offset-4")}>{ev.name}</span>
                              {ev.params.length > 0 && (
                                <>
                                  <span className={C.punct}>(</span>
                                  {ev.params.map((p, k) => (
                                    <span key={k} className="inline-flex flex-wrap items-baseline gap-1">
                                      {p.name && <span className={cn("text-[10px]", C.param)}>{p.name}=</span>}
                                      <V v={strVal(p.value, p.type, p.name, log.address, n)} />
                                      {k < ev.params.length - 1 && <span className={C.punct}>,</span>}
                                    </span>
                                  ))}
                                  <span className={C.punct}>)</span>
                                </>
                              )}
                            </span>
                          ) : (
                            <V v={{ kind: "bytes", text: log.topics[0] ?? "" }} />
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </Board>
          )}

          {tab === "balances" && (
            <Board>
              <div className="hidden grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,12rem)_8rem] gap-4 px-5 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 md:grid md:px-6 dark:text-zinc-500">
                <span>Account</span>
                <span>Asset</span>
                <span className="text-right">Change</span>
                <span className="text-right">USD</span>
              </div>
              {changes.length === 0 && <EmptyRow>no balance changed</EmptyRow>}
              {[...changes]
                .sort((a, b) => a.address.localeCompare(b.address) || (a.token ?? "").localeCompare(b.token ?? ""))
                .map((c, i, arr) => {
                  const tok = c.token ? tokens.get(c.token) : undefined;
                  const neg = c.delta < 0n;
                  const abs = neg ? -c.delta : c.delta;
                  const usdText = c.token ? (tok ? usdOfToken(abs, tok.decimals, prices.get(c.token)) : undefined) : usdOfWei(abs, usd);
                  const first = i === 0 || arr[i - 1].address !== c.address;
                  return (
                    <div key={`${c.address}-${c.token}`} className="grid grid-cols-2 items-center gap-x-4 gap-y-1 px-5 py-2.5 font-mono text-[12.5px] transition-colors hover:bg-zinc-50/60 md:h-11 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,12rem)_8rem] md:py-0 md:px-6 dark:hover:bg-zinc-900/60">
                      <span className="min-w-0">{first ? <Who addr={c.address} n={n} /> : null}</span>
                      <span className="flex min-w-0 items-center gap-1.5">
                        {c.token ? (
                          tok ? <TokenMark address={c.token} chainId={chainId} token={tok} size={14} /> : <HashChip value={c.token} href={`${base}/address/${c.token}`} len={8} />
                        ) : (
                          <NativeMark symbol={symbol} size={14} />
                        )}
                      </span>
                      <span className={cn("tabular-nums md:text-right", neg ? C.no : C.yes)}>
                        {neg ? "−" : "+"}
                        {c.token ? (tok ? formatTokenAmount(abs, tok.decimals) : abs.toString()) : (Number(abs) / 1e18).toLocaleString("en-US", { maximumFractionDigits: 6 })}{" "}
                        <span className="text-[11px] text-zinc-400 dark:text-zinc-500">{c.token ? tok?.symbol ?? "" : symbol}</span>
                      </span>
                      <span className="tabular-nums text-zinc-500 md:text-right dark:text-zinc-400">{usdText ?? "—"}</span>
                    </div>
                  );
                })}
            </Board>
          )}

          {tab === "state" && (
            <Board>
              <div className="hidden grid-cols-[minmax(0,1fr)_minmax(0,1.8fr)_minmax(0,1.1fr)_1.5rem_minmax(0,1.1fr)] gap-4 px-5 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 md:grid md:px-6 dark:text-zinc-500">
                <span>Contract</span>
                <span>Slot</span>
                <span className="text-right">Before</span>
                <span />
                <span>After</span>
              </div>
              {storage.length === 0 && <EmptyRow>no storage written</EmptyRow>}
              {storage.map((s, i, arr) => {
                const first = i === 0 || arr[i - 1].contract !== s.contract;
                const label = slotLabels.get(s.slot.toLowerCase());
                return (
                  <div key={`${s.contract}-${s.slot}`} className="grid grid-cols-2 items-center gap-x-4 gap-y-1 px-5 py-2.5 font-mono text-[12px] transition-colors hover:bg-zinc-50/60 md:min-h-10 md:grid-cols-[minmax(0,1fr)_minmax(0,1.8fr)_minmax(0,1.1fr)_1.5rem_minmax(0,1.1fr)] md:py-1 md:px-6 dark:hover:bg-zinc-900/60">
                    <span className="min-w-0">{first ? <Who addr={s.contract} n={n} /> : null}</span>
                    <span className="flex min-w-0 items-center gap-1.5" title={s.slot}>
                      {label ? (
                        <>
                          <span className="text-zinc-400 dark:text-zinc-500">slot {label.base}</span>
                          {label.keys.map((k, ki) => (
                            <span key={ki} className="inline-flex items-center">
                              <span className="text-zinc-300 dark:text-zinc-700">[</span>
                              <Who addr={k} n={n} />
                              <span className="text-zinc-300 dark:text-zinc-700">]</span>
                            </span>
                          ))}
                        </>
                      ) : (
                        <span className={cn("break-all text-[11px]", C.bytes)}>{s.slot}</span>
                      )}
                    </span>
                    <span className="min-w-0 md:text-right"><V v={slotValue(s.contract, s.before)} className="text-zinc-500 dark:text-zinc-400" /></span>
                    <span className={cn("text-center", C.punct)}>→</span>
                    <span className="min-w-0"><V v={slotValue(s.contract, s.after)} /></span>
                  </div>
                );
              })}
              {storage.length > 0 && (
                <div className="px-5 py-2.5 font-mono text-[10px] text-zinc-400 md:px-6 dark:text-zinc-500">
                  mapping keys recovered where the key is an address this execution touched; other slots keep their hash
                </div>
              )}
            </Board>
          )}

          {tab === "gas" && (
            <div className="grid gap-8 lg:grid-cols-2">
              <Board>
                <div className="grid grid-cols-[minmax(0,1fr)_9rem] gap-4 px-5 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 md:px-6 dark:text-zinc-500">
                  <span>Frame (own gas)</span>
                  <span className="text-right">Gas</span>
                </div>
                {[...frames]
                  .sort((a, b) => b.selfGas - a.selfGas)
                  .slice(0, 10)
                  .map((f) => {
                    const d = decodeCall(f.frame, n);
                    return (
                      <div key={f.id} className="grid grid-cols-[minmax(0,1fr)_9rem] items-center gap-4 px-5 py-2 font-mono text-[12px] md:px-6">
                        <span className="flex min-w-0 items-center gap-1.5">
                          <Who addr={f.frame.to} n={n} />
                          <span className={C.punct}>.</span>
                          <span className={cn("truncate", C.fn)}>{d?.name ?? f.frame.input.slice(0, 10)}</span>
                        </span>
                        <span className="flex items-center justify-end gap-2 tabular-nums text-zinc-700 dark:text-zinc-300">
                          <span className="h-1 w-16 bg-zinc-100 dark:bg-zinc-900">
                            <span className="block h-full bg-[#A2AFB2] dark:bg-zinc-600" style={{ width: `${Math.max(2, Math.round((f.selfGas / Math.max(1, totalGas)) * 100))}%` }} />
                          </span>
                          {f.selfGas.toLocaleString("en-US")}
                        </span>
                      </div>
                    );
                  })}
                <div className="px-5 py-2.5 font-mono text-[10px] text-zinc-400 md:px-6 dark:text-zinc-500">
                  {totalGas.toLocaleString("en-US")} gas in total · a frame's own gas excludes the calls it made
                </div>
              </Board>
              <Board>
                <div className="grid grid-cols-[minmax(0,1fr)_5rem_7rem] gap-4 px-5 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 md:px-6 dark:text-zinc-500">
                  <span>Opcode</span>
                  <span className="text-right">Count</span>
                  <span className="text-right">Gas</span>
                </div>
                {(trace.opcodes ?? [])
                  .filter((o) => !CALL_OPS.has(o.op))
                  .slice(0, 10)
                  .map((o) => (
                    <div key={o.op} className="grid grid-cols-[minmax(0,1fr)_5rem_7rem] items-center gap-4 px-5 py-2 font-mono text-[12px] md:px-6">
                      <span className="text-zinc-700 dark:text-zinc-300">{o.op}</span>
                      <span className="text-right tabular-nums text-zinc-500 dark:text-zinc-400">{o.count.toLocaleString("en-US")}</span>
                      <span className="text-right tabular-nums text-zinc-700 dark:text-zinc-300">{o.gas.toLocaleString("en-US")}</span>
                    </div>
                  ))}
                <div className="px-5 py-2.5 font-mono text-[10px] text-zinc-400 md:px-6 dark:text-zinc-500">
                  {trace.steps?.toLocaleString("en-US") ?? "—"} opcodes executed · call opcodes omitted: the EVM books the gas they forward as their own cost
                </div>
              </Board>
            </div>
          )}
        </>
      )}
    </section>
  );
}
