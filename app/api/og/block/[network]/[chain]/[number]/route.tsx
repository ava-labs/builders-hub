import { ImageResponse } from 'next/og';
import { DataCard, Hero, LedgerRow, MonoLine, StatCell } from '@/utils/og/data-card';
import { evmRpc, formatTimestampHex, resolveOgChain } from '@/utils/og/evm';
import { loadNodeFonts } from '@/utils/og/node-fonts';
import { OG_FAINT, OG_HEIGHT, OG_MUTED, OG_WIDTH, clampText } from '@/utils/og/sheet';

// Node runtime like the validator card; see the tx route for rationale.

const NUM_RE = /^\d{1,12}$/;
// Confirmed blocks are immutable; unavailable stays short.
const CACHE_FINAL = 'public, max-age=0, s-maxage=86400, stale-while-revalidate=604800';
const CACHE_SHORT = 'public, max-age=0, s-maxage=60, stale-while-revalidate=300';

type BlockFacts = { txCount: number; gasUsed: string; time: string | null };

async function fetchBlockFacts(rpcUrl: string, blockNumber: string): Promise<BlockFacts | null> {
  try {
    const block = await evmRpc<any>(
      rpcUrl,
      'eth_getBlockByNumber',
      [`0x${BigInt(blockNumber).toString(16)}`, false],
      3000,
    );
    if (!block) return null;
    return {
      txCount: Array.isArray(block.transactions) ? block.transactions.length : 0,
      gasUsed: block.gasUsed ? Number(BigInt(block.gasUsed)).toLocaleString('en-US') : 'N/A',
      time: block.timestamp ? formatTimestampHex(block.timestamp) : null,
    };
  } catch {
    return null;
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ network: string; chain: string; number: string }> },
): Promise<ImageResponse> {
  const { network, chain: chainSlug, number: rawNumber } = await params;
  const blockNumber = decodeURIComponent(rawNumber);
  const chain = resolveOgChain(network, chainSlug);
  const facts = chain && NUM_RE.test(blockNumber) ? await fetchBlockFacts(chain.rpcUrl, blockNumber) : null;

  const chainName = (chain?.name ?? chainSlug).toUpperCase();
  const label = clampText(`EXPLORER · ${chainName} · BLOCK`, 46);
  const footerRight = clampText(`${chainName} · BLOCK`, 34);
  const heightText = NUM_RE.test(blockNumber)
    ? `#${Number(blockNumber).toLocaleString('en-US')}`
    : clampText(blockNumber, 20);

  let body: React.ReactNode;
  if (!facts) {
    body = (
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <MonoLine text="BLOCK" size={22} />
        <Hero text="UNAVAILABLE" sub="BLOCK · DATA TEMPORARILY UNAVAILABLE" color={OG_FAINT} size={58} />
        <LedgerRow>
          <StatCell label="HEIGHT" value={heightText} valueColor={OG_MUTED} />
          <StatCell label="NETWORK" value={network.toUpperCase()} />
        </LedgerRow>
      </div>
    );
  } else {
    body = (
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <MonoLine text="BLOCK" size={22} />
        <Hero text={heightText} sub="BLOCK HEIGHT" size={heightText.length > 13 ? 84 : 106} />
        <LedgerRow>
          <StatCell label="TRANSACTIONS" value={String(facts.txCount)} />
          <StatCell label="GAS USED" value={facts.gasUsed} />
          <StatCell label="TIME" value={facts.time ?? 'N/A'} />
        </LedgerRow>
      </div>
    );
  }

  return new ImageResponse(
    <DataCard label={label} footerRight={footerRight}>{body}</DataCard>,
    {
      width: OG_WIDTH,
      height: OG_HEIGHT,
      fonts: await loadNodeFonts(),
      headers: { 'cache-control': facts ? CACHE_FINAL : CACHE_SHORT },
    },
  );
}
