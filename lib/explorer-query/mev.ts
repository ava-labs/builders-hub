/* MEV on the C-Chain as Query reads it. No table labels a sandwich, an arbitrage or a backrun, and the writer took
   that for a no: the DeFi audit's sandwich, arbitrage and backrun questions came back "not recorded", where the swap
   logs answer each in under 2 s. The order a block ran its swaps in is the pattern: $SWAPORDER(start) (macros.ts)
   stands for one row per block, pool and transaction of the window's swaps, and a sandwich, a backrun or a JIT cycle
   is a self-join of it in that order. mev_bots is our registry's list of the contracts it labels as MEV bots, and
   the Mint and Burn topics a JIT cycle reads are named here too. Mainnet C-Chain only. */

import registryData from "@/data/contract-registry.json";
import { DEX_CHAIN_ID, DEX_FACTORIES, DEX_TOPICS, packed, strings } from "./protocols";

type Entry = { address: string; category: string; name: string };
const registry = registryData as unknown as { contracts: Entry[] };

/** the contracts our registry labels as MEV bots */
export const MEV_BOTS: readonly Entry[] = registry.contracts.filter((e) => e.category === "mev");

const hexOf = (h: string) => `unhex('${h.replace(/^0x/, "")}')`;

/** the univ4 PoolManagers: a univ4 pool is an id and holds no tokens, so its tokens move to and from its PoolManager */
const V4_MANAGERS = DEX_FACTORIES.filter((f) => f.family === "univ4").map((f) => f.factory);

/** the names an MEV query uses; the server defines each one a query reads (sources.ts). mev_bots holds 20-byte
    FixedStrings: an address cast to a String loses its trailing zero bytes, and three of the bots end in 00 */
export const MEV_NAMES: Record<string, string> = {
  mev_bots: `arrayMap(x -> toFixedString(base64Decode(x), 20), ${strings(MEV_BOTS.map((b) => packed(b.address)))})`,
  v3_mint_t: hexOf(DEX_TOPICS.v3Mint),
  ramses_mint_t: hexOf(DEX_TOPICS.ramsesMint),
  v3_burn_t: hexOf(DEX_TOPICS.v3Burn),
};

/** the words of an MEV question */
/* a question about the largest arbitrages sizes them by their swaps' value: r11's G07 ranked "largest" by the fee
   paid, a gas bid, and the largest by value was not in its 15 */
const ARBITRAGE = /\barbitrage(?:s|urs?)?\b|\barbs?\b/i;
const SIZE = /\b(?:largest|biggest|value[ds]?|volumes?|size[ds]?|notional|usd|dollars?)\b/i;
const MEV_WORDS = /\b(?:mev|sandwich(?:es|ed|ing)?|front-?run(?:s|ning|ners?)?|back-?run(?:s|ning|ners?)?|arbitrage(?:s|urs?)?|arbs?|jit|just[- ]in[- ]time)\b/i;

/** a question about MEV, whose prompt carries the MEV chapter: it names MEV or a pattern, or an earlier turn read
    swap_order or mev_bots. Every other question's prompt is the one it was */
export function mevQuestion(chainId: number, prompt: string, history: { prompt?: string; sql?: string }[] = []): boolean {
  if (chainId !== DEX_CHAIN_ID) return false;
  return MEV_WORDS.test(prompt) || history.some((t) => MEV_WORDS.test(t.prompt ?? "") || /\b(?:swap_order|mev_bots|\$SWAPORDER)\b/.test(t.sql ?? ""));
}

/** the MEV question's turn: the chapter's first rule where the writer reads it (a rule in the system prompt alone held
    in 1 of 6 replays; in the turn, 6 of 6) */
export function mevTurn(chainId: number, prompt: string): string {
  if (chainId !== DEX_CHAIN_ID || !MEV_WORDS.test(prompt)) return "";
  const open = ARBITRAGE.test(prompt) && SIZE.test(prompt) ? "Open the query with $DEX: an arbitrage's size is its largest swap's value, max(usd) over its swaps in legs, never the fee it paid" : "Open the query with $SWAPORDER";
  return ` An MEV question: the order a block ran its swaps in answers it (the MEV rules). ${open}, and never answer kind "none" for want of a label. Name whom a pattern finds as the rows show them: signers and the contracts they called (backrunners, attackers), a bot only where mev_bots lists it.`;
}

const hex = (c: string) => `lower(concat('0x', hex(${c})))`;

/** an arbitrage's test over the transactions of cte (tx, pool_list): what their pools paid out of each token on net,
    then the transactions whose pools took in none and paid out one. swap_order writes a pool out, legs keeps its bytes */
function cycles(cte: string, written: boolean): string {
  const party = (t: string) => (written ? hex(`substring(assumeNotNull(l.${t}), 13, 20)`) : `substring(assumeNotNull(l.${t}), 13, 20)`);
  return `flows AS (SELECT l.transaction_hash AS tx, l.address AS token, sum((toInt8(has(a.pool_list, ${party("topic1")})) - toInt8(has(a.pool_list, ${party("topic2")}))) * toInt256(reinterpretAsUInt256(reverse(substring(l.data, 1, 32))))) AS paid FROM raw_logs AS l INNER JOIN ${cte} AS a ON a.tx = l.transaction_hash WHERE l.chain_id = ${DEX_CHAIN_ID} AND l.block_time >= toMonday(now()) AND l.topic0 = transfer_t AND l.transaction_hash IN (SELECT tx FROM ${cte}) GROUP BY tx, token), cycles AS (SELECT tx, count() AS tokens FROM flows GROUP BY tx HAVING tokens >= 2 AND min(paid) >= 0 AND max(paid) > 0)`;
}

/** a transaction's pools, written out as swap_order writes them or as bytes for legs, with the univ4 PoolManagers when
    it swaps in a univ4 pool (an id, 32 bytes). A bot also borrows from a PoolManager and keeps its profit there, so a
    PoolManager counted in every transaction took that profit back from the pools */
function poolList(written: boolean): string {
  if (!V4_MANAGERS.length) return "groupUniqArray(pool)";
  const managers = V4_MANAGERS.map((m) => (written ? `'${m}'` : hexOf(m))).join(", ");
  return `arrayConcat(groupUniqArray(pool), if(countIf(length(pool) = ${written ? 66 : 32}) > 0, [${managers}], []))`;
}

/** the MEV chapter's rules, in the prompt of an MEV question */
export function mevRules(): string {
  return `
## MEV
No table labels a sandwich, an arbitrage, a backrun or a bot: the order a block ran its swaps in is the pattern, and it answers every MEV question. Never answer kind "none" for want of a label. Open the query with $SWAPORDER(start) or $SWAPORDER(start, end), start and end as in $DEX: our server writes swap_order in its place, one row per block, pool and transaction of the window's Swap logs, every family and every pool: block_number, block_time, tx_index (the transaction's place in its block), tx, signer (tx_from), bot (tx_to, the contract it called), pool (written out, '0x…': show it as it is), dir (+1 when its first swap in the pool put token0 in, else -1) and swaps (its Swap logs there). After the shorthand comes SELECT, or , name AS (…) for a WITH of your own. A pattern is a self-join of swap_order on block_number and pool, in tx_index order. Write the other addresses and hashes as ${hex("…")}.
- A sandwich: rows f, v and b of one block and pool with f.tx_index < v.tx_index < b.tx_index, b.signer = f.signer, v.signer != f.signer, v.dir = f.dir and b.dir = -f.dir. Count uniqExact(f.tx, b.tx, f.pool); the attacker is f.signer and the victim v.tx. Match signers, never bots alone: two users of one router are no sandwich. The note says the sandwiches are found from the swaps' order in their blocks, by signer.
- A backrun: a swap right after another signer's swap in the same block and pool, the other way: over WINDOW w AS (PARTITION BY block_number, pool ORDER BY tx_index ROWS BETWEEN 1 PRECEDING AND CURRENT ROW), lagInFrame(signer) OVER w and lagInFrame(dir) OVER w give the swap before, and row_number() OVER w > 1 keeps rows that have one. A backrun has another signer before it and the dir before it = -dir.
- An arbitrage: a transaction with swaps in 2 or more pools (uniqExact(pool) over its rows) that took no token out of those pools on net and paid one out. Over its ERC-20 Transfers (transfer_t) of each token, add the amount (toInt256(reinterpretAsUInt256(reverse(substring(data, 1, 32))))) when the sender is one of its pools and subtract it when the receiver is one: min(paid) >= 0 AND max(paid) > 0 over its tokens, and 2 or more tokens. The univ4 PoolManager (${V4_MANAGERS.map((m) => `'${m}'`).join(", ")}) is one of its pools when it swaps in a univ4 pool (an id: 66 characters written out, 32 bytes in legs), since a univ4 pool holds no tokens; in a transaction with no univ4 swap it is a lender like any other. A trade through a router pays a token into the pools, so it fails; a flash loan and a profit sent to a third address leave the sum as it is, and the positive sum is the gross profit in that token. Read raw_logs' Transfers of those transactions only, in the same window: transaction_hash IN the transactions with 2 or more pools, joined to their pools (groupUniqArray(pool)); swap_order writes a pool out, so write the Transfer's addresses out the same way to compare them.
- An arbitrage's size is its largest swap's value, max(usd) over its swaps in legs (the capital that went round; sum(usd) is its volume, each hop once). A question about the largest arbitrages or their value opens with $DEX instead, where legs has one row per swap (tx, block_time, trader the signer, router the contract called, pool as bytes, usd), finds them by the same test, and ranks by size_usd DESC NULLS LAST, never by the fee paid. Its note says a swap no stablecoin or WAVAX prices has no value, and that $DEX reads only the pools of our registry's factories, so it finds fewer arbitrages than $SWAPORDER.
- JIT liquidity: a Mint (v3_mint_t, or ramses_mint_t for Pharaoh's cl-ramses pools; owner topic1) and a Burn (v3_burn_t; owner topic1, its liquidity above 0) of one pool by one owner and one signer in one block, around another signer's swap in that pool by tx_index. It is three transactions, never one: read the window's Mint and Burn logs, then join swap_order on block_number and pool, with the log's pool written as swap_order writes it, ${hex("address")}.
- MEV bots: mev_bots is the list of the ${MEV_BOTS.length} contracts our registry labels as MEV bots. A transaction is a bot's when has(mev_bots, assumeNotNull(\`to\`)) in raw_txs, or has(mev_bots, bot) in swap_order. The note says the list is our registry's labels, not every bot on the chain.
`;
}

/** the MEV chapter's worked examples */
export function mevExamples(): string {
  const c = DEX_CHAIN_ID;
  const sandwich = `swap_order AS f INNER JOIN swap_order AS v ON v.block_number = f.block_number AND v.pool = f.pool INNER JOIN swap_order AS b ON b.block_number = f.block_number AND b.pool = f.pool WHERE f.tx_index < v.tx_index AND v.tx_index < b.tx_index AND b.signer = f.signer AND v.signer != f.signer AND v.dir = f.dir AND b.dir = -f.dir`;
  return [
    `Sandwiches per day this week, with their victims, attackers and pools; drill into one day's sandwiches:
$SWAPORDER(toMonday(now())) SELECT toDate(f.block_time) AS day, uniqExact(f.tx, b.tx, f.pool) AS sandwiches, uniqExact(v.tx) AS victims, uniqExact(f.signer) AS attackers, uniqExact(f.pool) AS pools FROM ${sandwich} GROUP BY day ORDER BY day WITH FILL FROM toMonday(today()) TO today() + 1
drill: $SWAPORDER(toMonday(now())) SELECT min(f.block_time) AS t, f.block_number AS block_number, ${hex("f.tx")} AS front_tx, ${hex("v.tx")} AS victim_tx, ${hex("b.tx")} AS back_tx, f.pool AS pool, ${hex("any(f.signer)")} AS attacker, ${hex("any(f.bot)")} AS bot FROM ${sandwich} AND toDate(f.block_time) = {{day}} GROUP BY f.block_number, f.tx, v.tx, b.tx, f.pool ORDER BY t DESC LIMIT 50`,
    `The contracts that sent the most arbitrage transactions this week (swaps in 2 or more pools that took no token on net and paid one out); drill into one contract's:
$SWAPORDER(toMonday(now())), multi AS (SELECT tx, any(bot) AS bot, ${poolList(true)} AS pool_list FROM swap_order GROUP BY tx HAVING uniqExact(pool) >= 2), ${cycles("multi", true)} SELECT ${hex("m.bot")} AS contract, count() AS arbitrages, count() OVER () AS contracts FROM multi AS m INNER JOIN cycles AS c ON c.tx = m.tx GROUP BY m.bot ORDER BY arbitrages DESC LIMIT 15
drill: $SWAPORDER(toMonday(now())), multi AS (SELECT tx, any(bot) AS bot, min(block_time) AS t, uniqExact(pool) AS pools, ${poolList(true)} AS pool_list FROM swap_order GROUP BY tx HAVING pools >= 2), ${cycles("multi", true)} SELECT m.t AS t, ${hex("m.tx")} AS tx_hash, m.pools AS pools, c.tokens AS tokens FROM multi AS m INNER JOIN cycles AS c ON c.tx = m.tx WHERE m.bot = {{contract:bytes}} ORDER BY t DESC LIMIT 50`,
    `The largest arbitrage transactions this week, by the value that went round (the largest swap's USD) with their volume; drill into one transaction's swaps:
$DEX(toMonday(now())), arbs AS (SELECT tx, min(block_time) AS t, any(trader) AS signer, any(router) AS bot, uniqExact(pool) AS pools, count() AS swaps, max(usd) AS top_leg, sum(usd) AS legs_usd, ${poolList(false)} AS pool_list FROM legs GROUP BY tx HAVING pools >= 2), ${cycles("arbs", false)} SELECT a.t AS t, ${hex("a.tx")} AS tx_hash, ${hex("a.signer")} AS signer, ${hex("a.bot")} AS contract, a.pools AS pools, a.swaps AS swaps, c.tokens AS tokens, round(a.top_leg, 2) AS size_usd, round(a.legs_usd, 2) AS volume_usd, count() OVER () AS arbitrages FROM arbs AS a INNER JOIN cycles AS c ON c.tx = a.tx ORDER BY size_usd DESC NULLS LAST LIMIT 15
drill: $DEX(toMonday(now())) SELECT block_time AS t, protocol, version, ${hex("pool")} AS pool, ${hex("t0")} AS token0, ${hex("t1")} AS token1, round(usd, 2) AS swap_usd FROM legs WHERE tx = {{tx_hash:bytes}} ORDER BY swap_usd DESC NULLS LAST LIMIT 50`,
    `The MEV bots' share of the gas charged per hour today (the contracts our registry labels as MEV bots):
SELECT toStartOfHour(block_time) AS t, sumIf(gas_used, has(mev_bots, assumeNotNull(\`to\`))) AS mev_gas, sum(gas_used) AS all_gas, round(100 * mev_gas / all_gas, 2) AS mev_share_pct, countIf(has(mev_bots, assumeNotNull(\`to\`))) AS mev_txs, count() AS txs FROM raw_txs WHERE chain_id = ${c} AND block_time >= toStartOfDay(now()) GROUP BY t ORDER BY t`,
  ]
    .map((e) => `${e}\n\n`)
    .join("");
}
