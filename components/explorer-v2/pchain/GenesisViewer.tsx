"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Copy, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { Board, HashChip, SectionHeader, SpecPlate, SpecRow } from "@/components/explorer-v2/ui";
import { formatTime } from "@/components/explorer-v2/format";

/* CreateChainTx genesisData → readable. The node's JSON codec ships the
   genesis bytes base64-encoded; for EVM chains those bytes ARE the genesis
   JSON — the chain's founding document. Decode defensively: custom VMs can
   put anything in there, and the viewer must degrade, never break the page. */

interface DecodedGenesis {
  /** parsed document, when the bytes are JSON */
  json?: Record<string, unknown>;
  /** pretty-printed text of whatever decoded */
  text: string;
}

export function decodeGenesisData(genesisData: unknown): DecodedGenesis | null {
  if (genesisData == null) return null;
  // some encodings hand the document over already parsed
  if (typeof genesisData === "object") {
    return {
      json: genesisData as Record<string, unknown>,
      text: JSON.stringify(genesisData, null, 2),
    };
  }
  if (typeof genesisData !== "string") return null;
  let bytes: Uint8Array | null = null;
  if (/^0x[0-9a-fA-F]*$/.test(genesisData)) {
    const clean = genesisData.slice(2);
    bytes = new Uint8Array(clean.length / 2);
    for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  } else {
    try {
      bytes = Uint8Array.from(atob(genesisData), (c) => c.charCodeAt(0));
    } catch {
      return null;
    }
  }
  const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  try {
    const json = JSON.parse(text) as Record<string, unknown>;
    return { json, text: JSON.stringify(json, null, 2) };
  } catch {
    // not JSON — worth showing only if it reads as text, not binary noise
    const nonPrintable = text.replace(/[\x20-\x7e\s]/g, "");
    return nonPrintable.length / Math.max(text.length, 1) < 0.05 ? { text } : null;
  }
}

/* Subnet-EVM stateful precompiles, keyed as they appear in genesis config. */
const PRECOMPILE_NAMES: Record<string, string> = {
  contractDeployerAllowListConfig: "Contract Deployer Allow List",
  contractNativeMinterConfig: "Native Minter",
  txAllowListConfig: "Transaction Allow List",
  feeManagerConfig: "Fee Manager",
  rewardManagerConfig: "Reward Manager",
  warpConfig: "Warp Messaging",
};

interface EvmOverview {
  chainId?: number;
  gasLimit?: number;
  targetBlockRate?: number;
  minBaseFee?: number;
  targetGas?: number;
  timestamp?: number;
  precompiles: string[];
  alloc: { address: string; balance: string; contract: boolean }[];
}

/* one subnet-evm GenesisAccount — alloc entries can be funded accounts
   (balance) or predeployed contracts (code/storage/nonce), or both */
interface GenesisAccount {
  balance?: string;
  code?: string;
  storage?: Record<string, string>;
  nonce?: string | number;
}

function asNumber(v: unknown): number | undefined {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = v.startsWith("0x") ? parseInt(v, 16) : Number(v);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

function evmOverview(g: Record<string, unknown>): EvmOverview | null {
  const config = g.config as Record<string, unknown> | undefined;
  if (!config || typeof config !== "object") return null;
  const fee = (config.feeConfig ?? {}) as Record<string, unknown>;
  const allocObj = (g.alloc ?? {}) as Record<string, GenesisAccount>;
  const alloc = Object.entries(allocObj)
    .map(([addr, v]) => ({
      address: addr.startsWith("0x") ? addr : `0x${addr}`,
      balance: v?.balance ?? "0",
      contract: typeof v?.code === "string" && v.code.length > 2,
    }))
    .sort((a, b) => {
      try {
        return BigInt(b.balance) > BigInt(a.balance) ? 1 : -1;
      } catch {
        return 0;
      }
    });
  return {
    chainId: asNumber(config.chainId),
    gasLimit: asNumber(fee.gasLimit) ?? asNumber(g.gasLimit),
    targetBlockRate: asNumber(fee.targetBlockRate),
    minBaseFee: asNumber(fee.minBaseFee),
    targetGas: asNumber(fee.targetGas),
    timestamp: asNumber(g.timestamp),
    precompiles: Object.keys(config).filter(
      (k) => k.endsWith("Config") && k !== "feeConfig" && config[k] != null,
    ),
    alloc,
  };
}

const MAX_UINT256 = (1n << 256n) - 1n;

/* wei (hex or decimal string) → whole native-token units, 2dp when needed.
   Genesis balances can be absurd on purpose — a faucet chain allocates
   max uint256 (~1.16e59 tokens) to one key. Never expand those into a
   60-character comma string: it crushes the address column into a one-
   character-per-line ribbon. */
function formatTokenBalance(balance: string): string {
  let v: bigint;
  try {
    v = BigInt(balance);
  } catch {
    return balance;
  }
  if (v === MAX_UINT256) return "MAX";
  const whole = v / 10n ** 18n;
  if (whole >= 10n ** 15n) {
    // beyond any real supply — exponent form keeps the column sane
    const s = whole.toString();
    return `${s[0]}.${s.slice(1, 3)}e${s.length - 1}`;
  }
  const cents = ((v % 10n ** 18n) * 100n) / 10n ** 18n;
  const w = whole.toLocaleString("en-US");
  return cents > 0n ? `${w}.${cents.toString().padStart(2, "0")}` : w;
}

const ALLOC_PREVIEW = 8;

/* The genesis instrument: an Overview board reading the founding config
   like a spec sheet (chain id, fee market, precompiles, allocations), and
   the raw JSON verbatim — copy and download always at hand. Shared by the
   CreateChainTx page and the chain Details tab. */
export function GenesisViewer({
  genesisData,
  loading = false,
  label = "Genesis",
}: {
  genesisData: unknown;
  loading?: boolean;
  label?: string;
}) {
  const decoded = useMemo(() => decodeGenesisData(genesisData), [genesisData]);
  const overview = useMemo(
    () => (decoded?.json ? evmOverview(decoded.json) : null),
    [decoded],
  );
  const [view, setView] = useState<"overview" | "json">("json");
  // the data lands async — jump to the richer view the moment it parses
  useEffect(() => {
    setView(overview ? "overview" : "json");
  }, [overview]);
  const [copied, setCopied] = useState(false);
  const [showAllAlloc, setShowAllAlloc] = useState(false);

  if (!loading && !decoded) {
    // undecodable payload: state the fact quietly rather than hiding the row
    return (
      <section className="flex flex-col gap-4">
        <SectionHeader label={label} />
        <Board divide={false} className="px-5 py-6 text-center md:px-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-400 dark:text-zinc-500">
            Genesis payload is not decodable as text
          </p>
        </Board>
      </section>
    );
  }

  const copy = async () => {
    if (!decoded) return;
    try {
      await navigator.clipboard.writeText(decoded.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* text is selectable anyway */
    }
  };

  const download = () => {
    if (!decoded) return;
    const blob = new Blob([decoded.text], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "genesis.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const visibleAlloc = overview
    ? showAllAlloc
      ? overview.alloc
      : overview.alloc.slice(0, ALLOC_PREVIEW)
    : [];

  return (
    <section className="flex flex-col gap-4">
      <SectionHeader
        label={label}
        action={
          decoded ? (
            <span className="flex shrink-0 items-center gap-4">
              {overview && (
                <div className="inline-flex border border-zinc-200 dark:border-zinc-800">
                  {(["overview", "json"] as const).map((v) => (
                    <button
                      key={v}
                      onClick={() => setView(v)}
                      className={cn(
                        "px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.14em] transition-colors",
                        view === v
                          ? "bg-zinc-900 text-zinc-50 dark:bg-zinc-50 dark:text-zinc-900"
                          : "text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900",
                      )}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              )}
              <button
                onClick={copy}
                className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              >
                {copied ? <Check className="h-3 w-3 text-[#E6212F]" /> : <Copy className="h-3 w-3" />}
                Copy
              </button>
              <button
                onClick={download}
                className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              >
                <Download className="h-3 w-3" />
                genesis.json
              </button>
            </span>
          ) : undefined
        }
      />
      {loading || !decoded ? (
        <Board divide={false} className="px-5 py-4 md:px-6">
          <div className="flex flex-col gap-3 py-1">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-3 w-2/3 animate-pulse bg-zinc-100 dark:bg-zinc-900" />
            ))}
          </div>
        </Board>
      ) : view === "overview" && overview ? (
        <div className="grid items-start gap-8 lg:grid-cols-2">
          <Board divide={false} className="px-5 py-4 md:px-6">
            <SpecPlate>
              {overview.chainId !== undefined && (
                <SpecRow label="EVM Chain ID">
                  <span className="inline-flex items-baseline gap-2">
                    <span className="font-mono">{overview.chainId}</span>
                    <span className="font-mono text-[11px] text-zinc-400 dark:text-zinc-500">
                      0x{overview.chainId.toString(16)}
                    </span>
                  </span>
                </SpecRow>
              )}
              {overview.gasLimit !== undefined && (
                <SpecRow label="Gas Limit">{overview.gasLimit.toLocaleString("en-US")}</SpecRow>
              )}
              {overview.targetBlockRate !== undefined && (
                <SpecRow label="Target Block Rate">{overview.targetBlockRate}s</SpecRow>
              )}
              {overview.minBaseFee !== undefined && (
                <SpecRow label="Min Base Fee">
                  {(overview.minBaseFee / 1e9).toLocaleString("en-US")} gwei
                </SpecRow>
              )}
              {overview.targetGas !== undefined && (
                <SpecRow label="Target Gas">{overview.targetGas.toLocaleString("en-US")}</SpecRow>
              )}
              {overview.timestamp !== undefined && overview.timestamp > 0 && (
                <SpecRow label="Genesis Time">{formatTime(overview.timestamp)}</SpecRow>
              )}
              {overview.precompiles.length > 0 && (
                <SpecRow label="Precompiles" align="start">
                  <span className="flex flex-wrap justify-end gap-1.5">
                    {overview.precompiles.map((p) => (
                      <span
                        key={p}
                        className="border border-[#0061E2]/35 bg-[#0061E2]/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-[#0052bd] dark:border-[#0061E2]/50 dark:text-[#5f9dff]"
                      >
                        {PRECOMPILE_NAMES[p] ?? p.replace(/Config$/, "")}
                      </span>
                    ))}
                  </span>
                </SpecRow>
              )}
            </SpecPlate>
          </Board>
          <div className="flex flex-col gap-4">
            <Board>
              <div className="flex items-center justify-between gap-4 px-5 py-2.5 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 md:px-6 dark:text-zinc-500">
                <span>Genesis Allocations · {overview.alloc.length}</span>
                <span className="text-right">Balance</span>
              </div>
              {overview.alloc.length === 0 && (
                <div className="px-5 py-4 font-mono text-[11px] text-zinc-400 md:px-6 dark:text-zinc-500">
                  no pre-funded accounts
                </div>
              )}
              {visibleAlloc.map((a) => (
                <div
                  key={a.address}
                  className="flex items-center justify-between gap-4 px-5 py-3 md:px-6"
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    <HashChip value={a.address} len={24} />
                    {a.contract && (
                      <span className="shrink-0 border border-[#0061E2]/35 bg-[#0061E2]/10 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-[#0052bd] dark:border-[#0061E2]/50 dark:text-[#5f9dff]">
                        contract
                      </span>
                    )}
                  </span>
                  <span
                    className="shrink-0 font-mono text-[13px] tabular-nums text-zinc-900 dark:text-zinc-100"
                    title={a.balance}
                  >
                    {formatTokenBalance(a.balance)}
                  </span>
                </div>
              ))}
            </Board>
            {overview.alloc.length > ALLOC_PREVIEW && (
              <button
                onClick={() => setShowAllAlloc((v) => !v)}
                className="mx-auto border border-zinc-200 px-5 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-zinc-600 transition-colors hover:border-zinc-900 hover:text-zinc-900 dark:border-zinc-800 dark:text-zinc-300 dark:hover:border-zinc-100 dark:hover:text-zinc-100"
              >
                {showAllAlloc ? "Show fewer" : `Show all ${overview.alloc.length}`}
              </button>
            )}
          </div>
        </div>
      ) : (
        <Board divide={false}>
          <pre className="max-h-[36rem] overflow-auto whitespace-pre-wrap break-all px-5 py-4 font-mono text-[11.5px] leading-relaxed text-zinc-700 md:px-6 dark:text-zinc-300">
            {decoded.text}
          </pre>
        </Board>
      )}
    </section>
  );
}
