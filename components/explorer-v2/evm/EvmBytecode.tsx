"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Check, Copy, ShieldCheck } from "lucide-react";
import { keccak256 } from "viem";
import { cn } from "@/lib/utils";
import { Board, HashChip, SpecLine, SpecSheet } from "@/components/explorer-v2/ui";
import { formatNumber } from "@/components/explorer-v2/format";
import { rpcBatch } from "./useHeadStream";
import { useVerifiedContract } from "./EvmContract";
import { useSignatures } from "@/lib/token-list";
import { isGenesisCode } from "@/lib/evm-explorer";

/* What an unverified contract still tells you, read off the chain: its
   runtime bytecode (size, hash, the compiler that produced it), whether
   it is a proxy and to what, and the functions its dispatcher answers
   to, named where the signature database knows the selector. Then the
   door to verification. */

const SLOT_IMPL = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc"; // EIP-1967 implementation
const SLOT_BEACON = "0xa3f0ad74e5423aebfd80d3ef4346578335a9a72aeaee59ff6cb3582b35133d50"; // EIP-1967 beacon
const SLOT_ADMIN = "0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103"; // EIP-1967 admin

interface CodeFacts {
  code: string;
  bytes: number;
  hash: string;
  solc: string | null;
  implementation: string | null;
  beacon: string | null;
  admin: string | null;
  selectors: string[];
}

const toBytes = (hex: string): Uint8Array => {
  const h = hex.replace(/^0x/, "");
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
  return out;
};
const toHex = (b: Uint8Array): string => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
const indexOf = (hay: Uint8Array, needle: Uint8Array): number => {
  outer: for (let i = 0; i + needle.length <= hay.length; i++) {
    for (let j = 0; j < needle.length; j++) if (hay[i + j] !== needle[j]) continue outer;
    return i;
  }
  return -1;
};

const slotAddr = (word: string | null): string | null => {
  if (!word || /^0x0*$/.test(word)) return null;
  const a = `0x${word.slice(-40)}`;
  return /^0x0{40}$/.test(a) ? null : a;
};

/** the dispatcher's selectors: PUSH4 immediates followed by EQ (or DUP2 EQ) */
function scanSelectors(code: string): string[] {
  const b = toBytes(code);
  const out = new Set<string>();
  for (let i = 0; i < b.length; ) {
    const op = b[i];
    if (op === 0x63 && i + 5 < b.length && (b[i + 5] === 0x14 || (b[i + 5] === 0x81 && i + 6 < b.length && b[i + 6] === 0x14))) {
      out.add(`0x${toHex(b.subarray(i + 1, i + 5))}`);
    }
    // skip PUSH immediates so data never reads as opcodes
    i += op >= 0x60 && op <= 0x7f ? op - 0x5f + 1 : 1;
  }
  return [...out].sort();
}

/** the solc version solidity stamps into its CBOR metadata trailer */
function solcVersion(code: string): string | null {
  const b = toBytes(code);
  const at = indexOf(b, new TextEncoder().encode("dsolcC"));
  if (at < 0 || at + 9 > b.length) return null;
  return `${b[at + 6]}.${b[at + 7]}.${b[at + 8]}`;
}

function useCodeFacts(rpcUrl: string | undefined, addr: string): { facts: CodeFacts | null; loading: boolean } {
  const [facts, setFacts] = useState<CodeFacts | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setFacts(null);
    setLoading(true);
    if (!rpcUrl) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    rpcBatch<string>(
      rpcUrl,
      [
        { method: "eth_getCode", params: [addr, "latest"] },
        { method: "eth_getStorageAt", params: [addr, SLOT_IMPL, "latest"] },
        { method: "eth_getStorageAt", params: [addr, SLOT_BEACON, "latest"] },
        { method: "eth_getStorageAt", params: [addr, SLOT_ADMIN, "latest"] },
      ],
      controller.signal,
    )
      .then(([code, impl, beacon, admin]) => {
        if (controller.signal.aborted) return;
        const c = code ?? "0x";
        setFacts({
          code: c,
          bytes: (c.length - 2) / 2,
          hash: c === "0x" ? "" : keccak256(c as `0x${string}`),
          solc: solcVersion(c),
          implementation: slotAddr(impl),
          beacon: slotAddr(beacon),
          admin: slotAddr(admin),
          selectors: scanSelectors(c),
        });
        setLoading(false);
      })
      .catch(() => !controller.signal.aborted && setLoading(false));
    return () => controller.abort();
  }, [rpcUrl, addr]);
  return { facts, loading };
}

function CopyText({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        void navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
      className="flex items-center gap-1.5 border border-zinc-200 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-500 transition-colors hover:border-zinc-400 hover:text-zinc-900 dark:border-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100"
    >
      {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
      {copied ? "Copied" : label}
    </button>
  );
}

export function EvmBytecode({ addr, base, chainId, rpcUrl }: { addr: string; base: string; chainId: string; rpcUrl: string | undefined }) {
  const { facts, loading } = useCodeFacts(rpcUrl, addr);
  const [full, setFull] = useState(false);
  const sigs = useSignatures(facts?.selectors ?? [], []);
  const implTarget = facts?.implementation ?? facts?.beacon ?? null;
  const { contract: implVerified } = useVerifiedContract(chainId, implTarget ?? "0x0000000000000000000000000000000000000000");
  const verifyHref = `${base}/verify/${addr.toLowerCase()}`;
  // genesis code has no deploy tx and no source to submit: say where it
  // came from instead of offering verification
  const genesis = isGenesisCode(chainId, addr);

  const functions = useMemo(
    () =>
      (facts?.selectors ?? []).map((sel) => {
        const hit = sigs.fn.get(sel);
        return { sel, name: hit?.name ?? null, verified: hit?.verified ?? false };
      }),
    [facts, sigs],
  );
  const named = functions.filter((f) => f.name).sort((a, b) => a.name!.localeCompare(b.name!));
  const unnamed = functions.filter((f) => !f.name);

  return (
    <div className="flex flex-col gap-4">
      {/* what the chain knows, and the door to telling it more */}
      <Board divide={false} className="px-5 md:px-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-200 py-3 dark:border-zinc-800">
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">{genesis ? "Genesis code" : "Source not verified"}</span>
          {!genesis && <Link
            href={verifyHref}
            className="inline-flex items-center gap-2 border border-zinc-900 bg-zinc-900 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-white transition-opacity hover:opacity-90 dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
          >
            <ShieldCheck className="size-3.5" />
            Verify contract
          </Link>}
        </div>
        <SpecSheet>
          {loading && <SpecLine label="Bytecode">…</SpecLine>}
          {facts && facts.bytes === 0 && <SpecLine label="Bytecode">none: no code at this address</SpecLine>}
          {facts && facts.bytes > 0 && (
            <>
              <SpecLine label="Bytecode">
                {formatNumber(facts.bytes)} bytes
                {facts.solc && <span className="text-zinc-500 dark:text-zinc-400"> · solc {facts.solc}</span>}
              </SpecLine>
              {genesis && (
                <SpecLine label="Origin">
                  C-Chain genesis
                  <span className="text-zinc-500 dark:text-zinc-400"> · allocated at launch, not deployed by a transaction</span>
                </SpecLine>
              )}
              <SpecLine label="Code Hash">
                <HashChip value={facts.hash} len={66} />
              </SpecLine>
              {implTarget && (
                <SpecLine label={facts.beacon && !facts.implementation ? "Beacon" : "Implementation"}>
                  <span className="inline-flex max-w-full flex-wrap items-baseline gap-x-3 gap-y-1">
                    {implVerified?.name && <span>{implVerified.name}</span>}
                    <HashChip value={implTarget} href={`${base}/address/${implTarget}`} len={66} className={implVerified?.name ? "text-zinc-400 dark:text-zinc-500" : undefined} />
                    <span className="text-[12px] font-normal text-zinc-400 dark:text-zinc-500">EIP-1967 proxy · calls here run that contract's code</span>
                  </span>
                </SpecLine>
              )}
              {facts.admin && (
                <SpecLine label="Proxy Admin">
                  <HashChip value={facts.admin} href={`${base}/address/${facts.admin}`} len={66} />
                </SpecLine>
              )}
            </>
          )}
        </SpecSheet>
      </Board>

      {/* genesis code: say what it can do before listing anything that
          reads like a way to move the burned AVAX */}
      {genesis && facts && facts.bytes > 0 && (
        <Board divide={false}>
          <div className="border-b border-zinc-200 px-5 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 md:px-6 dark:border-zinc-800 dark:text-zinc-500">
            What this code can do
          </div>
          <div className="flex flex-col gap-3 px-5 py-4 text-[14px] leading-relaxed text-zinc-700 md:px-6 dark:text-zinc-300">
            <p>
              <span className="font-medium text-zinc-900 dark:text-zinc-50">Nothing: every call to it reverts.</span> It cannot move the burned AVAX held here. No
              key controls this address, and the code holds no call, transfer or self-destruct instruction that could send value out.
            </p>
            <p className="text-zinc-500 dark:text-zinc-400">
              Its two entry points used opcodes from Avalanche&apos;s early multi-coin feature (<span className="font-mono text-[12px]">0xcd</span>,{" "}
              <span className="font-mono text-[12px]">0xcf</span>), which the C-Chain no longer executes, so a call to either one reverts.
            </p>
            <p className="font-mono text-[11px] text-zinc-400 dark:text-zinc-500">
              {facts.selectors.map((sel) => {
                const name = sigs.fn.get(sel)?.name;
                return (
                  <span key={sel} className="mr-5 inline-block">
                    {sel}
                    {name && <span className="ml-1.5">{name.split("(")[0]}, retired</span>}
                  </span>
                );
              })}
            </p>
          </div>
        </Board>
      )}

      {/* the interface, read off the dispatcher */}
      {!genesis && facts && facts.selectors.length > 0 && (
        <Board divide={false}>
          <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 md:px-6 dark:border-zinc-800 dark:text-zinc-500">
            <span>Functions · {facts.selectors.length} selectors in the dispatcher</span>
            <span>{named.length} named</span>
          </div>
          <div className="grid grid-cols-1 gap-x-8 px-5 py-2 font-mono text-[12px] sm:grid-cols-2 lg:grid-cols-3 md:px-6">
            {named.map((f) => (
              <span key={f.sel} className="flex min-h-7 items-baseline gap-2" title={f.verified ? "from a verified contract with this selector" : "from the signature database"}>
                <span className={cn("text-violet-700 dark:text-violet-300", !f.verified && "underline decoration-dotted decoration-current underline-offset-4")}>{f.name!.split("(")[0]}</span>
                <span className="truncate text-zinc-400 dark:text-zinc-500">({f.name!.slice(f.name!.indexOf("(") + 1, -1)})</span>
                <span className="ml-auto shrink-0 text-[10px] text-zinc-300 dark:text-zinc-700">{f.sel}</span>
              </span>
            ))}
            {unnamed.map((f) => (
              <span key={f.sel} className="flex min-h-7 items-baseline gap-2 text-zinc-400 dark:text-zinc-500">
                {f.sel}
              </span>
            ))}
          </div>
          <div className="px-5 py-2 font-mono text-[10px] text-zinc-400 md:px-6 dark:text-zinc-500">
            selectors read from PUSH4 EQ patterns in the runtime code; names from the signature database, dotted where no verified contract backs them
          </div>
        </Board>
      )}

      {/* the code itself */}
      {facts && facts.bytes > 0 && (
        <Board divide={false}>
          <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 md:px-6 dark:border-zinc-800 dark:text-zinc-500">
            <span>Runtime bytecode</span>
            <span className="flex items-center gap-2">
              <button onClick={() => setFull((v) => !v)} className="border border-zinc-200 px-2 py-1 transition-colors hover:border-zinc-400 hover:text-zinc-900 dark:border-zinc-800 dark:hover:text-zinc-100">
                {full ? "Collapse" : "Expand"}
              </button>
              <CopyText text={facts.code} label="Copy" />
            </span>
          </div>
          <pre className={cn("overflow-auto whitespace-pre-wrap break-all px-5 py-4 font-mono text-[11px] leading-relaxed text-zinc-600 md:px-6 dark:text-zinc-400", !full && "max-h-40")}>{facts.code}</pre>
        </Board>
      )}
    </div>
  );
}
