"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import {
  Board,
  HashChip,
  SectionHeader,
  SpecPlate,
  SpecRow,
  StatCell,
  StatDash,
  StatFigure,
} from "@/components/explorer-v2/ui";
import { AddToWalletButton } from "@/components/ui/add-to-wallet-button";
import { CopyButton } from "@/components/explorer/DetailRow";
import type { L1Chain } from "@/types/stats";

/* The chain's Details tab, as one instrument: identity on the left (what
   the chain IS), live state + connection on the right (what it's doing and
   how to reach it). Every fact appears exactly once — the old page said
   chain id, blockchain id, and subnet id twice each across three boards. */

const POLL_MS = 12_000;

interface RpcSnapshot {
  clientVersion: string | null;
  blockNumber: number | null;
  gasPriceWei: bigint | null;
}

async function rpcCall(rpcUrl: string, method: string, params: unknown[] = []): Promise<unknown> {
  const res = await fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = await res.json();
  if (body.error) throw new Error(body.error.message);
  return body.result;
}

function useRpcSnapshot(rpcUrl: string | undefined): RpcSnapshot {
  const [snap, setSnap] = useState<RpcSnapshot>({
    clientVersion: null,
    blockNumber: null,
    gasPriceWei: null,
  });

  useEffect(() => {
    if (!rpcUrl) return;
    let cancelled = false;

    // the client version identifies the node software — it doesn't change
    // between polls, so ask once
    rpcCall(rpcUrl, "web3_clientVersion")
      .then((v) => !cancelled && typeof v === "string" && setSnap((s) => ({ ...s, clientVersion: v })))
      .catch(() => {});

    const load = async () => {
      if (document.visibilityState === "hidden") return;
      try {
        const [blockHex, gasPrice] = await Promise.all([
          rpcCall(rpcUrl, "eth_blockNumber") as Promise<string>,
          rpcCall(rpcUrl, "eth_gasPrice") as Promise<string>,
        ]);
        if (cancelled) return;
        setSnap((s) => ({
          ...s,
          blockNumber: blockHex ? parseInt(blockHex, 16) : s.blockNumber,
          gasPriceWei: gasPrice ? BigInt(gasPrice) : s.gasPriceWei,
        }));
      } catch {
        /* the last snapshot stands */
      }
    };
    void load();
    const timer = setInterval(() => void load(), POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [rpcUrl]);

  return snap;
}

/* wei → the chain's gwei-equivalent (nAVAX on the C-Chain), 2dp */
function formatGwei(wei: bigint, symbol?: string): string {
  const gwei = Number(wei) / 1e9;
  const value = gwei >= 100 ? Math.round(gwei).toLocaleString("en-US") : gwei.toFixed(2);
  return `${value} ${symbol === "AVAX" ? "nAVAX" : "gwei"}`;
}

export function EvmChainDetails({
  catalog,
  /** genesis chains (the C-Chain) have no P-Chain creation record — this
   *  board carries their full identity, and the page renders nothing else */
  genesis = false,
  /** the chain's vendored genesis JSON, embedded in full below the boards */
  genesisJson,
  /** upstream source of the vendored genesis (avalanchego) */
  genesisSourceUrl,
}: {
  catalog: L1Chain;
  genesis?: boolean;
  genesisJson?: object;
  genesisSourceUrl?: string;
}) {
  const snap = useRpcSnapshot(catalog.rpcUrl);
  const evmChainId = Number(catalog.chainId);
  const token = catalog.networkToken;
  const explorers = catalog.explorers ?? [];
  const genesisRaw = genesisJson ? JSON.stringify(genesisJson, null, 2) : null;

  return (
    <>
    <div className="grid items-start gap-x-8 gap-y-10 lg:grid-cols-[1.05fr_1fr]">
      {/* what it's doing, and how to reach it */}
      <section className="flex flex-col gap-4">
        <SectionHeader
          label="Connect"
          action={
            <span className="flex shrink-0 items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#E6212F] opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#E6212F]" />
              </span>
              Live
            </span>
          }
        />
        <Board divide={false}>
          {/* the chain at work, one glance */}
          <div className="grid grid-cols-2 divide-x divide-zinc-200 border-b border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            <StatCell label="Latest Block">
              {snap.blockNumber !== null ? <StatFigure value={snap.blockNumber} /> : <StatDash />}
            </StatCell>
            <StatCell
              label="Gas Price"
              href={`/explorer/${catalog.isTestnet === true ? "fuji" : "mainnet"}/${catalog.slug}/gas`}
            >
              {snap.gasPriceWei !== null ? (
                <span className="font-mono text-xl tabular-nums tracking-tight text-zinc-900 sm:text-2xl md:text-[1.75rem] dark:text-zinc-50">
                  {formatGwei(snap.gasPriceWei, token?.symbol)}
                </span>
              ) : (
                <StatDash />
              )}
            </StatCell>
          </div>
          <div className="px-5 py-2 md:px-6">
            <SpecPlate>
              {catalog.rpcUrl && (
                <SpecRow label="Public RPC" align="start">
                  <HashChip value={catalog.rpcUrl} len={64} />
                </SpecRow>
              )}
              {snap.clientVersion && <SpecRow label="Client">{snap.clientVersion}</SpecRow>}
            </SpecPlate>
          </div>
          {/* act on it: wallet + the chain's other explorers */}
          <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-4 border-t border-zinc-200 px-5 py-4 md:px-6 dark:border-zinc-800">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
              {explorers.map((e) => (
                <Link
                  key={e.link}
                  href={e.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                >
                  {e.name}
                  <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                </Link>
              ))}
            </div>
            {catalog.rpcUrl && (
              <AddToWalletButton
                rpcUrl={catalog.rpcUrl}
                chainName={catalog.chainName}
                chainId={Number.isFinite(evmChainId) ? evmChainId : undefined}
                tokenSymbol={token?.symbol}
              />
            )}
          </div>
        </Board>
      </section>

      {/* what the chain IS */}
      <section className="flex flex-col gap-4">
        <SectionHeader
          label={catalog.chainName}
          action={
            genesis ? (
              <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
                Genesis chain
              </span>
            ) : undefined
          }
        />
        <Board divide={false} className="px-5 py-4 md:px-6">
          <SpecPlate>
            <SpecRow label="EVM Chain ID">
              <span className="inline-flex items-baseline gap-2">
                <span className="font-mono">{evmChainId}</span>
                <span className="font-mono text-[11px] text-zinc-400 dark:text-zinc-500">
                  0x{evmChainId.toString(16)}
                </span>
              </span>
            </SpecRow>
            {genesis && catalog.blockchainId && (
              <SpecRow label="Blockchain ID">
                <HashChip value={catalog.blockchainId} len={30} />
              </SpecRow>
            )}
            {genesis && catalog.subnetId && (
              <SpecRow label="Subnet ID">
                <HashChip value={catalog.subnetId} len={26} />
              </SpecRow>
            )}
            {token && (
              <SpecRow label="Native Token">
                {token.symbol} · {token.decimals} decimals
              </SpecRow>
            )}
            {catalog.sourcifySupport && <SpecRow label="Contract Verification">Sourcify</SpecRow>}
          </SpecPlate>
        </Board>
      </section>
    </div>

    {/* the founding document itself, verbatim — vendored from avalanchego's
        embedded cChainGenesis, immutable since network launch */}
    {genesisRaw && (
      <section className="flex flex-col gap-4">
        <SectionHeader
          label="Genesis JSON"
          action={
            <span className="flex shrink-0 items-center gap-5">
              <span className="flex items-center gap-1.5">
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
                  Copy JSON
                </span>
                <CopyButton text={genesisRaw} />
              </span>
              {genesisSourceUrl && (
                <Link
                  href={genesisSourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                >
                  Source · avalanchego
                  <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                </Link>
              )}
            </span>
          }
        />
        <Board divide={false}>
          <pre className="whitespace-pre-wrap break-all px-5 py-4 font-mono text-[12px] leading-relaxed text-zinc-700 md:px-6 dark:text-zinc-300">
            {genesisRaw}
          </pre>
        </Board>
      </section>
    )}
    </>
  );
}
