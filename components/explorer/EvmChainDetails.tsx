"use client";

import { useEffect, useState } from "react";
import { Board, HashChip, SectionHeader, SpecPlate, SpecRow } from "@/components/explorer-v2/ui";
import { LiveTag } from "@/components/explorer/L1ExplorerPage";
import type { L1Chain } from "@/types/stats";

/* The EVM half of a chain's Details tab: what a developer needs to CONNECT
   (chain ID, token, RPC endpoint) beside what the chain is doing right now
   (tip, gas). The on-chain P-Chain record (ChainDetailsContent) renders
   below this — identity there, connectivity here. */

const POLL_MS = 12_000;

interface RpcSnapshot {
  clientVersion: string | null;
  blockNumber: number | null;
  gasPriceWei: bigint | null;
  baseFeeWei: bigint | null;
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
    baseFeeWei: null,
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
        const [block, gasPrice] = await Promise.all([
          rpcCall(rpcUrl, "eth_getBlockByNumber", ["latest", false]) as Promise<{
            number?: string;
            baseFeePerGas?: string;
          }>,
          rpcCall(rpcUrl, "eth_gasPrice") as Promise<string>,
        ]);
        if (cancelled) return;
        setSnap((s) => ({
          ...s,
          blockNumber: block?.number ? parseInt(block.number, 16) : s.blockNumber,
          baseFeeWei: block?.baseFeePerGas ? BigInt(block.baseFeePerGas) : s.baseFeeWei,
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

export function EvmChainDetails({ catalog }: { catalog: L1Chain }) {
  const snap = useRpcSnapshot(catalog.rpcUrl);
  const evmChainId = Number(catalog.chainId);
  const token = catalog.networkToken;

  return (
    <div className="grid items-start gap-x-8 gap-y-10 lg:grid-cols-2">
      {/* connect: everything a wallet or script needs, copyable */}
      <section className="flex flex-col gap-4">
        <SectionHeader label="EVM Network" />
        <Board divide={false} className="px-5 py-4 md:px-6">
          <SpecPlate>
            <SpecRow label="Chain ID">
              <span className="inline-flex items-baseline gap-2">
                <span className="font-mono">{evmChainId}</span>
                <span className="font-mono text-[11px] text-zinc-400 dark:text-zinc-500">
                  0x{evmChainId.toString(16)}
                </span>
              </span>
            </SpecRow>
            {token && (
              <SpecRow label="Native Token">
                {token.symbol} · {token.decimals} decimals
              </SpecRow>
            )}
            {catalog.rpcUrl && (
              <SpecRow label="Public RPC" align="start">
                <HashChip value={catalog.rpcUrl} len={64} />
              </SpecRow>
            )}
            {snap.clientVersion && <SpecRow label="Client">{snap.clientVersion}</SpecRow>}
            {catalog.sourcifySupport && (
              <SpecRow label="Contract Verification">Sourcify</SpecRow>
            )}
          </SpecPlate>
        </Board>
      </section>

      {/* observe: the chain at work, straight from the RPC */}
      <section className="flex flex-col gap-4">
        <SectionHeader label="Network Now" action={<LiveTag />} />
        <Board divide={false} className="px-5 py-4 md:px-6">
          <SpecPlate>
            <SpecRow label="Latest Block">
              {snap.blockNumber !== null ? (
                <span className="font-mono">#{snap.blockNumber.toLocaleString("en-US")}</span>
              ) : (
                "—"
              )}
            </SpecRow>
            <SpecRow label="Base Fee">
              {snap.baseFeeWei !== null ? formatGwei(snap.baseFeeWei, token?.symbol) : "—"}
            </SpecRow>
            <SpecRow label="Gas Price">
              {snap.gasPriceWei !== null ? formatGwei(snap.gasPriceWei, token?.symbol) : "—"}
            </SpecRow>
          </SpecPlate>
        </Board>
      </section>
    </div>
  );
}
