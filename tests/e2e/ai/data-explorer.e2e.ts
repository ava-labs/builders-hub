import { test } from '@e2e-dev/web';
import { expect } from 'e2e';
import { z } from 'zod';
import { DATA } from '../explorer/explorer-page';
import { desktopOnly, needsModel } from '../lib/skip';

// Data tests: the agent reads facts off a page, and plain code compares them with the known truth.
// Explorer data is live. Most tests here read facts that never change: chain identity and past blocks. The gas page
// tests read live burn and fee market figures and check only relations that always hold between them.

// The chain record at the foot of a C-Chain overview (components/explorer/EvmChainDetails.tsx).
const CHAINS = [
  { network: 'mainnet', chainId: 43114, chainIdHex: '0xa86a' },
  { network: 'fuji', chainId: 43113, chainIdHex: '0xa869' },
] as const;

for (const chain of CHAINS) {
  test(`${chain.network} c-chain overview shows the chain ID ${chain.chainId}`, async (fixtures) => {
    needsModel();
    const { app, agent, browser, screen } = fixtures;
    await app.open(`/explorer/${chain.network}/c-chain`);
    await desktopOnly(browser, 'the facts are the same at both sizes');
    await expect(screen.getByText('EVM Chain ID')).toBeVisible(DATA);
    const facts = await agent.extract(
      'From the chain record near the bottom of the page, read the EVM chain ID in decimal and in hex, ' +
        'and the native token symbol and its number of decimals. Copy each value as the page shows it.',
      {
        schema: z.object({
          chainId: z.number().int(),
          chainIdHex: z.string(),
          tokenSymbol: z.string(),
          tokenDecimals: z.number().int(),
        }),
      },
    );
    expect({ ...facts, chainIdHex: facts.chainIdHex.toLowerCase() }).toEqual({
      chainId: chain.chainId,
      chainIdHex: chain.chainIdHex,
      tokenSymbol: 'AVAX',
      tokenDecimals: 18,
    });
  });
}

// Two past mainnet blocks. Block 0 is the C-Chain genesis: its hash is the network's well-known genesis hash.
// Block 96532775 is an ordinary block with 4 transactions: the agent reads the whole page, and every listed
// transaction adds to the cost. Its values come from eth_getBlockByNumber (2026-10-02), not from this page;
// an accepted block never changes.
const ZERO_HASH = `0x${'0'.repeat(64)}`;
const BLOCKS = [
  {
    number: 0,
    hash: '0x31ced5b9beb7f8782b014660da0cb18cc409f121f408186886e1ca3e8eeca96b',
    parentHash: ZERO_HASH,
    timestamp: 0,
    transactions: 0,
    gasLimit: 100_000_000,
  },
  {
    number: 96532775,
    hash: '0x02c689a396a990ac0acfbcfcce9b4ed52bf41f1b9d1d8aa3d0540c6631de0dbc',
    parentHash: '0x7b4d6fe2273b707d70adcd81d2bfb24f08eb1b13abcc54965ae756636ac1d9fc',
    timestamp: 1790861618,
    transactions: 4,
    gasLimit: 80_000_000,
  },
] as const;

for (const block of BLOCKS) {
  test(`mainnet c-chain block ${block.number} shows its hash, parent and header values`, async (fixtures) => {
    needsModel();
    const { app, agent, browser, screen } = fixtures;
    await app.open(`/explorer/mainnet/c-chain/block/${block.number}`);
    await desktopOnly(browser, 'the facts are the same at both sizes');
    // The header fields load from the RPC after the page renders.
    await expect(screen.getByText('Gas Limit')).toBeVisible(DATA);
    const facts = await agent.extract(
      'From the block details, read the full block hash, the full parent hash, the timestamp in unix seconds, ' +
        'the number of transactions in the block and the gas limit, as plain numbers without separators.',
      {
        schema: z.object({
          hash: z.string(),
          parentHash: z.string(),
          timestamp: z.number().int(),
          transactions: z.number().int(),
          gasLimit: z.number().int(),
        }),
      },
    );
    const { number: _number, ...truth } = block;
    expect({ ...facts, hash: facts.hash.toLowerCase(), parentHash: facts.parentHash.toLowerCase() }).toEqual(truth);
  });
}

// A compact figure as the explorer writes it ("10.8K", "1.2M", "985", also with its unit after it) as a number.
function compactValue(text: string): number {
  const m = /^\$?([\d,.]+)\s*([KMB]?)/.exec(text.trim());
  if (!m) return Number.NaN;
  return Number(m[1].replace(/,/g, '')) * ({ K: 1e3, M: 1e6, B: 1e9 }[m[2]] ?? 1);
}

// The value of a compact figure's last digit: "10.8K" steps by 100, "985" by 1.
function compactStep(text: string): number {
  const m = /^\$?[\d,]+(?:\.(\d+))?\s*([KMB]?)/.exec(text.trim());
  return 10 ** -(m?.[1]?.length ?? 0) * ({ K: 1e3, M: 1e6, B: 1e9 }[m?.[2] ?? ''] ?? 1);
}

// The burn sections of the C-Chain gas page (components/explorer-v2/gas/burn.tsx) on the week clock. The burn is
// live, so the test checks relations that always hold. The chart reads the burn address's daily gain, and the board
// adds up the indexed transactions, which read up to about 0.5% high since Helicon. When both blocks name the same
// days, their totals agree to within that and the rounding of the figures. For some hours after midnight the chart
// can still end a day earlier than the board; the test then skips that one check.
test('mainnet c-chain gas page burn figures are positive and agree with each other', async (fixtures) => {
  needsModel();
  const { app, agent, browser, screen } = fixtures;
  await app.open('/explorer/mainnet/c-chain/gas');
  await desktopOnly(browser, 'the figures are the same at both sizes');
  // The page opens on the month clock. The week board replaces the month board when its read lands.
  const boardWindow = screen.getByText(/^paid [\d.]+[KM]? AVAX · /);
  await expect(boardWindow).toBeVisible(DATA);
  const monthWindow = await boardWindow.textContent();
  await screen.getByRole('radio', '1W').tap();
  await expect(boardWindow).not.toHaveText(monthWindow ?? '', DATA);
  await expect(screen.getByText(/ per day · [A-Z][a-z]{2} \d{1,2}(, \d{4})? to [A-Z][a-z]{2} \d{1,2}(, \d{4})?( · today so far [\d.,]+[KM]? AVAX)?$/)).toBeVisible(DATA);
  await expect(screen.getByRole('table', 'Top burners').getByRole('row')).toHaveCount(11);

  const facts = await agent.extract(
    'Read the two burn blocks of this gas page. From the "AVAX Burned" block, copy its large figure, the amount ' +
      'it says is burned per day, and the days it covers (for example "Sep 29 to Oct 5"). From the "Top Burners" ' +
      'block, copy the AVAX amount after the word "paid", the days after it, and each of the ten table rows: its AVAX ' +
      'burned, its share in percent and its transaction count, as plain numbers without separators. Copy the two ' +
      'figures and the per-day amount as the page writes them, with their K or M and without the word AVAX.',
    {
      schema: z.object({
        burnedFigure: z.string(),
        perDay: z.string(),
        chartDays: z.string(),
        boardPaid: z.string(),
        boardDays: z.string(),
        rows: z.array(z.object({ avaxBurned: z.number(), sharePercent: z.number(), txs: z.number().int() })),
      }),
    },
  );
  const burned = compactValue(facts.burnedFigure);
  const paid = compactValue(facts.boardPaid);
  expect(burned).toBeGreaterThan(0);
  expect(paid).toBeGreaterThan(0);
  expect(compactValue(facts.perDay)).toBeGreaterThan(0);
  expect(facts.rows).toHaveLength(10);
  for (const [i, row] of facts.rows.entries()) {
    expect(row.avaxBurned).toBeGreaterThan(0);
    expect(row.txs).toBeGreaterThan(0);
    expect(row.sharePercent).toBeGreaterThan(0);
    expect(row.sharePercent).toBeLessThan(100);
    // the rank follows the burn
    if (i > 0) expect(row.avaxBurned).toBeLessThanOrEqual(facts.rows[i - 1].avaxBurned);
    // a share is the row's burn over the window's total, to the rounding of the shown total and of the share
    expect(Math.abs(row.sharePercent - (row.avaxBurned / paid) * 100)).toBeLessThan(
      0.06 + row.sharePercent * (compactStep(facts.boardPaid) / 2 / paid + 0.01),
    );
  }
  expect(facts.rows.reduce((s, r) => s + r.sharePercent, 0)).toBeLessThan(100);

  // The window totals agree when both blocks count the same days.
  test.skip(facts.chartDays.trim() !== facts.boardDays.trim(), `the chart covers ${facts.chartDays} and the board ${facts.boardDays}`);
  const step = Math.max(compactStep(facts.burnedFigure), compactStep(facts.boardPaid));
  expect(Math.abs(paid - burned)).toBeLessThanOrEqual(step + 0.005 * burned);
});

// A gas price as the fee market writes it, in nAVAX: "5.035" with its unit "nAVAX", or "150" with "wei".
function nano(value: number, unit: string): number {
  return unit.trim().toLowerCase() === 'wei' ? value / 1e9 : value;
}

// The fee market now at the top of the C-Chain gas page (components/explorer-v2/gas/fee-market.tsx). Its figures are
// live and refresh every 2 s, so the test reads them at one moment and checks the relations that always hold: the price
// in the cost table's heading is the base fee plus the suggested priority fee, each action costs its gas times that price,
// every dollar amount uses one AVAX price, and the three priority fee bands hold every transaction.
test('mainnet c-chain gas page fee market figures agree with each other', async (fixtures) => {
  needsModel();
  const { app, agent, browser, screen } = fixtures;
  await app.open('/explorer/mainnet/c-chain/gas');
  await desktopOnly(browser, 'the figures are the same at both sizes');
  const market = screen.getByRole('region', 'Fee market now');
  await expect(market.getByText(/^[\d.,]+ (wei|nAVAX) or less$/)).toBeVisible(DATA);
  await expect(market.getByRole('table', 'Cost of an action').getByRole('row').nth(1).getByRole('cell').nth(3)).toHaveText(/^\$0\.\d+$/, DATA);

  const facts = await agent.extract(
    'Read the "Fee Market Now" section at the top of the page. Copy the Base Fee figure and its unit, and the Priority ' +
      'Fee figure and its unit. In the "Cost of an Action" heading, copy the price per gas after the word "at" and its ' +
      'unit. Copy each row of that table: its gas, its AVAX amount and its USD amount, as plain numbers without ' +
      'separators or a dollar sign. Copy the three percentages of the "Priority Fees Paid" bands as plain numbers.',
    {
      schema: z.object({
        baseFee: z.number(),
        baseFeeUnit: z.string(),
        priorityFee: z.number(),
        priorityFeeUnit: z.string(),
        price: z.number(),
        priceUnit: z.string(),
        rows: z.array(z.object({ gas: z.number().int(), avax: z.number(), usd: z.number() })),
        bands: z.array(z.number()),
      }),
    },
  );
  const base = nano(facts.baseFee, facts.baseFeeUnit);
  const tip = nano(facts.priorityFee, facts.priorityFeeUnit);
  const price = nano(facts.price, facts.priceUnit);
  // The base fee is a validator vote plus demand, so the test checks only that it is a price at all.
  expect(base).toBeGreaterThan(0);
  expect(base).toBeLessThan(10_000);
  expect(tip).toBeGreaterThanOrEqual(0);
  // The page writes prices to three places, so the sum agrees to the rounding of each part.
  expect(Math.abs(price - (base + tip))).toBeLessThanOrEqual(0.0015);
  expect(facts.rows).toHaveLength(4);
  const usdPerAvax = facts.rows[0].usd / facts.rows[0].avax;
  expect(usdPerAvax).toBeGreaterThan(0);
  for (const row of facts.rows) {
    // AVAX amounts are cut to six places, and the price is rounded to three
    expect(Math.abs(row.avax - (row.gas * price) / 1e9)).toBeLessThanOrEqual((row.gas * 0.0005) / 1e9 + 1e-6);
    // one AVAX price for every row, to the rounding of a sub-cent dollar amount (three digits) and of the AVAX amount
    expect(Math.abs(row.usd / row.avax - usdPerAvax) / usdPerAvax).toBeLessThan(0.03);
  }
  expect(facts.bands).toHaveLength(3);
  expect(Math.abs(facts.bands.reduce((s, b) => s + b, 0) - 100)).toBeLessThanOrEqual(1.5);
});
