import { ImageResponse } from 'next/og';
import { DataCard, Hero, LedgerRow, MonoLine, StatCell } from '@/utils/og/data-card';
import { evmRpc, formatUnitsHex, resolveOgChain } from '@/utils/og/evm';
import { loadNodeFonts } from '@/utils/og/node-fonts';
import { OG_FAINT, OG_HEIGHT, OG_MUTED, OG_WIDTH, clampText } from '@/utils/og/sheet';

// Node runtime like the validator card; see the tx route for rationale.

const ADDR_RE = /^0x[0-9a-fA-F]{40}$/;
const CACHE = 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400';
const CACHE_SHORT = 'public, max-age=0, s-maxage=60, stale-while-revalidate=300';

type AddressFacts = { balanceHex: string; nonce: number; isContract: boolean };

async function fetchAddressFacts(rpcUrl: string, address: string): Promise<AddressFacts | null> {
  try {
    const [balance, nonce, code] = await Promise.all([
      evmRpc<string>(rpcUrl, 'eth_getBalance', [address, 'latest'], 3000),
      evmRpc<string>(rpcUrl, 'eth_getTransactionCount', [address, 'latest'], 3000),
      evmRpc<string>(rpcUrl, 'eth_getCode', [address, 'latest'], 3000),
    ]);
    return { balanceHex: balance, nonce: Number(BigInt(nonce)), isContract: code !== '0x' };
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
  { params }: { params: Promise<{ network: string; chain: string; address: string }> },
): Promise<ImageResponse> {
  const { network, chain: chainSlug, address: rawAddress } = await params;
  const address = decodeURIComponent(rawAddress);
  const chain = resolveOgChain(network, chainSlug);
  const facts = chain && ADDR_RE.test(address) ? await fetchAddressFacts(chain.rpcUrl, address) : null;

  const chainName = (chain?.name ?? chainSlug).toUpperCase();
  const label = clampText(`EXPLORER · ${chainName} · ADDRESS`, 46);
  const footerRight = clampText(`${chainName} · ADDRESS`, 34);
  const idLine = <MonoLine text={clampText(address, 46)} size={25} />;

  let body: React.ReactNode;
  if (!facts) {
    body = (
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {idLine}
        <Hero text="UNAVAILABLE" sub="ADDRESS · DATA TEMPORARILY UNAVAILABLE" color={OG_FAINT} size={58} />
        <LedgerRow>
          <StatCell label="TYPE" value="UNKNOWN" valueColor={OG_MUTED} />
          <StatCell label="NETWORK" value={network.toUpperCase()} />
        </LedgerRow>
      </div>
    );
  } else {
    const balance = `${formatUnitsHex(facts.balanceHex, chain!.decimals, 4)} ${chain!.symbol}`;
    body = (
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {idLine}
        <Hero text={balance} sub="NATIVE BALANCE" size={heroSize(balance)} />
        <LedgerRow>
          <StatCell label="TYPE" value={facts.isContract ? 'CONTRACT' : 'EOA'} />
          <StatCell label="TXNS SENT" value={facts.nonce.toLocaleString('en-US')} />
          <StatCell label="NETWORK" value={network.toUpperCase()} />
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
      headers: { 'cache-control': facts ? CACHE : CACHE_SHORT },
    },
  );
}
