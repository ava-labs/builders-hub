/**
 * Top Unclassified Contracts Script
 *
 * Identifies the top gas-consuming addresses on C-Chain NOT in CONTRACT_REGISTRY.
 * Used to guide the next round of manual classification.
 *
 * Usage:
 *   npx tsx scripts/top-unclassified.ts
 *   npx tsx scripts/top-unclassified.ts --days 7 --limit 20
 */

import "dotenv/config";
import { CONTRACT_REGISTRY } from "../lib/contracts";
import { getTopUnknownContracts, getTotalChainGas } from "../lib/clickhouse";

function parseArgs(): { days: number; limit: number } {
  const args = process.argv.slice(2);
  let days = 30;
  let limit = 50;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--days" && args[i + 1]) {
      days = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === "--limit" && args[i + 1]) {
      limit = parseInt(args[i + 1], 10);
      i++;
    }
  }

  return { days, limit };
}

function formatGasPercent(gas: number, totalGas: number): string {
  return totalGas > 0 ? ((gas / totalGas) * 100).toFixed(2) : "0.00";
}

function formatNumber(num: number): string {
  return num.toLocaleString("en-US");
}

function padRight(str: string, len: number): string {
  return str.length >= len ? str : str + " ".repeat(len - str.length);
}

function padLeft(str: string, len: number): string {
  return str.length >= len ? str : " ".repeat(len - str.length) + str;
}

async function main() {
  const { days, limit } = parseArgs();

  // Validate env
  if (!process.env.CLICKHOUSE_URL) {
    console.error("Error: CLICKHOUSE_URL not set. Make sure .env.local is loaded.");
    console.error("Tip: copy .env.local to .env or use: npx dotenv -e .env.local -- tsx scripts/top-unclassified.ts");
    process.exit(1);
  }

  const knownAddresses = Object.keys(CONTRACT_REGISTRY);

  console.log(`\nQuerying ClickHouse for top ${limit} unclassified addresses (${days}d)...\n`);

  const [unknowns, chainStats] = await Promise.all([
    getTopUnknownContracts(knownAddresses, days, limit),
    getTotalChainGas(days),
  ]);

  const totalGas = chainStats.totalGas;
  const classifiedGas = totalGas - unknowns.reduce((sum, u) => sum + u.totalGas, 0);
  // Approximate: real classified = knownGas, but we only have unknowns from the API
  // Use coverage from the known registry perspective
  const knownGasEstimate = totalGas - unknowns.reduce((s, u) => s + u.totalGas, 0);

  // Header
  console.log("=".repeat(100));
  console.log(`  Top Unclassified Addresses (${days}d)`);
  console.log(`  Total chain gas: ${formatNumber(totalGas)} | Known addresses: ${knownAddresses.length}`);
  console.log("=".repeat(100));
  console.log();

  // Table header
  const hdrRank = padLeft("#", 3);
  const hdrAddr = padRight("Address", 44);
  const hdrGas = padLeft("Gas%", 8);
  const hdrTx = padLeft("TxCount", 12);
  const hdrLink = "Routescan";
  console.log(`${hdrRank}  ${hdrAddr}${hdrGas}  ${hdrTx}  ${hdrLink}`);
  console.log("-".repeat(100));

  let cumulativeGasPercent = 0;

  for (let i = 0; i < unknowns.length; i++) {
    const u = unknowns[i];
    const gasPct = parseFloat(formatGasPercent(u.totalGas, totalGas));
    cumulativeGasPercent += gasPct;

    const rank = padLeft(String(i + 1), 3);
    const addr = padRight(u.address, 44);
    const gas = padLeft(`${gasPct.toFixed(2)}%`, 8);
    const tx = padLeft(formatNumber(u.txCount), 12);
    const link = `https://routescan.io/address/${u.address}`;

    console.log(`${rank}  ${addr}${gas}  ${tx}  ${link}`);
  }

  console.log();
  console.log("-".repeat(100));

  // Top 10 summary
  const top10Gas = unknowns
    .slice(0, Math.min(10, unknowns.length))
    .reduce((sum, u) => sum + u.totalGas, 0);
  const top10Pct = parseFloat(formatGasPercent(top10Gas, totalGas));
  console.log(
    `  Top 10 would add +${top10Pct.toFixed(1)}% coverage if classified`
  );
  console.log(
    `  All ${unknowns.length} shown would add +${cumulativeGasPercent.toFixed(1)}% coverage`
  );
  console.log();
}

main().catch((err) => {
  console.error("Script failed:", err);
  process.exit(1);
});
