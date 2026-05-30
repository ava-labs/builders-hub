import { NextResponse } from "next/server";

interface CoinGeckoResponse {
  "avalanche-2": {
    usd: number;
    usd_24h_change: number;
  };
}

export async function GET() {
  try {
    const [supplyResponse, priceResponse] = await Promise.all([
      fetch("https://data-api.avax.network/v1/avax/supply", {
        headers: {
          accept: "application/json",
        },
        next: { revalidate: 14400 }, // 4 hours - aligns with other aggregate metrics
      }),
      fetch(
        "https://api.coingecko.com/api/v3/simple/price?ids=avalanche-2&vs_currencies=usd&include_24hr_change=true",
        {
          headers: {
            Accept: "application/json",
          },
          next: { revalidate: 60 }, // 1 minute - price data changes frequently
        }
      ),
    ]);

    if (!supplyResponse.ok) {
      throw new Error(`Failed to fetch AVAX supply data: ${supplyResponse.status}`);
    }

    const supplyData = await supplyResponse.json();
    
    let priceData = {
      price: 0,
      change24h: 0,
    };

    if (priceResponse.ok) {
      try {
        const priceJson: CoinGeckoResponse = await priceResponse.json();
        priceData = {
          price: priceJson["avalanche-2"]?.usd || 0,
          change24h: priceJson["avalanche-2"]?.usd_24h_change || 0,
        };
      } catch (priceError) {
        console.warn("Failed to parse price data:", priceError);
      }
    } else {
      console.warn("Price API returned non-ok response");
    }

    return NextResponse.json({
      ...supplyData,
      price: priceData.price,
      priceChange24h: priceData.change24h,
    });
  } catch (error) {
    console.error("Error fetching AVAX supply:", error);
    return NextResponse.json(
      { error: "Failed to fetch AVAX supply data" },
      { status: 500 }
    );
  }
}

