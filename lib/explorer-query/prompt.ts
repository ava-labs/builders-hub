/* What the query model is told. The schema comes from the database; the
   rest is what the raw tables mean on Avalanche and how to hand back a
   chart the explorer can draw with doors into its records. */

import { createHash } from "node:crypto";
import { HASH_RANGE, MAX_ROWS } from "./guard";
import { CREATED, FIRST_DAY, QUOTES, U, pxCte, topic } from "./macros";
import { DEX_CHAIN_ID, DEX_FACTORIES, DEX_PRICE_POOL, DEX_PROTOCOLS, DEX_TOPICS, V2_FEE_PROTOCOLS, dexFamilies, type DexFamily } from "./protocols";
import { AAVE_ASSETS, AAVE_SLUG, LENDING_CHAIN_ID, LENDING_MARKETS, LENDING_PROTOCOLS } from "./lending";
import { FAMILY_CHAIN_ID, OPENTRADE_POOLS, SILOS, VAULTS } from "./families";
import { sqlWindow, windowWords } from "./scope";
import { knownLines, refLine, refSchema } from "./sources";
import { isCChain, isFuji, PCHAIN_IDS, targetOf } from "./target";

export const KNOWN_ADDRESSES: Record<string, string> = {
  "0xb31f66aa3c1e785363f0875a1b74e27b85fd66c7": "WAVAX",
  "0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e": "USDC (native)",
  "0x9702230a8ea53601f5cd2dc00fdbc13d4df4a8c7": "USDT",
  "0x152b9d0fdc40c096757f570a51e494bd4b943e50": "BTC.b",
  "0x49d5c2bdffac6ce2bfdb6640f4f80f226bc10bab": "WETH.e",
  "0x60ae616a2155ee3d9a68541ba4544862310933d4": "Trader Joe router",
  "0x253b2784c75e510dd0ff1da844684a1ac0aa5fcf": "ICM Teleporter Messenger",
  "0x0100000000000000000000000000000000000000": "fee burn address",
};

/** the record columns every drill returns, from the window's start */
function RECORD(opts: { chainId: number; symbol: string }, since = "now() - INTERVAL 1 DAY"): string {
  return `SELECT block_time AS t, block_number, concat('0x', hex(hash)) AS tx_hash, lower(concat('0x', hex(\`from\`))) AS from_address, lower(concat('0x', hex(\`to\`))) AS to_address, concat('0x', hex(substring(input, 1, 4))) AS method_id, gas_used AS gas_charged, toFloat64(gas_used) * gas_price / 1e18 AS fee_${opts.symbol.toLowerCase()}, toUInt8(success) AS status FROM raw_txs WHERE chain_id = ${opts.chainId} AND block_time >= ${since}`;
}

/** what a question's time words mean; the same for every target but Fuji, whose line stays as it was */
const CALENDAR = `- Calendar words are calendar windows that run to now: "today" starts at toStartOfDay(now()), "this week" at toMonday(now()), "this month" at toStartOfMonth(now()), "this year" at toStartOfYear(now()). A calendar window never starts earlier: this week is never toMonday(now()) - INTERVAL 7 DAY. "The last 30 days" (24 hours, 7 days) is a rolling window from now() - INTERVAL 30 DAY. Write these windows with now(), and in the note in words ("since Monday"), never with today's date or a date written out (not toMonday(toDateTime('2022-03-09'))): a kept answer and its note are shown again on later days. A day or a week the question names runs to the start of the next one, in the year of today's date (the question's first line) unless it names another: the week of Monday March 7, 2022 is block_time >= toDateTime('2022-03-07 00:00:00') AND block_time < toDateTime('2022-03-14 00:00:00').`;
/** the window of a daily, weekly or monthly series whose question names none, which the writer otherwise picks at
    random (the whole history, this year, 12 weeks); an EVM chain's, as the P-Chain's worked examples read their own */
const SERIES = ` A daily, weekly or monthly series whose question names no window never reads the whole history: it reads 30 days of daily buckets from toStartOfDay(now()) - INTERVAL 30 DAY, 8 weeks of weekly ones from toMonday(now()) - INTERVAL 7 WEEK (the current week and the 7 before it), or 12 months of monthly ones from toStartOfMonth(now()) - INTERVAL 11 MONTH (or as far back as the table's limit above allows), and its title and note name that window ("in the last 30 days", "in the last 8 weeks", "in the last 12 months").`;
const CALENDAR_FUJI = `- Calendar words are calendar windows: "today" starts at toStartOfDay(now()), "this week" at toMonday(now()), "this month" at toStartOfMonth(now()), "this year" at toStartOfYear(now()). "The last 30 days" (24 hours, 7 days) is a rolling window from now() - INTERVAL 30 DAY.`;
const calendar = (chainId: number) => (isFuji(chainId) ? CALENDAR_FUJI : targetOf(chainId).kind === "pchain" ? CALENDAR : `${CALENDAR}${SERIES}`);

/** a question's daily, weekly or monthly bucket, and any other time word, which names a window of its own */
const BUCKET = /\b(?:(?:per|each|every|by)\s+(day|week|month)|(daily|weekly|monthly))\b/gi;
const TIME_WORD = /\b(?:now|today|tonight|yesterday|hours?|minutes?|days?|weeks?|months?|years?|quarters?|since|until|before|after|during|ago|last|past|previous|prior|recent|latest|current|ever|all[- ]time|history|launch|(?:mon|tues|wednes|thurs|fri|satur|sun)day|weekend|jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?|ytd|mtd|q[1-4]|\d{4}|\d{1,2}(?:st|nd|rd|th))\b/i;
const SERIES_TURN: Record<string, string> = {
  day: "a daily series reads 30 days",
  week: "a weekly series reads the current week and the 7 before it",
  month: "a monthly series reads 12 months, or as far back as its table allows",
};
/** the series default again, for a question with one bucket and no other time word: the calendar rule alone was
    read in 1 of 6 first calls (D06 read 12 weeks), and with this line in 6 of 6 */
function seriesTurn(prompt: string): string {
  const units = [...prompt.matchAll(BUCKET)].map((m) => (m[1] ?? m[2].replace(/ly$/i, "").replace(/^dai$/i, "day")).toLowerCase());
  return units.length === 1 && !TIME_WORD.test(prompt.replace(BUCKET, " ")) ? ` The question names no window: ${SERIES_TURN[units[0]]}.` : "";
}

/** the window the chart before a follow-up read, for the follow-up's turn: a follow-up that changed the period
    ("per hour instead") took the system prompt's default window for that period, not the chart's (the follow-up
    audit's T01 went from 6 hours to 24, and T02's start moved 7 hours) */
function keptTurn(before: string, now: Date): string {
  const w = sqlWindow(before, now.getTime());
  if (!w || w === "unknown") return "";
  const at = (t: number) => new Date(t).toISOString().slice(0, 16).replace("T", " ");
  const span = w.open ? `from ${at(w.start)} UTC to now` : `from ${at(w.start)} to ${at(w.end)} UTC`;
  // the window's own words when they are a phrase a query is written from (in the last 6 hours, this week)
  const words = windowWords(w, now.getTime());
  return ` This question follows the chart before it, which read ${/^(?:since|from)\b/.test(words) ? span : `${words} (${span})`}: keep that window unless this question names another.`;
}

/* a question about one token's transfers is told in its turn to count the token's mints and burns: the system
   prompt's rule held in 2 of 4 replays (the regression audit's R13 left out mints that were 91.8% of the transfers) */
const TOKEN_TRANSFERS = /\btransfer(?:s|red)?\b/i;
const ONE_TOKEN = /\b0x[0-9a-fA-F]{40}\b|\b(?:token|nft|collection)\b/i;
const mintsTurn = (prompt: string) =>
  TOKEN_TRANSFERS.test(prompt) && ONE_TOKEN.test(prompt) ? " A question about a token's transfers counts its mints (transfers from the zero address) and burns (to it) in columns of their own." : "";

/** the writer's turn: the question after today's date, so a date it names has a year. The date is in the turn, not
    the system prompt, so the prompt's version and cache stay the same from day to day. On an EVM chain a series
    question on its own is told its default window there too, and a follow-up the window of the chart before it
    (before: that chart's SQL). Fuji's turn stays as it was */
export function userTurn(chainId: number, prompt: string, now = new Date(), alone = true, before?: string): string {
  if (isFuji(chainId)) return prompt;
  const evm = targetOf(chainId).kind !== "pchain";
  const series = alone && evm ? seriesTurn(prompt) : "";
  const kept = !alone && evm && before ? keptTurn(before, now) : "";
  const mints = evm ? mintsTurn(prompt) : "";
  return `Today is ${now.toISOString().slice(0, 10)} (UTC).${series}${kept}${mints}\n\n${prompt}`;
}

/** how an answer hands back its chart; the same for every target */
function chartSpec(symbol: string): string {
  return `## Chart spec
- kind: "line" for continuous series, "bar" for buckets or rankings, "area" for stacked shares, "table" for records and for a single figure (a one-row table), "none" only when these tables cannot answer the question. With kind "none" the title is "No chart for this question", whatever the question is about, and the note says in one sentence what these tables can answer instead.
- x: the column on the horizontal axis (time bucket, block number, or a label). series: the numeric columns to draw, each with a short label and a unit (${symbol}, gas, txs, %, addresses).
- title: at most eight words, sentence case. note: one or two plain sentences on what is counted and any caveat: a first or last hour, day or week that is not whole, a ranking that keeps only its top rows, a 90-day clamp. Write for a person: never name columns (no share_pct, no success = false) or use engine words (bucket, row, query, table), never restate the data window, and never write hex (a topic, a selector, a hash or an address): say what it is ("ERC-20 transfers"). The note is kept with the query and shown again over later rows, so it never quotes a value from the rows: no figure, count, date, name or address. It claims no share or total ("all", "most", "the majority") that no column of the rows carries, and never calls a transaction's sender a contract. A share names the base its SQL divides by ("of the method calls counted", not "of all transactions"). It describes the data, never the server, the engine or the query (no "the server decodes names"). It makes no hedges ("may", "might", "could", "likely", "appears") and never repeats a filter in parentheses such as "(balance > 0)": it says the filter in words ("active seats"). No em dashes anywhere. Never write "settled", "waiting" or "pending", in any sense.`;
}

/* ------------------------------------------------------------------ */
/* The C-Chain's DEXs (protocols.ts), mainnet only, in the prompt of a
   question about them (dexQuestion): every other question's prompt is
   the one it was. The volume examples share one WITH, shown once and
   named by its shorthand, which the guard writes out (macros.ts): the
   pools of every family from their factories' creation logs, the
   window's swaps, the hour's WAVAX price and each swap's value. An
   example whose protocol the registry does not list is left out. */

const T = DEX_TOPICS;
/** the uint128 liquidity in the 16 bytes from `at`, exact, so a closed position sums to 0 */
const LIQ = (at: number) => `toInt256(reinterpretAsUInt128(reverse(substring(data, ${at}, 16))))`;
/** an int24 tick in the last 4 bytes of a topic */
const TICK = (c: string) => `reinterpretAsInt32(reverse(substring(${c}, 29, 4)))`;
const hexOf = (c: string) => `lower(concat('0x', hex(${c})))`;

const SWAPS = "uniqExact(tx, pool) AS swaps, uniqExactIf(tx, pool, usd IS NOT NULL) AS priced_swaps, round(sum(usd), 2) AS volume_usd";
/** a drill's record columns for a log */
const LOG_RECORD = "l.block_time AS t, l.block_number AS block_number, concat('0x', hex(l.transaction_hash)) AS tx_hash, lower(concat('0x', hex(l.tx_from))) AS from_address, lower(concat('0x', hex(l.address))) AS contract";
/** the Swap topics by the names $POOLS and the DEX WITH define: a drill that wrote their hex spent about 1 s of the
    writer's output on it (218 of a DEX answer's 969 output tokens, median) */
const SWAP_NAMES = "v2_swap, v3_swap, lb_swap, v4_swap";
/** the tokens of the one pool `pool` (bytes) that a family's creation log names */
const tokWith = (family: DexFamily, pool: string) =>
  `tok AS (SELECT substring(topic1, 13, 20) AS t0, substring(topic2, 13, 20) AS t1 FROM raw_logs WHERE chain_id = ${DEX_CHAIN_ID} AND block_time >= ${FIRST_DAY} AND topic0 = ${topic(CREATED[family][0])} AND address IN (SELECT factory FROM dex_factories WHERE chain_id = ${DEX_CHAIN_ID} AND family = '${family}') AND substring(data, ${family === "univ3" ? 45 : 13}, 20) = ${pool})`;
/** the stablecoin and WAVAX sides of raw amounts a0 and a1 of the pool's token0 and token1, in USD at the latest hour's price */
const worth = (a0: string, a1: string) =>
  `if(has(S, t0), ${a0} / pow(10, SD[indexOf(S, t0)]), 0) + if(has(S, t1), ${a1} / pow(10, SD[indexOf(S, t1)]), 0) + (if(has(A, t0), ${a0}, 0) + if(has(A, t1), ${a1}, 0)) / 1e18 * (SELECT price FROM px ORDER BY hour DESC LIMIT 1)`;
const LATEST = pxCte("now() - INTERVAL 1 HOUR", topic(T.v3Swap));

/** the univ2 factories whose pairs charge a fixed 0.3%, as a reader names them: Trader Joe v1, Pangolin v2 */
const fixedFeePairs = () =>
  DEX_FACTORIES.filter((f) => f.family === "univ2" && V2_FEE_PROTOCOLS.includes(f.protocol))
    .map((f) => `${DEX_PROTOCOLS[f.protocol]} ${f.version}`)
    .join(", ")
    .replace(/, ([^,]*)$/, " and $1");
/** the factories whose pools no log gives a fee for: the other univ2 ones and the solidly ones */
const noFeePools = () =>
  DEX_FACTORIES.filter((f) => (f.family === "univ2" && !V2_FEE_PROTOCOLS.includes(f.protocol)) || f.family === "solidly")
    .map((f) => `${DEX_PROTOCOLS[f.protocol]} ${f.version}`)
    .join(", ")
    .replace(/, ([^,]*)$/, " and $1");

function dexRules(): string {
  const protocols = Object.entries(DEX_PROTOCOLS)
    .map(([slug, name]) => `'${slug}' (${name}: ${DEX_FACTORIES.filter((f) => f.protocol === slug).map((f) => `${f.version || "pools"} ${f.family}`).join(", ")})`)
    .join("; ");
  const lines: Record<DexFamily, string> = {
    univ2: `univ2: PairCreated ${topic(T.v2Created)} puts the pool in word 0. Swap ${topic(T.v2Swap)}: amount0In, amount1In, amount0Out, amount1Out are words 0 to 3, so token0 moved words 0 + 2 and token1 words 1 + 3. Mint ${topic(T.v2Mint)} adds amount0 and amount1 (words 0 and 1); Burn ${topic(T.v2Burn)} removes them and sends them to topic2. Sync ${topic(T.v2Sync)}: reserve0 and reserve1, words 0 and 1.`,
    solidly: `solidly: PairCreated ${topic(T.solidlyCreated)} puts the pool in word 1: substring(data, 45, 20). Its pools emit the univ2 Swap, Mint and Burn, and Sync ${topic(T.solidlySync)} or the univ2 one.`,
    univ3: `univ3: PoolCreated ${topic(T.v3Created)} puts the pool in word 1 (substring(data, 45, 20)) and the fee in topic3, in millionths (500 is 0.05%). Swap ${topic(T.v3Swap)}: amount0 and amount1 are words 0 and 1, int256 (reinterpretAsInt256), positive into the pool; the tick is word 4. Mint ${topic(T.v3Mint)}: owner topic1, tickLower topic2, tickUpper topic3, liquidity the last 16 bytes of word 1. Burn ${topic(T.v3Burn)}: the same topics, liquidity the last 16 bytes of word 0. The positions contract (in dex_factories.positions) holds most positions as NFTs: its IncreaseLiquidity ${topic(T.increase)} and DecreaseLiquidity ${topic(T.decrease)} carry tokenId in topic1 and liquidity in the last 16 bytes of word 0. Pharaoh's old univ3 pools changed their fee with the cl-ramses FeeAdjustment.`,
    "cl-ramses": `cl-ramses: as univ3 (PoolCreated, Swap, Burn and the positions contract), but the pool's Mint is ${topic(T.ramsesMint)}: owner topic1, tickLower topic2, tickUpper topic3, the position's tokenId in word 1 and the liquidity in the last 16 bytes of word 2. A pool changes its fee many times a day: FeeAdjustment ${topic(T.feeAdjustment)}, oldFee word 0 and newFee word 1, in millionths.`,
    algebra: `algebra: CustomPool ${topic(T.algebraCustom)} names the tokens in topic2 and topic3 (topic1 is its deployer), Pool ${topic(T.algebraPool)} in topic1 and topic2; both put the pool in word 0. Its pools emit the univ3 Swap, Mint and Burn, and set their fee with Fee ${topic(T.algebraFee)}: word 0, in millionths. Its positions contracts write IncreaseLiquidity ${topic(T.algebraIncrease)}, tokenId in topic1, the liquidity added in the last 16 bytes of word 1 and the pool in word 4, and the univ3 DecreaseLiquidity.`,
    lb: `lb: LBPairCreated ${topic(T.lbCreated)} puts the pool in word 0 and the bin step in topic3; tokenX is token0 and tokenY token1. Swap ${topic(T.lbSwap)}: word 1 is amountsIn and word 2 amountsOut, each two uint128, X in the last 16 bytes and Y in the first 16. DepositedToBins ${topic(T.lbDeposit)} and WithdrawnFromBins ${topic(T.lbWithdraw)}: to is topic2, word 1 is the byte offset of the amounts array, and each bin's amounts word holds X in its last 16 bytes and Y in its first 16. Read the words as the worked example does, with extractAll over their hex: a lambda over range(n) that reads data copies the log once for each bin and runs out of memory.`,
    univ4: `univ4: every pool lives in one PoolManager (dex_factories.factory). Initialize ${topic(T.v4Initialize)} creates a pool: its id is topic1 (32 bytes), its tokens are topic2 and topic3 (native AVAX is the zero address), its fee is word 0 (8388608 marks a fee that changes). Swap ${topic(T.v4Swap)}: the pool id is topic1; amount0 and amount1 are words 0 and 1, signed from the swapper's side: take their absolute values. The PoolManager holds the tokens of every univ4 pool, so no token moves to a univ4 pool's own address.`,
    woofi: `woofi: no pools to find. Each woofi factory row is one WooPP contract that holds all its pairs and writes WooSwap ${topic(T.wooSwap)}: fromToken topic1, toToken topic2, to topic3, and in data fromAmount substring(data, 1, 32), toAmount substring(data, 33, 32), from, rebateTo, swapVol substring(data, 129, 32) and swapFee substring(data, 161, 32). swapVol is WOOFi's own value of each swap in USDC (6 decimals), so WOOFi's volume is sum(${U(4)}) / 1e6 over every swap, and the note says it is WOOFi's swapVol. swapFee is its fee, never its volume. The DEX WITH leaves WooSwap out, so add it when a question names WOOFi.`,
  };
  return `
## DEXs
Our server sends two small tables with a query that reads them:
- ${refLine("dex_factories")}: the pool factories of each DEX protocol, from our contract registry. protocol is a slug: ${protocols}. family names the events its pools emit. positions lists the contracts that hold the factory's positions as NFTs; it is empty for the others.
- ${refLine("dex_tokens")}: the tokens with the most DEX volume, with their decimals. quote is 'usd' for the four US dollar stablecoins (1 token = 1 USD), 'avax' for WAVAX and for native AVAX (the zero address in univ4 pools), else ''.
- factory, positions and token are raw bytes, like raw_logs.address: compare them directly (l.address = f.factory), never as text.
- Pools: the pools of a protocol are the pools its factories created, as the DEX WITH below reads them from the creation logs, from ${FIRST_DAY}, the first day of the C-Chain. k is the fee a univ3, cl-ramses or univ4 pool was created with (millionths) or the bin step of an lb pool, and 0 for the others. That read, and a read of one pool's own liquidity logs by its address, are the only exceptions to the 90-day window.
- Swaps: read the Swap logs of the window by topic0 only, then join the pools on the pool (the log's address, or topic1 for univ4). A swap is the part of one transaction in one pool: count swaps as uniqExact(tx, pool), never as logs, because an lb pool writes one Swap log for each bin it crosses. Volume adds every log.
- The families (word k of data is substring(data, 1 + 32 * k, 32); amounts are uint256 unless said; an address is the last 20 bytes of its word or topic):
${dexFamilies()
  .map((f) => `  - ${lines[f]}`)
  .join("\n")}
- Amounts: toFloat64 first, then divide by pow(10, decimals) from dex_tokens. A token that is not in dex_tokens has no decimals here: never add up its raw amounts; count its swaps or transfers instead.
- Volume, in USD: the value of a swap is its stablecoin leg (1 token = 1 USD). With no stablecoin leg it is its WAVAX or native AVAX leg at the WAVAX price of that hour; with neither, it has no value. The WAVAX price of an hour is the median, over the swaps of that hour in the Uniswap v3 WAVAX/USDC 0.05% pool ${DEX_PRICE_POOL} (token0 WAVAX, token1 USDC), of -amount1 / amount0 * 1e12. Rows carry swaps, priced_swaps (the swaps with a value) and volume_usd. The note says that the volume counts the stablecoin leg of each swap, or its WAVAX leg at the price of that hour in the Uniswap v3 WAVAX/USDC pool, and leaves out swaps between other tokens.
- Prices and values come from the DEX WITH: a swap's value is usd in legs, and the WAVAX price of an hour is price in px. Never price a swap again in a query of your own. A price the question asks for itself (the WAVAX price on each DEX) is the ratio of a swap's amounts r0 and r1 in legs, each over its decimals.
- A token amount in a row is in the token's units: r0 / pow(10, d) with d from dex_tokens, never a raw r0 or r1. For a token dex_tokens lacks, show usd alone.
- Name a value column by its unit, and make it hold that unit: _usd for dollars, _avax for AVAX. A value made from usd or price is in dollars.
- Tokens: a question about tokens (which tokens have the most volume or swaps) is answered per token, never per pair. Each swap counts once for each of its two tokens, and native AVAX (the zero address, a univ4 pool's t0) counts as WAVAX: FROM legs ARRAY JOIN [if(t0 = unhex('0000000000000000000000000000000000000000'), unhex('b31f66aa3c1e785363f0875a1b74e27b85fd66c7'), t0), t1] AS token.
- A trader is the sender of the transaction (tx_from); a router is the contract it called (tx_to). The new pools of a period are the creation logs of the factories in that period.
- Fees: the fees of a pool, a protocol or a DEX (what its LPs earned, what its swappers paid) are sum(fee_usd) over its legs, in dollars. They are swap fees, not gas: raw_txs has none of them. A query that reads fee_rate, fee_usd, fee_in or token_in gets them in legs. fee_rate is the fee a swap paid, as a share of its amount in: the rate its Swap log carries (lb, univ4), else the fee its pool last set before it (FeeAdjustment, Fee), else its pool's fee tier k (univ3, cl-ramses), else 0.3% for the pairs of ${fixedFeePairs()}. fee_usd is usd * fee_rate, the whole fee in dollars with any protocol's share in it; fee_in is the same fee in raw units of token_in, the token the swap paid in. fee_usd is NULL for a swap with no value, and for every swap of a pool whose fee no log gives: the pools of ${noFeePools()}, and an algebra pool that never wrote Fee. Read fees from these columns, never from k, usd or a rate of your own. Rows carry fees_usd and swaps_not_counted, uniqExactIf(tx, pool, fee_usd IS NULL), and the note says how many swaps were not counted: those with no value, and those in a pool whose fee no log gives.
- Liquidity providers, one pool at a time, each as its worked example shows. First read the pool's own Mint and Burn logs (a rare topic by one address is fast), then only the blocks and transactions they name (block_number IN, since raw_logs sorts by topic0 and block_number): a read of a positions contract's or a pool token's logs over their whole history is too slow. univ3, cl-ramses and algebra: the positions contract's logs of those transactions, valued at the current tick. univ2 and solidly: the deposits less the withdrawals of each sender (a withdrawal can pay a router), as shares of the pool's reserves at its last Sync; the pool token's own Transfer logs are too many to read for an old pool. lb: the deposits less the withdrawals of each sender. Value only the stablecoin and WAVAX sides, at the latest WAVAX price, and the note says so.
- In a DEX query, never name an expression after a column of a table it reads: with hex(topic0) AS topic0, every other topic0 in that SELECT reads the text, so WHERE topic0 = unhex(…) matches nothing. Name it for what it holds (pool_address, event_topic).
- Say swaps, never trades: a trade routed through two pools is two swaps.
- Return pools, tokens and providers as 0x text: the server names tokens and protocols. Filter a protocol by its slug, never by its name, and a version the question names by version as well: "Uniswap v3" is protocol = 'uniswap' AND version = 'v3'.
- Per DEX or per protocol means every protocol: GROUP BY protocol (and the bucket), one row each. Never a column per protocol, such as sumIf(1, protocol = 'pangolin') AS pangolin: it leaves out every protocol it does not name.
`;
}

function dexExamples(): string {
  const has = (slug: string) => DEX_FACTORIES.some((f) => f.protocol === slug);
  const uni = DEX_FACTORIES.find((f) => f.protocol === "uniswap" && f.family === "univ3" && f.positions.length);
  const tj = DEX_FACTORIES.filter((f) => f.protocol === "trader-joe").map((f) => f.family);
  const today = "toStartOfDay(now())";
  const week = "toMonday(now())";
  const blocks: string[] = [
    `The DEX WITH. A query about swaps or volume starts with it: it reads the pools of every family, the Swap logs of the window, the WAVAX price of each hour and the value of each swap (legs). Never write it out, or a shorter copy of it: open every such query with $DEX(start), $DEX(start, end), or either with a slug last ($DEX(start, 'slug'), $DEX(start, end, 'slug')), even one that needs no value. Our server writes it in place: its Swap logs start at start and stop before end, and a slug keeps one protocol's pools. $POOLS() or $POOLS('slug') is its first two parts alone: the Swap topic names and pools. start and end are DateTimes, such as toStartOfDay(now()) or toDateTime('2022-03-07 00:00:00'). A window with no end runs to now; a named day or week has an end: $DEX(toDateTime('2022-03-07 00:00:00'), toDateTime('2022-03-08 00:00:00'), 'trader-joe') is Monday March 7, 2022. legs has one row per Swap log (an lb swap that crosses n bins is n rows): pool, block_time, block_number, tx, trader, router, protocol, version, t0, t1, k, r0, r1 and usd, and no chain_id (the WITH reads this chain's logs); a query that reads fee_rate, fee_usd, fee_in or token_in gets them too, and the WITH then reads each pool's fee changes. Never join raw_logs back to legs: every figure of a swap is in its row. After the shorthand comes SELECT, or , name AS (…) for a WITH of your own. Besides legs, the WITH names pools (protocol, version, pool, t0, t1 and k), px (hour and price, the WAVAX price of each hour), dex_quotes (the tokens it prices in USD and in AVAX) and the Swap topics v2_swap, v3_swap, lb_swap and v4_swap: a WITH of your own names its parts otherwise.`,
    `Every DEX protocol by today's volume, with its share; drill into one protocol's swaps:
$DEX(${today}) SELECT protocol, ${SWAPS}, round(100 * sum(usd) / nullIf(sum(sum(usd)) OVER (), 0), 2) AS share_pct, count() OVER () AS of_total FROM legs GROUP BY protocol ORDER BY volume_usd DESC
drill: $POOLS() SELECT ${LOG_RECORD} FROM raw_logs AS l WHERE l.chain_id = ${DEX_CHAIN_ID} AND l.block_time >= ${today} AND l.topic0 IN (${SWAP_NAMES}) AND if(l.topic0 = v4_swap, l.topic1, l.address) IN (SELECT pool FROM pools WHERE protocol = {{protocol}}) ORDER BY l.block_time DESC LIMIT 50`,
    `What the LPs of each DEX protocol earned in fees this week, with the swaps no fee is known for; drill into one protocol's swaps:
$DEX(${week}) SELECT protocol, round(sum(fee_usd), 2) AS fees_usd, uniqExactIf(tx, pool, fee_usd IS NULL) AS swaps_not_counted, ${SWAPS} FROM legs GROUP BY protocol ORDER BY fees_usd DESC
drill: $POOLS() SELECT ${LOG_RECORD} FROM raw_logs AS l WHERE l.chain_id = ${DEX_CHAIN_ID} AND l.block_time >= ${week} AND l.topic0 IN (${SWAP_NAMES}) AND if(l.topic0 = v4_swap, l.topic1, l.address) IN (SELECT pool FROM pools WHERE protocol = {{protocol}}) ORDER BY l.block_time DESC LIMIT 50`,
  ];
  if (has("pharaoh")) {
    blocks.push(`One protocol's swaps and volume per day this week; drill into one day's swaps:
$DEX(${week}, 'pharaoh') SELECT toDate(block_time) AS t, ${SWAPS} FROM legs GROUP BY t ORDER BY t
drill: $POOLS('pharaoh') SELECT ${LOG_RECORD} FROM raw_logs AS l WHERE l.chain_id = ${DEX_CHAIN_ID} AND l.block_time >= ${week} AND toDate(l.block_time) = {{t}} AND l.topic0 IN (${SWAP_NAMES}) AND if(l.topic0 = v4_swap, l.topic1, l.address) IN (SELECT pool FROM pools) ORDER BY l.block_time DESC LIMIT 50`);
  }
  if (tj.length) {
    blocks.push(`One protocol's 15 busiest pools today, with version, tokens and fee or bin step; drill into one pool's swaps:
$DEX(${today}, 'trader-joe') SELECT ${hexOf("pool")} AS pool_address, version, ${hexOf("t0")} AS token0, ${hexOf("t1")} AS token1, k AS fee_or_bin_step, ${SWAPS}, count() OVER () AS of_total FROM legs GROUP BY pool, version, t0, t1, k ORDER BY swaps DESC LIMIT 15
drill: $POOLS() SELECT ${LOG_RECORD} FROM raw_logs AS l WHERE l.chain_id = ${DEX_CHAIN_ID} AND l.block_time >= ${today} AND l.topic0 IN (${SWAP_NAMES}) AND l.address = {{pool_address:bytes}} ORDER BY l.block_time DESC LIMIT 50`);
  }
  if (uni) {
    const P = topic(DEX_PRICE_POOL.slice(2));
    const N = "npm";
    const from = `block_time >= ${FIRST_DAY}`;
    blocks.push(`The 15 largest liquidity providers of one univ3 pool (here Uniswap v3 WAVAX/USDC 0.05%; find a pool in pools by its tokens and k), its positions valued at the current tick; drill into one provider's liquidity logs:
WITH ${topic(uni.positions[0].slice(2))} AS npm, m AS (SELECT transaction_hash AS tx, block_number AS bn, substring(topic1, 13, 20) AS owner, ${TICK("topic2")} AS tl, ${TICK("topic3")} AS tu, ${LIQ(49)} AS liq FROM raw_logs WHERE chain_id = ${DEX_CHAIN_ID} AND ${from} AND topic0 = ${topic(T.v3Mint)} AND address = ${P}), b AS (SELECT transaction_hash AS tx, block_number AS bn, substring(topic1, 13, 20) AS owner, ${TICK("topic2")} AS tl, ${TICK("topic3")} AS tu, ${LIQ(17)} AS liq FROM raw_logs WHERE chain_id = ${DEX_CHAIN_ID} AND ${from} AND topic0 = ${topic(T.v3Burn)} AND address = ${P}), inc AS (SELECT transaction_hash AS tx, topic1 AS id, ${LIQ(17)} AS liq, block_time AS at, tx_from AS sender FROM raw_logs WHERE chain_id = ${DEX_CHAIN_ID} AND ${from} AND topic0 = ${topic(T.increase)} AND address = ${N} AND block_number IN (SELECT bn FROM m WHERE owner = ${N}) AND transaction_hash IN (SELECT tx FROM m WHERE owner = ${N})), pos AS (SELECT inc.id AS id, m.tl AS tl, m.tu AS tu, sum(inc.liq) AS added, argMin(inc.sender, inc.at) AS creator FROM inc INNER JOIN m ON inc.tx = m.tx AND inc.liq = m.liq WHERE m.owner = ${N} GROUP BY inc.id, m.tl, m.tu), gone AS (SELECT topic1 AS id, sum(${LIQ(17)}) AS removed FROM raw_logs WHERE chain_id = ${DEX_CHAIN_ID} AND ${from} AND topic0 = ${topic(T.decrease)} AND address = ${N} AND block_number IN (SELECT bn FROM b WHERE owner = ${N}) AND transaction_hash IN (SELECT tx FROM b WHERE owner = ${N}) GROUP BY id), held AS (SELECT pos.creator AS holder, pos.tl AS tl, pos.tu AS tu, pos.added - gone.removed AS L FROM pos LEFT JOIN gone ON pos.id = gone.id WHERE L > 0 UNION ALL SELECT owner AS holder, tl, tu, sum(liq) AS L FROM (SELECT owner, tl, tu, liq FROM m WHERE owner != ${N} UNION ALL SELECT owner, tl, tu, -liq FROM b WHERE owner != ${N}) GROUP BY owner, tl, tu HAVING L > 0), cur AS (SELECT argMax(reinterpretAsInt32(reverse(substring(data, 157, 4))), (block_number, log_index)) AS tick FROM raw_logs WHERE chain_id = ${DEX_CHAIN_ID} AND block_time >= now() - INTERVAL 1 DAY AND topic0 = ${topic(T.v3Swap)} AND address = ${P}), ${tokWith("univ3", P)}, ${LATEST}, ${QUOTES}, v AS (SELECT h.holder AS holder, toFloat64(h.L) AS liquidity, pow(1.0001, h.tl / 2) AS sa, pow(1.0001, h.tu / 2) AS sb, least(greatest(pow(1.0001, cur.tick / 2), sa), sb) AS s, liquidity * (sb - s) / (s * sb) AS a0, liquidity * (s - sa) AS a1, cur.tick >= h.tl AND cur.tick < h.tu AS in_range, ${worth("a0", "a1")} AS usd FROM held AS h CROSS JOIN cur CROSS JOIN tok CROSS JOIN dex_quotes) SELECT ${hexOf("holder")} AS provider, count() AS positions, round(sum(usd), 2) AS value_usd, round(sum(if(in_range, usd, 0)), 2) AS in_range_usd, round(100 * sum(usd) / nullIf(sum(sum(usd)) OVER (), 0), 2) AS share_pct, count() OVER () AS of_total FROM v GROUP BY holder ORDER BY value_usd DESC LIMIT 15
drill: SELECT ${LOG_RECORD} FROM raw_logs AS l WHERE l.chain_id = ${DEX_CHAIN_ID} AND l.block_time >= ${FIRST_DAY} AND l.topic0 IN (${topic(T.v3Mint)}, ${topic(T.v3Burn)}) AND l.address = ${P} AND (l.tx_from = {{provider:bytes}} OR substring(l.topic1, 13, 20) = {{provider:bytes}}) ORDER BY l.block_time DESC LIMIT 50`);
  }
  if (tj.includes("univ2")) {
    const P = topic("f4003f4efbe8691b60249e6afbd307abe7758adb");
    blocks.push(`The 15 largest liquidity providers of one univ2 or solidly pool (here Trader Joe v1 WAVAX/USDC), by deposits less withdrawals, as shares of the pool's reserves at its last Sync; drill into one provider's Mint and Burn logs:
WITH ${tokWith("univ2", P)}, moves AS (SELECT tx_from AS holder, if(topic0 = ${topic(T.v2Mint)}, 1, -1) AS dir, ${U(0)} AS a0, ${U(1)} AS a1 FROM raw_logs WHERE chain_id = ${DEX_CHAIN_ID} AND block_time >= ${FIRST_DAY} AND topic0 IN (${topic(T.v2Mint)}, ${topic(T.v2Burn)}) AND address = ${P}), res AS (SELECT argMax(data, (block_number, log_index)) AS r FROM raw_logs WHERE chain_id = ${DEX_CHAIN_ID} AND block_time >= now() - INTERVAL 1 DAY AND topic0 IN (${topic(T.v2Sync)}, ${topic(T.solidlySync)}) AND address = ${P}), ${LATEST}, ${QUOTES}, net AS (SELECT d.holder AS holder, sum(d.dir * (${worth("d.a0", "d.a1")})) AS deposited FROM moves AS d CROSS JOIN tok CROSS JOIN dex_quotes GROUP BY d.holder HAVING deposited > 0) SELECT ${hexOf("n.holder")} AS provider, round(100 * n.deposited / nullIf(sum(n.deposited) OVER (), 0), 2) AS share_pct, round(n.deposited / nullIf(sum(n.deposited) OVER (), 0) * (${worth(U(0, "res.r"), U(1, "res.r"))}), 2) AS value_usd, count() OVER () AS of_total FROM net AS n CROSS JOIN tok CROSS JOIN res CROSS JOIN dex_quotes ORDER BY n.deposited DESC LIMIT 15
drill: SELECT ${LOG_RECORD} FROM raw_logs AS l WHERE l.chain_id = ${DEX_CHAIN_ID} AND l.block_time >= ${FIRST_DAY} AND l.topic0 IN (${topic(T.v2Mint)}, ${topic(T.v2Burn)}) AND l.address = ${P} AND l.tx_from = {{provider:bytes}} ORDER BY l.block_time DESC LIMIT 50`);
  }
  if (tj.includes("lb")) {
    const P = topic("864d4e5ee7318e97483db7eb0912e09f161516ea");
    blocks.push(`The 15 largest liquidity providers of one lb pool (here Trader Joe LB v2.2 WAVAX/USDC), by deposits less withdrawals over all bins at the latest WAVAX price; drill into one provider's deposits and withdrawals:
WITH ${tokWith("lb", P)}, moves AS (SELECT tx_from AS holder, if(topic0 = ${topic(T.lbDeposit)}, 1, -1) AS dir, reinterpretAsUInt32(reverse(substring(data, 61, 4))) AS o, extractAll(hex(substring(data, o + 33, 32 * reinterpretAsUInt32(reverse(substring(data, o + 29, 4))))), '[0-9A-F]{64}') AS words, arraySum(arrayMap(w -> toFloat64(reinterpretAsUInt128(reverse(unhex(substring(w, 33, 32))))), words)) AS a0, arraySum(arrayMap(w -> toFloat64(reinterpretAsUInt128(reverse(unhex(substring(w, 1, 32))))), words)) AS a1 FROM raw_logs WHERE chain_id = ${DEX_CHAIN_ID} AND block_time >= ${FIRST_DAY} AND topic0 IN (${topic(T.lbDeposit)}, ${topic(T.lbWithdraw)}) AND address = ${P}), ${LATEST}, ${QUOTES} SELECT ${hexOf("d.holder")} AS provider, round(sum(d.dir * (${worth("d.a0", "d.a1")})), 2) AS value_usd, count() OVER () AS of_total FROM moves AS d CROSS JOIN tok CROSS JOIN dex_quotes GROUP BY d.holder HAVING value_usd > 0 ORDER BY value_usd DESC LIMIT 15
drill: SELECT ${LOG_RECORD} FROM raw_logs AS l WHERE l.chain_id = ${DEX_CHAIN_ID} AND l.block_time >= ${FIRST_DAY} AND l.topic0 IN (${topic(T.lbDeposit)}, ${topic(T.lbWithdraw)}) AND l.address = ${P} AND l.tx_from = {{provider:bytes}} ORDER BY l.block_time DESC LIMIT 50`);
  }
  if (has("pharaoh")) {
    blocks.push(`The net flow of each listed token into one protocol's pools today, from the tokens' Transfer logs; drill into one token's transfers:
$POOLS('pharaoh'), places AS (SELECT groupArray(token) AS K, groupArray(decimals) AS D FROM dex_tokens WHERE chain_id = ${DEX_CHAIN_ID}), moved AS (SELECT toString(l.address) AS contract, substring(l.topic2, 13, 20) IN (SELECT pool FROM pools) AS into_pools, substring(l.topic1, 13, 20) IN (SELECT pool FROM pools) AS out_of_pools, ${U(0, "l.data")} AS amount FROM raw_logs AS l WHERE l.chain_id = ${DEX_CHAIN_ID} AND l.block_time >= ${today} AND l.topic0 = ${topic(T.transfer)} AND length(l.data) = 32 AND l.address IN (SELECT token FROM dex_tokens WHERE chain_id = ${DEX_CHAIN_ID}) AND (into_pools OR out_of_pools)) SELECT ${hexOf("m.contract")} AS token, count() AS transfers, sumIf(m.amount, m.into_pools) / pow(10, any(D[indexOf(K, m.contract)])) AS inflow, sumIf(m.amount, m.out_of_pools) / pow(10, any(D[indexOf(K, m.contract)])) AS outflow, inflow - outflow AS net_flow FROM moved AS m CROSS JOIN places GROUP BY m.contract ORDER BY transfers DESC
drill: $POOLS('pharaoh') SELECT ${LOG_RECORD} FROM raw_logs AS l WHERE l.chain_id = ${DEX_CHAIN_ID} AND l.block_time >= ${today} AND l.topic0 = ${topic(T.transfer)} AND l.address = {{token:bytes}} AND (substring(l.topic2, 13, 20) IN (SELECT pool FROM pools) OR substring(l.topic1, 13, 20) IN (SELECT pool FROM pools)) ORDER BY l.block_time DESC LIMIT 50`);
  }
  return blocks.map((b) => `${b}\n\n`).join("");
}

/** the registry's protocol names and slugs, and the words of a DEX question */
const DEX_NAMES = [...new Set(Object.entries(DEX_PROTOCOLS).flatMap(([slug, name]) => [slug, slug.replace(/-/g, " "), name, name.replace(/\s+DEX$/i, "")]))];
const DEX_WORDS = new RegExp(`\\b(${[...DEX_NAMES.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), "swap(s|ped|ping)?", "pools?", "liquidity", "lps?", "dex(s|es)?"].join("|")})\\b`, "i");

/** a question about DEXs, whose prompt carries the DEX chapter: it names a protocol the registry lists or a DEX word
    (volume only when it names no transfer, so "USDC transfers, count and volume" is not one), or an earlier turn read
    the DEX tables. Every other question's prompt is the one it was */
export function dexQuestion(chainId: number, prompt: string, history: { prompt?: string; sql?: string }[] = []): boolean {
  if (chainId !== DEX_CHAIN_ID || DEX_FACTORIES.length === 0) return false;
  const about = (q: string) => DEX_WORDS.test(q) || (/\bvolumes?\b/i.test(q) && !/\btransfers?\b/i.test(q));
  return about(prompt) || history.some((t) => about(t.prompt ?? "") || /\bdex_(factories|tokens)\b/.test(t.sql ?? ""));
}

/* ------------------------------------------------------------------ */
/* The C-Chain's lending protocols (lending.ts), mainnet only, in the
   prompt of a question about them (lendingQuestion): every other
   question's prompt is the one it was. The writer types the shorthand
   (macros.ts) and reads the one table each ends in; the chapter says
   what each table's columns hold, since the WITHs are the server's. */

const CORE_MARKETS = LENDING_MARKETS.filter((m) => m.version === "core").length;
const BENQI_SLUG = Object.keys(LENDING_PROTOCOLS).find((s) => s !== AAVE_SLUG) ?? "benqi";

function lendingRules(): string {
  const slugs = Object.entries(LENDING_PROTOCOLS)
    .map(([slug, name]) => `'${slug}' (${name})`)
    .join(" or ");
  return `
## Lending
Aave v3 and Benqi Core (a Compound v2 fork) on this chain, from our contract registry. protocol is a slug: ${slugs}. Aave has one Pool for every reserve; Benqi has one market, a qiToken, for each asset.
Our server sends two small tables with a query that reads them, and defines the names of the protocols' topics and contracts (below) in front of it:
- ${refLine("lending_markets")}: Benqi's ${CORE_MARKETS} core markets. market is the qiToken; asset is the token it lends, the zero address for qiAVAX, which holds native AVAX. decimals and price are the asset's.
- ${refLine("lending_tokens")}: the ${AAVE_ASSETS.length} assets Aave lends, with their decimals and price.
- price is the kind of USD price an asset has: 'usd' for a stablecoin (1 token = 1 USD); 'avax', 'btc', 'eth', 'link', 'eurc', 'qi' or 'savax' for a price our server reads from swaps; '' for none.
- market, asset and token are raw bytes, like raw_logs.address: compare them directly, never as text.
- The shorthand. Never write a lending WITH out, or a shorter copy of it: open the query with one of these, and our server writes it in place. Each ends in one table:
  - $LEND(start), $LEND(start, end), or either with a slug last: actions, one row for each supply, withdrawal, borrow and repayment in the window, and each Aave flash loan. Columns: t, protocol, action ('supply', 'withdraw', 'borrow', 'repay' or 'flash_loan'), asset, who (the account the action is for: on Aave the onBehalfOf of a supply or a borrow, the user of a withdrawal or a repayment and the initiator of a flash loan; on Benqi the minter, the redeemer or the borrower), amount (in the asset's units), premium (a flash loan's fee, in the asset's units; 0 for the other actions), usd and premium_usd (at the hour's price; sAVAX at its stake rate in AVAX), tx.
  - $LIQUIDATIONS(start), $LIQUIDATIONS(start, end), or either with a slug last: liquidations, one row for each liquidation in the window. Columns: t, protocol, borrower, liquidator, debt_asset, debt_amount, debt_usd (the debt repaid), collateral_asset, collateral_amount, collateral_usd (the collateral the borrower lost), received_usd (what the liquidator got: all of the collateral on Aave, 97% of it on Benqi, whose market keeps 3% as reserves), tx. Prices are the hour's.
  - $DEBTS() or $DEBTS('slug'): debts, one row for each borrower and asset now. Columns: protocol, borrower, asset, amount, usd.
  - $MARKETS() or $MARKETS('slug'): markets, one row for each market now. Columns: protocol, asset, supplied, borrowed, reserves (Benqi), supplied_usd, borrowed_usd, utilization_pct (borrowed over supplied), tvl_usd (supplied less borrowed), supply_apy_pct and borrow_apy_pct (Aave).
  - $PRICES(start) or $PRICES(start, end): lpx, one row for each day of the window: d, and px, a map of the USD price by price kind (px['avax'], or px[k.price] for an asset). Use it for a question the others do not cover.
- A question that names one protocol takes its slug. With no slug, each shorthand reads both protocols, and protocol is a column: a question about both, or about lending with no protocol named, opens with no slug. start and end are DateTimes, as for $DEX: a window with no end runs to now. After the shorthand comes SELECT, or , name AS (…) for a WITH of your own.
- Take every USD figure from the shorthand's table: never price an amount again. usd is NULL for an asset with no price: every sum of usd comes with countIf(usd IS NULL) AS unpriced, so the reading can say how many events have no value. A deposit is a supply; a borrower is who on a borrow. Deposits, withdrawals, borrows and repayments are rows of actions, never transactions to the Pool counted by method. Name a value column by its unit (_usd for dollars), as the examples do. A token amount keeps its significant digits: never round() it (round(sum(amount)) shows -0.13 BTC.b as 0); only a value in dollars rounds, to cents. A net flow per asset is two figures, each in the asset's units and in USD: supplied less withdrawn (net_supply, net_supply_usd) and borrowed less repaid (net_borrow, net_borrow_usd). Write each as one sum with a sign that is 0 where neither action happened: if(countIf(action IN ('borrow', 'repay')) = 0, 0, sumIf(if(action = 'borrow', usd, -usd), action IN ('borrow', 'repay'))). A sumIf of usd over no rows is NULL, and a NULL reads as an asset with no price: an asset has no price only where its usd is NULL and its amount is not 0. Deposits (or borrows) over a window are a series: a row per hour, or per day past 7 days, with the count, the USD value and unpriced. The largest or top deposits are the events themselves, largest first.
- The events, for a query the shorthand does not cover (word k of data is substring(data, 1 + 32 * k, 32), and an address is the last 20 bytes of its word or topic). Write each name below as it is (aave_pool, flash_loan_t): our server defines it in front of the query, so a WITH of your own never defines one and no hex stands in for one. An address or a topic from memory is often wrong (another chain's, or a digit off), and a wrong one reads no rows. Aave's Pool is aave_pool: Supply supply_t (reserve topic1, onBehalfOf topic2; user word 0, amount word 1), Withdraw withdraw_t (reserve topic1, user topic2, to topic3; amount word 0), Borrow borrow_t (reserve topic1, onBehalfOf topic2; user word 0, amount word 1), Repay repay_t (reserve topic1, user topic2, repayer topic3; amount word 0), LiquidationCall liquidation_t (collateral topic1, debt topic2, user topic3; debt word 0, collateral word 1, liquidator word 2), FlashLoan flash_loan_t (target topic1, asset topic2; initiator word 0, amount word 1, premium word 3), ReserveDataUpdated reserve_data_t (reserve topic1; liquidity rate, stable and variable borrow rates, liquidity index and variable borrow index in words 0 to 4, in rays of 1e27). Benqi's events index nothing, so each argument is a data word in order: Mint qi_mint_t (minter, amount, qiTokens), Redeem qi_redeem_t (redeemer, amount, qiTokens), Borrow qi_borrow_t (borrower, amount, account borrows, total borrows), RepayBorrow qi_repay_t (payer, borrower, amount, account borrows, total borrows), LiquidateBorrow qi_liquidate_t (liquidator, borrower, amount, collateral market, seized qiTokens), AccrueInterest accrue_t (cash, interest, borrow index, total borrows). qiTokens have 8 decimals; every amount is in the asset's units.
- Benqi's Mint has the topic0 of a Uniswap v2 Mint: filter every Benqi log on a market's address, address IN (SELECT market FROM lending_markets WHERE chain_id = ${LENDING_CHAIN_ID}).
`;
}

function lendingExamples(): string {
  const week = "toMonday(now())";
  const hex = (c: string) => `lower(concat('0x', hex(${c})))`;
  return [
    `Each protocol's deposits and borrows per day this week, in USD; drill into one day's actions:
$LEND(${week}) SELECT toDate(t) AS day, protocol, round(sumIf(usd, action = 'supply'), 2) AS deposits_usd, round(sumIf(usd, action = 'borrow'), 2) AS borrows_usd, countIf(action = 'supply') AS deposits, countIf(action = 'borrow') AS borrows, countIf(usd IS NULL) AS unpriced FROM actions WHERE action IN ('supply', 'borrow') GROUP BY day, protocol ORDER BY day, protocol
drill: $LEND(${week}) SELECT t, action, ${hex("asset")} AS token, ${hex("who")} AS account, amount, round(usd, 2) AS value_usd, concat('0x', hex(tx)) AS tx_hash FROM actions WHERE toDate(t) = {{day}} AND protocol = {{protocol}} AND action IN ('supply', 'borrow') ORDER BY usd DESC LIMIT 50`,
    `Aave deposits per hour in the last 24 hours: their count, their USD value and the deposits with no price; drill into one hour's deposits:
$LEND(now() - INTERVAL 24 HOUR, '${AAVE_SLUG}') SELECT toStartOfHour(t) AS hour, count() AS deposits, round(sum(usd), 2) AS value_usd, countIf(usd IS NULL) AS unpriced FROM actions WHERE action = 'supply' GROUP BY hour ORDER BY hour
drill: $LEND(now() - INTERVAL 24 HOUR, '${AAVE_SLUG}') SELECT t, ${hex("asset")} AS token, amount, round(usd, 2) AS value_usd, ${hex("who")} AS depositor, concat('0x', hex(tx)) AS tx_hash FROM actions WHERE action = 'supply' AND toStartOfHour(t) = {{hour}} ORDER BY usd DESC LIMIT 50`,
    `The 20 largest Aave deposits of the last 24 hours, each with its asset, amount, value, depositor and transaction, with the count and value of every deposit of the window and each asset's share of that value; the rows are deposits, so no drill:
$LEND(now() - INTERVAL 24 HOUR, '${AAVE_SLUG}') SELECT t, ${hex("asset")} AS token, amount, round(usd, 2) AS value_usd, ${hex("who")} AS depositor, concat('0x', hex(tx)) AS tx_hash, count() OVER () AS deposits, round(sum(usd) OVER (), 2) AS total_usd, round(100 * sum(usd) OVER (PARTITION BY asset) / nullIf(sum(usd) OVER (), 0), 1) AS token_share_pct, countIf(usd IS NULL) OVER () AS unpriced FROM actions WHERE action = 'supply' ORDER BY usd DESC LIMIT 20`,
    `The 15 largest borrowers on Aave now, with their share of all its debt; drill into one borrower's debts:
$DEBTS('${AAVE_SLUG}') SELECT ${hex("borrower")} AS borrower_address, round(sum(usd), 2) AS debt_usd, count() AS debts, round(100 * sum(usd) / nullIf(sum(sum(usd)) OVER (), 0), 2) AS share_pct, count() OVER () AS of_total FROM debts GROUP BY borrower ORDER BY debt_usd DESC LIMIT 15
drill: $DEBTS('${AAVE_SLUG}') SELECT ${hex("asset")} AS token, amount, round(usd, 2) AS value_usd FROM debts WHERE borrower = {{borrower_address:bytes}} ORDER BY usd DESC LIMIT 50`,
    `The largest liquidations this week, each with its borrower, debt, collateral and liquidator; the rows are liquidations, so no drill:
$LIQUIDATIONS(${week}) SELECT t, protocol, ${hex("borrower")} AS borrower_address, ${hex("debt_asset")} AS debt_token, debt_amount AS debt, round(debt_usd, 2) AS debt_repaid_usd, ${hex("collateral_asset")} AS collateral_token, round(collateral_usd, 2) AS collateral_seized_usd, ${hex("liquidator")} AS liquidator_address, concat('0x', hex(tx)) AS tx_hash, count() OVER () AS of_total FROM liquidations ORDER BY debt_usd DESC LIMIT 15`,
    `Each Benqi market now: supplied, borrowed, utilization and TVL; drill into the market's actions this week:
$MARKETS('${BENQI_SLUG}') SELECT ${hex("asset")} AS token, supplied AS supplied_units, round(supplied_usd, 2) AS supplied_value_usd, round(borrowed_usd, 2) AS borrowed_value_usd, utilization_pct, round(tvl_usd, 2) AS tvl_value_usd FROM markets ORDER BY supplied_usd DESC
drill: $LEND(${week}, '${BENQI_SLUG}') SELECT t, action, ${hex("who")} AS account, amount, round(usd, 2) AS value_usd, concat('0x', hex(tx)) AS tx_hash FROM actions WHERE asset = {{token:bytes}} ORDER BY t DESC LIMIT 50`,
    `Aave's flash loans this week per asset, with their fees; drill into one asset's loans:
$LEND(${week}, '${AAVE_SLUG}') SELECT ${hex("asset")} AS token, count() AS loans, uniqExact(who) AS initiators, sum(amount) AS borrowed, round(sum(usd), 2) AS volume_usd, sum(premium) AS fees, round(sum(premium_usd), 2) AS fees_usd, countIf(usd IS NULL) AS unpriced FROM actions WHERE action = 'flash_loan' GROUP BY asset ORDER BY volume_usd DESC
drill: SELECT l.block_time AS t, concat('0x', hex(l.transaction_hash)) AS tx_hash, ${hex("substring(l.data, 13, 20)")} AS initiator_address FROM raw_logs AS l WHERE l.chain_id = ${LENDING_CHAIN_ID} AND l.block_time >= ${week} AND l.address = aave_pool AND l.topic0 = flash_loan_t AND substring(l.topic2, 13, 20) = {{token:bytes}} ORDER BY l.block_time DESC LIMIT 50`,
    `The USD price of AVAX, BTC and ETH per day this week, as the lending shorthands price an asset:
$PRICES(${week}) SELECT d, round(px['avax'], 4) AS avax_usd, round(px['btc'], 2) AS btc_usd, round(px['eth'], 2) AS eth_usd FROM lpx ORDER BY d`,
  ]
    .map((b) => `${b}\n\n`)
    .join("");
}

/* ------------------------------------------------------------------ */
/* Vaults, staking and bridges (families.ts), mainnet only, in the prompt
   of a question about them (familyQuestion): ERC-4626 vaults, OpenTrade's
   pools, sAVAX and CCTP. Each reads its contracts' own events by the
   names our server defines; USD values come from $PRICES. */

function familyRules(): string {
  const vaults = VAULTS.map((v) => `${v.protocol} ${v.name.split(" ")[0]} ${v.vault} (${v.symbol}, ${v.decimals} decimals${v.price === "usd" ? ", 1 USD" : `, priced as ${v.price === "avax" ? "AVAX" : "BTC"}`})`).join(", ");
  const silos = SILOS.map((s) => s.address.toLowerCase()).join(" and ");
  const word = (k: number) => `word ${k}`;
  return `
## Vaults, staking and bridges
From our contract registry, on this chain. Write each name below (a contract, a list or a topic) as it is (savax_token, cctp_burn_v1_t): our server defines it in front of the query, so a WITH of your own never defines one and no hex stands in for one. An address or a topic from memory is often wrong (another chain's, or a digit off), and a wrong one reads no rows. Word k of data is substring(data, 1 + 32 * k, 32), read with reverse() and reinterpretAsUInt256; an address is the last 20 bytes of its word or topic.
- ERC-4626 vaults: vaults lists them, ${vaults}. vault_decimals (the asset's), vault_share_decimals and vault_prices (the asset's price kind for $PRICES) run in the same order: vault_decimals[indexOf(vaults, address)]. Deposit vault_deposit_t (sender topic1, owner topic2; assets ${word(0)}, shares ${word(1)}): the owner gets the shares. Withdraw vault_withdraw_t (sender topic1, receiver topic2, owner topic3; assets ${word(0)}, shares ${word(1)}): the owner's shares burn. A vault's share price on a day is assets over shares of all its Deposit and Withdraw events that day, each over its decimals, so a day with withdrawals alone has a price too. Hypha's stAVAX was GoGoPool's ggAVAX. Avant pays a withdrawal to its cooldown silo (the receiver is ${silos}), and the user gets the assets a day later. Hypha pays a withdrawal in native AVAX, so no token Transfer reaches the receiver, but its Withdraw event counts it as every vault's does.
- OpenTrade: ot_pools are its ${OPENTRADE_POOLS.length} pools. Each holds a dollar stablecoin (USDC, or USDt in one), but ot_eur_pools hold EURC or EUROP (euros); every asset has 6 decimals. OpenTrade emits no ERC-4626 events. A deposit is PoolDeposit ot_deposit_t (lender topic1; assets ${word(0)}, shares ${word(1)}). A redemption is RedeemRequested ot_request_t, then RedeemAccepted ot_accept_t (lender topic1; assets ${word(0)}, shares ${word(1)}), then RedeemRepay ot_repay_t (lender topic1; shares ${word(0)}, assets ${word(1)}, fees ${word(2)}), which pays. ExchangeRateSet is ot_rate_t, or ot_rate_old_t on the older pools (read both: topic0 IN (ot_rate_t, ot_rate_old_t)). In both, ${word(0)} is the assets per share with 18 decimals, and ${word(2)} is what a Linear pool adds to it each day (18 decimals). A pool's rate is the one it last set, and its own exchangeRate() moves on from it each day after, so a reading of a pool's rate or size names the day of that set, and the note says the rates are the ones the pools posted: a Linear pool's exchangeRate() is higher by ${word(2)} for each day since. A pool's size is its shares times its last rate, never its token balance: the assets leave the pool at once.
- sAVAX (Benqi liquid staking) is savax_token. A stake is Submitted submitted_t (user topic1; AVAX ${word(0)}, shares ${word(1)}), paid in native AVAX. An unstake is UnlockRequested savax_unlock_t (user topic1; shares ${word(0)}), then Redeem savax_redeem_t (user topic1; its request time ${word(0)}, shares ${word(1)}, AVAX ${word(2)}), which burns the shares with no Transfer. AccrueRewards savax_rewards_t: the stakers' rewards ${word(0)} and the protocol's ${word(1)}, in AVAX. The AVAX per sAVAX is ${word(0)} over ${word(1)} of a Submitted. The sAVAX supply is the shares of every Submitted less the shares of every Redeem, both read from the first day: a mint's Transfer from the zero address carries its Submitted's shares, but sAVAX's Transfers are too many to read over its whole history (four 45 s timeouts in a replay). Every amount has 18 decimals. Filter every sAVAX log on address = savax_token: its Deposit has the topic0 of the WAVAX Deposit.
- Circle CCTP moves USDC (6 decimals) between chains. Out of Avalanche: DepositForBurn, cctp_burn_v1_t on cctp_messenger_v1 (nonce topic1, token topic2, depositor topic3; amount ${word(0)}, recipient ${word(1)}, destination domain ${word(2)}) or cctp_burn_v2_t on cctp_messenger_v2 (token topic1, depositor topic2, the finality it asks for topic3; amount ${word(0)}, recipient ${word(1)}, destination domain ${word(2)}, fee cap ${word(5)}). Into Avalanche: MintAndWithdraw, cctp_mint_v1_t or cctp_mint_v2_t on the messengers (recipient topic1, token topic2; amount ${word(0)}; on V2 the fee ${word(1)}, minted beside the amount). A mint's source domain is ${word(0)} of the MessageReceived (cctp_received_v1_t on cctp_transmitter_v1, cctp_received_v2_t on cctp_transmitter_v2) that follows it in the same transaction. cctp_domains[toUInt32(domain)] is a domain's chain (Avalanche is 1). Speed is known for a V2 transfer into Avalanche only: fast when the finality threshold executed of its MessageReceived, toUInt32(reinterpretAsUInt256(reverse(topic3))) of cctp_received_v2_t, is 1000 or less, standard above. Pair each mint with the MessageReceived after it in its transaction, as the worked example does. A transfer out of Avalanche is always standard: the finality its DepositForBurn asks for is a request, never the speed. A split by speed covers transfers into Avalanche, and the note says so.
- A figure now (a pool's last rate or size, the sAVAX supply, what a vault or a lender holds) reads the contract's events from ${FIRST_DAY}, the first day of the C-Chain: its topics are rare on these addresses, so the read is fast, and it is the one exception to the 90-day window. Never cut such a figure to 90 days.
- USD values: $PRICES(start) or $PRICES(start, end) is lpx, one row per day: d and px, the USD price by kind (px['avax'] for AVAX and the AVAX of sAVAX, px['btc'], px['eurc'] for euros, px['usd'] = 1). Take px as nullIf(x.px[kind], 0), so a day with no price stays NULL. Name each value column by its unit. A token amount keeps its significant digits: never round() it; only a value in dollars rounds, to cents.
`;
}

function familyExamples(): string {
  const hex = (c: string) => `lower(concat('0x', hex(${c})))`;
  const w = (k: number, d = "data") => `toFloat64(reinterpretAsUInt256(reverse(substring(${d}, ${1 + 32 * k}, 32))))`;
  const c = FAMILY_CHAIN_ID;
  return [
    `AVAX staked into sAVAX and redeemed per day this week, in AVAX and USD, with the AVAX per sAVAX; drill into one day's stakes and redemptions:
$PRICES(toMonday(now())), s AS (SELECT toDate(block_time) AS day, topic0 AS e, ${w(0)} AS w0, ${w(1)} AS w1, ${w(2)} AS w2 FROM raw_logs WHERE chain_id = ${c} AND block_time >= toMonday(now()) AND address = savax_token AND topic0 IN (submitted_t, savax_redeem_t)) SELECT s.day AS day, sumIf(w0, e = submitted_t) / 1e18 AS staked_avax, sumIf(w2, e = savax_redeem_t) / 1e18 AS redeemed_avax, round(sumIf(w0, e = submitted_t) / 1e18 * nullIf(any(x.px['avax']), 0), 2) AS staked_usd, round(sumIf(w2, e = savax_redeem_t) / 1e18 * nullIf(any(x.px['avax']), 0), 2) AS redeemed_usd, round(sumIf(w0, e = submitted_t) / nullIf(sumIf(w1, e = submitted_t), 0), 5) AS avax_per_savax, countIf(e = submitted_t) AS stakes, countIf(e = savax_redeem_t) AS redemptions FROM s LEFT JOIN lpx AS x ON s.day = x.d GROUP BY day ORDER BY day
drill: SELECT l.block_time AS t, if(l.topic0 = submitted_t, 'stake', 'redemption') AS action, ${hex("substring(l.topic1, 13, 20)")} AS account, if(l.topic0 = submitted_t, ${w(0, "l.data")}, ${w(2, "l.data")}) / 1e18 AS avax, concat('0x', hex(l.transaction_hash)) AS tx_hash FROM raw_logs AS l WHERE l.chain_id = ${c} AND l.block_time >= toMonday(now()) AND toDate(l.block_time) = {{day}} AND l.address = savax_token AND l.topic0 IN (submitted_t, savax_redeem_t) ORDER BY avax DESC LIMIT 50`,
    `USDC out of Avalanche through CCTP today, per destination chain and version; the rows are chains, so no drill:
SELECT cctp_domains[toUInt32(reinterpretAsUInt256(reverse(substring(data, 65, 32))))] AS destination, if(topic0 = cctp_burn_v2_t, 'V2', 'V1') AS version, count() AS transfers, sum(${w(0)}) / 1e6 AS usdc FROM raw_logs WHERE chain_id = ${c} AND block_time >= toStartOfDay(now()) AND address IN (cctp_messenger_v1, cctp_messenger_v2) AND topic0 IN (cctp_burn_v1_t, cctp_burn_v2_t) GROUP BY destination, version ORDER BY usdc DESC`,
    `USDC into Avalanche through CCTP today, per source chain and speed, each mint paired with the MessageReceived after it; the rows are chains, so no drill:
WITH m AS (SELECT transaction_hash AS tx, log_index AS i, ${w(0)} / 1e6 AS amount FROM raw_logs WHERE chain_id = ${c} AND block_time >= toStartOfDay(now()) AND address IN (cctp_messenger_v1, cctp_messenger_v2) AND topic0 IN (cctp_mint_v1_t, cctp_mint_v2_t)), r AS (SELECT transaction_hash AS tx, log_index AS i, toUInt32(reinterpretAsUInt256(reverse(substring(data, 1, 32)))) AS source, if(topic0 = cctp_received_v2_t, toUInt32(reinterpretAsUInt256(reverse(topic3))), 0) AS threshold FROM raw_logs WHERE chain_id = ${c} AND block_time >= toStartOfDay(now()) AND address IN (cctp_transmitter_v1, cctp_transmitter_v2) AND topic0 IN (cctp_received_v1_t, cctp_received_v2_t)) SELECT cctp_domains[r.source] AS source_chain, multiIf(r.threshold = 0, 'V1', r.threshold <= 1000, 'V2 fast', 'V2 standard') AS speed, count() AS transfers, sum(m.amount) AS usdc FROM m ASOF JOIN r ON m.tx = r.tx AND m.i < r.i GROUP BY source_chain, speed ORDER BY usdc DESC`,
    `Each vault's deposits and withdrawals this week, in the asset's units and in USD; drill into one vault's events:
$PRICES(toMonday(now())), v AS (SELECT toDate(block_time) AS day, address AS vault, topic0 AS e, ${w(0)} / pow(10, vault_decimals[indexOf(vaults, address)]) AS assets, vault_prices[indexOf(vaults, address)] AS kind FROM raw_logs WHERE chain_id = ${c} AND block_time >= toMonday(now()) AND has(vaults, address) AND topic0 IN (vault_deposit_t, vault_withdraw_t)) SELECT ${hex("v.vault")} AS vault_address, countIf(e = vault_deposit_t) AS deposits, sumIf(assets, e = vault_deposit_t) AS deposited, round(sumIf(assets * nullIf(x.px[kind], 0), e = vault_deposit_t), 2) AS deposited_usd, countIf(e = vault_withdraw_t) AS withdrawals, sumIf(assets, e = vault_withdraw_t) AS withdrawn, round(sumIf(assets * nullIf(x.px[kind], 0), e = vault_withdraw_t), 2) AS withdrawn_usd FROM v LEFT JOIN lpx AS x ON v.day = x.d GROUP BY v.vault ORDER BY deposited_usd DESC
drill: SELECT l.block_time AS t, if(l.topic0 = vault_deposit_t, 'deposit', 'withdrawal') AS action, ${hex("substring(if(l.topic0 = vault_deposit_t, l.topic2, l.topic3), 13, 20)")} AS owner, ${w(0, "l.data")} / pow(10, vault_decimals[indexOf(vaults, l.address)]) AS assets, concat('0x', hex(l.transaction_hash)) AS tx_hash FROM raw_logs AS l WHERE l.chain_id = ${c} AND l.block_time >= toMonday(now()) AND l.address = {{vault_address:bytes}} AND l.topic0 IN (vault_deposit_t, vault_withdraw_t) ORDER BY l.block_time DESC LIMIT 50`,
    `OpenTrade deposits and redemptions per pool this month, in USD; the rows are pools, so no drill:
$PRICES(toStartOfMonth(now())), o AS (SELECT toDate(block_time) AS day, address AS pool, topic0 AS e, toFloat64(reinterpretAsUInt256(reverse(substring(data, if(topic0 = ot_repay_t, 33, 1), 32)))) / 1e6 AS assets FROM raw_logs WHERE chain_id = ${c} AND block_time >= toStartOfMonth(now()) AND has(ot_pools, address) AND topic0 IN (ot_deposit_t, ot_repay_t)) SELECT ${hex("o.pool")} AS pool_address, countIf(e = ot_deposit_t) AS deposits, round(sumIf(assets * if(has(ot_eur_pools, o.pool), nullIf(x.px['eurc'], 0), 1), e = ot_deposit_t), 2) AS deposited_usd, countIf(e = ot_repay_t) AS redemptions, round(sumIf(assets * if(has(ot_eur_pools, o.pool), nullIf(x.px['eurc'], 0), 1), e = ot_repay_t), 2) AS redeemed_usd FROM o LEFT JOIN lpx AS x ON o.day = x.d GROUP BY o.pool ORDER BY deposited_usd DESC`,
  ]
    .map((b) => `${b}\n\n`)
    .join("");
}

export function systemPrompt(opts: { chainId: number; chainName: string; symbol: string; schema: string; coverage: string | null; dex?: boolean; lending?: boolean; families?: boolean }): string {
  const known = Object.entries(KNOWN_ADDRESSES)
    .map(([a, n]) => `- ${n}: ${a}`)
    .join("\n");
  // an L1 shares the tables, not the C-Chain's tokens, fee rules or P-Chain door
  const c = isCChain(opts.chainId);
  // the DEX tables and rules: a DEX question's (dexQuestion), on the mainnet C-Chain only
  const dex = !!opts.dex && opts.chainId === DEX_CHAIN_ID && DEX_FACTORIES.length > 0;
  // the lending tables and rules: a lending question's (lendingQuestion), on the mainnet C-Chain only
  const lending = !!opts.lending && opts.chainId === LENDING_CHAIN_ID && LENDING_MARKETS.length > 0;
  // the vaults, staking and bridge rules: a question about them (familyQuestion), on the mainnet C-Chain only
  const families = !!opts.families && opts.chainId === FAMILY_CHAIN_ID && VAULTS.length > 0;
  // the rows the flow panel draws, on the mainnet C-Chain, where the contract registry names senders and receivers
  const flows =
    opts.chainId === DEX_CHAIN_ID
      ? "\n- Flows: when the question asks where value went, from whom or to whom, or how it moved between addresses, contracts or protocols, return one row per sender and receiver pair, largest first, at most 200 pairs: from_address, to_address and the amount in token units summed over the pair, with its transfers beside it. The page draws the pairs as a flow from sender to receiver. A question about one side alone (who received the most) stays a ranking of that side."
      : "";
  // the active-address note belongs to an answer that counts them; Fuji's prompt stays as it was
  const activeNote =
    c && opts.chainId !== DEX_CHAIN_ID
      ? "An answer about active addresses says in its note that they are the senders and recipients of transactions, and that the explorer's own charts count more roles, so their figure is higher."
      : "An answer whose query counts active addresses (this uniqExactArray over raw_txs) says in its note that they are the senders and recipients of transactions, and that the explorer's own charts count more roles, so their figure is higher. An answer about other addresses (borrowers, depositors, holders, senders of a token) never says it.";
  // the query service cannot send an inf or a nan; Fuji's prompt stays as it was
  const finite = c && opts.chainId !== DEX_CHAIN_ID ? "" : " Divide by nullIf(x, 0), and wrap a ratio or a quantile in ifNotFinite(x, NULL): an inf or a nan in the rows fails the whole answer.";
  // NFTs of both standards, and contracts created inside a transaction too: the writer read ERC-721 alone (ERC-1155
  // held 8 of the true top 15 collections) and counted deploying transactions (457 of 2,088 new contracts). Mints
  // and contracts by transactions: the L1 audit's L16 called an ERC-721's transfers ERC-20 and counted the zero address
  // as a sender, and its L05 dropped a contract's plain transfers with the selector rule's length(input) filter. Fuji's
  // prompt stays as it was
  // a sender's partners are the addresses it sent to, often wallets: the night audit's G11 counted them as contracts
  // and its reading said an account "called 778 distinct contracts" with plain AVAX sends. Fuji's prompt stays as it was
  const partners = isFuji(opts.chainId) ? "" : " a ranking of senders carries how many addresses each sent to (recipients, uniqExact over `to`), never contracts, since a plain transfer goes to a wallet;";
  // a token's senders are the addresses its Transfers move it from (topic1), not the transactions' signers: the
  // follow-up audit's T06 counted tx_from from this example, 10 to 25% below the USDT senders each hour. Fuji's
  // example stays as it was
  const tokenSenders = isFuji(opts.chainId) ? "uniqExact(tx_from)" : "uniqExactIf(topic1, topic1 != unhex(repeat('00', 32)))";
  const created = isFuji(opts.chainId)
    ? ""
    : `- NFT transfers: an ERC-721 Transfer is the ERC-20 topic0 with a fourth topic (topic3 IS NOT NULL, the token id). An ERC-1155 transfer is TransferSingle unhex('c3d58168c5ae7397731d063d5bbf3d657854427343f4c083240f7aacaa2d0f62') or TransferBatch unhex('4a39dc06d4c0dbc64b70af90fd698a233a518aa5d07e595d983b8c0526c8f7fb'), with topic1 = operator, topic2 = from, topic3 = to (a batch moves several token ids in one log). A collection is the log's address. NFTs are both standards: a question about NFTs or collections that names no standard reads all three events and counts each standard in a column of its own (erc721_transfers, erc1155_transfers), never ERC-721 alone.
- New contracts: every contract is created by a CREATE or CREATE2 call in raw_traces, whether a transaction deploys it directly or a factory or an account-abstraction bundler creates it inside one (often most of them); the trace's \`to\` is the new contract. Count them with startsWith(call_type, 'CREAT') AND tx_success, and write the prefix 'CREAT': the server refuses the word CREATE even inside a string. raw_txs.contract_address holds only the direct deployments, so a question about new, created or deployed contracts reads raw_traces.
- Mints and burns: a Transfer from the zero address mints the token to its recipient, and one to the zero address burns it. A count of the wallets a token moved from (topic1) or to (topic2) leaves the zero address out, uniqExactIf(topic1, topic1 != unhex(repeat('00', 32))), and a count of one token's transfers counts its mints and burns beside them: countIf(topic1 = unhex(repeat('00', 32))) AS mints. A note calls a token's transfers ERC-20 or ERC-721 only when the query reads topic3; otherwise it says transfers.
- Contracts by transactions: a ranking of contracts counts every transaction to each, plain transfers included, and tells a contract from a wallet with HAVING countIf(length(input) >= 4) > 0. A WHERE on length(input) is for method_id alone.
`;
  const sym = opts.symbol.toLowerCase();
  return `You turn a question about ${opts.chainName} (${c ? "" : "an Avalanche L1, "}EVM chain id ${opts.chainId}, native token ${opts.symbol}) into one ClickHouse SELECT and a chart spec. You are precise, terse, and you never invent data.

## Tables (from the database, this is the whole schema you may read)
${opts.schema}
${opts.coverage ? `\n${opts.coverage}` : ""}

## What the columns mean
- Every table is multi-chain. ALWAYS filter every table on chain_id = ${opts.chainId}. Sort keys start with chain_id; partitions are by month of block_time. ALWAYS bound block_time (for example block_time >= now() - INTERVAL 7 DAY), or block_number, on every table you read.
- Addresses, hashes, topics and log data are raw bytes (FixedString or String). Compare them with unhex('…') WITHOUT the 0x prefix. Return them as text with lower(concat('0x', hex(col))).
- \`from\` and \`to\` are reserved words: always backtick them. A transaction's \`from\` (tx_from in raw_logs) is the account that signed it, never a contract; contracts appear as \`to\`, as a log's address, or in raw_traces.
${
  c
    ? `- Gas, per ACP-194 (Continuous Execution, live since the Helicon upgrade): raw_blocks.gas_used is the gas RESERVED (the sum of the block's tx gas limits, what fills the block against gas_limit). raw_txs.gas_used is the gas CHARGED per receipt, max(used, half the limit); fees are paid on it. Fees paid in wei = toFloat64(gas_used) * gas_price. Divide by 1e18 for ${opts.symbol}. The C-Chain burns every fee.
- Use these names in titles and notes, never "gas used" for the block figure. A sum of raw_txs.gas_used is gas charged, per block, per hour or per contract alike (name it gas_charged); gas reserved comes only from raw_blocks.gas_used.`
    : `- Gas: raw_blocks.gas_used is the block's gas used, against gas_limit. raw_txs.gas_used is the gas charged per receipt; fees are paid on it. Fees paid in wei = toFloat64(gas_used) * gas_price. Divide by 1e18 for ${opts.symbol}. Whether an L1 burns its fees or pays them to a fee recipient depends on its configuration: say "fees paid", never "burned". A fee question also reads raw_blocks.miner over the same window, as the worked example "Fees per bucket" shows, and the note says where the fees went: to the burn address when not_burned is 0, that is when every block's miner is 0x0100000000000000000000000000000000000000, the one case where it may say "burned"; else to the one recipient, by its full address, when recipients is 1; else to how many recipients. That address or count is the one exception to the note rules against hex, addresses and counts.`
}
- ERC-20 Transfer logs: topic0 = unhex('ddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'); topic1 = from, topic2 = to (left-padded to 32 bytes, address is the last 20 bytes); data = amount (uint256, big endian: reinterpretAsUInt256(reverse(data))). A transfer's sender and recipient are lower(concat('0x', hex(substring(topic1, 13, 20)))) AS from_address and the same over topic2 AS to_address. Never take them from tx_from, tx_to or raw_logs.address: those are the transaction's sender, the contract it called and the token contract. ${
  c
    ? `Well-known token contracts:
${known}`
    : `This chain's token contracts are not listed here: find them in raw_logs (group by address), and never assume a C-Chain token address. Token decimals are not in the tables; unless the question names them, count transfers rather than sum amounts.`
}
${created}- Log data is bytes: read a 32-byte word with substring(data, 1 + 32*k, 32), and reverse() before reinterpretAsUInt256.
- Active addresses: the distinct addresses that sent or received a transaction, uniqExactArray([\`from\`, \`to\`]) AS active_addresses over raw_txs. Never add uniqExact(\`from\`) and uniqExact(\`to\`) (an address on both sides counts twice), and never arrayJoin them (it repeats every row, so every other figure in the query doubles). ${activeNote}
- ICM (Teleporter) messages: the messenger is unhex('253b2784c75e510dd0ff1da844684a1ac0aa5fcf') on every chain. Its logs by topic0: SendCrossChainMessage unhex('2a211ad4a59ab9d003852404f9c57c690704ee755f3c79d2c2812ad32da99df8') is a message this chain sent (topic1 = message ID, topic2 = destination blockchain ID); ReceiveCrossChainMessage unhex('292ee90bbaf70b5d4936025e09d56ba08f3e421156b6a568cf3c2840d9343e34') is a message it received (topic1 = message ID, topic2 = source blockchain ID); MessageExecuted unhex('34795cc6b122b9a0ae684946319f1e14a577b4e8f9b3dda9ac94c21a54d3188c') and MessageExecutionFailed unhex('4619adc1017b82e02eaefac01a43d50d6d8de4460774bc370c3ff0210d40c985') say how a received message ran. Return a blockchain ID as lower(concat('0x', hex(topic2))).
${dex ? dexRules() : ""}${lending ? lendingRules() : ""}${families ? familyRules() : ""}
## Query rules
- One SELECT (a WITH is fine). No FORMAT, no SETTINGS, no semicolons, no comments. The server sets format, timeouts and memory.
- At most ${MAX_ROWS} rows come back, and a longer series is cut. Pick the bucket from the window: toStartOfMinute or toStartOfFiveMinutes for windows up to 6 hours, toStartOfHour up to 7 days, toDate beyond, toMonday for weeks. A question that names a bucket but no window reads 6 hours of 5-minute buckets, 24 hours of hourly ones, 30 days of daily ones. Windows over raw_logs and raw_traces: 90 days at most. raw_txs: 365 days at most.
${isFuji(opts.chainId) ? "" : `- A hash prefix ("transactions whose hash starts with 0x12") is a range on the bytes: ${HASH_RANGE}. raw_txs is sorted by hash, so the range reads only its share of the table and needs no window: it covers the whole history. Never startsWith(hash, …) in a filter: it misses rows.\n`}- A series starts its window on a bucket boundary, block_time >= toStartOfHour(now()) - INTERVAL 24 HOUR (or toStartOfFiveMinutes, toStartOfDay, toMonday), so its first bucket is whole; its last bucket is still in progress, and the note says so in words of time ("the current hour is not over"). A sparse series of counts fills its empty buckets: ORDER BY t WITH FILL STEP INTERVAL 1 HOUR (the bucket's own step). A fill's TO, when it has one, is the bucket after now, never later: a fill adds no bucket that has not begun. A level such as a balance or a supply fills only as Nullable, toNullable(...), so a missing bucket stays empty instead of dropping to zero.
${calendar(opts.chainId)}
- Whole sets: a question about a set (every contract, each token, how many per chain) returns the whole set, with no LIMIT. A ranking (top, most, largest, busiest) keeps its first 15 rows unless the question names a number, and carries count() OVER () AS of_total, the size of the whole set, so the page can say of how many.
- Order time series by time ascending. Name columns plainly: block_time bucket as \`t\`, counts as \`txs\`, gas as \`gas_charged\` or \`${c ? "gas_reserved" : "block_gas_used"}\`, fees as \`fees_${sym}\`.
- Doors: when a row is about a record, include its key as text: block_number for blocks, concat('0x', hex(hash)) AS tx_hash for transactions, lower(concat('0x', hex(\`to\`))) AS address for contracts and accounts. The explorer turns those into links.
- Names: return function selectors as text, concat('0x', hex(substring(input, 1, 4))) AS method_id, over rows with length(input) >= 4 (a transaction with no calldata is a plain transfer and has no selector; count those as native transfers when asked). Return addresses and topics as 0x text the same way. The server decodes selectors to function names, addresses to token and contract names, topics to event names. Never try to name them yourself, and never filter a selector out because it looks unknown.
- Cast UInt64 sums to Float64 when you divide.${finite}
- When a SELECT names an expression after one of the table's own columns (lower(concat('0x', hex(address))) AS address), every other mention of that column must be table-qualified (raw_logs.address in WHERE and GROUP BY), or it reads the alias instead. Drills included.
- Success and failure: raw_txs.success and raw_traces.tx_success are Bool; count failures with countIf(NOT success). In record rows return toUInt8(success) AS status. raw_logs keys its transaction as transaction_hash (raw_txs.hash), and carries tx_from and tx_to. raw_blocks has no transaction count: count raw_txs by block_number when you need it.
- Go one layer deeper than the literal ask when one chart can hold it: a ranking carries its transactions (txs), its distinct senders (senders, or callers for methods) and share_pct (Float64, percent of the window's total); a ranking of methods also carries how many contracts each was called on (contracts, uniqExact over \`to\`) and names one (contract) only when it holds most of the method's calls, as in the worked example, so the server can name the method from that contract's verified code;${partners} a series of counts carries its reverted count; gas carries the fee in ${opts.symbol.toLowerCase()}. Keep it to what fits one chart.

## Comparisons, overlays, sophistication
Answer comparative questions with ONE query that puts the things being compared side by side as columns, so the page can overlay them:
- Groups: one row per bucket, one column per group with countIf / sumIf (usdc_transfers, usdt_transfers, usdc_volume, usdt_volume). Never one row per group per bucket when the question compares them.
- Periods: align by offset. Take the window end from the data (max(block_time)), split it into current and previous halves, and return one row per offset bucket: toUInt32(dateDiff('minute', window_start, block_time) / 5) * 5 AS offset_min, with current_* and previous_* columns. Name the offset column so the axis reads minutes into the window.
- Fees or gas per bucket: also return the largest single transaction in the bucket (max_fee_${sym}, or max_gas) and that transaction beside it: concat('0x', lower(hex(argMax(hash, toFloat64(gas_used) * gas_price)))) AS max_fee_tx, or concat('0x', lower(hex(argMax(hash, gas_used)))) AS max_gas_tx. A spike from one or two overpaying transactions is then visible, and the page opens that transaction.${c ? " Priority tips on the C-Chain go to the burn address with the base fee, so all of gas_used * gas_price is burned." : ""}
- Rates and shares with their counts: return both (txs, reverted, revert_pct), so the page can draw bars with a rate line.
- Relations: one row per group or per record with two numeric measures (gas_charged and fee, calls and callers) for a scatter.${flows}
- Cumulative, rolling and rebased views are computed by the page: return the raw per-bucket values.
- Use WITH to name windows and to reuse a filter; up to six value columns per row is fine. Keep every table bounded on chain_id and time.

## How to work
1. If the question fits a worked example below, adapt it and call render_chart directly. Do not test first: render_chart runs the query and returns the database error if it fails, so a wrong final costs one step, the same as a test.${c ? "" : " The one exception is a fee question: call run_sql first with the check of where the fees went, as the worked example \"Fees per bucket\" shows, then render_chart."}
2. Call run_sql first only when you write something the examples do not cover: a join, a period comparison, bytes decoding. Fix and retry from the error.
${
  c
    ? `3. If the question is about the P-Chain (staking, stake or staking ratio, validators, delegators or delegations, uptime, L1 or subnet validators, AVAX supply or issuance), do not answer it here: call render_chart with kind "none", route "p-chain", sql "" and a one-line note. The page sends the question to the P-Chain.`
    : `3. These tables hold only ${opts.chainName}'s own blocks. If the question is about another chain, or about validators, staking or AVAX supply (P-Chain data), call render_chart with kind "none", sql "" and a one-line note that says this chain's tables do not hold it. Never set route.`
}
4. If the question cannot be answered from these tables, call render_chart with kind "none" and say why in the note.
5. A drill must find records for the row it opens: keep the main query's window and filters, and filter on the row's own values. render_chart tests it on the first row and returns an error if it finds none.

## Worked examples (tested on this schema; change the window, bucket and filters to fit the question)
The 15 most called methods, with reverts, callers, share, the contracts each was called on, and the contract that holds most of its calls where one does; drill into one method:
SELECT method_id, if(top_calls * 2 > txs, top_contract, NULL) AS contract, contracts, txs, reverted, callers, round(100 * txs / sum(txs) OVER (), 2) AS share_pct, count() OVER () AS of_total FROM (SELECT method_id, argMax(callee, n) AS top_contract, max(n) AS top_calls, uniqExact(callee) AS contracts, sum(n) AS txs, sum(r) AS reverted, uniqExactMerge(s) AS callers FROM (SELECT concat('0x', hex(substring(input, 1, 4))) AS method_id, lower(concat('0x', hex(\`to\`))) AS callee, count() AS n, countIf(NOT success) AS r, uniqExactState(\`from\`) AS s FROM raw_txs WHERE chain_id = ${opts.chainId} AND block_time >= now() - INTERVAL 1 DAY AND length(input) >= 4 GROUP BY method_id, callee) GROUP BY method_id) ORDER BY txs DESC LIMIT 15
drill: ${RECORD(opts)} AND substring(input, 1, 4) = {{method_id:bytes}} ORDER BY block_time DESC LIMIT 50

Counts over time with reverts; drill into one bucket:
SELECT toStartOfFiveMinutes(block_time) AS t, count() AS txs, countIf(NOT success) AS reverted, round(100 * countIf(NOT success) / count(), 2) AS revert_pct FROM raw_txs WHERE chain_id = ${opts.chainId} AND block_time >= toStartOfFiveMinutes(now()) - INTERVAL 6 HOUR GROUP BY t ORDER BY t
drill: ${RECORD(opts, "toStartOfFiveMinutes(now()) - INTERVAL 6 HOUR")} AND toStartOfFiveMinutes(block_time) = {{t}} ORDER BY block_time DESC LIMIT 50

Fees per bucket with the largest single fee and its transaction (toFloat64 before multiplying, so the product cannot wrap)${
  c
    ? ":"
    : `. On this chain a fee question takes two calls. First run_sql, over the fee query's window, where the fees went:
SELECT uniqExact(miner) AS recipients, lower(concat('0x', hex(any(miner)))) AS recipient, countIf(miner != unhex('0100000000000000000000000000000000000000')) AS not_burned FROM raw_blocks WHERE chain_id = ${opts.chainId} AND block_time >= toStartOfHour(now()) - INTERVAL 24 HOUR
Then render_chart with the fee query, and a note that says where the fees went:`
}
SELECT toStartOfHour(block_time) AS t, sum(toFloat64(gas_used) * gas_price) / 1e18 AS fees_${opts.symbol.toLowerCase()}, max(toFloat64(gas_used) * gas_price) / 1e18 AS max_fee_${opts.symbol.toLowerCase()}, concat('0x', lower(hex(argMax(hash, toFloat64(gas_used) * gas_price)))) AS max_fee_tx, count() AS txs FROM raw_txs WHERE chain_id = ${opts.chainId} AND block_time >= toStartOfHour(now()) - INTERVAL 24 HOUR GROUP BY t ORDER BY t

Gas charged against ${c ? "gas reserved" : "the blocks' gas used"} per hour (charged from the receipts in raw_txs, ${c ? "reserved" : "the block figure"} from raw_blocks):
SELECT t, c.gas_charged AS gas_charged, b.${c ? "gas_reserved" : "block_gas_used"} AS ${c ? "gas_reserved" : "block_gas_used"} FROM (SELECT toStartOfHour(block_time) AS t, sum(gas_used) AS gas_charged FROM raw_txs WHERE chain_id = ${opts.chainId} AND block_time >= toStartOfHour(now()) - INTERVAL 24 HOUR GROUP BY t) AS c INNER JOIN (SELECT toStartOfHour(block_time) AS t, sum(gas_used) AS ${c ? "gas_reserved" : "block_gas_used"} FROM raw_blocks WHERE chain_id = ${opts.chainId} AND block_time >= toStartOfHour(now()) - INTERVAL 24 HOUR GROUP BY t) AS b USING t ORDER BY t

${
  c
    ? `Token transfers, count and volume (USDC has 6 decimals, WAVAX 18):
SELECT toStartOfFiveMinutes(block_time) AS t, count() AS transfers, sum(toFloat64(reinterpretAsUInt256(reverse(substring(data, 1, 32))))) / 1e6 AS volume_usdc FROM raw_logs WHERE chain_id = ${opts.chainId} AND block_time >= toStartOfFiveMinutes(now()) - INTERVAL 6 HOUR AND address = unhex('b97ef9ef8734c71904d8002f8b6bc66dd9c48a6e') AND topic0 = unhex('ddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef') GROUP BY t ORDER BY t

The 20 largest USDT transfers in the last hour (USDT has 6 decimals); the rows are transfers, so no drill:
SELECT block_time AS t, block_number, concat('0x', hex(transaction_hash)) AS tx_hash, lower(concat('0x', hex(substring(topic1, 13, 20)))) AS from_address, lower(concat('0x', hex(substring(topic2, 13, 20)))) AS to_address, toFloat64(reinterpretAsUInt256(reverse(substring(data, 1, 32)))) / 1e6 AS amount_usdt, lower(concat('0x', hex(tx_from))) AS tx_sender FROM raw_logs WHERE chain_id = ${opts.chainId} AND block_time >= now() - INTERVAL 1 HOUR AND raw_logs.address = unhex('9702230a8ea53601f5cd2dc00fdbc13d4df4a8c7') AND topic0 = unhex('ddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef') ORDER BY amount_usdt DESC LIMIT 20

`
    : ""
}${dex ? dexExamples() : ""}${lending ? lendingExamples() : ""}${families ? familyExamples() : ""}The 15 token contracts with the most transfers, with transactions, senders and share (the server names the tokens it knows):
SELECT lower(concat('0x', hex(raw_logs.address))) AS token, count() AS transfers, uniqExact(transaction_hash) AS txs, ${tokenSenders} AS senders, round(100 * count() / sum(count()) OVER (), 2) AS share_pct, count() OVER () AS of_total FROM raw_logs WHERE chain_id = ${opts.chainId} AND block_time >= now() - INTERVAL ${c ? "1 DAY" : "7 DAY"} AND topic0 = unhex('ddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef') GROUP BY raw_logs.address ORDER BY transfers DESC LIMIT 15

Active addresses per day, each address once:
SELECT toDate(block_time) AS t, uniqExactArray([\`from\`, \`to\`]) AS active_addresses, uniqExact(\`from\`) AS senders, count() AS txs FROM raw_txs WHERE chain_id = ${opts.chainId} AND block_time >= toStartOfDay(now()) - INTERVAL 7 DAY GROUP BY t ORDER BY t

This hour against the hour before, aligned by offset:
WITH (SELECT max(block_time) FROM raw_txs WHERE chain_id = ${opts.chainId} AND block_time >= now() - INTERVAL 1 DAY) AS end_t, end_t - INTERVAL 1 HOUR AS mid_t SELECT intDiv(toUInt32(dateDiff('minute', if(block_time > mid_t, mid_t, mid_t - INTERVAL 1 HOUR), block_time)), 5) * 5 AS offset_min, countIf(block_time > mid_t) AS current_txs, countIf(block_time <= mid_t) AS previous_txs FROM raw_txs WHERE chain_id = ${opts.chainId} AND block_time > end_t - INTERVAL 2 HOUR AND block_time <= end_t GROUP BY offset_min ORDER BY offset_min

Blocks against the gas limit (raw_blocks rows are blocks; no drill):
SELECT block_number, block_time AS t, gas_used AS ${c ? "gas_reserved" : "block_gas_used"}, gas_limit FROM raw_blocks WHERE chain_id = ${opts.chainId} AND block_time >= now() - INTERVAL 30 MINUTE ORDER BY block_number

## Drill: every group opens into its records
Whenever a row is a group (a method, a contract, a sender, a time bucket, a block), render_chart MUST carry drill: a SELECT template that lists the records behind ONE row, plus a title for that list.
- Placeholders name the picked row's columns: {{col}} inserts the value as a SQL literal (quoted string or number); {{col:bytes}} inserts unhex('…') for a 0x hex value, so compare binary columns like \`to\` = {{address:bytes}} or substring(input, 1, 4) = {{method_id:bytes}}. For a time bucket compare the same bucket expression: toStartOfHour(block_time) = {{t}}.
- The drill keeps the same chain_id and time-window filters as the main query, ORDER BY block_time DESC, LIMIT 50.
- Return record columns in this order when they apply: block_time AS t, block_number, concat('0x', hex(hash)) AS tx_hash, lower(concat('0x', hex(\`from\`))) AS from_address, lower(concat('0x', hex(\`to\`))) AS to_address, method_id (hex text), gas_used AS gas_charged, toFloat64(gas_used) * gas_price / 1e18 AS fee_${opts.symbol.toLowerCase()}, toUInt8(success) AS status.
- drill.title reads like "Transactions calling {{method_id}} in the last 7 days" or "Transactions in the 5 minutes from {{t}}". The server fills the placeholders with names where it knows them.
- Rows that already are records need no drill. A list of transactions MUST carry the same record columns as a drill (t, block_number, tx_hash, from_address, to_address, method_id, gas_charged, fee, status) next to the figure the question is about. A list of token transfers is a list of Transfer logs, one row per transfer, as in the worked example: t, block_number, tx_hash (from transaction_hash), from_address and to_address from topic1 and topic2, the amount in token units, and the token contract (token) when more than one token is listed; tx_sender (tx_from) may follow. For what a transfer row does not carry (gas, fee, status), join raw_logs to raw_txs on raw_logs.transaction_hash = raw_txs.hash with the same chain_id and time bound on both.

${chartSpec(opts.symbol)}`;
}

/* The P-Chain chapter. Its tables are decoded transactions, UTXOs and
   snapshots of the validator, delegator and L1 validator sets, taken
   about every 11 minutes; ids are raw bytes that the page shows as CB58
   and bech32. */

const CB58 = (col: string) => `base58Encode(concat(${col}, substring(SHA256(${col}), 29, 4)))`;
const NODE = (col: string) => `concat('NodeID-', ${CB58(`assumeNotNull(${col})`)})`;

/** the worked example's pivot, on the newest version lines in the set */
function linePivot(lines: string[]): string {
  const top = lines.slice(0, 2);
  const known = [...top, "Unknown"].map((l) => `'${l}'`).join(", ");
  return [
    ...top.map((l) => `sumIf(seats, version = '${l}') AS on_${l.replace(/\./g, "_")}`),
    `sumIf(seats, version NOT IN (${known})) AS on_other`,
    `sumIf(seats, version = 'Unknown') AS unknown`,
  ].join(", ");
}

/** lines: the version lines in the validator set now, newest first
    (sources.ts); left out, the lines last read; null, none */
export function pchainPrompt(opts: { chainId: number; network: string; schema: string; coverage: string | null; lines?: string[] | null }): string {
  const id = opts.chainId;
  const latest = (t: string) => `(SELECT max(snapshot_time) FROM ${t} WHERE chain_id = ${id} AND snapshot_time <= now() - INTERVAL 15 MINUTE AND snapshot_time >= now() - INTERVAL 1 DAY)`;
  const primary = "unhex(repeat('00', 32))";
  const live = opts.lines === undefined ? knownLines(id) : opts.lines;
  const lines = live?.length ? live : ["1.15", "1.14"];
  // the Data API counts the supply on mainnet only (target.ts)
  const supply = targetOf(id).refs.includes("p_avax_supply");
  // mainnet only, from the P-Chain audit: rewards read from their outputs (P08 said they cannot be summed), a
  // registration count named as one (P06 called 22 renewals of 26 new validators), and the last N days as N whole
  // days and today (P09 and P15 read 6 days and today). Fuji's prompt stays as it was
  const audited = isFuji(id)
    ? ""
    : `
- raw_p_reward_utxos: one row per reward output, paid to a validator or a delegator when its staking period ends (block_time is when). Its AVAX is reinterpretAsUInt64(reverse(substring(utxo_bytes, 75, 8))) / 1e9, the 8-byte amount after the output's type id: sum it for the AVAX paid in staking rewards. It is never returned stake, and never decoded_p_txs.reward_paid, which is set on few reward transactions.
- Registrations: an AddPermissionlessValidatorTx, AddValidatorTx or AddAutoRenewedValidatorTx registers a validation period, and a node that renews registers again. A count of them is a count of registrations, renewals included: its title and note say registrations, never new validators.`;
  // the auto-renewed staking transactions (ACP-236), and the reward a RewardValidatorTx paid, which reward_paid does
  // not hold (P09 put RewardAutoRenewedValidatorTx under other)
  const renewed = isFuji(id)
    ? ""
    : ", RewardAutoRenewedValidatorTx (an auto-renewed validator's cycle ends: its rewards are settled, and it renews or ends), SetAutoRenewedValidatorConfigTx (an auto-renewed validator's next cycle or auto-compound share changes; a next cycle of 0 ends it)";
  const rewardOf = isFuji(id) ? "reward_paid = 1 when it earned" : "its reward is in raw_p_reward_utxos";
  const lastDays = isFuji(id) ? "" : "\n- The last N days as a daily series are N whole days and today, from toDate(now()) - INTERVAL N DAY: the last 7 days start at toDate(now()) - INTERVAL 7 DAY, never 6, and the note says so.";
  return `You turn a question about the Avalanche P-Chain (${opts.network}; its rows carry chain_id = ${id}) into one ClickHouse SELECT and a chart spec. The P-Chain is Avalanche's platform chain: validators and delegators of the Primary Network, L1s and their validators, and the AVAX that moves between the P-Chain and the C-Chain and X-Chain. You are precise, terse, and you never invent data.

## Tables (from the database, and ${supply ? "p_validator_versions and p_avax_supply" : "p_validator_versions"}, which our server sends with the query; this is the whole schema you may read)
${opts.schema}
${opts.coverage ? `\n${opts.coverage}` : ""}

## What the tables mean
- ALWAYS filter every table on chain_id = ${id}, and bound every table on its time or height (block_time, snapshot_time, created_time, block_height).
- decoded_p_txs: one row per P-Chain transaction; its key is (chain_id, tx_id). tx_type is one of AddPermissionlessValidatorTx, AddValidatorTx, AddAutoRenewedValidatorTx (a validator joins the Primary Network, weight = its stake)${renewed}, AddPermissionlessDelegatorTx, AddDelegatorTx (a delegation, weight = the stake, node_id = the validator), RewardValidatorTx (a staking period ends; staking_tx_id names it, ${rewardOf}), ImportTx and ExportTx (AVAX moving with the C-Chain or X-Chain; source_chain and destination_chain are blockchain ids), CreateSubnetTx, CreateChainTx, ConvertSubnetToL1Tx, RegisterL1ValidatorTx, SetL1ValidatorWeightTx (l1_weight 0 removes the validator), IncreaseL1ValidatorBalanceTx, DisableL1ValidatorTx, AddSubnetValidatorTx, RemoveSubnetValidatorTx, TransferSubnetOwnershipTx, AdvanceTimeTx, BaseTx.
- Duplicates: a re-ingest wrote some rows of decoded_p_txs, p_utxos_created and p_utxos_spent twice (the UTXO tables are keyed by (chain_id, utxo_id)). The server reads these three tables without the duplicates, so count() counts each transaction and output once. Never write FINAL.
- L1s: a subnet becomes an L1 with its ConvertSubnetToL1Tx (subnet_id), and that transaction registers the L1's first validators, one per entry of l1_validation_ids, with their deposits in l1_balances. Each later validator comes with a RegisterL1ValidatorTx (validation_id, l1_weight, l1_balance); it carries no subnet_id or node_id, so find its L1 and node in p_l1_validator_snapshots, whose validation_id is CB58 text: validation_id = ${CB58("assumeNotNull(decoded_p_txs.validation_id)")}. Count registrations as both: sum(if(tx_type = 'ConvertSubnetToL1Tx', length(l1_validation_ids), 1)). IncreaseL1ValidatorBalanceTx tops up a seat's balance (l1_balance). CreateSubnetTx makes a subnet, not an L1: the newest L1s are the newest ConvertSubnetToL1Tx.${
  id === PCHAIN_IDS.fuji
    ? " On Fuji, ConvertSubnetToL1Tx rows carry no l1_validation_ids or l1_balances (they were indexed before those columns were decoded), so the first validators of a new L1 cannot be counted here: count registrations from RegisterL1ValidatorTx, carry the conversions beside them, and say in the note that the first validators of new L1s are not included."
    : ""
}
- Amounts (weight, stake_amount, balance, l1_balance, amount, supply) are nAVAX: divide by 1e9 for AVAX. An L1 validator's weight (p_l1_validator_snapshots.weight, l1_weight) is a unitless number the L1 sets: never divide it by 1e9, and never call it AVAX or stake.
- The snapshot tables (p_validator_snapshots, p_delegator_snapshots, p_l1_validator_snapshots) are photographs of the sets, taken about every 11 minutes. A snapshot's rows are written over several minutes under one snapshot_time, so the newest can be half written: for the current set, read snapshot_time = ${latest("<table>")}. That expression already passes over a snapshot still being written, so the note never mentions it. For a history, group by snapshot_time and keep the snapshots at least 15 minutes old. In snapshots, node_id and ids are already text (NodeID-…).
- The Primary Network's subnet_id is 32 zero bytes: subnet_id = ${primary}. Other subnet_id values are L1s.
- p_l1_validator_snapshots: an L1's seats. balance is what is left to pay the continuous fee (net of what has burned); a seat with balance 0 is inactive. A question about balances reads the active seats only (balance > 0), returns the L1 (subnet_id, which the server names) and the days the balance lasts (days_left) at the fee a seat pays per day, as in the worked example.
- Fees paid: the Convert, Register and IncreaseL1ValidatorBalance deposits minus the balances left overstate the continuous fees L1 validators have paid, because a removed or disabled seat's balance is refunded to its owner and the tables do not mark refunds. ${supply ? "For the fees paid, read p_avax_supply.l1_validator_fees_avax, as in the worked example." : "Give that figure only as an upper bound, and say so in the note."}
- p_exec_state_history: the P-Chain supply after each block (nAVAX), the AVAX the P-Chain counts as issued, gross of what the C-Chain and X-Chain burned. Call it the P-Chain supply, never the AVAX supply or the total supply.${supply ? " The total supply net of every chain's burns is p_avax_supply.total_supply_avax." : ""}
- p_utxos_created and p_utxos_spent: every output and when it was spent. An address's balance is the sum of its outputs not yet spent (owner_addresses holds the owners).${audited}
- p_validator_observations and p_node_info: what our nodes saw of each validator and node they peer with (uptime, version, IP), per observation.
- Uptime: a validator's uptime is the median of what its observers saw: per observer, the average uptime_percent over the last hour of p_validator_observations; per validator, the median of those, with the number of observers, as in the worked example. A validator with no observations has no uptime: after a LEFT JOIN return if(up.observers > 0, round(up.median_uptime, 2), NULL), never 0. p_validator_snapshots.uptime_percent is one node's view and can be far from the rest: never report it as the uptime.
- p_validator_versions: the AvalancheGo version line of every validator seat now, on the Primary Network and on every L1, one row per subnet and line; it has no row per node, so no node's own version is readable. It is not in the database: our server builds it from the explorer's validator feed and sends it with the query, so it has no history and no time column, and a read of it needs no time bound. It counts every active seat, as the explorer's validator pages do. version is the line ('1.15'), or 'Unknown' for the seats no source has a version for: keep the Unknown rows, they are part of the set. The page states how many seats have a known version, so never put that figure in the note. seats is the number of validator seats (name its sum validators, never seats). seen_day and seen_week count the seats whose version was seen in the last day and in the last 7 days, and from_crawler the seats whose version comes from a discovery crawler, which keeps the last version it saw of a node, so an old sighting may be out of date. For a question about upgrades, carry sum(seen_week) AS seen_7d with the counts; the page states how recent the versions are. weight is stake plus delegations in nAVAX on the Primary Network (is_l1 = 0) and the L1's own unitless weight on an L1 (is_l1 = 1): compare weight only inside one subnet. subnet_id is CB58 text, as the other tables return it with the CB58 expression below; return it as subnet_id and the server names the L1. A drill opens one L1's seats in p_l1_validator_snapshots on {{subnet_id:bytes}}, as in the worked example; a drill that stays in p_validator_versions compares subnet_id = {{subnet_id}}, with no quotes around the placeholder.${live?.length ? ` Version lines in the set now: ${live.join(", ")}.` : ""}${
  supply
    ? `
- p_avax_supply: one row, the AVAX supply now as the Avalanche Data API counts it, in AVAX: total_supply_avax (net of every chain's burns), circulating_supply_avax, staked_avax, locked_avax, rewards_avax, burned_p_avax, burned_c_avax and burned_x_avax (what each chain has burned), l1_validator_fees_avax (all the continuous fees L1 validators have paid), genesis_unlock_avax, and updated_at (when the Data API counted). Like p_validator_versions, our server sends it with the query, so it has no history and a read of it needs no time bound. The page states when the figures were counted, so never put that in the note.`
    : ""
}
- Validators, unqualified ("how many validators", "validators now"): answer for the Primary Network and the L1s side by side, primary_validators and l1_validators (the active L1 seats), as in the worked example; never the Primary Network alone.
- Versions: for any question about node versions (which versions run, who has upgraded, L1s by version), read p_validator_versions. p_node_info and p_validator_observations hold only the nodes our own nodes peer with, which misses most L1 validators, so never count versions from them.

## Identifiers
- Return ids as the explorer shows them. A tx, block, subnet or chain id: ${CB58("tx_id")} AS tx_id (use the column in place of tx_id). A node id stored as bytes: ${NODE("node_id")} AS node_id. Snapshot tables already store node ids as text.
- Return addresses as lower(hex(addr)) AS reward_address (a name that contains address); arrays as arrayMap(a -> lower(hex(a)), reward_addresses) AS reward_addresses. The server shows them as P-avax1….
- In a drill, compare a byte column to a picked id with {{col:bytes}}: the server turns a CB58 id, a NodeID or a P-avax1 address back into bytes. For a text column (snapshot node_id) use {{node_id}}.
- Doors: tx_id opens the transaction, node_id the validator, any address column the address, block_height the block. Include them whenever a row is about one.

## Query rules
- One SELECT (a WITH is fine). No FORMAT, no SETTINGS, no semicolons, no comments. At most ${MAX_ROWS} rows come back.
- Buckets: toStartOfHour up to 7 days, toDate beyond, toMonday for weeks (never date arithmetic on dayOfWeek). A series of counts starts its window on a bucket boundary (block_time >= toMonday(now()) - INTERVAL 12 WEEK) and fills its empty buckets: ORDER BY t WITH FILL FROM the window's start TO the bucket after now STEP INTERVAL 1 WEEK (1 DAY, 1 HOUR), as in the worked examples. TO is always the bucket after now (toDate(now()) + INTERVAL 1 DAY for days), never the end of a calendar window such as this month: a fill adds no day that has not begun. A daily level (a supply, a stake, a balance) fills too, but only as Nullable, toNullable(...), so a day with no rows stays empty instead of dropping to zero and no line is drawn across it: some days have no rows (as in the worked examples). The last bucket is still in progress: the note says so in words of time ("the current week is not over"). Order time series ascending; name the time bucket \`t\`.
${calendar(opts.chainId)}${lastDays}
- Whole sets: a question about a set (every L1, each tx type, how many per L1) returns the whole set, with no LIMIT. A ranking (top, most, largest, lowest) keeps its first 20 rows unless the question names a number, and carries count() OVER () AS of_total, the size of the whole set.
- When a SELECT names an expression after one of the table's columns (…AS tx_id over tx_id), every other mention of that column must be table-qualified (decoded_p_txs.tx_id), or it reads the alias instead.
- Go one layer deeper when one chart can hold it: a ranking of validators carries delegated stake, delegators and fee; a count of delegations carries the AVAX delegated; a count of L1 registrations carries the conversions.

## How to work
1. If the question fits a worked example below, adapt it and call render_chart directly; render_chart runs it and returns the database error if it fails.
2. Call run_sql first only for joins, UTXO balances, or anything the examples do not cover.
3. If the question is about C-Chain activity (EVM transactions, gas, contracts, tokens such as USDC or USDT), do not answer it here: call render_chart with kind "none", route "c-chain", sql "" and a one-line note. The page sends the question to the C-Chain.
4. If the question cannot be answered from these tables, call render_chart with kind "none" and say why in the note.
5. A drill must find records for the row it opens: keep the main query's window and filters, and filter on the row's own values. render_chart tests it on the first row and returns an error if it finds none.

## Worked examples (tested on these tables)
How many validators now, the Primary Network and the L1 seats side by side (a single row):
SELECT (SELECT count() FROM p_validator_snapshots WHERE chain_id = ${id} AND subnet_id = ${primary} AND snapshot_time = ${latest("p_validator_snapshots")}) AS primary_validators, (SELECT count() FROM p_l1_validator_snapshots WHERE chain_id = ${id} AND balance > 0 AND snapshot_time = ${latest("p_l1_validator_snapshots")}) AS l1_validators

The 20 largest validators now, with their delegations, of all validators; drill into one validator's transactions:
SELECT node_id, weight / 1e9 AS stake_avax, delegator_weight / 1e9 AS delegated_avax, delegator_count, delegation_fee_percent AS fee_pct, toString(end_time) AS ends, count() OVER () AS of_total FROM p_validator_snapshots WHERE chain_id = ${id} AND subnet_id = ${primary} AND snapshot_time = ${latest("p_validator_snapshots")} ORDER BY weight DESC LIMIT 20
drill: SELECT block_time AS t, block_height, ${CB58("tx_id")} AS tx_id, tx_type, weight / 1e9 AS amount_avax, toString(end_time) AS ends FROM decoded_p_txs WHERE chain_id = ${id} AND block_time >= now() - INTERVAL 365 DAY AND node_id = {{node_id:bytes}} ORDER BY block_time DESC LIMIT 50

AVAX staked on the Primary Network per day, from the last complete snapshot of each day:
WITH snaps AS (SELECT snapshot_time, sum(weight + delegator_weight) / 1e9 AS staked FROM p_validator_snapshots WHERE chain_id = ${id} AND subnet_id = ${primary} AND snapshot_time >= toDate(now()) - INTERVAL 30 DAY AND snapshot_time <= now() - INTERVAL 15 MINUTE GROUP BY snapshot_time) SELECT toDate(snapshot_time) AS t, toNullable(argMax(staked, snapshot_time)) AS staked_avax FROM snaps GROUP BY t ORDER BY t WITH FILL FROM toDate(now()) - INTERVAL 30 DAY TO toDate(now()) + INTERVAL 1 DAY STEP INTERVAL 1 DAY

Transactions by type; drill into one type:
SELECT tx_type, count() AS txs, round(100 * count() / sum(count()) OVER (), 2) AS share_pct FROM decoded_p_txs WHERE chain_id = ${id} AND block_time >= now() - INTERVAL 7 DAY GROUP BY tx_type ORDER BY txs DESC
drill: SELECT block_time AS t, block_height, ${CB58("tx_id")} AS tx_id, tx_type, if(node_id IS NULL, '', ${NODE("node_id")}) AS node_id, weight / 1e9 AS amount_avax FROM decoded_p_txs WHERE chain_id = ${id} AND block_time >= now() - INTERVAL 7 DAY AND tx_type = {{tx_type}} ORDER BY block_time DESC LIMIT 50

Delegations and new validators per day, empty days filled:
SELECT toDate(block_time) AS t, countIf(tx_type IN ('AddPermissionlessDelegatorTx', 'AddDelegatorTx')) AS delegations, sumIf(ifNull(weight, 0), tx_type IN ('AddPermissionlessDelegatorTx', 'AddDelegatorTx')) / 1e9 AS delegated_avax, countIf(tx_type IN ('AddPermissionlessValidatorTx', 'AddValidatorTx', 'AddAutoRenewedValidatorTx')) AS validators_added FROM decoded_p_txs WHERE chain_id = ${id} AND block_time >= toDate(now()) - INTERVAL 30 DAY GROUP BY t ORDER BY t WITH FILL FROM toDate(now()) - INTERVAL 30 DAY TO toDate(now()) + INTERVAL 1 DAY STEP INTERVAL 1 DAY

L1 validator registrations per week, the first validators of each new L1 included, empty weeks filled; drill into one week:
SELECT toMonday(block_time) AS t, sum(if(tx_type = 'ConvertSubnetToL1Tx', length(l1_validation_ids), 1)) AS registrations, countIf(tx_type = 'ConvertSubnetToL1Tx') AS conversions FROM decoded_p_txs WHERE chain_id = ${id} AND tx_type IN ('ConvertSubnetToL1Tx', 'RegisterL1ValidatorTx') AND block_time >= toMonday(now()) - INTERVAL 12 WEEK GROUP BY t ORDER BY t WITH FILL FROM toMonday(now()) - INTERVAL 12 WEEK TO toMonday(now()) + INTERVAL 1 WEEK STEP INTERVAL 1 WEEK
drill: SELECT block_time AS t, block_height, ${CB58("tx_id")} AS tx_id, tx_type, if(tx_type = 'ConvertSubnetToL1Tx', length(l1_validation_ids), 1) AS validators FROM decoded_p_txs WHERE chain_id = ${id} AND tx_type IN ('ConvertSubnetToL1Tx', 'RegisterL1ValidatorTx') AND block_time >= toMonday(now()) - INTERVAL 12 WEEK AND toMonday(block_time) = {{t}} ORDER BY block_time DESC LIMIT 50

L1s by active validators now, with the balance left for fees (the server names the L1):
SELECT ${CB58("subnet_id")} AS subnet_id, count() AS validators, sum(balance) / 1e9 AS balance_avax FROM p_l1_validator_snapshots WHERE chain_id = ${id} AND balance > 0 AND snapshot_time = ${latest("p_l1_validator_snapshots")} GROUP BY subnet_id ORDER BY validators DESC

The 20 active L1 seats with the least balance left, and the days it lasts at the fee a seat pays per day (the server names the L1):
WITH ${latest("p_l1_validator_snapshots")} AS s_now, (SELECT max(snapshot_time) FROM p_l1_validator_snapshots WHERE chain_id = ${id} AND snapshot_time <= s_now - INTERVAL 1 DAY AND snapshot_time >= s_now - INTERVAL 2 DAY) AS s_day, fee AS (SELECT median(d.balance - n.balance) * 86400 / dateDiff('second', s_day, s_now) AS per_day FROM p_l1_validator_snapshots AS n INNER JOIN p_l1_validator_snapshots AS d ON d.validation_id = n.validation_id WHERE n.chain_id = ${id} AND d.chain_id = ${id} AND n.snapshot_time = s_now AND d.snapshot_time = s_day AND n.balance > 0 AND d.balance > n.balance) SELECT ${CB58("subnet_id")} AS subnet_id, node_id, balance / 1e9 AS balance_avax, round(balance / (SELECT per_day FROM fee), 1) AS days_left, count() OVER () AS of_total FROM p_l1_validator_snapshots WHERE chain_id = ${id} AND snapshot_time = s_now AND balance > 0 ORDER BY balance ASC LIMIT 20

L1s by AvalancheGo version, every seat now (the server names the L1); drill into one L1's seats:
SELECT subnet_id, sum(seats) AS validators, ${linePivot(lines)}, sum(seen_week) AS seen_7d FROM p_validator_versions WHERE chain_id = ${id} AND is_l1 = 1 GROUP BY subnet_id ORDER BY validators DESC
drill: SELECT node_id, weight, balance / 1e9 AS balance_avax FROM p_l1_validator_snapshots WHERE chain_id = ${id} AND subnet_id = {{subnet_id:bytes}} AND snapshot_time = ${latest("p_l1_validator_snapshots")} ORDER BY weight DESC LIMIT 50

Validators under 80% uptime now (80% earns the staking reward), by the median of what their observers saw:
WITH obs AS (SELECT node_id, observer_node_id, avg(uptime_percent) AS u FROM p_validator_observations WHERE chain_id = ${id} AND observed_at >= now() - INTERVAL 1 HOUR GROUP BY node_id, observer_node_id), up AS (SELECT node_id, quantileExact(0.5)(u) AS median_uptime, count() AS observers FROM obs GROUP BY node_id) SELECT v.node_id AS node_id, v.weight / 1e9 AS stake_avax, round(up.median_uptime, 2) AS uptime_pct, up.observers AS observers FROM p_validator_snapshots AS v INNER JOIN up ON up.node_id = v.node_id WHERE v.chain_id = ${id} AND v.subnet_id = ${primary} AND v.snapshot_time = ${latest("p_validator_snapshots")} AND up.median_uptime < 80 ORDER BY uptime_pct
${
  supply
    ? `
The continuous fees L1 validators have paid, all time (a single figure: a one-row table):
SELECT l1_validator_fees_avax FROM p_avax_supply WHERE chain_id = ${id}
`
    : ""
}
The P-Chain supply per day, gross of the C-Chain and X-Chain burns (a level: days with no rows stay empty):
SELECT toDate(block_time) AS t, toNullable(argMax(supply, block_height) / 1e9) AS pchain_supply_avax FROM p_exec_state_history WHERE chain_id = ${id} AND block_time >= toDate(now()) - INTERVAL 90 DAY GROUP BY t ORDER BY t WITH FILL FROM toDate(now()) - INTERVAL 90 DAY TO toDate(now()) + INTERVAL 1 DAY STEP INTERVAL 1 DAY

## Drill: every group opens into its records
Whenever a row is a group (a tx type, a validator, a day or a week, an L1), render_chart MUST carry drill: a SELECT template that lists the records behind ONE row, with {{col}} and {{col:bytes}} placeholders as above, the same chain_id and time bound, ORDER BY time DESC, LIMIT 50. Record rows carry t, block_height, tx_id, tx_type, node_id and amount_avax where they apply. drill.title reads like "{{tx_type}} transactions in the last 7 days".

${chartSpec("AVAX")}`;
}

/* ------------------------------------------------------------------ */

/** one per chain and prompt variant */
const versions = new Map<string, string>();

/** what a kept recipe was written against: the prompt as this code writes
    it, with no schema, coverage or live figures in it, and the reference
    tables' columns. A change to the rules or the worked examples names new
    recipe keys (cache.ts), so a fixed question is written again instead of
    served its old SQL. Per chain: the C-Chain, an L1 and the P-Chain are
    told different things. */
export function promptVersion(chainId: number, dex = false, lending = false, families = false): string {
  const key = `${chainId}:${dex ? "dex" : ""}:${lending ? "lending" : ""}:${families ? "families" : ""}`;
  let v = versions.get(key);
  if (!v) {
    const text =
      targetOf(chainId).kind === "pchain"
        ? pchainPrompt({ chainId, network: "", schema: "", coverage: null, lines: null })
        : systemPrompt({ chainId, chainName: "", symbol: "", schema: "", coverage: null, dex, lending, families });
    v = createHash("sha256").update(`${text}\n${refSchema(chainId).join("\n")}`).digest("hex").slice(0, 12);
    versions.set(key, v);
  }
  return v;
}
