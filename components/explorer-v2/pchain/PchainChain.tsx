"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ExplorerShell } from "@/components/explorer-v2/ExplorerShell";
import { Board, DetailSkeleton, HEAD, HashChip, INK, LoadMore, MUTED, ROW, RowDoor, SectionHeader, SpecLine, SpecSheet, idInk } from "@/components/explorer-v2/ui";
import { formatAvax, formatNumber, formatTime, timeAgo, truncate } from "@/components/explorer-v2/format";
import { NotFound } from "@/components/explorer-v2/detail-parts";
import { usePchainData } from "./hooks";
import { GenesisViewer } from "./GenesisViewer";
import l1ChainsData from "@/constants/l1-chains.json";
import { L1Chain } from "@/types/stats";
import { hexToCB58 } from "@avalanche-sdk/client/utils";
import { ChainIdChips } from "@/components/ui/copyable-id-chip";
import { AddToWalletButton } from "@/components/ui/add-to-wallet-button";
import {
  PRIMARY_SUBNET_ID,
  VM_NAMES,
  cb58ToHex,
  getCurrentValidators,
  getPlatformTx,
  getSubnetInfo,
  type CurrentValidator,
  type SubnetInfo,
} from "@/lib/pchain-node";
import type { Tx } from "@/lib/pchain-explorer";
import { cn } from "@/lib/utils";

/* the live validator set's ledger columns */
const SET_COLS = "md:grid-cols-[minmax(0,1.6fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_minmax(0,1fr)]";

/* A blockchain ID *is* the ID of the CreateChainTx that made it, so the
   indexer's tx endpoint is the chain's birth certificate: name, VM,
   genesis hash, subnet, creation time. The node RPC layers on what the
   chain is NOW: subnet/L1 conversion state and the live validator set. */
export function PchainChain({ chain, network, id }: { chain: string; network: string; id: string }) {
  return (
    <ExplorerShell chain={chain} network={network}>
      <ChainDetailsContent network={network} id={id} base={`/explorer/${network}/${chain}`} />
    </ExplorerShell>
  );
}

/* The details body, shell-agnostic: the P-Chain route wraps it in the
   P-Chain shell; every EVM chain mounts it under its own Details tab.
   `base` is the P-Chain explorer base: the entities linked here (create
   txs, validators, conversions) live on the P-Chain wherever it's viewed. */
export function ChainDetailsContent({
  network,
  id,
  base,
  website,
  socials,
}: {
  network: string;
  id: string;
  base: string;
  website?: string;
  socials?: { twitter?: string; linkedin?: string };
}) {
  // links arrive in either encoding (the catalog speaks hex, the P-Chain
  // speaks CB58): normalize once and speak CB58 from here on
  const cb58Id = useMemo(() => {
    if (!id.startsWith("0x")) return id;
    try {
      return hexToCB58(id as `0x${string}`);
    } catch {
      return id;
    }
  }, [id]);
  const { data: tx, loading, error } = usePchainData<Tx>(network, `tx/${cb58Id}`);
  const isChain = tx?.txType === "CreateChainTx";

  // catalog match by blockchain ID: the catalog mixes encodings (the
  // C-Chain's is CB58, most L1s' are hex), so compare in hex both ways
  const catalog = useMemo(() => {
    const hex = (id.startsWith("0x") ? id : cb58ToHex(cb58Id))?.toLowerCase();
    if (!hex) return undefined;
    return (l1ChainsData as L1Chain[]).find((c) => {
      if (!c.blockchainId) return false;
      const catalogHex = c.blockchainId.startsWith("0x")
        ? c.blockchainId.toLowerCase()
        : cb58ToHex(c.blockchainId)?.toLowerCase();
      return catalogHex === hex;
    });
  }, [id, cb58Id]);

  // genesis chains (the C-Chain) predate the P-Chain's tx record: the
  // catalog carries their identity instead
  const genesisFallback = !loading && !isChain && !!catalog;
  const subnetId = isChain ? tx?.subnetId : genesisFallback ? catalog?.subnetId : undefined;

  const [subnet, setSubnet] = useState<SubnetInfo | null>(null);
  const [validators, setValidators] = useState<CurrentValidator[] | null>(null);
  const [shown, setShown] = useState(50);
  // the chain's genesis rides in its CreateChainTx: the node keeps the bytes
  const [genesisData, setGenesisData] = useState<unknown>(undefined);

  useEffect(() => {
    if (!isChain) return;
    let cancelled = false;
    getPlatformTx(network, cb58Id).then((u) => !cancelled && setGenesisData(u?.genesisData));
    return () => {
      cancelled = true;
    };
  }, [network, cb58Id, isChain]);

  useEffect(() => {
    // the Primary Network's subnet is implicit and its validator set is the
    // whole network: that story belongs to the validators tab, not here
    if (!subnetId || subnetId === PRIMARY_SUBNET_ID) return;
    let cancelled = false;
    getSubnetInfo(network, subnetId).then((s) => !cancelled && setSubnet(s));
    getCurrentValidators(network, subnetId).then((v) => !cancelled && setValidators(v));
    return () => {
      cancelled = true;
    };
  }, [network, subnetId]);

  const chainName = tx?.details?.chainName ?? catalog?.chainName;
  const vmId = tx?.details?.vmId;

  return (
    <>
      {loading && <DetailSkeleton label="Blockchain" />}
      {(error || (tx && !isChain)) && !catalog && <NotFound label="Blockchain not found" id={cb58Id} />}
      {genesisFallback && catalog && (
        <div className="flex flex-col gap-10">
          <section className="flex flex-col gap-4">
            <SectionHeader
              label={`Blockchain · ${catalog.chainName}`}
              action={
                <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
                  Genesis chain
                </span>
              }
            />
            <Board divide={false} className="px-5 md:px-6">
              <SpecSheet>
                <SpecLine label="Network Name">{catalog.chainName}</SpecLine>
                <SpecLine label="Blockchain ID">
                  <HashChip value={cb58Id} len={40} />
                </SpecLine>
                {catalog.subnetId && (
                  <SpecLine label="Subnet ID">
                    <HashChip
                      value={catalog.subnetId}
                      href={catalog.subnetId !== PRIMARY_SUBNET_ID ? `${base}/tx/${catalog.subnetId}` : undefined}
                      len={32}
                    />
                  </SpecLine>
                )}
                <SpecLine label="Created">Genesis (predates the P-Chain's transaction record)</SpecLine>
              </SpecSheet>
            </Board>
          </section>
          <CatalogStrip catalog={catalog} website={website} socials={socials} />
        </div>
      )}
      {tx && isChain && (
        <div className="flex flex-col gap-10">
          <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-2">
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
            <Board divide={false} className="px-5 md:px-6">
              <SpecSheet>
                {chainName && <SpecLine label="Network Name">{chainName}</SpecLine>}
                <SpecLine label="Blockchain ID">
                  <HashChip value={id} len={40} />
                </SpecLine>
                {tx.subnetId && (
                  <SpecLine label="Subnet ID">
                    <HashChip
                      value={tx.subnetId}
                      href={tx.subnetId !== PRIMARY_SUBNET_ID ? `${base}/tx/${tx.subnetId}` : undefined}
                      len={32}
                    />
                  </SpecLine>
                )}
                {vmId && (
                  <SpecLine label="VM">
                    <span className="inline-flex items-center gap-2">
                      {VM_NAMES[vmId] && <span>{VM_NAMES[vmId]} ·</span>}
                      <HashChip value={vmId} len={16} />
                    </span>
                  </SpecLine>
                )}
                {tx.details?.genesisDataHash && (
                  <SpecLine label="Genesis Hash">
                    <HashChip value={tx.details.genesisDataHash} len={32} />
                  </SpecLine>
                )}
                <SpecLine label="Created">
                  {formatTime(tx.blockTimestamp)} · {timeAgo(tx.blockTimestamp)}
                </SpecLine>
                <SpecLine label="Created By">
                  <HashChip value={tx.txHash} href={`${base}/tx/${tx.txHash}`} len={24} />
                </SpecLine>
              </SpecSheet>
            </Board>
          </section>

          {/* Subnet / L1 conversion state, straight from the node */}
          {subnet && (
            <section className="flex flex-col gap-4">
              <SectionHeader label={subnet.isPermissioned ? "Subnet Status" : "L1 Status"} />
              <Board divide={false} className="px-5 md:px-6">
                <SpecSheet>
                  {subnet.isPermissioned ? (
                    <>
                      <SpecLine label="Status">Permissioned subnet</SpecLine>
                      <SpecLine label="Threshold">
                        {subnet.threshold} of {subnet.controlKeys?.length ?? 0} control keys
                      </SpecLine>
                      {(subnet.controlKeys ?? []).slice(0, 5).map((k) => (
                        <SpecLine key={k} label="Control Key">
                          <HashChip value={k} len={24} />
                        </SpecLine>
                      ))}
                    </>
                  ) : (
                    <>
                      <SpecLine label="Status">Sovereign L1 (converted via ACP-77)</SpecLine>
                      {/* the ACP-77 conversionID is the SHA-256 of the conversion
                          data, NOT the ConvertSubnetToL1Tx's ID: there is no tx
                          at this ID, so it must never link to a tx page */}
                      {subnet.conversionID && (
                        <SpecLine label="Conversion ID">
                          <HashChip value={subnet.conversionID} len={24} />
                        </SpecLine>
                      )}
                      {subnet.managerChainID && (
                        <SpecLine label="Manager Chain">
                          <HashChip
                            value={subnet.managerChainID}
                            href={`${base}/chain/${subnet.managerChainID}`}
                            len={24}
                          />
                        </SpecLine>
                      )}
                      {subnet.managerAddress && (
                        <SpecLine label="Validator Manager">
                          <HashChip value={subnet.managerAddress} len={24} />
                        </SpecLine>
                      )}
                    </>
                  )}
                </SpecSheet>
              </Board>
            </section>
          )}
          </div>

          {/* Known chain: identifiers, wallet hook, explorer hand-offs */}
          {catalog && <CatalogStrip catalog={catalog} website={website} socials={socials} />}

          {/* Live validator set */}
          {validators && validators.length > 0 && (
            <section className="flex flex-col gap-4">
              <SectionHeader label={`Validators · ${validators.length}`} />
              <Board divide={false}>
                <div className={cn(HEAD, SET_COLS, "border-b border-zinc-200 dark:border-zinc-800")}>
                  <span>Node</span>
                  <span className="text-right">Weight</span>
                  <span className="text-right">Balance</span>
                  <span className="text-right">Validation ID</span>
                </div>
                <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {validators.slice(0, shown).map((v) => (
                    <RowDoor key={v.validationID ?? v.nodeID} href={`${base}/node/${v.nodeID}${subnetId ? `?subnet=${subnetId}` : ""}`} className={cn(ROW, SET_COLS)}>
                      <span className={cn("truncate font-mono text-[12.5px]", idInk)} title={v.nodeID}>
                        {v.nodeID}
                      </span>
                      <span className={cn(INK, "text-right")}>{formatNumber(Number(v.weight))}</span>
                      <span className={cn(MUTED, "text-right")}>{v.balance !== undefined ? formatAvax(v.balance) : "—"}</span>
                      <span className={cn(MUTED, "truncate text-right")} title={v.validationID}>
                        {v.validationID ? truncate(v.validationID, 12) : "—"}
                      </span>
                    </RowDoor>
                  ))}
                </div>
              </Board>
              {shown < validators.length && (
                <LoadMore onClick={() => setShown((s) => s + 50)} />
              )}
            </section>
          )}

          {/* the founding document itself, decoded from the CreateChainTx */}
          {genesisData != null && <GenesisViewer genesisData={genesisData} />}
        </div>
      )}
    </>
  );
}

/* The chain's practical identity: the encoded IDs (CB58/hex toggles), the
   wallet hook, EVM chain ID, and every explorer that can open it. This is
   the "details" strip the chain headers point at. */
function CatalogStrip({
  catalog,
  website,
  socials,
}: {
  catalog: L1Chain;
  website?: string;
  socials?: { twitter?: string; linkedin?: string };
}) {
  const socialExits = [
    ...(website ? [{ label: "Website", href: website }] : []),
    ...(socials?.twitter ? [{ label: "X", href: `https://x.com/${socials.twitter}` }] : []),
    ...(socials?.linkedin
      ? [{ label: "LinkedIn", href: `https://linkedin.com/company/${socials.linkedin}` }]
      : []),
  ];
  return (
    <Board divide={false} className="flex flex-col gap-4 px-5 py-4 md:px-6">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        {catalog.chainLogoURI && (
          <img src={catalog.chainLogoURI} alt="" className="h-6 w-6 rounded-full object-contain" />
        )}
        <span className="text-[14px] font-medium text-zinc-900 dark:text-zinc-100">{catalog.chainName}</span>
        {catalog.chainId && (
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
            EVM Chain ID {catalog.chainId}
          </span>
        )}
        <span className="ml-auto flex flex-wrap items-center gap-x-5 gap-y-2">
          {socialExits.map((e) => (
            <ExitLink key={e.href} href={e.href} label={e.label} />
          ))}
          {catalog.rpcUrl && catalog.isTestnet !== true && (
            <ExitLink href={`/explorer/mainnet/${catalog.slug}`} label="Explorer" internal />
          )}
          {(catalog.explorers ?? []).map((e) => (
            <ExitLink key={e.link} href={e.link} label={e.name} />
          ))}
        </span>
      </div>
      <div className="scrollbar-hide flex flex-row items-center gap-2 overflow-x-auto">
        <ChainIdChips subnetId={catalog.subnetId} blockchainId={catalog.blockchainId} />
        {catalog.rpcUrl && (
          <div className="flex-shrink-0">
            <AddToWalletButton
              rpcUrl={catalog.rpcUrl}
              chainName={catalog.chainName}
              chainId={catalog.chainId ? parseInt(catalog.chainId) : undefined}
              tokenSymbol={catalog.networkToken?.symbol}
            />
          </div>
        )}
      </div>
    </Board>
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
