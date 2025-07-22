const fs = require('fs');
const path = require('path');

const GLACIER_API_KEY = process.env.GLACIER_API_KEY;
const ROUTESCAN_API_KEY = process.env.ROUTESCAN_API_KEY;
const CSV_FILE_PATH = path.join(process.cwd(), 'public', 'data', 'chain-metrics.csv');
const dataDir = path.dirname(CSV_FILE_PATH);

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

function getDateRange() {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - 7);

  return {
    dateFrom: startDate.toISOString().split('T')[0] + 'T00:00:00.000Z',
    dateTo: endDate.toISOString().split('T')[0] + 'T00:00:00.000Z'
  };
}

async function fetchGlacierChains() {
  if (!GLACIER_API_KEY) {
    console.log('WARNING: GLACIER_API_KEY not found. Skipping Glacier chains fetch.');
    return [];
  }

  try {
    const response = await fetch('https://glacier-api.avax.network/v1/chains', {
      headers: {
        'x-glacier-api-key': GLACIER_API_KEY,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Glacier API failed: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const chains = data.chains || [];

    const mainnetChains = chains.filter(chain => !chain.isTestnet);

    return mainnetChains.map(chain => ({
      chainId: chain.chainId,
      chainName: chain.chainName,
      logoUri: chain.networkToken?.logoUri || '',
      source: 'glacier'
    }));
  } catch (error) {
    console.error('Error fetching Glacier chains:', error);
    return [];
  }
}

async function fetchMetricsChains() {
  try {
    const response = await fetch('https://metrics.avax.network/v2/chains?network=mainnet', {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Metrics API failed: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const chains = data.chains || [];

    return chains.map(chain => ({
      chainId: chain.evmChainId,
      chainName: chain.chainName,
      logoUri: '',
      source: 'metrics'
    }));
  } catch (error) {
    console.error('Error fetching Metrics chains:', error);
    return [];
  }
}

function deduplicateChains(glacierChains, metricsChains) {
  const chainMap = new Map();

  const normalizeChainId = (chainId) => Number(chainId);

  for (const chain of glacierChains) {
    const normalizedId = normalizeChainId(chain.chainId);
    chainMap.set(normalizedId, {
      ...chain,
      chainId: normalizedId,
      originalSource: 'glacier'
    });
  }

  for (const chain of metricsChains) {
    const normalizedId = normalizeChainId(chain.chainId);
    const existingChain = chainMap.get(normalizedId);

    if (!existingChain) {
      chainMap.set(normalizedId, {
        ...chain,
        chainId: normalizedId,
        originalSource: 'metrics'
      });
    } else {
      if (!existingChain.logoUri && chain.logoUri) {
        existingChain.logoUri = chain.logoUri;
      }
      if (!existingChain.chainName && chain.chainName) {
        existingChain.chainName = chain.chainName;
      }
      existingChain.source = `${existingChain.originalSource},metrics`;
      existingChain.originalSource = `${existingChain.originalSource},metrics`;
    }
  }

  const uniqueChains = Array.from(chainMap.values());

  return uniqueChains;
}

async function fetchRoutescanData(chainId, endpoint, chainName) {
  try {
    const { dateFrom, dateTo } = getDateRange();
    const url = `https://api.routescan.io/v2/network/mainnet/evm/${chainId}/aggregations/${endpoint}?dateFrom=${dateFrom}&dateTo=${dateTo}`;

    const response = await fetch(url, {
      headers: {
        'accept': 'application/json',
        'x-private-api-key': ROUTESCAN_API_KEY,
      },
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data;
  } catch (error) {
    return null;
  }
}

async function getDailyTxCountsForWeek(chainId, chainName) {
  const txData = await fetchRoutescanData(chainId, 'txs', chainName);

  if (!txData || !Array.isArray(txData)) {
    return {
      day1TxCount: "N/A",
      day2TxCount: "N/A",
      day3TxCount: "N/A",
      day4TxCount: "N/A",
      day5TxCount: "N/A",
      day6TxCount: "N/A",
      day7TxCount: "N/A"
    };
  }

  const sortedData = txData.sort((a, b) => new Date(b[0]) - new Date(a[0]));

  const day1TxCount = sortedData[0] ? Number(sortedData[0][1]) : 0;
  const day2TxCount = sortedData[1] ? Number(sortedData[1][1]) : 0;
  const day3TxCount = sortedData[2] ? Number(sortedData[2][1]) : 0;
  const day4TxCount = sortedData[3] ? Number(sortedData[3][1]) : 0;
  const day5TxCount = sortedData[4] ? Number(sortedData[4][1]) : 0;
  const day6TxCount = sortedData[5] ? Number(sortedData[5][1]) : 0;
  const day7TxCount = sortedData[6] ? Number(sortedData[6][1]) : 0;

  return {
    day1TxCount,
    day2TxCount,
    day3TxCount,
    day4TxCount,
    day5TxCount,
    day6TxCount,
    day7TxCount
  };
}

async function getWeeklyTxCount(day1TxCount, day2TxCount, day3TxCount, day4TxCount, day5TxCount, day6TxCount, day7TxCount, chainName) {
  try {
    const dailyCounts = [day1TxCount, day2TxCount, day3TxCount, day4TxCount, day5TxCount, day6TxCount, day7TxCount];

    const validCounts = dailyCounts.filter(count => count !== "N/A" && typeof count === "number");

    if (validCounts.length === 0) {
      return "N/A";
    }

    const weeklyTotal = validCounts.reduce((sum, count) => sum + count, 0);
    return weeklyTotal;
  } catch (error) {
    return "N/A";
  }
}

async function getWeeklyActiveAddresses(chainId, chainName) {
  const addressData = await fetchRoutescanData(chainId, 'addresses', chainName);

  if (!addressData || !Array.isArray(addressData)) {
    return "N/A";
  }

  const weeklyTotal = addressData.reduce((sum, [date, count]) => sum + Number(count), 0);
  return weeklyTotal;
}

async function getWeeklyContractsDeployed(chainId, chainName) {
  const contractData = await fetchRoutescanData(chainId, 'contracts', chainName);

  if (!contractData || !Array.isArray(contractData)) {
    return "N/A";
  }

  const weeklyTotal = contractData.reduce((sum, [date, count]) => sum + Number(count), 0);
  return weeklyTotal;
}

async function getTotalIcmMessages(chainId, chainName) {
  try {
    const url = `https://metrics.avax.network/v2/chains/${chainId}/teleporterMetrics/teleporterTotalTxnCount`;

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      return "N/A";
    }

    const data = await response.json();

    if (!data?.result?.value) {
      return "N/A";
    }

    const value = Number(data.result.value);
    return value;
  } catch (error) {
    return "N/A";
  }
}

async function getSubnetId(chainId, chainName) {
  try {
    const url = `https://metrics.avax.network/v2/chains/${chainId}`;

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      return "N/A";
    }

    const data = await response.json();

    if (!data?.subnetId) {
      return "N/A";
    }

    return data.subnetId;
  } catch (error) {
    return "N/A";
  }
}

async function getValidatorCount(subnetId, chainName) {
  try {
    if (!subnetId || subnetId === "N/A") {
      return "N/A";
    }

    const url = `https://metrics.avax.network/v2/networks/mainnet/metrics/validatorCount?pageSize=1&subnetId=${subnetId}`;

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      return "N/A";
    }

    const data = await response.json();

    if (!data?.results?.[0]?.value) {
      return "N/A";
    }

    const value = Number(data.results[0].value);
    return value;
  } catch (error) {
    return "N/A";
  }
}

async function updateMetricsCSV() {
  if (!ROUTESCAN_API_KEY) {
    console.error('ERROR: ROUTESCAN_API_KEY is required. Please add your Routescan API key.');
    return;
  }

  const glacierChains = await fetchGlacierChains();
  const metricsChains = await fetchMetricsChains();

  const uniqueChains = deduplicateChains(glacierChains, metricsChains);

  uniqueChains.sort((a, b) => a.chainName.localeCompare(b.chainName));

  console.log(`Total unique chains fetched: ${uniqueChains.length}`);

  const csvData = [];
  csvData.push('chainId,chainName,chainLogoURI,subnetId,day1TxCount,day2TxCount,day3TxCount,day4TxCount,day5TxCount,day6TxCount,day7TxCount,weeklyTxCount,weeklyContractsDeployed,weeklyActiveAddresses,totalIcmMessages,validatorCount');

  for (const chain of uniqueChains) {
    try {
      const {
        day1TxCount, day2TxCount, day3TxCount, day4TxCount, day5TxCount, day6TxCount, day7TxCount
      } = await getDailyTxCountsForWeek(chain.chainId, chain.chainName);
      const weeklyTxCount = await getWeeklyTxCount(day1TxCount, day2TxCount, day3TxCount, day4TxCount, day5TxCount, day6TxCount, day7TxCount, chain.chainName);
      const weeklyContractsDeployed = await getWeeklyContractsDeployed(chain.chainId, chain.chainName);
      const weeklyActiveAddresses = await getWeeklyActiveAddresses(chain.chainId, chain.chainName);
      const totalIcmMessages = await getTotalIcmMessages(chain.chainId, chain.chainName);
      const subnetId = await getSubnetId(chain.chainId, chain.chainName);
      const validatorCount = await getValidatorCount(subnetId, chain.chainName);

      const row = [
        chain.chainId,
        `"${chain.chainName}"`,
        `"${chain.logoUri}"`,
        `"${subnetId}"`,
        day1TxCount === "N/A" ? "N/A" : day1TxCount,
        day2TxCount === "N/A" ? "N/A" : day2TxCount,
        day3TxCount === "N/A" ? "N/A" : day3TxCount,
        day4TxCount === "N/A" ? "N/A" : day4TxCount,
        day5TxCount === "N/A" ? "N/A" : day5TxCount,
        day6TxCount === "N/A" ? "N/A" : day6TxCount,
        day7TxCount === "N/A" ? "N/A" : day7TxCount,
        weeklyTxCount === "N/A" ? "N/A" : weeklyTxCount,
        weeklyContractsDeployed === "N/A" ? "N/A" : weeklyContractsDeployed,
        weeklyActiveAddresses === "N/A" ? "N/A" : weeklyActiveAddresses,
        totalIcmMessages === "N/A" ? "N/A" : totalIcmMessages,
        validatorCount === "N/A" ? "N/A" : validatorCount
      ].join(',');

      csvData.push(row);
      console.log(`✓ ${chain.chainName} completed`);

    } catch (error) {
      console.error(`Error processing ${chain.chainName}:`, error);
      const row = [
        chain.chainId,
        `"${chain.chainName}"`,
        `"${chain.logoUri}"`,
        'N/A', 'N/A', 'N/A', 'N/A', 'N/A', 'N/A', 'N/A', 'N/A', 'N/A', 'N/A', 'N/A', 'N/A', 'N/A'
      ].join(',');
      csvData.push(row);
    }
  }

  const csvContent = csvData.join('\n');
  fs.writeFileSync(CSV_FILE_PATH, csvContent);
  console.log(`\nCSV file updated: ${CSV_FILE_PATH}`);
}

updateMetricsCSV().catch(console.error);