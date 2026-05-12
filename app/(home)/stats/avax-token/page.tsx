import { Suspense } from "react";
import { headers } from "next/headers";
import AvaxTokenView, { type AvaxSupplyData, type FeeDataPoint } from "./AvaxTokenView";
import AvaxTokenSkeleton from "./AvaxTokenSkeleton";

interface CChainFeesResponse {
  feesPaid: {
    data: Array<{ date: string; timestamp: number; value: string | number }>;
  };
}

interface ICMFeesResponse {
  data: Array<{
    date: string;
    timestamp: number;
    feesPaid: number;
    txCount: number;
  }>;
  totalFees: number;
  lastUpdated: string;
}

async function getOrigin(): Promise<string> {
  const headersList = await headers();
  const host = headersList.get("host");
  if (!host) return "https://build.avax.network";
  const protocol = headersList.get("x-forwarded-proto") ?? "https";
  return `${protocol}://${host}`;
}

async function loadAvaxTokenData(): Promise<{
  data: AvaxSupplyData;
  cChainFees: FeeDataPoint[];
  icmFees: FeeDataPoint[];
}> {
  const origin = await getOrigin();

  const [supplyRes, cChainRes, icmRes] = await Promise.all([
    fetch(`${origin}/api/avax-supply`, { next: { revalidate: 60 } }),
    fetch(`${origin}/api/chain-stats/43114?timeRange=1y`, { next: { revalidate: 300 } }),
    fetch(`${origin}/api/icm-contract-fees?timeRange=1y`, { next: { revalidate: 300 } }),
  ]);

  if (!supplyRes.ok || !cChainRes.ok) {
    throw new Error(
      `Failed to fetch required data (supply: HTTP ${supplyRes.status}, c-chain: HTTP ${cChainRes.status})`,
    );
  }

  const data = (await supplyRes.json()) as AvaxSupplyData;
  const cChainData = (await cChainRes.json()) as CChainFeesResponse;

  const cChainFeesRaw = cChainData?.feesPaid?.data;
  if (!Array.isArray(cChainFeesRaw)) {
    throw new Error("C-Chain fees response is missing expected shape");
  }
  const cChainFees: FeeDataPoint[] = cChainFeesRaw
    .map((item) => ({
      date: item.date,
      timestamp: item.timestamp,
      value: typeof item.value === "string" ? parseFloat(item.value) : item.value,
    }))
    .reverse();

  let icmFees: FeeDataPoint[] = [];
  if (icmRes.ok) {
    const icmData = (await icmRes.json()) as ICMFeesResponse;
    if (Array.isArray(icmData.data)) {
      icmFees = icmData.data
        .map((item) => ({
          date: item.date,
          timestamp: item.timestamp,
          value: item.feesPaid / 1e18,
        }))
        .reverse();
    }
  } else {
    // ICM data is non-critical — log and continue without breaking the page.
    console.warn(`ICM contract fees fetch failed: HTTP ${icmRes.status}`);
  }

  return { data, cChainFees, icmFees };
}

async function AvaxTokenSection() {
  const { data, cChainFees, icmFees } = await loadAvaxTokenData();
  return <AvaxTokenView data={data} cChainFees={cChainFees} icmFees={icmFees} />;
}

export default function Page() {
  return (
    <Suspense fallback={<AvaxTokenSkeleton />}>
      <AvaxTokenSection />
    </Suspense>
  );
}
