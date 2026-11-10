import { isFuji } from "./target";

/* The P-Chain's validator sets as they stand now, read from its own
   tables. The Primary Network's set and each L1's seats are in snapshot
   tables. A legacy subnet's set (a subnet that has not converted to an
   L1) is in no snapshot: it is the AddSubnetValidatorTx whose term has
   not ended and that no RemoveSubnetValidatorTx removed. On 2026-11-10
   that gave Gunzilla 6 validators and Step Network 1, as
   platform.getValidatorsAt did for both. */

/** the newest snapshot of a table that holds as many rows as the one before it, or is 15 minutes old: a snapshot still
    being written holds fewer rows. Mainnet only: 15 minutes alone read r12's H16 from a snapshot 24 minutes old, one
    validator short, where a 13-minute one was complete. Fuji's stays as it was */
export const latestSnapshot = (table: string, chainId: number): string =>
  isFuji(chainId)
    ? `(SELECT max(snapshot_time) FROM ${table} WHERE chain_id = ${chainId} AND snapshot_time <= now() - INTERVAL 15 MINUTE AND snapshot_time >= now() - INTERVAL 1 DAY)`
    : `(SELECT max(snap_t) FROM (SELECT snapshot_time AS snap_t, count() AS snap_rows, lagInFrame(count()) OVER (ORDER BY snapshot_time ROWS BETWEEN 1 PRECEDING AND CURRENT ROW) AS snap_before FROM ${table} WHERE chain_id = ${chainId} AND snapshot_time >= now() - INTERVAL 1 DAY GROUP BY snapshot_time) WHERE (snap_before > 0 AND snap_rows >= snap_before) OR snap_t <= now() - INTERVAL 15 MINUTE)`;

/** p_subnets: one row per subnet a CreateSubnetTx created, as it stands now */
export const SUBNET_COLUMNS = [
  ["chain_id", "UInt8"],
  ["subnet_id", "String"],
  ["created_at", "DateTime('UTC')"],
  ["chains", "UInt32"],
  ["chain_name", "String"],
  ["is_l1", "UInt8"],
  ["converted_at", "Nullable(DateTime('UTC'))"],
  ["validators", "UInt32"],
  ["validators_until", "Nullable(DateTime('UTC'))"],
] as const;

const SUBNET_TXS = "'CreateSubnetTx', 'CreateChainTx', 'ConvertSubnetToL1Tx', 'AddSubnetValidatorTx', 'RemoveSubnetValidatorTx'";

/** the table's rows as one SELECT, in one pass over the transactions. Every figure is one a row written twice does not
    change (a count of distinct ids, a first or a last time), so it reads the same with or without the server's FINAL
    over decoded_p_txs */
export function subnetsSql(chainId: number): string {
  const is = (type: string) => `tx_type = '${type}'`;
  // per subnet and node: the subnet's own transactions carry no node, and a node's newest term on a subnet holds its
  // seat until the term ends, unless a removal came after it. A CreateSubnetTx carries no subnet_id: its tx_id is the id
  const terms =
    `SELECT if(${is("CreateSubnetTx")}, tx_id, assumeNotNull(subnet_id)) AS s, node_id AS node, countIf(${is("CreateSubnetTx")}) AS t_made, minIf(block_time, ${is("CreateSubnetTx")}) AS t_created, ` +
    `uniqExactIf(tx_id, ${is("CreateChainTx")}) AS t_chains, argMaxIf(ifNull(chain_name, ''), block_time, ${is("CreateChainTx")}) AS t_name, ` +
    `countIf(${is("ConvertSubnetToL1Tx")}) AS t_conv, minIf(block_time, ${is("ConvertSubnetToL1Tx")}) AS t_converted, maxIf(block_time, ${is("AddSubnetValidatorTx")}) AS added, ` +
    `argMaxIf(end_time, block_time, ${is("AddSubnetValidatorTx")}) AS ends, maxIf(block_time, ${is("RemoveSubnetValidatorTx")}) AS removed ` +
    `FROM decoded_p_txs WHERE chain_id = ${chainId} AND tx_type IN (${SUBNET_TXS}) AND (${is("CreateSubnetTx")} OR subnet_id IS NOT NULL) GROUP BY s, node`;
  const seated = "ends > now() AND removed < added";
  const made =
    `SELECT s, toDateTime(max(t_created), 'UTC') AS created, toUInt32(sum(t_chains)) AS chains, max(t_name) AS name, toUInt8(max(t_conv) > 0) AS l1, toDateTime(max(t_converted), 'UTC') AS converted, ` +
    `countIf(${seated}) AS n, toDateTime(maxIf(ends, ${seated}), 'UTC') AS until FROM (${terms}) GROUP BY s HAVING max(t_made) > 0`;
  const seats = `SELECT subnet_id AS s, count() AS n FROM p_l1_validator_snapshots WHERE chain_id = ${chainId} AND balance > 0 AND snapshot_time = ${latestSnapshot("p_l1_validator_snapshots", chainId)} GROUP BY s`;
  return (
    `SELECT toUInt8(${chainId}) AS chain_id, base58Encode(concat(b.s, substring(SHA256(b.s), 29, 4))) AS subnet_id, b.created AS created_at, b.chains AS chains, b.name AS chain_name, ` +
    `b.l1 AS is_l1, if(b.l1 = 1, b.converted, NULL) AS converted_at, toUInt32(if(b.l1 = 1, l.n, b.n)) AS validators, if(b.l1 = 0 AND b.n > 0, b.until, NULL) AS validators_until ` +
    `FROM (${made}) AS b LEFT JOIN (${seats}) AS l ON l.s = b.s`
  );
}
