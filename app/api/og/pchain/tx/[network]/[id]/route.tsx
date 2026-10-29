import { ImageResponse } from 'next/og';
import { ledgerOf, sumBig } from '@/components/explorer-v2/pchain/utxo';
import {
  EXPLORER_API_BASE,
  NETWORK_LABEL,
  chainDisplayName,
  isPchainNetwork,
  txTypeLabel,
  type Tx,
} from '@/lib/pchain-explorer';
import { DataCard, Hero, LedgerRow, MonoLine, StatCell } from '@/utils/og/data-card';
import { formatUnitsHex, formatUnixTime } from '@/utils/og/evm';
import { loadNodeFonts } from '@/utils/og/node-fonts';
import { OG_FAINT, OG_HEIGHT, OG_MUTED, OG_WIDTH, clampText } from '@/utils/og/sheet';

// Node runtime like the validator card: the explorer API upstream is reached
// the same way the pchain proxy route reaches it. A cold tx read upstream can
// take seconds, so the budget is longer than the validator card's.

const TX_ID_RE = /^[1-9A-HJ-NP-Za-km-z]{40,60}$/;
// An accepted tx never changes; a miss may be a tx the indexer has not read yet.
const CACHE_FINAL = 'public, max-age=0, s-maxage=86400, stale-while-revalidate=604800';
const CACHE_SHORT = 'public, max-age=0, s-maxage=60, stale-while-revalidate=300';

async function fetchTx(network: string, id: string): Promise<Tx | null> {
  try {
    const res = await fetch(`${EXPLORER_API_BASE}/api/${network}/tx/${id}`, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(6000),
    });
    return res.ok ? ((await res.json()) as Tx) : null;
  } catch {
    return null;
  }
}

const avax = (nAvax: bigint, digits = 4) => `${formatUnitsHex(`0x${nAvax.toString(16)}`, 9, digits)} AVAX`;

/** what the tx staked, minted or moved, as the tx page's headline reads it, else the value it moved */
function headline(tx: Tx): { amount: bigint; sub: string } | null {
  const head = purposeHeadline(tx);
  if (head && head.amount > 0n) return head;
  const value = sumBig(tx.value);
  return value > 0n ? { amount: value, sub: 'VALUE MOVED' } : null;
}

function purposeHeadline(tx: Tx): { amount: bigint; sub: string } | null {
  const ledger = ledgerOf({ consumed: tx.consumedUtxos, emitted: tx.emittedUtxos, txType: tx.txType });
  const outs = (p: string) => ledger.produced.filter((r) => r.purpose === p).reduce((t, r) => t + r.amount, 0n);
  const staked = sumBig(tx.amountStaked);
  if (staked > 0n) return { amount: staked, sub: 'STAKED' };
  if (tx.txType.startsWith('Reward'))
    return ledger.totalOut > 0n ? { amount: ledger.totalOut, sub: 'REWARD PAID' } : null;
  if (tx.txType === 'ImportTx') {
    const from = chainDisplayName(tx.details?.sourceChain);
    return { amount: ledger.totalOut, sub: from ? `IMPORTED FROM ${from.toUpperCase()}` : 'IMPORTED' };
  }
  if (tx.txType === 'ExportTx') {
    const to = chainDisplayName(tx.details?.destinationChain);
    return { amount: outs('export'), sub: to ? `EXPORTED TO ${to.toUpperCase()}` : 'EXPORTED' };
  }
  if (tx.details?.l1Balance) return { amount: BigInt(Math.round(tx.details.l1Balance)), sub: 'L1 BALANCE PREPAID' };
  if (outs('sent') > 0n) return { amount: outs('sent'), sub: 'SENT TO OTHER OWNERS' };
  return null;
}

function heroSize(text: string): number {
  if (text.length > 18) return 68;
  if (text.length > 13) return 84;
  return 106;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ network: string; id: string }> },
): Promise<ImageResponse> {
  const { network, id: rawId } = await params;
  const id = decodeURIComponent(rawId);
  const validNetwork = isPchainNetwork(network) ? network : null;
  const tx = validNetwork && TX_ID_RE.test(id) ? await fetchTx(validNetwork, id) : null;
  const networkLabel = validNetwork ? NETWORK_LABEL[validNetwork].toUpperCase() : 'MAINNET';

  const idLine = <MonoLine text={clampText(id, 60)} />;
  let body: React.ReactNode;
  if (!tx) {
    body = (
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {idLine}
        <Hero text="UNAVAILABLE" sub="TRANSACTION · DATA TEMPORARILY UNAVAILABLE" color={OG_FAINT} size={58} />
        <LedgerRow>
          <StatCell label="TYPE" value="UNKNOWN" valueColor={OG_MUTED} />
          <StatCell label="NETWORK" value={networkLabel} />
        </LedgerRow>
      </div>
    );
  } else {
    const type = txTypeLabel(tx.txType).toUpperCase();
    const head = headline(tx);
    const fee = sumBig(tx.amountBurned);
    const hero = head ? avax(head.amount) : type;
    body = (
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {idLine}
        <Hero text={clampText(hero, 24)} sub={head?.sub ?? 'CONFIRMED ON THE P-CHAIN'} size={heroSize(hero)} />
        <LedgerRow>
          {head ? (
            <StatCell label="TYPE" value={clampText(type, 24)} />
          ) : (
            <StatCell label="NETWORK" value={networkLabel} />
          )}
          <StatCell label="FEE" value={fee > 0n ? avax(fee, 6) : '0 AVAX'} />
          <StatCell label="BLOCK" value={Number(tx.blockNumber).toLocaleString('en-US')} />
          <StatCell label="TIME" value={formatUnixTime(tx.blockTimestamp)} />
        </LedgerRow>
      </div>
    );
  }

  return new ImageResponse(
    <DataCard label={`EXPLORER · P-CHAIN · ${networkLabel} · TRANSACTION`} footerRight="P-CHAIN · TRANSACTION">
      {body}
    </DataCard>,
    {
      width: OG_WIDTH,
      height: OG_HEIGHT,
      fonts: await loadNodeFonts(),
      headers: { 'cache-control': tx ? CACHE_FINAL : CACHE_SHORT },
    },
  );
}
