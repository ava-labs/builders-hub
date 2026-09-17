import { ImageResponse } from 'next/og';
import { DataCard, Hero, LedgerRow, MonoLine, StatCell } from '@/utils/og/data-card';
import { evmRpc, formatTimestampHex, formatUnitsHex, resolveOgChain, truncateMiddle } from '@/utils/og/evm';
import { loadNodeFonts } from '@/utils/og/node-fonts';
import { OG_FAINT, OG_HEIGHT, OG_MUTED, OG_RED, OG_WIDTH, clampText } from '@/utils/og/sheet';

// Node runtime like the validator card: some L1 RPCs and the fetch budget
// behave predictably here, and edge outbound restrictions never apply.

const HASH_RE = /^0x[0-9a-fA-F]{64}$/;
const GREEN = '#15803d';
const AMBER = '#d97706';

// Confirmed transactions are immutable; pending or unavailable stays short.
const CACHE_FINAL = 'public, max-age=0, s-maxage=86400, stale-while-revalidate=604800';
const CACHE_SHORT = 'public, max-age=0, s-maxage=60, stale-while-revalidate=300';

type TxFacts = {
  valueHex: string;
  status: 'success' | 'failed' | 'pending';
  feeHex: string | null;
  block: string | null;
  time: string | null;
};

async function fetchTxFacts(rpcUrl: string, hash: string): Promise<TxFacts | null> {
  try {
    const [tx, receipt] = await Promise.all([
      evmRpc<any>(rpcUrl, 'eth_getTransactionByHash', [hash], 3000),
      evmRpc<any>(rpcUrl, 'eth_getTransactionReceipt', [hash], 3000),
    ]);
    if (!tx) return null;
    let time: string | null = null;
    if (receipt?.blockNumber) {
      try {
        const block = await evmRpc<any>(rpcUrl, 'eth_getBlockByNumber', [receipt.blockNumber, false], 2000);
        time = block?.timestamp ? formatTimestampHex(block.timestamp) : null;
      } catch {
        time = null;
      }
    }
    const gasUsed = receipt?.gasUsed ? BigInt(receipt.gasUsed) : null;
    const gasPrice = receipt?.effectiveGasPrice ?? tx.gasPrice ?? null;
    return {
      valueHex: tx.value ?? '0x0',
      status: receipt ? (BigInt(receipt.status ?? '0x0') === 1n ? 'success' : 'failed') : 'pending',
      feeHex: gasUsed !== null && gasPrice ? `0x${(gasUsed * BigInt(gasPrice)).toString(16)}` : null,
      block: receipt?.blockNumber ? Number(BigInt(receipt.blockNumber)).toLocaleString('en-US') : null,
      time,
    };
  } catch {
    return null;
  }
}

function heroSize(text: string): number {
  if (text.length > 18) return 68;
  if (text.length > 13) return 84;
  return 106;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ network: string; chain: string; hash: string }> },
): Promise<ImageResponse> {
  const { network, chain: chainSlug, hash: rawHash } = await params;
  const hash = decodeURIComponent(rawHash);
  const chain = resolveOgChain(network, chainSlug);
  const facts = chain && HASH_RE.test(hash) ? await fetchTxFacts(chain.rpcUrl, hash) : null;

  const chainName = (chain?.name ?? chainSlug).toUpperCase();
  const label = clampText(`EXPLORER · ${chainName} · TRANSACTION`, 46);
  const footerRight = clampText(`${chainName} · TRANSACTION`, 34);
  const idLine = <MonoLine text={truncateMiddle(clampText(hash, 70))} />;

  let body: React.ReactNode;
  if (!facts) {
    body = (
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {idLine}
        <Hero text="UNAVAILABLE" sub="TRANSACTION · DATA TEMPORARILY UNAVAILABLE" color={OG_FAINT} size={58} />
        <LedgerRow>
          <StatCell label="STATUS" value="UNKNOWN" valueColor={OG_MUTED} />
          <StatCell label="VALUE" value="N/A" />
          <StatCell label="NETWORK" value={network.toUpperCase()} />
        </LedgerRow>
      </div>
    );
  } else if (facts.status === 'pending') {
    body = (
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {idLine}
        <Hero text="PENDING" sub="AWAITING CONFIRMATION" color={AMBER} size={92} />
        <LedgerRow>
          <StatCell label="VALUE" value={`${formatUnitsHex(facts.valueHex, chain!.decimals, 4)} ${chain!.symbol}`} />
          <StatCell label="FEE" value="N/A" />
          <StatCell label="NETWORK" value={network.toUpperCase()} />
        </LedgerRow>
      </div>
    );
  } else {
    const ok = facts.status === 'success';
    const tone = ok ? GREEN : OG_RED;
    const fee = facts.feeHex ? `${formatUnitsHex(facts.feeHex, chain!.decimals, 6)} ${chain!.symbol}` : 'N/A';
    const row = (
      <LedgerRow>
        {BigInt(facts.valueHex) > 0n && ok ? (
          <StatCell label="STATUS" value="SUCCESS" valueColor={GREEN} />
        ) : (
          <StatCell label="VALUE" value={`${formatUnitsHex(facts.valueHex, chain!.decimals, 4)} ${chain!.symbol}`} />
        )}
        <StatCell label="FEE" value={fee} />
        <StatCell label="BLOCK" value={facts.block ?? 'N/A'} />
        <StatCell label="TIME" value={facts.time ?? 'N/A'} />
      </LedgerRow>
    );
    if (BigInt(facts.valueHex) > 0n && ok) {
      const value = `${formatUnitsHex(facts.valueHex, chain!.decimals, 4)} ${chain!.symbol}`;
      body = (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {idLine}
          <Hero text={value} sub="VALUE TRANSFERRED" size={heroSize(value)} />
          {row}
        </div>
      );
    } else {
      body = (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {idLine}
          <Hero
            text={ok ? 'SUCCESS' : 'FAILED'}
            sub={clampText(`${ok ? 'CONFIRMED' : 'REVERTED'} ON ${chainName}`, 44)}
            color={tone}
            size={92}
          />
          {row}
        </div>
      );
    }
  }

  return new ImageResponse(
    <DataCard label={label} footerRight={footerRight}>{body}</DataCard>,
    {
      width: OG_WIDTH,
      height: OG_HEIGHT,
      fonts: await loadNodeFonts(),
      headers: { 'cache-control': facts && facts.status !== 'pending' ? CACHE_FINAL : CACHE_SHORT },
    },
  );
}
