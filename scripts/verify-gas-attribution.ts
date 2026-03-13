/**
 * Gas Attribution Verification Script
 *
 * Validates the x-ray formula: sum(self_gas per contract) ≈ tx.gas_used
 * Where self_gas = max(gas_received - gas_given, 0)
 *
 * Usage: npx tsx scripts/verify-gas-attribution.ts
 */
import 'dotenv/config';

const CLICKHOUSE_URL = process.env.CLICKHOUSE_PROXY_URL || '';
const CLICKHOUSE_USER = process.env.CLICKHOUSE_USER || 'readonly';
const CLICKHOUSE_PASSWORD = process.env.CLICKHOUSE_PASSWORD || '';
const CLICKHOUSE_DATABASE = process.env.CLICKHOUSE_DATABASE || 'default';
const C_CHAIN_ID = 43114;

async function query<T>(sql: string): Promise<T[]> {
  const response = await fetch(CLICKHOUSE_URL, {
    method: 'POST',
    headers: {
      'X-ClickHouse-User': CLICKHOUSE_USER,
      'X-ClickHouse-Key': CLICKHOUSE_PASSWORD,
      'X-ClickHouse-Database': CLICKHOUSE_DATABASE,
    },
    body: `${sql} FORMAT JSON`,
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`ClickHouse error: ${err}`);
  }
  const json = await response.json();
  return json.data;
}

interface VerifyResult {
  txHash: string;
  txGasUsed: number;
  totalSelfGas: number;
  difference: number;
  contractCount: number;
}

async function verifyTransaction(
  label: string,
  gasMin: number,
  gasMax: number,
  minContracts: number
): Promise<VerifyResult | null> {
  console.log(`\n${'═'.repeat(80)}`);
  console.log(`  ${label}`);
  console.log(`${'═'.repeat(80)}`);

  const [sample] = await query<{ tx_hash: string; gas_used: string; trace_contracts: string }>(`
    SELECT
      lower(concat('0x', hex(t.hash))) AS tx_hash,
      t.gas_used,
      count(DISTINCT tr.to) AS trace_contracts
    FROM raw_txs t
    INNER JOIN raw_traces tr ON tr.tx_hash = t.hash AND tr.chain_id = t.chain_id
    WHERE t.chain_id = ${C_CHAIN_ID}
      AND t.block_time >= now() - INTERVAL 40 DAY
      AND t.block_time < now() - INTERVAL 30 DAY
      AND tr.call_type IN ('CALL', 'CREATE', 'CREATE2')
      AND t.gas_used BETWEEN ${gasMin} AND ${gasMax}
    GROUP BY t.hash, t.gas_used
    HAVING count(DISTINCT tr.to) >= ${minContracts}
    ORDER BY rand()
    LIMIT 1
  `);

  if (!sample) {
    console.log('  No suitable transaction found');
    return null;
  }

  const txHash = sample.tx_hash;
  const txGasUsed = parseInt(sample.gas_used);
  console.log(`\n  TX:         ${txHash}`);
  console.log(`  gas_used:   ${txGasUsed.toLocaleString()}`);
  console.log(`  contracts:  ${sample.trace_contracts}`);

  // Self-gas per contract
  const perContract = await query<{
    address: string;
    total_received: string;
    total_given: string;
    self_gas: string;
  }>(`
    SELECT
      address,
      sum(received_gas) AS total_received,
      sum(given_gas) AS total_given,
      greatest(sum(received_gas) - sum(given_gas), 0) AS self_gas
    FROM (
      SELECT
        lower(concat('0x', hex(tr.to))) AS address,
        toInt64(tr.gas_used) AS received_gas,
        0 AS given_gas
      FROM raw_traces tr
      WHERE tr.chain_id = ${C_CHAIN_ID}
        AND tr.tx_hash = unhex(substring('${txHash}', 3))
        AND tr.call_type IN ('CALL', 'CREATE', 'CREATE2')

      UNION ALL

      SELECT
        lower(concat('0x', hex(tr.from))) AS address,
        0 AS received_gas,
        toInt64(tr.gas_used) AS given_gas
      FROM raw_traces tr
      WHERE tr.chain_id = ${C_CHAIN_ID}
        AND tr.tx_hash = unhex(substring('${txHash}', 3))
        AND tr.call_type IN ('CALL', 'CREATE', 'CREATE2')
    )
    GROUP BY address
    HAVING self_gas > 0
    ORDER BY self_gas DESC
  `);

  console.log('\n  Per-contract self-gas:');
  console.log(`  ${'─'.repeat(76)}`);
  let totalSelfGas = 0;
  for (const row of perContract) {
    const selfGas = parseInt(row.self_gas);
    const received = parseInt(row.total_received);
    const given = parseInt(row.total_given);
    totalSelfGas += selfGas;
    console.log(
      `    ${row.address}  recv=${received.toLocaleString().padStart(12)}  gave=${given.toLocaleString().padStart(12)}  self=${selfGas.toLocaleString().padStart(12)}`
    );
  }
  console.log(`  ${'─'.repeat(76)}`);

  const difference = txGasUsed - totalSelfGas;
  console.log(`\n  sum(self_gas):    ${totalSelfGas.toLocaleString()}`);
  console.log(`  tx.gas_used:     ${txGasUsed.toLocaleString()}`);
  console.log(`  difference:      ${difference.toLocaleString()}`);

  if (difference === 0) {
    console.log('  ✅ EXACT MATCH — no over-counting, intrinsic gas absorbed by entry contract');
  } else if (Math.abs(difference) <= 21000) {
    console.log('  ✅ PASS — within 21000 (intrinsic gas)');
  } else if (difference > 0) {
    console.log(`  ⚠️  UNDER-COUNT by ${difference} — some gas not attributed`);
  } else {
    console.log(`  ❌ OVER-COUNT by ${Math.abs(difference)} — investigate`);
  }

  return { txHash, txGasUsed, totalSelfGas, difference, contractCount: perContract.length };
}

async function main() {
  console.log('Gas Attribution Verification');
  console.log('Formula: self_gas = max(received - given, 0)');
  console.log('Expected: sum(self_gas) ≈ tx.gas_used (± 21000 intrinsic)');

  const results: (VerifyResult | null)[] = [];

  // Test 1: Complex multi-contract tx (DEX swap through aggregator)
  results.push(
    await verifyTransaction('Test 1: Complex multi-contract (high gas, 5+ contracts)', 300000, 5000000, 5)
  );

  // Test 2: Medium complexity (2-4 contracts)
  results.push(
    await verifyTransaction('Test 2: Medium complexity (2-4 contracts)', 100000, 300000, 2)
  );

  // Test 3: Simple single-contract call
  results.push(
    await verifyTransaction('Test 3: Simple call (1 contract)', 30000, 80000, 1)
  );

  // Summary
  console.log(`\n\n${'═'.repeat(80)}`);
  console.log('  SUMMARY');
  console.log(`${'═'.repeat(80)}`);
  for (const r of results) {
    if (!r) continue;
    const status = r.difference === 0 ? '✅ EXACT' : Math.abs(r.difference) <= 21000 ? '✅ OK' : '❌ CHECK';
    console.log(
      `  ${status}  contracts=${r.contractCount}  gas=${r.txGasUsed.toLocaleString()}  self_sum=${r.totalSelfGas.toLocaleString()}  diff=${r.difference}`
    );
  }

  console.log('\nConclusion:');
  const allPass = results.filter(Boolean).every((r) => r!.difference >= 0 && r!.difference <= 21000);
  if (allPass) {
    console.log('  All tests pass — self_gas formula does NOT over-count.');
    console.log('  If diff=0: root trace includes intrinsic gas, entry contract absorbs it.');
    console.log('  If diff≈21000: root trace excludes intrinsic gas (separate accounting).');
  } else {
    console.log('  Some tests failed — investigate mismatches above.');
  }
}

main().catch(console.error);
