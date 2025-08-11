const fs = require('fs');
const path = require('path');

const GLACIER_API_KEY = process.env.GLACIER_API_KEY;
const CSV_FILE_PATH = path.join(process.cwd(), 'public', 'data', 'primary-network-stats.csv');
const dataDir = path.dirname(CSV_FILE_PATH);
const PRIMARY_NETWORK_SUBNET_ID = "11111111111111111111111111111111LpoYY";

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

async function getDelegatorCount30Days() {
  try {
    const url = `https://metrics.avax.network/v2/networks/mainnet/metrics/delegatorCount?pageSize=30&subnetId=${PRIMARY_NETWORK_SUBNET_ID}`;
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) return Array(30).fill("N/A");

    const data = await response.json();
    if (!data?.results || !Array.isArray(data.results)) return Array(30).fill("N/A");

    const sortedResults = data.results
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 30);

    const values = Array(30).fill("N/A");
    for (let i = 0; i < Math.min(30, sortedResults.length); i++) {
      values[i] = sortedResults[i].value || "N/A";
    }

    return values;
  } catch (error) {
    return Array(30).fill("N/A");
  }
}

async function getDelegatorWeight30Days() {
  try {
    const url = `https://metrics.avax.network/v2/networks/mainnet/metrics/delegatorWeight?pageSize=30&subnetId=${PRIMARY_NETWORK_SUBNET_ID}`;
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) return Array(30).fill("N/A");

    const data = await response.json();
    if (!data?.results || !Array.isArray(data.results)) return Array(30).fill("N/A");

    const sortedResults = data.results
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 30);

    const values = Array(30).fill("N/A");
    for (let i = 0; i < Math.min(30, sortedResults.length); i++) {
      values[i] = sortedResults[i].value || "N/A";
    }

    return values;
  } catch (error) {
    return Array(30).fill("N/A");
  }
}

async function getValidatorCount30Days() {
  try {
    const url = `https://metrics.avax.network/v2/networks/mainnet/metrics/validatorCount?pageSize=30&subnetId=${PRIMARY_NETWORK_SUBNET_ID}`;
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) return Array(30).fill("N/A");

    const data = await response.json();
    if (!data?.results || !Array.isArray(data.results)) return Array(30).fill("N/A");

    const sortedResults = data.results
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 30);

    const values = Array(30).fill("N/A");
    for (let i = 0; i < Math.min(30, sortedResults.length); i++) {
      values[i] = sortedResults[i].value || "N/A";
    }

    return values;
  } catch (error) {
    return Array(30).fill("N/A");
  }
}

async function getValidatorWeight30Days() {
  try {
    const url = `https://metrics.avax.network/v2/networks/mainnet/metrics/validatorWeight?pageSize=30&subnetId=${PRIMARY_NETWORK_SUBNET_ID}`;
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) return Array(30).fill("N/A");

    const data = await response.json();
    if (!data?.results || !Array.isArray(data.results)) return Array(30).fill("N/A");

    const sortedResults = data.results
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 30);

    const values = Array(30).fill("N/A");
    for (let i = 0; i < Math.min(30, sortedResults.length); i++) {
      values[i] = sortedResults[i].value || "N/A";
    }

    return values;
  } catch (error) {
    return Array(30).fill("N/A");
  }
}

async function fetchValidatorVersions() {
  if (!GLACIER_API_KEY) return {};

  try {
    const allValidators = [];
    let pageToken = undefined;
    let pageCount = 0;

    do {
      pageCount++;
      const url = new URL('https://glacier-api.avax.network/v1/networks/mainnet/validators');
      url.searchParams.set('pageSize', '100');
      url.searchParams.set('subnetId', PRIMARY_NETWORK_SUBNET_ID);
      url.searchParams.set('validationStatus', 'active');
      if (pageToken) url.searchParams.set('pageToken', pageToken);

      const response = await fetch(url.toString(), {
        headers: {
          'x-glacier-api-key': GLACIER_API_KEY,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) break;

      const data = await response.json();
      if (data.validators && Array.isArray(data.validators)) {
        allValidators.push(...data.validators);
      }

      pageToken = data.nextPageToken;
      if (pageCount > 50) break;
    } while (pageToken);

    const versionCounts = {};
    allValidators.forEach(validator => {
      if (validator.avalancheGoVersion) {
        const version = validator.avalancheGoVersion;
        versionCounts[version] = (versionCounts[version] || 0) + 1;
      }
    });

    return versionCounts;
  } catch (error) {
    return {};
  }
}

async function updatePrimaryNetworkMetrics() {
  try {
    const [
      delegatorCounts,
      delegatorWeights,
      validatorCounts,
      validatorWeights,
      validatorVersions
    ] = await Promise.all([
      getDelegatorCount30Days(),
      getDelegatorWeight30Days(),
      getValidatorCount30Days(),
      getValidatorWeight30Days(),
      fetchValidatorVersions()
    ]);

    const csvData = [];
    const headerParts = [];

    for (let i = 1; i <= 30; i++) headerParts.push(`delegator_count_day${i}`);
    for (let i = 1; i <= 30; i++) headerParts.push(`delegator_weight_day${i}`);
    for (let i = 1; i <= 30; i++) headerParts.push(`validator_count_day${i}`);
    for (let i = 1; i <= 30; i++) headerParts.push(`validator_weight_day${i}`);
    headerParts.push('validator_versions');

    csvData.push(headerParts.join(','));

    const versionsJson = JSON.stringify(validatorVersions);
    const rowData = [
      ...delegatorCounts.map(val => val === "N/A" ? "N/A" : val),
      ...delegatorWeights.map(val => val === "N/A" ? "N/A" : val),
      ...validatorCounts.map(val => val === "N/A" ? "N/A" : val),
      ...validatorWeights.map(val => val === "N/A" ? "N/A" : val),
      `"${versionsJson.replace(/"/g, '""')}"`
    ];

    csvData.push(rowData.join(','));
    fs.writeFileSync(CSV_FILE_PATH, csvData.join('\n'));

  } catch (error) {
    const headerParts = [];
    for (let i = 1; i <= 30; i++) headerParts.push(`delegator_count_day${i}`);
    for (let i = 1; i <= 30; i++) headerParts.push(`delegator_weight_day${i}`);
    for (let i = 1; i <= 30; i++) headerParts.push(`validator_count_day${i}`);
    for (let i = 1; i <= 30; i++) headerParts.push(`validator_weight_day${i}`);
    headerParts.push('validator_versions');

    const csvData = [
      headerParts.join(','),
      Array(120).fill('N/A').concat(['"{}"']).join(',')
    ];
    
    fs.writeFileSync(CSV_FILE_PATH, csvData.join('\n'));
  }
}

updatePrimaryNetworkMetrics().catch(console.error);