import { ImageResponse } from 'next/og';
import { EXPLORER_API_BASE, NETWORK_LABEL, isPchainNetwork } from '@/lib/pchain-explorer';
import { StatCell } from '@/utils/og/data-card';
import { loadNodeFonts } from '@/utils/og/node-fonts';
import {
  BrandRow,
  LedgerFooter,
  OG_FAINT,
  OG_HAIRLINE,
  OG_HEIGHT,
  OG_INK,
  OG_MUTED,
  OG_PAD_X,
  OG_RED,
  OG_WIDTH,
  SectionLabel,
  SheetFrame,
  clampText,
} from '@/utils/og/sheet';

// Node runtime, unlike the section-card og routes: the explorer API is plain
// HTTP on a bare IP (see lib/pchain-explorer.ts), which edge fetch cannot
// reach (outbound edge requests are upgraded to HTTPS). The pchain proxy
// route talks to the same upstream from the Node runtime.

// NodeID- prefix + CB58 payload (20-byte id + 4-byte checksum, base58: 32-33 chars).
const NODE_ID_RE = /^NodeID-[1-9A-HJ-NP-Za-km-z]{32,33}$/;

// The explorer node document is hourly-bucketed upstream, so 1h of CDN
// freshness is honest; a day of serve-stale keeps scrapers fast if the
// upstream is slow or down.
const CACHE_CONTROL = 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400';
const UPSTREAM_TIMEOUT_MS = 3500;

type ValidatorFacts = {
  uptime: number | null;
  connected: boolean | null;
  stakeAvax: string | null;
};

async function fetchValidatorFacts(network: string, nodeId: string): Promise<ValidatorFacts | null> {
  try {
    const res = await fetch(`${EXPLORER_API_BASE}/api/${network}/node/${nodeId}`, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const doc = await res.json();
    const p50 = doc?.uptime?.currentP50;
    const connected = doc?.validator?.connected;
    const stakeNavax = doc?.validator?.totalStake ?? doc?.validator?.weight;
    return {
      uptime: typeof p50 === 'number' ? p50 : null,
      connected: typeof connected === 'boolean' ? connected : null,
      stakeAvax:
        typeof stakeNavax === 'number'
          ? Math.round(stakeNavax / 1e9).toLocaleString('en-US')
          : null,
    };
  } catch {
    // Timeout, network failure, or non-JSON body: the branded fallback renders.
    return null;
  }
}

function formatUptime(uptime: number): string {
  return Number.isInteger(uptime) ? `${uptime}%` : `${uptime.toFixed(1)}%`;
}

function uptimeTone(uptime: number): string {
  // Same thresholds as the node page headline (components/explorer-v2/pchain/PchainNode.tsx).
  if (uptime >= 98) return '#16a34a';
  if (uptime >= 90) return '#d97706';
  return OG_RED;
}

function ValidatorCard({
  networkLabel,
  nodeId,
  facts,
}: {
  networkLabel: string;
  nodeId: string;
  facts: ValidatorFacts | null;
}) {
  const uptime = facts?.uptime ?? null;
  const status =
    facts?.connected === null || facts === null
      ? { text: 'UNKNOWN', color: OG_MUTED }
      : facts.connected
        ? { text: 'CONNECTED', color: '#15803d' }
        : { text: 'DISCONNECTED', color: OG_RED };

  return (
    <SheetFrame>
      <BrandRow />
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          flexGrow: 1,
          justifyContent: 'center',
          padding: `0 ${OG_PAD_X}px`,
        }}
      >
        <SectionLabel text={`P-CHAIN VALIDATOR · ${networkLabel}`} />
        <div
          style={{
            display: 'flex',
            marginTop: 18,
            fontFamily: 'Geist-Mono',
            fontSize: 27,
            letterSpacing: 0.5,
            color: OG_INK,
          }}
        >
          {clampText(nodeId, 50)}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 26 }}>
          <div
            style={{
              display: 'flex',
              fontFamily: 'Geist-Medium',
              fontSize: uptime === null ? 58 : 116,
              letterSpacing: -3,
              color: uptime === null ? OG_FAINT : uptimeTone(uptime),
              lineHeight: 1,
            }}
          >
            {uptime === null ? 'UNAVAILABLE' : formatUptime(uptime)}
          </div>
          <div
            style={{
              display: 'flex',
              marginTop: 12,
              fontFamily: 'Geist-Mono',
              fontSize: 15,
              letterSpacing: 3,
              color: OG_MUTED,
            }}
          >
            {uptime === null ? 'UPTIME · DATA TEMPORARILY UNAVAILABLE' : 'UPTIME · P50'}
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            marginTop: 28,
            paddingTop: 22,
            borderTop: `1.5px solid ${OG_HAIRLINE}`,
            gap: 72,
            maxWidth: 900,
          }}
        >
          <StatCell label="STATUS" value={status.text} valueColor={status.color} />
          <StatCell label="TOTAL STAKE" value={facts?.stakeAvax ? `${facts.stakeAvax} AVAX` : 'N/A'} valueColor={OG_INK} />
          <StatCell label="NETWORK" value={networkLabel} valueColor={OG_INK} />
        </div>
      </div>
      <LedgerFooter left="BUILD.AVAX.NETWORK/EXPLORER" right="P-CHAIN · VALIDATOR HEALTH" />
    </SheetFrame>
  );
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ network: string; nodeId: string }> },
): Promise<ImageResponse> {
  const { network, nodeId: rawNodeId } = await params;
  const nodeId = decodeURIComponent(rawNodeId);

  const validNetwork = isPchainNetwork(network) ? network : null;
  const validNodeId = NODE_ID_RE.test(nodeId);

  // Invalid input never reaches the upstream; every path renders a 200 card so
  // scrapers cache something sane.
  const facts = validNetwork && validNodeId ? await fetchValidatorFacts(validNetwork, nodeId) : null;
  const networkLabel = validNetwork ? NETWORK_LABEL[validNetwork].toUpperCase() : 'MAINNET';

  return new ImageResponse(
    <ValidatorCard networkLabel={networkLabel} nodeId={nodeId} facts={facts} />,
    {
      width: OG_WIDTH,
      height: OG_HEIGHT,
      fonts: await loadNodeFonts(),
      headers: { 'cache-control': CACHE_CONTROL },
    },
  );
}
