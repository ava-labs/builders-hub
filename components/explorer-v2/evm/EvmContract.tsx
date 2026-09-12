"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Check, Copy, ExternalLink, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { Board, CellLabel, SpecPlate, SpecRow, idInk } from "@/components/explorer-v2/ui";
import ContractReadSection from "@/components/explorer/ContractReadSection";
import ContractWriteSection from "@/components/explorer/ContractWriteSection";
import SourceCodeViewer from "@/components/explorer/SourceCodeViewer";
import { fetchVerifiedContract, type SourcifyContract } from "@/lib/sourcify-client";
import { useChainContext } from "@/app/(home)/explorer/[network]/[chain]/layout.client";

/* ------------------------------------------------------------------ */
/* The Contract tab.                                                   */
/*                                                                     */
/* Verified source, ABI, and the read/write consoles. The heavy pieces */
/* are the long-standing components under components/explorer; what    */
/* lives here is the tab shell, the verification provenance, and the   */
/* path to the verify form when the contract is unverified.            */
/* ------------------------------------------------------------------ */

interface ContractSources {
  sources: Record<string, { content: string }>;
  optimizer: { enabled: boolean; runs: number | null } | null;
  evmVersion: string | null;
  origin: "builder-hub" | "sourcify";
}

/** Whether an address holds code. Cheap enough to ask the chain directly,
 *  and the only way to tell a contract from a wallet before any indexer
 *  has an opinion. */
export function useIsContract(rpcUrl: string | undefined, address: string): boolean | null {
  const [isContract, setIsContract] = useState<boolean | null>(null);

  useEffect(() => {
    if (!rpcUrl) {
      setIsContract(null);
      return;
    }
    let cancelled = false;
    setIsContract(null);

    fetch(rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_getCode", params: [address, "latest"] }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { result?: string } | null) => {
        if (cancelled) return;
        const code = body?.result;
        setIsContract(typeof code === "string" ? code !== "0x" && code.length > 2 : null);
      })
      .catch(() => {
        if (!cancelled) setIsContract(null);
      });

    return () => {
      cancelled = true;
    };
  }, [rpcUrl, address]);

  return isContract;
}

/** How long to keep asking when we arrived expecting a verified contract. */
const SETTLE_TIMEOUT_MS = 30_000;
const SETTLE_INTERVAL_MS = 2_000;

export function useVerifiedContract(
  chainId: string,
  address: string,
  options?: {
    /** We just verified this contract, so "unverified" is the wrong answer
     *  and worth re-asking for. A CDN or browser can still be holding a
     *  miss from before the verification landed. */
    expectVerified?: boolean;
  },
) {
  const [contract, setContract] = useState<SourcifyContract | null>(null);
  const [loading, setLoading] = useState(true);
  const expectVerified = options?.expectVerified ?? false;

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = Date.now() + SETTLE_TIMEOUT_MS;
    setLoading(true);

    const ask = (force: boolean) => {
      fetchVerifiedContract(chainId, address, force ? { force: true } : undefined)
        .then((found) => {
          if (cancelled) return;
          setContract(found);
          setLoading(false);
          // Keep asking only while we have reason to believe the answer is
          // about to change, and only until it does.
          if (!found && expectVerified && Date.now() < deadline) {
            timer = setTimeout(() => ask(true), SETTLE_INTERVAL_MS);
          }
        })
        .catch(() => {
          if (!cancelled) setLoading(false);
        });
    };

    ask(expectVerified);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [chainId, address, expectVerified]);

  return { contract, loading };
}

type SubTab = "code" | "read" | "write";

const SUB_TABS: { id: SubTab; label: string }[] = [
  { id: "code", label: "Code" },
  { id: "read", label: "Read" },
  { id: "write", label: "Write" },
];

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors",
        active
          ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
          : "border-zinc-200 bg-white/80 text-zinc-500 hover:border-zinc-400 hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950/80 dark:text-zinc-400 dark:hover:text-zinc-100",
      )}
    >
      {children}
    </button>
  );
}

function CopyAbiButton({ abi }: { abi: unknown[] }) {
  const [copied, setCopied] = useState(false);
  const copy = useCallback(() => {
    void navigator.clipboard.writeText(JSON.stringify(abi, null, 2)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [abi]);

  return (
    <button
      onClick={copy}
      className="flex items-center gap-1.5 border border-zinc-200 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-500 transition-colors hover:border-zinc-400 hover:text-zinc-900 dark:border-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100"
    >
      {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
      {copied ? "Copied" : "Copy ABI"}
    </button>
  );
}

function Unverified({ verifyHref }: { verifyHref: string }) {
  return (
    <Board divide={false} className="px-6 py-12 text-center">
      <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-400 dark:text-zinc-500">
        Source code not verified
      </p>
      <p className="mx-auto mt-4 max-w-lg text-[13px] leading-relaxed text-zinc-500 dark:text-zinc-400">
        Verify this contract to publish its source and ABI here, and to make every call and event
        against it decode by name across the explorer.
      </p>
      <Link
        href={verifyHref}
        className="mt-6 inline-flex items-center gap-2 border border-zinc-900 bg-zinc-900 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-white transition-opacity hover:opacity-90 dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
      >
        <ShieldCheck className="size-3.5" />
        Verify contract
      </Link>
    </Board>
  );
}

export function EvmContract({
  network,
  addr,
  justVerified,
}: {
  network: string;
  addr: string;
  justVerified?: boolean;
}) {
  const c = useChainContext();
  const base = `/explorer/${network}/${c.chainSlug}`;
  const { contract, loading } = useVerifiedContract(c.chainId, addr, {
    expectVerified: justVerified,
  });
  const [tab, setTab] = useState<SubTab>("code");
  const [sources, setSources] = useState<ContractSources | null>(null);

  useEffect(() => {
    if (!contract) {
      setSources(null);
      return;
    }
    let cancelled = false;
    fetch(`/api/sourcify/${c.chainId}/${addr.toLowerCase()}/sources`)
      .then((res) => (res.ok ? res.json() : null))
      .then((body: (ContractSources & { available: boolean }) | null) => {
        if (!cancelled && body?.available) setSources(body);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [contract, c.chainId, addr]);

  if (loading) {
    return (
      <Board divide={false} className="px-5 py-8 md:px-6">
        <p className="font-mono text-[11px] text-zinc-400 dark:text-zinc-500">Loading…</p>
      </Board>
    );
  }

  if (!contract) {
    // Telling someone their contract is unverified moments after they
    // verified it is worse than saying nothing yet.
    if (justVerified) {
      return (
        <Board divide={false} className="px-5 py-8 md:px-6">
          <p className="font-mono text-[11px] text-zinc-400 dark:text-zinc-500">
            Verified — waiting for the explorer to catch up…
          </p>
        </Board>
      );
    }
    return <Unverified verifyHref={`${base}/verify/${addr.toLowerCase()}`} />;
  }

  const abi = (contract.abi ?? []) as unknown[];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        {SUB_TABS.map((sub) => (
          <TabButton key={sub.id} active={tab === sub.id} onClick={() => setTab(sub.id)}>
            {sub.label}
          </TabButton>
        ))}
      </div>

      {tab === "code" && (
        <>
          <Board divide={false} className="px-5 py-4 md:px-6">
            <SpecPlate>
              <SpecRow label="Verification">
                <span className="inline-flex items-center gap-1.5 border border-[#4e9a52]/40 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-[#3f7d43] dark:text-[#77c47b]">
                  <Check className="size-3" />
                  {contract.match === "exact_match" ? "Exact match" : "Match"}
                </span>
              </SpecRow>
              {contract.name ? <SpecRow label="Contract">{contract.name}</SpecRow> : null}
              {contract.compilerVersion ? (
                <SpecRow label="Compiler">{contract.compilerVersion}</SpecRow>
              ) : null}
              {sources?.optimizer ? (
                <SpecRow label="Optimizer">
                  {sources.optimizer.enabled
                    ? `Enabled${sources.optimizer.runs ? ` · ${sources.optimizer.runs} runs` : ""}`
                    : "Disabled"}
                </SpecRow>
              ) : null}
              {contract.verifiedAt ? (
                <SpecRow label="Verified">
                  {new Date(contract.verifiedAt).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                  {sources?.origin === "sourcify" ? " · via Sourcify" : ""}
                </SpecRow>
              ) : null}
              {contract.proxy ? (
                <SpecRow label="Implementation">
                  <Link
                    href={`${base}/address/${contract.proxy.implementation}`}
                    className={`font-mono text-[12px] ${idInk} hover:underline`}
                  >
                    {contract.proxy.implementationName ?? contract.proxy.implementation}
                  </Link>
                </SpecRow>
              ) : null}
            </SpecPlate>
          </Board>

          {sources && Object.keys(sources.sources).length > 0 ? (
            <Board divide={false}>
              <SourceCodeViewer sources={sources.sources} themeColor={c.themeColor} />
            </Board>
          ) : null}

          {abi.length > 0 ? (
            <Board divide={false}>
              <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-3 md:px-6 dark:border-zinc-800">
                <CellLabel>Contract ABI</CellLabel>
                <CopyAbiButton abi={abi} />
              </div>
              <pre className="max-h-72 overflow-auto px-5 py-4 font-mono text-[11px] leading-relaxed text-zinc-700 md:px-6 dark:text-zinc-300">
                {JSON.stringify(abi, null, 2)}
              </pre>
            </Board>
          ) : null}

          {sources?.origin === "sourcify" ? (
            <div className="flex justify-end">
              <a
                href={`https://repo.sourcify.dev/${c.chainId}/${addr}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-400 hover:text-zinc-700 dark:text-zinc-500 dark:hover:text-zinc-300"
              >
                View on Sourcify
                <ExternalLink className="size-3" />
              </a>
            </div>
          ) : null}
        </>
      )}

      {tab === "read" && (
        <Board divide={false}>
          <ContractReadSection abi={abi} address={addr} rpcUrl={c.rpcUrl} themeColor={c.themeColor} />
        </Board>
      )}

      {tab === "write" && (
        <Board divide={false}>
          <ContractWriteSection
            abi={abi}
            address={addr}
            chainId={c.chainId}
            chainSlug={c.chainSlug}
            rpcUrl={c.rpcUrl}
            themeColor={c.themeColor}
          />
        </Board>
      )}
    </div>
  );
}
