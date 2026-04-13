import { withApi, successResponse, InternalError } from '@/lib/api';

interface CoinGeckoResponse {
  'avalanche-2': {
    usd: number;
    usd_24h_change: number;
  };
}

export const GET = withApi(async () => {
  const [supplyResponse, priceResponse] = await Promise.all([
    fetch('https://data-api.avax.network/v1/avax/supply', {
      headers: { accept: 'application/json' },
      next: { revalidate: 14400 },
    }),
    fetch('https://api.coingecko.com/api/v3/simple/price?ids=avalanche-2&vs_currencies=usd&include_24hr_change=true', {
      headers: { Accept: 'application/json' },
      next: { revalidate: 60 },
    }),
  ]);

  if (!supplyResponse.ok) {
    throw new InternalError(`Failed to fetch AVAX supply data: ${supplyResponse.status}`);
  }

  const supplyData = await supplyResponse.json();

  let priceData = { price: 0, change24h: 0 };

  if (priceResponse.ok) {
    try {
      const priceJson: CoinGeckoResponse = await priceResponse.json();
      priceData = {
        price: priceJson['avalanche-2']?.usd || 0,
        change24h: priceJson['avalanche-2']?.usd_24h_change || 0,
      };
    } catch {
      // Price parse failed; proceed with zero values
    }
  }

  return successResponse({
    ...supplyData,
    price: priceData.price,
    priceChange24h: priceData.change24h,
  });
});
