// Hardware cost model for archival node storage.
// Mid-tier NVMe Gen 4 SSDs at retail (April 2026) sit around $120/TB — examples:
// Samsung 990 Pro, WD Black SN850X, Crucial T700, Kingston KC3000 at bulk
// capacity (2–4 TB tiers). This single constant drives every dollar figure
// rendered in the archival footprint card.
export const PRICE_PER_TB_USD = 120

export interface ArchivalCostResult {
  leveldb: number
  firewood: number
  savings: number
  savingsPct: number
}

export function computeArchivalCosts(
  leveldbTb: number,
  firewoodTb: number,
  pricePerTbUsd: number = PRICE_PER_TB_USD,
): ArchivalCostResult {
  const leveldb = leveldbTb * pricePerTbUsd
  const firewood = firewoodTb * pricePerTbUsd
  const savings = leveldb - firewood
  const savingsPct = leveldb === 0 ? 0 : Math.round((savings / leveldb) * 100)
  return { leveldb, firewood, savings, savingsPct }
}

// Format a USD amount as "$1,200" — no decimals, localised thousand separators.
export function formatUsd(amount: number): string {
  return `$${Math.round(amount).toLocaleString("en-US")}`
}
