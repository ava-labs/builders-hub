import { ImageResponse } from 'next/og';
import { EXPLORER_API_BASE, NETWORK_LABEL, isPchainNetwork, type Address } from '@/lib/pchain-explorer';
import { DataCard, Hero, LedgerRow, MonoLine, StatCell } from '@/utils/og/data-card';
import { formatUnitsHex } from '@/utils/og/evm';
import { loadNodeFonts } from '@/utils/og/node-fonts';
import { OG_FAINT, OG_HEIGHT, OG_MUTED, OG_WIDTH, clampText } from '@/utils/og/sheet';

// Node runtime like the validator card; see the P-Chain tx card.

const ADDR_RE = /^(P-)?(avax|fuji)1[02-9ac-hj-np-z]{38}$/;
// Balances move, so an hour of CDN freshness, as for the C-Chain address card.
const CACHE = 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400';
const CACHE_SHORT = 'public, max-age=0, s-maxage=60, stale-while-revalidate=300';

async function fetchAddress(network: string, addr: string): Promise<Address | null> {
  try {
    const res = await fetch(`${EXPLORER_API_BASE}/api/${network}/address/${addr}`, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(6000),
    });
    return res.ok ? ((await res.json()) as Address) : null;
  } catch {
    return null;
  }
}

const avax = (nAvax: string, digits: number) =>
  `${formatUnitsHex(`0x${BigInt(nAvax || 0).toString(16)}`, 9, digits)} AVAX`;

function heroSize(text: string): number {
  if (text.length > 18) return 68;
  if (text.length > 13) return 84;
  return 106;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ network: string; addr: string }> },
): Promise<ImageResponse> {
  const { network, addr: rawAddr } = await params;
  const addr = decodeURIComponent(rawAddr);
  const validNetwork = isPchainNetwork(network) ? network : null;
  const facts = validNetwork && ADDR_RE.test(addr) ? await fetchAddress(validNetwork, addr) : null;
  const networkLabel = validNetwork ? NETWORK_LABEL[validNetwork].toUpperCase() : 'MAINNET';

  const idLine = <MonoLine text={clampText(addr.startsWith('P-') ? addr : `P-${addr}`, 50)} size={25} />;
  let body: React.ReactNode;
  if (!facts) {
    body = (
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {idLine}
        <Hero text="UNAVAILABLE" sub="ADDRESS · DATA TEMPORARILY UNAVAILABLE" color={OG_FAINT} size={58} />
        <LedgerRow>
          <StatCell label="STAKED" value="N/A" valueColor={OG_MUTED} />
          <StatCell label="NETWORK" value={networkLabel} />
        </LedgerRow>
      </div>
    );
  } else {
    const total = avax(facts.balance.total, 4);
    body = (
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {idLine}
        <Hero text={total} sub="TOTAL BALANCE" size={heroSize(total)} />
        <LedgerRow>
          <StatCell label="STAKED" value={avax(facts.balance.staked, 2)} />
          <StatCell label="UNLOCKED" value={avax(facts.balance.unlocked, 2)} />
          <StatCell label="UTXOS" value={facts.utxoCount.toLocaleString('en-US')} />
          <StatCell label="NETWORK" value={networkLabel} />
        </LedgerRow>
      </div>
    );
  }

  return new ImageResponse(
    <DataCard label={`EXPLORER · P-CHAIN · ${networkLabel} · ADDRESS`} footerRight="P-CHAIN · ADDRESS">
      {body}
    </DataCard>,
    {
      width: OG_WIDTH,
      height: OG_HEIGHT,
      fonts: await loadNodeFonts(),
      headers: { 'cache-control': facts ? CACHE : CACHE_SHORT },
    },
  );
}
