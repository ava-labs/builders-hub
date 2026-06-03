import { NextResponse } from "next/server";
import { DATS, ETFS, type DatEntry, type EtfEntry } from "@/constants/dat-etf";

// Live-overlay endpoint for the DATs & ETFs section on the AVAX token stats page.
// Probes two sources that the joeycannoliLABS dashboard validated as free + reliable:
//   - AVAX One treasury holdings via the public Blueprint analytics page (HTML scrape)
//   - VAVX ETF AUM + estimated AVAX holdings via Yahoo Finance quoteSummary
// Everything else falls back to the static baseline in constants/dat-etf.ts.

export const revalidate = 1800; // 30 minutes

const REQUEST_TIMEOUT_MS = 6000;

async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = REQUEST_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

async function fetchAvaxOneHoldings(): Promise<number | null> {
  try {
    const res = await fetchWithTimeout("https://analytics-avaxone.theblueprint.xyz/", {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; BuildersHub/1.0)" },
      next: { revalidate: 1800 },
    });
    if (!res.ok) return null;
    const html = await res.text();
    // Primary pattern: "AVAX Held ... 13.8M AVAX"
    const labeled = html.match(/AVAX\s*Held[\s\S]*?([\d,.]+)\s*M\s*AVAX/i);
    if (labeled) {
      return parseFloat(labeled[1].replace(/,/g, "")) * 1_000_000;
    }
    // Fallback: any reasonable "Nx AVAX" figure in millions
    const loose = html.match(/([\d,.]+)\s*M\s*AVAX/i);
    if (loose) {
      const n = parseFloat(loose[1].replace(/,/g, ""));
      if (n > 1 && n < 100) return n * 1_000_000;
    }
    return null;
  } catch {
    return null;
  }
}

interface VavxLive {
  aum: number | null;
  avaxHoldings: number | null;
  navPerShare: number | null;
  marketPrice: number | null;
  avaxPrice: number | null;
  feeWaiverActive: boolean;
  feeWaiverEnd: string;
}

// Yahoo's v10/quoteSummary endpoint (used by the upstream repo) now requires a
// crumb cookie ("Invalid Crumb" 401), so we fall back to the v8/chart endpoint
// which is still open and gives us the regular market price. AUM, shares
// outstanding, and NAV/holdings stay static unless a richer source is wired up.
async function fetchVavx(): Promise<VavxLive | null> {
  try {
    const res = await fetchWithTimeout(
      "https://query1.finance.yahoo.com/v8/finance/chart/VAVX?interval=1d&range=5d",
      {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; BuildersHub/1.0)" },
        next: { revalidate: 300 },
      },
      4000
    );
    if (!res.ok) return null;
    const data = await res.json();
    const meta = data?.chart?.result?.[0]?.meta;
    if (!meta) return null;

    const marketPrice: number | null = typeof meta.regularMarketPrice === "number" ? meta.regularMarketPrice : null;

    const waiverEnd = "2026-02-28";
    const feeWaiverActive = new Date() < new Date(waiverEnd);

    return {
      aum: null,
      avaxHoldings: null,
      navPerShare: marketPrice,
      marketPrice,
      avaxPrice: null,
      feeWaiverActive,
      feeWaiverEnd: waiverEnd,
    };
  } catch {
    return null;
  }
}

export async function GET() {
  const [avaxOneHoldings, vavx] = await Promise.all([fetchAvaxOneHoldings(), fetchVavx()]);

  const dats: DatEntry[] = DATS.map((dat) => {
    if (dat.id === "avax-one" && avaxOneHoldings && avaxOneHoldings > 0) {
      return { ...dat, avaxHoldings: avaxOneHoldings };
    }
    return dat;
  });

  const etfs: EtfEntry[] = ETFS.map((etf) => {
    if (etf.id === "vaneck-vavx" && vavx) {
      // Only overlay fields the live probe actually returned — preserve the
      // static AUM / AVAX holdings baseline if Yahoo gave us only the price.
      return {
        ...etf,
        aum: vavx.aum ?? etf.aum,
        avaxHoldings: vavx.avaxHoldings ?? etf.avaxHoldings,
        navPerShare: vavx.navPerShare ?? etf.navPerShare,
        sponsorFee: vavx.feeWaiverActive ? 0 : etf.sponsorFeeAfterWaiver ?? etf.sponsorFee,
      };
    }
    return etf;
  });

  return NextResponse.json(
    {
      dats,
      etfs,
      live: {
        avaxOneHoldings,
        vavx,
      },
      updatedAt: new Date().toISOString(),
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600",
      },
    }
  );
}
