"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, X } from "lucide-react";
import {
  decodeAbiParameters,
  decodeFunctionData,
  decodeFunctionResult,
  encodeAbiParameters,
  parseAbiItem,
  parseAbiParameters,
  toFunctionSelector,
  type Abi,
  type AbiFunction,
  type AbiParameter,
} from "viem";
import { cn } from "@/lib/utils";
import { Board, HashChip, HEAD } from "@/components/explorer-v2/ui";
import { Tabs, EmptyRow } from "./AddressTables";
import { TokenMark } from "./TokenMark";
import { useUnlistedTokenMeta } from "./useErc20";
import { useVerifiedContracts, decodeEventWithAbi, type SourcifyContract } from "@/lib/sourcify-client";
import { decodeEventLog as registryDecodeEvent, decodeFunctionInput as registryDecodeInput } from "@/abi/event-signatures.generated";
import { declaredSymbol, formatTokenAmount, usdOfToken, useSignatures, useTokenList, useTokenPrices, type SignatureHit, type TokenMap } from "@/lib/token-list";
import { knownAddress } from "@/lib/evm-explorer";
import { readRpc } from "@/lib/explorer-rpc";
import type { TraceState } from "./useTrace";
import { GasTab } from "./EvmTraceGas";
import { TRACE_INK as C } from "./trace-ink";
import { balanceChanges, contractsIn, flatten, hexBig, hexInt, type BalanceChange, type FlatFrame, type TraceFrame, type TraceResponse } from "@/lib/trace";

/* The execution, dissected, in four views a developer actually reaches
   for: the call tree (what happened, in order), the events, the token
   balance changes (who ended up with what), and where the gas went
   (EvmTraceGas.tsx). The trace comes from the ingestion pipeline
   (useTrace.ts), which records no per-call errors and no link from an
   event to the call that emitted it: only the top call of a reverted tx is
   marked, and the events are one list. Names come from the token list,
   Sourcify, the selector registry, then the signature database; anything
   still unknown stays honest hex. */

type Tab = "calls" | "events" | "balances" | "gas";
const LABELS: Record<Tab, string> = { calls: "Call Trace", events: "Events", balances: "Balance Changes", gas: "Gas" };

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
  const inner = <span className={cn(v.kind === "address" || v.kind === "number" ? "whitespace-nowrap" : "break-all", "tabular-nums", cls, className)} title={v.title}>{v.text}</span>;
  return v.href ? <Link href={v.href} className="hover:underline underline-offset-4" onClick={(e) => e.stopPropagation()}>{inner}</Link> : inner;
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
  return n.tokens.get(a)?.symbol ?? n.contracts.get(a)?.name ?? knownAddress(a, n.chainId)?.label ?? null;
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
        <span className={cn("whitespace-nowrap", C.addr)}>{addr}</span>
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
  const abi = f.to ? n.contracts.get(f.to.toLowerCase())?.abi ?? knownAddress(f.to, n.chainId)?.abi : null;
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
  const abi = n.contracts.get(log.address.toLowerCase())?.abi ?? knownAddress(log.address, n.chainId)?.abi;
  const viaAbi = decodeEventWithAbi(abi, log);
  if (viaAbi) return viaAbi;
  const reg = registryDecodeEvent(log);
  if (reg) return { name: reg.name, params: reg.params };
  const hit = n.sigs.ev.get((log.topics[0] ?? "").toLowerCase());
  if (hit) return decodeFromSignature(hit.name, log);
  return null;
}

/* ------------------------------------------------------------------ */
/* frame names                                                        */

/** a frame's name as one line: contract.function */
function frameLabel(f: FlatFrame, n: Names): string {
  const d = decodeCall(f.frame, n);
  // a creation's input is bytecode, not a call: its first bytes are no selector
  const fn = f.frame.type.startsWith("CREATE") ? "new contract" : d?.name ?? (f.frame.input && f.frame.input !== "0x" ? f.frame.input.slice(0, 10) : "transfer");
  const who = nameOf(f.frame.to, n);
  return who ? `${who}.${fn}` : fn;
}

/* ------------------------------------------------------------------ */
/* events                                                              */

/** one emitted event: who emitted it, its name, its decoded arguments */
function EventBody({ log, n }: { log: { address: string; topics: string[]; data: string }; n: Names }) {
  const ev = decodeLog(log, n);
  return (
    <span className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5">
      <Who addr={log.address} n={n} />
      <span className={C.punct}>.</span>
      {ev ? (
        <>
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
        </>
      ) : (
        <V v={{ kind: "bytes", text: log.topics[0] ?? "" }} />
      )}
    </span>
  );
}

export function EvmTrace({
  trace,
  state,
  retrying,
  onLoad,
  chainId,
  base,
  sender,
  symbol,
  charged,
}: {
  /** the receipt's gasUsed: what ACP-194 charged */
  charged?: number;
  trace: TraceResponse | null;
  state: TraceState;
  /** the page asks again for a trace not indexed yet */
  retrying: boolean;
  /** the user asks for the trace ("idle" until then) */
  onLoad: () => void;
  chainId: string;
  base: string;
  sender: string;
  symbol: string;
}) {
  const [tab, setTab] = useState<Tab>("calls");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const call = trace?.call;
  const logs = useMemo(() => trace?.logs ?? [], [trace]);
  const frames = useMemo(() => (call ? flatten(call) : []), [call]);
  const contracts = useMemo(() => (trace ? contractsIn(trace) : []), [trace]);
  const verified = useVerifiedContracts(chainId, contracts);
  const tokens = useTokenList(chainId);

  // selectors and topics nothing local can name go to the signature database
  const unknownSel = useMemo(() => {
    const out = new Set<string>();
    for (const f of frames) {
      const fr = f.frame;
      if (!fr.input || fr.input.length < 10) continue;
      const sel = fr.input.slice(0, 10).toLowerCase();
      const abi = fr.to ? verified.get(fr.to.toLowerCase())?.abi ?? knownAddress(fr.to, chainId)?.abi : null;
      const inAbi = abi ? (abi as Abi).some((i) => i.type === "function" && toFunctionSelector(i as AbiFunction) === sel) : false;
      if (!inAbi && !registryDecodeInput(fr.input)) out.add(sel);
    }
    return [...out];
  }, [frames, verified, chainId]);
  const unknownTopics = useMemo(() => {
    const out = new Set<string>();
    for (const log of logs) {
      const abi = verified.get(log.address.toLowerCase())?.abi ?? knownAddress(log.address, chainId)?.abi;
      if (!decodeEventWithAbi(abi, log) && !registryDecodeEvent(log) && log.topics[0]) out.add(log.topics[0].toLowerCase());
    }
    return [...out];
  }, [logs, verified, chainId]);
  const sigs = useSignatures(unknownSel, unknownTopics);

  const n: Names = { tokens, contracts: verified, sigs, chainId, base, sender };

  const changes = useMemo(() => balanceChanges({ logs }), [logs]);
  const prices = useTokenPrices(chainId, changes.map((c) => c.token));
  // an unlisted token's own decimals scale its balance changes, never its events: a pair's amount0In is not its LP token
  const unlisted = useUnlistedTokenMeta(readRpc(chainId, undefined), changes.flatMap((c) => (!tokens.get(c.token) ? [c.token] : [])));

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

  return (
    <section id="execution" className="flex scroll-mt-24 flex-col gap-4">
      {state === "idle" && (
        <Board divide={false}>
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 font-mono text-[11px] text-zinc-500 md:px-6 dark:text-zinc-400">
            <span>The execution trace: internal calls, events, token balance changes and gas per call.</span>
            <button type="button" onClick={onLoad} className="border border-zinc-300 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-900 transition-colors hover:border-[#E6212F] hover:text-[#E6212F] dark:border-zinc-700 dark:text-zinc-50">
              Load trace
            </button>
          </div>
        </Board>
      )}
      {state === "loading" && (
        <Board divide={false}>
          <div className="px-5 py-6 font-mono text-[11px] text-zinc-400 md:px-6 dark:text-zinc-500">reading the trace…</div>
        </Board>
      )}
      {(state === "error" || state === "pending") && (
        <Board divide={false}>
          <div className="px-5 py-6 font-mono text-[11px] text-zinc-400 md:px-6 dark:text-zinc-500">
            {state === "pending" ? `Trace not indexed yet${retrying ? " · trying again shortly" : ""}` : "the trace did not load"}
          </div>
        </Board>
      )}
      {trace && (
        <>
          <Tabs
            tabs={["calls", "events", "balances", "gas"]}
            active={tab}
            onChange={setTab}
            labels={{ ...LABELS, events: logs.length ? `Events · ${logs.length}` : "Events" }}
          />

          {tab === "calls" && (
            <Board divide={false}>
              <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 md:px-6 dark:border-zinc-800 dark:text-zinc-500">
                <span className="flex gap-6">
                  <button onClick={() => setCollapsed(new Set())} className="hover:text-zinc-900 dark:hover:text-zinc-100">expand all</button>
                  <button onClick={() => setCollapsed(new Set(frames.filter((f) => f.children.length && f.depth > 0).map((f) => f.id)))} className="hover:text-zinc-900 dark:hover:text-zinc-100">collapse</button>
                </span>
                <span>gas</span>
              </div>
              {/* a call tree keeps its indents: on a phone it scrolls sideways
                  inside its board instead of folding every address */}
              <div className="overflow-x-auto">
              <div className="min-w-[46rem] lg:min-w-0">
              {frames.map((f) => {
                if (hidden(f)) return null;
                const fr = f.frame;
                const d = decodeCall(fr, n);
                const value = hexBig(fr.value);
                const gas = hexInt(fr.gasUsed);
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
                      <span className={cn("w-[6.75rem] shrink-0 text-[9px] font-bold uppercase tracking-[0.14em]", C.type[fr.type] ?? C.type.CALL)}>
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
                            {d.args.length === 0 ? (
                              <span className={C.punct}>()</span>
                            ) : (
                              <>
                                <span className={C.punct}>(</span>
                                {d.args.map((a, i) => (
                                  <span key={i} className="inline-flex flex-wrap items-baseline gap-1">
                                    {a.name && <span className={cn("text-[10px]", C.param)}>{a.name}=</span>}
                                    <V v={a.value} />
                                    {i < d.args.length - 1 && <span className={C.punct}>,</span>}
                                  </span>
                                ))}
                                <span className={C.punct}>)</span>
                              </>
                            )}
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
                  </div>
                );
              })}
              </div>
              </div>
            </Board>
          )}

          {/* every event the transaction emitted, in execution order */}
          {tab === "events" && (
            <Board>
              {logs.length === 0 && (
                <EmptyRow>{trace.call.error ? "the transaction reverted, so the chain kept none of its events" : "this transaction emitted no events"}</EmptyRow>
              )}
              {logs.map((log, i) => (
                // a phone wraps a 42-character address rather than push it off the screen
                <div key={log.logIndex} className="grid grid-cols-[2.5rem_minmax(0,1fr)] items-baseline gap-x-3 px-5 py-2.5 font-mono text-[12px] max-md:[overflow-wrap:anywhere] max-md:[&_.whitespace-nowrap]:whitespace-normal md:px-6">
                  <span className="tabular-nums text-zinc-400 dark:text-zinc-500">#{i}</span>
                  <EventBody log={log} n={n} />
                </div>
              ))}
            </Board>
          )}

          {tab === "balances" && (
            <Board>
              <div className={cn(HEAD, "grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,12rem)_8rem]")}>
                <span>Account</span>
                <span>Asset</span>
                <span className="text-right">Change</span>
                <span className="text-right">USD</span>
              </div>
              {changes.length === 0 && <EmptyRow>no token balance changed</EmptyRow>}
              {[...changes]
                .sort((a, b) => {
                  // the sender first, then anyone with a name, then the rest
                  const rank = (x: BalanceChange) => (x.address === sender.toLowerCase() ? 0 : nameOf(x.address, n) ? 1 : 2);
                  return rank(a) - rank(b) || a.address.localeCompare(b.address) || a.token.localeCompare(b.token);
                })
                .map((c, i, arr) => {
                  const tok = tokens.get(c.token);
                  const amt = tok ?? unlisted.get(c.token);
                  const declared = !tok ? declaredSymbol(amt?.symbol, tokens, symbol) : null;
                  const neg = c.delta < 0n;
                  const abs = neg ? -c.delta : c.delta;
                  const usdText = amt ? usdOfToken(abs, amt.decimals, prices.get(c.token)) : undefined;
                  return (
                    <div key={`${c.address}-${c.token}`} className="grid grid-cols-2 items-center gap-x-4 gap-y-1 px-5 py-2.5 font-mono text-[12.5px] transition-colors hover:bg-zinc-50/60 md:h-11 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,12rem)_8rem] md:py-0 md:px-6 dark:hover:bg-zinc-900/60">
                      <span className="min-w-0">{i === 0 || arr[i - 1].address !== c.address ? <Who addr={c.address} n={n} /> : null}</span>
                      <span className="flex min-w-0 items-center gap-1.5">
                        {tok ? <TokenMark address={c.token} chainId={chainId} token={tok} size={14} /> : nameOf(c.token, n) ? <Who addr={c.token} n={n} /> : <HashChip value={c.token} href={`${base}/address/${c.token}`} len={8} />}
                      </span>
                      <span className={cn("tabular-nums md:text-right", neg ? C.no : C.yes)}>
                        {neg ? "−" : "+"}
                        {amt ? formatTokenAmount(abs, amt.decimals) : abs.toLocaleString("en-US")}{" "}
                        <span className={cn("text-[11px] text-zinc-400 dark:text-zinc-500", declared && "underline decoration-dotted underline-offset-2")} title={declared ? "the symbol the contract declares; the token is not on our token list" : undefined}>{tok?.symbol ?? declared ?? ""}</span>
                      </span>
                      <span className="tabular-nums text-zinc-500 md:text-right dark:text-zinc-400">{usdText ?? "—"}</span>
                    </div>
                  );
                })}
            </Board>
          )}

          {tab === "gas" && (
            <GasTab frames={frames} charged={charged} label={(f) => frameLabel(f, n)} base={base} />
          )}
        </>
      )}
    </section>
  );
}
