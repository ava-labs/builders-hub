import { NextResponse } from "next/server";

interface ContractStatsResponse {
  contracts: string[];
  timeRange: {
    from: number;
    to: number;
  };
  transactions: {
    total: number;
    totalGasCost: number;
  };
  icmMessages: {
    count: number;
    totalGasCost: number;
  };
  interactions: {
    uniqueAddresses: number;
    avgDailyAddresses: number;
  };
  concentration: {
    top5AccountsPercentage: number;
    top20AccountsPercentage: number;
  };
}

interface DailyFeeData {
  date: string;
  timestamp: number;
  feesPaid: number;
  txCount: number;
}

let cachedDailyData: {
  data: DailyFeeData[];
  totalFees: number;
  lastUpdated: string;
} | null = null;

let lastCacheTime = 0;
const CACHE_DURATION = 5 * 60 * 1000;

export async function GET(_request: Request) {
  try {
    const icmContract = "0x253b2784c75e510dD0fF1da844684a1aC0aa5fcf";
    const deploymentTimestamp = 1709586720;
    const now = Math.floor(Date.now() / 1000);

    if (
      cachedDailyData &&
      Date.now() - lastCacheTime < CACHE_DURATION
    ) {
      return NextResponse.json(cachedDailyData);
    }

    const dailyData: DailyFeeData[] = [];
    const oneDaySeconds = 24 * 60 * 60;
    const oneWeekSeconds = 7 * oneDaySeconds;
    let currentTimestamp = deploymentTimestamp;

    while (currentTimestamp < now) {
      const nextTimestamp = Math.min(currentTimestamp + oneWeekSeconds, now);
      
      try {
        const response = await fetch(
          `https://idx6.solokhin.com/api/43114/contract-stats?contracts=${icmContract}&tsFrom=${currentTimestamp}&tsTo=${nextTimestamp}`,
          {
            headers: {
              Accept: "application/json",
            },
          }
        );

        if (response.ok) {
          const data: ContractStatsResponse = await response.json();
          const weeklyFees = data.transactions?.totalGasCost || 0;
          const weeklyTxCount = data.transactions?.total || 0;
          const daysInThisWeek = Math.ceil((nextTimestamp - currentTimestamp) / oneDaySeconds);
          const dailyFees = weeklyFees / daysInThisWeek;
          const dailyTxCount = Math.floor(weeklyTxCount / daysInThisWeek);

          for (let i = 0; i < daysInThisWeek; i++) {
            const dayTimestamp = currentTimestamp + (i * oneDaySeconds);
            const date = new Date(dayTimestamp * 1000).toISOString().split('T')[0];
            
            dailyData.push({
              date,
              timestamp: dayTimestamp,
              feesPaid: dailyFees,
              txCount: dailyTxCount,
            });
          }
        }
      } catch (error) {
        console.warn(`Failed to fetch ICM data for week starting ${currentTimestamp}:`, error);
      }

      currentTimestamp = nextTimestamp;
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    const totalFees = dailyData.reduce((sum, item) => sum + item.feesPaid, 0);

    const result = {
      data: dailyData,
      totalFees,
      lastUpdated: new Date().toISOString(),
    };

    cachedDailyData = result;
    lastCacheTime = Date.now();

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching ICM contract fees:", error);
    
    if (cachedDailyData) {
      return NextResponse.json(cachedDailyData);
    }
    
    return NextResponse.json(
      { error: "Failed to fetch ICM contract fees data" },
      { status: 500 }
    );
  }
}

