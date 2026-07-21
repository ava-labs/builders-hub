"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ExplorerShell } from "@/components/explorer-v2/ExplorerShell";
import {
  Board,
  DetailSkeleton,
  HashChip,
  SectionHeader,
  SpecPlate,
  SpecRow,
} from "@/components/explorer-v2/ui";
import { formatAvax, formatNumber, formatTime, timeAgo, truncate } from "@/components/explorer-v2/format";
import { usePchainData } from "./hooks";
import { NotFound } from "./PchainTx";
import l1ChainsData from "@/constants/l1-chains.json";
import { L1Chain } from "@/types/stats";
import {
  PRIMARY_SUBNET_ID,
  VM_NAMES,
  cb58ToHex,
  getCurrentValidators,
  getSubnetInfo,
  type CurrentValidator,
  type SubnetInfo,
} from "@/lib/pchain-node";
import type { Tx } from "@/lib/pchain-explorer";

/* A blockchain ID *is* the ID of the CreateChainTx that made it, so the
   indexer's tx endpoint is the chain's birth certificate: name, VM,
   genesis hash, subnet, creation time. The node RPC layers on what the
   chain is NOW: subnet/L1 conversion state and the live validator set. */
export function PchainChain({ chain, network, id }: { chain: string; network: string; id: string }) {
  const base = `/explorer/${network}/${chain}`;
  const { data: tx, loading, error } = usePchainData<Tx>(network, `tx/${id}`);
  const isChain = tx?.txType === "CreateChainTx";
  const subnetId = isChain ? tx?.subnetId : undefined;

  const [subnet, setSubnet] = useState<SubnetInfo | null>(null);
  const [validators, setValidators] = useState<CurrentValidator[] | null>(null);
  const [shown, setShown] = useState(50);

  useEffect(() => {
    if (!subnetId) return;
    let cancelled = false;
    getSubnetInfo(network, subnetId).then((s) => !cancelled && setSubnet(s));
    getCurrentValidators(network, subnetId).then((v) => !cancelled && setValidators(v));
    return () => {
      cancelled = true;
    };
  }, [network, subnetId]);

  // catalog match by blockchain ID (the catalog stores it hex-encoded)
  const catalog = useMemo(() => {
    const hex = cb58ToHex(id)?.toLowerCase();
    if (!hex) return undefined;
    return (l1ChainsData as L1Chain[]).find((c) => c.blockchainId?.toLowerCase() === hex);
  }, [id]);

  const chainName = tx?.details?.chainName ?? catalog?.chainName;
  const vmId = tx?.details?.vmId;

  return (
    <ExplorerShell chain={chain} network={network}>
      {loading && <DetailSkeleton label="Blockchain" />}
      {(error || (tx && !isChain)) && <NotFound label="Blockchain not found" id={id} />}
      {tx && isChain && (
        <div className="flex flex-col gap-10">
          <div className="grid items-start gap-8 lg:grid-cols-2">
          {/* Identity */}
          <section className="flex flex-col gap-4">
            <SectionHeader
              label={chainName ? `Blockchain · ${chainName}` : "Blockchain"}
              action={
                vmId ? (
                  <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
                    {VM_NAMES[vmId] ?? "Custom VM"}
                  </span>
                ) : undefined
              }
            />
            <Board divide={false} className="px-5 py-4 md:px-6">
              <SpecPlate>
                {chainName && <SpecRow label="Network Name">{chainName}</SpecRow>}
                <SpecRow label="Blockchain ID">
                  <HashChip value={id} len={40} />
                </SpecRow>
                {tx.subnetId && (
                  <SpecRow label="Subnet ID">
                    <HashChip
                      value={tx.subnetId}
                      href={tx.subnetId !== PRIMARY_SUBNET_ID ? `${base}/tx/${tx.subnetId}` : undefined}
                      len={32}
                    />
                  </SpecRow>
                )}
                {vmId && (
                  <SpecRow label="VM">
                    <span className="inline-flex items-center gap-2">
                      {VM_NAMES[vmId] && <span>{VM_NAMES[vmId]} ·</span>}
                      <HashChip value={vmId} len={16} />
                    </span>
                  </SpecRow>
                )}
                {tx.details?.genesisDataHash && (
                  <SpecRow label="Genesis Hash">
                    <HashChip value={tx.details.genesisDataHash} len={32} />
                  </SpecRow>
                )}
                <SpecRow label="Created">
                  {formatTime(tx.blockTimestamp)} · {timeAgo(tx.blockTimestamp)}
                </SpecRow>
                <SpecRow label="Created By">
                  <HashChip value={tx.txHash} href={`${base}/tx/${tx.txHash}`} len={24} />
                </SpecRow>
              </SpecPlate>
            </Board>
          </section>

          {/* Subnet / L1 conversion state, straight from the node */}
          {subnet && (
            <section className="flex flex-col gap-4">
              <SectionHeader label={subnet.isPermissioned ? "Subnet Status" : "L1 Status"} />
              <Board divide={false} className="px-5 py-4 md:px-6">
                <SpecPlate>
                  {subnet.isPermissioned ? (
                    <>
                      <SpecRow label="Status">Permissioned subnet</SpecRow>
                      <SpecRow label="Threshold">
                        {subnet.threshold} of {subnet.controlKeys?.length ?? 0} control keys
                      </SpecRow>
                      {(subnet.controlKeys ?? []).slice(0, 5).map((k) => (
                        <SpecRow key={k} label="Control Key">
                          <HashChip value={k} len={24} />
                        </SpecRow>
                      ))}
                    </>
                  ) : (
                    <>
                      <SpecRow label="Status">Sovereign L1 (converted via ACP-77)</SpecRow>
                      {subnet.conversionID && (
                        <SpecRow label="Conversion Tx">
                          <HashChip value={subnet.conversionID} href={`${base}/tx/${subnet.conversionID}`} len={24} />
                        </SpecRow>
                      )}
                      {subnet.managerChainID && (
                        <SpecRow label="Manager Chain">
                          <HashChip
                            value={subnet.managerChainID}
                            href={`${base}/chain/${subnet.managerChainID}`}
                            len={24}
                          />
                        </SpecRow>
                      )}
                      {subnet.managerAddress && (
                        <SpecRow label="Validator Manager">
                          <HashChip value={subnet.managerAddress} len={24} />
                        </SpecRow>
                      )}
                    </>
                  )}
                </SpecPlate>
              </Board>
            </section>
          )}
          </div>

          {/* Known chain: hand off to its explorers */}
          {catalog && (
            <Board divide={false} className="px-5 py-4 md:px-6">
              <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                {catalog.chainLogoURI && (
                  <img src={catalog.chainLogoURI} alt="" className="h-6 w-6 rounded-full object-contain" />
                )}
                <span className="text-[14px] font-medium text-zinc-900 dark:text-zinc-100">
                  {catalog.chainName}
                </span>
                {catalog.chainId && (
                  <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
                    EVM Chain ID {catalog.chainId}
                  </span>
                )}
                <span className="ml-auto flex flex-wrap items-center gap-x-5 gap-y-2">
                  {catalog.rpcUrl && catalog.isTestnet !== true && (
                    <ExitLink href={`/explorer/mainnet/${catalog.slug}`} label="Explorer" internal />
                  )}
                  {(catalog.explorers ?? []).map((e) => (
                    <ExitLink key={e.link} href={e.link} label={e.name} />
                  ))}
                </span>
              </div>
            </Board>
          )}

          {/* Live validator set */}
          {validators && validators.length > 0 && (
            <section className="flex flex-col gap-4">
              <SectionHeader label={`Validators · ${validators.length}`} />
              <Board>
                <div className="hidden grid-cols-[1.6fr_0.8fr_0.8fr_1fr] gap-4 px-5 py-2.5 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 md:grid md:px-6 dark:text-zinc-500">
                  <span>Node</span>
                  <span className="text-right">Weight</span>
                  <span className="text-right">Balance</span>
                  <span className="text-right">Validation ID</span>
                </div>
                {validators.slice(0, shown).map((v) => (
                  <Link
                    key={v.validationID ?? v.nodeID}
                    href={`${base}/node/${v.nodeID}${subnetId ? `?subnet=${subnetId}` : ""}`}
                    className="grid grid-cols-2 gap-x-4 gap-y-1 px-5 py-3 transition-colors hover:bg-zinc-50 md:grid-cols-[1.6fr_0.8fr_0.8fr_1fr] md:items-center md:px-6 dark:hover:bg-zinc-900"
                  >
                    <span className="font-mono text-[12px] text-zinc-900 dark:text-zinc-100">
                      {truncate(v.nodeID, 18)}
                    </span>
                    <span className="font-mono text-[11px] tabular-nums text-zinc-700 md:text-right dark:text-zinc-300">
                      {formatNumber(Number(v.weight))}
                    </span>
                    <span className="font-mono text-[11px] tabular-nums text-zinc-500 md:text-right dark:text-zinc-400">
                      {v.balance !== undefined ? formatAvax(v.balance) : "—"}
                    </span>
                    <span className="font-mono text-[11px] text-zinc-500 md:text-right dark:text-zinc-400">
                      {v.validationID ? truncate(v.validationID, 12) : "—"}
                    </span>
                  </Link>
                ))}
              </Board>
              {shown < validators.length && (
                <button
                  onClick={() => setShown((s) => s + 50)}
                  className="mx-auto border border-zinc-200 px-5 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-zinc-600 transition-colors hover:border-zinc-900 hover:text-zinc-900 dark:border-zinc-800 dark:text-zinc-300 dark:hover:border-zinc-100 dark:hover:text-zinc-100"
                >
                  Load more
                </button>
              )}
            </section>
          )}
        </div>
      )}
    </ExplorerShell>
  );
}

function ExitLink({ href, label, internal = false }: { href: string; label: string; internal?: boolean }) {
  const cls =
    "group inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100";
  const arrow = (
    <ArrowRight className="h-3 w-3 transition-all group-hover:translate-x-0.5 group-hover:text-[#E6212F]" />
  );
  return internal ? (
    <Link href={href} className={cls}>
      {label}
      {arrow}
    </Link>
  ) : (
    <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
      {label}
      {arrow}
    </a>
  );
}
