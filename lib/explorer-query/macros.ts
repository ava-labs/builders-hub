/* The shorthand a DEX or lending query opens with, and the WITH it
   stands for. The writer types $DEX(start) or $DEX(start, end), either
   with a slug last, for the DEX WITH (the pools of every family, the
   window's Swap logs, the WAVAX price of each hour and the value of each
   swap), or $POOLS() or $POOLS('slug') for its Swap topic names and pools
   alone; and $LEND, $LIQUIDATIONS, $PRICES, $DEBTS or $MARKETS for a
   lending WITH (lending.ts). The guard writes it out before it reads the
   query, so what the guard checks, what runs and what the page shows is
   the whole WITH, the one the prompt shows. Mainnet C-Chain only. */

import { debtsWith, LENDING_PROTOCOLS, lendWith, liquidationsWith, marketsWith, pricesWith } from "./lending";
import { DEX_CHAIN_ID, DEX_PRICE_POOL, DEX_PROTOCOLS, DEX_TOPICS, type DexFamily } from "./protocols";

const T = DEX_TOPICS;
export const topic = (t: string) => `unhex('${t}')`;
const inList = (xs: string[]) => (xs.length === 1 ? `= ${xs[0]}` : `IN (${xs.join(", ")})`);
/** word k of a log's data as a number, unsigned or signed; toFloat64 first, so no sum wraps */
export const U = (k: number, d = "data") => `toFloat64(reinterpretAsUInt256(reverse(substring(${d}, ${1 + 32 * k}, 32))))`;
export const I = (k: number, d = "data") => `toFloat64(reinterpretAsInt256(reverse(substring(${d}, ${1 + 32 * k}, 32))))`;
/** the uint128 in the 16 bytes of a log's data from byte `at` */
export const H = (at: number | string, d = "data") => `toFloat64(reinterpretAsUInt128(reverse(substring(${d}, ${at}, 16))))`;
export const FIRST_DAY = "'2020-09-23'";

/** the events that create each family's pools; woofi has no pools to find */
export const CREATED: Record<DexFamily, string[]> = {
  univ2: [T.v2Created],
  solidly: [T.solidlyCreated],
  univ3: [T.v3Created],
  "cl-ramses": [T.v3Created],
  algebra: [T.algebraCustom, T.algebraPool],
  lb: [T.lbCreated],
  univ4: [T.v4Initialize],
  woofi: [],
};
/** the pools of the factories the WITH reads: protocol, version, pool, its tokens t0 and t1, and k, its fee or bin step */
function poolsCte(): string {
  const created = [...new Set(Object.values(CREATED).flat())];
  // PoolCreated and Solidly's PairCreated put the pool in word 1, the others in word 0; a univ4 pool is its id
  const pool = "multiIf(f.family = 'univ4', l.topic1, f.family IN ('univ3', 'cl-ramses', 'solidly'), substring(l.data, 45, 20), substring(l.data, 13, 20))";
  // Initialize and algebra's CustomPool name the tokens in topic2 and topic3
  const later = `f.family = 'univ4' OR l.topic0 = ${topic(T.algebraCustom)}`;
  const k = "multiIf(f.family IN ('univ3', 'cl-ramses', 'lb'), reinterpretAsUInt32(reverse(substring(l.topic3, 29, 4))), f.family = 'univ4', reinterpretAsUInt32(reverse(substring(l.data, 29, 4))), 0)";
  // a factory is a String in dex_factories and a FixedString(20) in raw_logs.address: a join or an IN of the two casts the
  // address to a String, which drops its trailing zero bytes, so the factory is read as a FixedString(20) too
  return `pools AS (SELECT f.protocol AS protocol, f.version AS version, ${pool} AS pool, substring(if(${later}, l.topic2, l.topic1), 13, 20) AS t0, substring(if(${later}, l.topic3, l.topic2), 13, 20) AS t1, ${k} AS k FROM raw_logs AS l INNER JOIN dex_factories AS f ON l.address = toFixedString(f.factory, 20) WHERE l.chain_id = ${DEX_CHAIN_ID} AND l.block_time >= ${FIRST_DAY} AND l.address IN (SELECT toFixedString(factory, 20) FROM dex_factories WHERE chain_id = ${DEX_CHAIN_ID} $PROTOCOL) AND l.topic0 ${inList(created.map(topic))})`;
}

/** the Swap topics, named once in the WITH */
const SWAPS_NAMED = `${topic(T.v2Swap)} AS v2_swap, ${topic(T.v3Swap)} AS v3_swap, ${topic(T.lbSwap)} AS lb_swap, ${topic(T.v4Swap)} AS v4_swap`;
/** the window's Swap logs by topic0: pool, time, block, transaction, trader, router, and what each moved of token0 (r0) and token1 (r1) */
const swapsCte = (start: string, end: string) =>
  `swap_logs AS (SELECT if(topic0 = v4_swap, topic1, address) AS pool, block_time, block_number, transaction_hash AS tx, tx_from AS trader, tx_to AS router, multiIf(topic0 = v2_swap, ${U(0)} + ${U(2)}, topic0 = lb_swap, ${H(49)} + ${H(81)}, abs(${I(0)})) AS r0, multiIf(topic0 = v2_swap, ${U(1)} + ${U(3)}, topic0 = lb_swap, ${H(33)} + ${H(65)}, abs(${I(1)})) AS r1 FROM raw_logs WHERE chain_id = ${DEX_CHAIN_ID} AND block_time >= ${start}${end} AND topic0 IN (v2_swap, v3_swap, lb_swap, v4_swap))`;
/** the WAVAX price per hour from the hour before `start`: the median over the hour's swaps in the price pool */
export const pxCte = (start: string, swap = "v3_swap") =>
  `px AS (SELECT toStartOfHour(block_time) AS hour, quantileExact(0.5)(-${I(1)} / nullIf(${I(0)}, 0) * 1e12) AS price FROM raw_logs WHERE chain_id = ${DEX_CHAIN_ID} AND block_time >= ${start} - INTERVAL 1 HOUR AND topic0 = ${swap} AND address = ${topic(DEX_PRICE_POOL.slice(2))} GROUP BY hour)`;
/** the stablecoins with their decimals, and WAVAX with native AVAX, as arrays */
export const QUOTES = `q AS (SELECT groupArrayIf(token, quote = 'usd') AS S, groupArrayIf(decimals, quote = 'usd') AS SD, groupArrayIf(token, quote = 'avax') AS A FROM dex_tokens WHERE chain_id = ${DEX_CHAIN_ID})`;
/** a swap's value in USD: its stablecoin leg, else its WAVAX leg at the hour's price, else NULL */
const USD =
  "multiIf(has(S, p.t0), s.r0 / pow(10, SD[indexOf(S, p.t0)]), has(S, p.t1), s.r1 / pow(10, SD[indexOf(S, p.t1)]), has(A, p.t0) AND x.price > 0, s.r0 / 1e18 * x.price, has(A, p.t1) AND x.price > 0, s.r1 / 1e18 * x.price, NULL)";
const LEGS = `legs AS (SELECT s.pool AS pool, s.block_time AS block_time, s.block_number AS block_number, s.tx AS tx, s.trader AS trader, s.router AS router, p.protocol AS protocol, p.version AS version, p.t0 AS t0, p.t1 AS t1, p.k AS k, s.r0 AS r0, s.r1 AS r1, ${USD} AS usd FROM swap_logs AS s INNER JOIN pools AS p ON s.pool = p.pool CROSS JOIN q LEFT JOIN px AS x ON toStartOfHour(s.block_time) = x.hour)`;

/** the DEX WITH with its three slots: the window's start, its end or nothing, and a protocol filter or nothing */
export const DEX_WITH = `WITH ${SWAPS_NAMED}, ${poolsCte()}, ${swapsCte("$START", "$END")}, ${pxCte("$START")}, ${QUOTES}, ${LEGS}`;
/** its Swap topic names and pools alone */
const DEX_POOLS = `WITH ${SWAPS_NAMED}, ${poolsCte()}`;

/* ------------------------------------------------------------------ */

/** each shorthand: whether it takes the window's start (and then, optionally, its end), the slugs it takes, and the WITH it stands for */
interface Macro {
  window: boolean;
  slugs: () => readonly string[];
  /** "required": the WITH covers one protocol at a time, so it always takes a slug */
  slug: "none" | "optional" | "required";
  text: (start: string, end: string | undefined, slug: string | undefined) => string;
}
const dexSlugs = () => Object.keys(DEX_PROTOCOLS);
const lendSlugs = () => Object.keys(LENDING_PROTOCOLS);
const dex = (with_: string, start: string, end: string | undefined, slug: string | undefined) =>
  with_.replaceAll("$START", () => start).replace("$END", () => (end ? ` AND block_time < ${end}` : "")).replace("$PROTOCOL", () => (slug ? `AND protocol = '${slug}'` : ""));
const MACROS: Record<string, Macro> = {
  DEX: { window: true, slugs: dexSlugs, slug: "optional", text: (start, end, slug) => dex(DEX_WITH, start, end, slug) },
  POOLS: { window: false, slugs: dexSlugs, slug: "optional", text: (_s, _e, slug) => dex(DEX_POOLS, "", undefined, slug) },
  LEND: { window: true, slugs: lendSlugs, slug: "optional", text: lendWith },
  LIQUIDATIONS: { window: true, slugs: lendSlugs, slug: "optional", text: liquidationsWith },
  PRICES: { window: true, slugs: () => [], slug: "none", text: (start, end) => pricesWith(start, end) },
  // one protocol's debts or markets take most of the 8 KiB the query service accepts, so one at a time
  DEBTS: { window: false, slugs: lendSlugs, slug: "required", text: (_s, _e, slug) => debtsWith(slug!) },
  MARKETS: { window: false, slugs: lendSlugs, slug: "required", text: (_s, _e, slug) => marketsWith(slug) },
};

const USAGE =
  "open the query with one shorthand: $DEX, $LEND or $LIQUIDATIONS with the window's start, then its end if it has one, then a slug for one protocol, as in $DEX(start, end, 'slug'); $PRICES(start) or $PRICES(start, end); $POOLS() or $POOLS('slug'); $DEBTS('slug') or $MARKETS('slug'). Then SELECT, or , name AS (…)";
const quoted = (xs: readonly string[]) => xs.map((s) => `'${s}'`).join(", ");
/** a quoted word, as a slug is; a quoted date is a DateTime */
const WORD = /^'([a-z][\w-]*)'$/i;
/** a date in quotes is a DateTime, so the price's hour before it can be taken */
const time = (a: string) => (/^'[^']*'$/.test(a) ? `toDateTime(${a})` : a);

export type Expanded = { ok: true; sql: string; macro?: { name: string; size: number } } | { ok: false; error: string };

/** the query with the shorthand it opens with written out. Any other $NAME, a second one, or one after the start is
    refused, and so is a slug the shorthand has no protocol for. Every chain but the mainnet C-Chain gets its query back as it came */
export function expandMacros(sql: string, chainId: number): Expanded {
  if (chainId !== DEX_CHAIN_ID) return { ok: true, sql };
  // strings and quoted names are blanked, so a $ inside one is text
  const blank = sql.replace(/'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`|"(?:[^"\\]|\\.)*"/g, (s) => s[0] + " ".repeat(s.length - 2) + s[0]);
  const found = [...blank.matchAll(/\$([A-Za-z_]\w*)/g)];
  if (found.length === 0) return { ok: true, sql };
  const other = found.find((m) => !Object.hasOwn(MACROS, m[1]));
  if (other) return { ok: false, error: `$${other[1]} is no shorthand here: ${USAGE}` };
  const lead = /^\s*(?:WITH\s+)?\$([A-Z]+)\s*\(/i.exec(blank);
  if (!lead || !Object.hasOwn(MACROS, lead[1]) || found.length > 1) return { ok: false, error: `the shorthand stands for the query's WITH, once, at its start: ${USAGE}` };
  const name = lead[1];
  const macro = MACROS[name];
  // the arguments run to the parenthesis that closes the first one, split at its own commas
  const open = lead[0].length - 1;
  const cuts: number[] = [];
  let close = -1;
  for (let i = open, depth = 0; i < blank.length && close < 0; i++) {
    if (blank[i] === "(") depth++;
    else if (blank[i] === ")" && --depth === 0) close = i;
    else if (blank[i] === "," && depth === 1) cuts.push(i);
  }
  if (close < 0) return { ok: false, error: `$${name}( is not closed: ${USAGE}` };
  const args = [open, ...cuts].map((at, j) => sql.slice(at + 1, cuts[j] ?? close).trim()).filter((a, j, all) => a !== "" || all.length > 1);
  const slugs = macro.slugs();
  // a slug comes last, a quoted word; the start and the end come first
  const last = args[args.length - 1];
  const slugArg = macro.slug !== "none" && last !== undefined && WORD.test(last) && (!macro.window || args.length > 1) ? last : undefined;
  const times = slugArg === undefined ? args : args.slice(0, -1);
  const slug = WORD.exec(slugArg ?? "")?.[1];
  const [start, end] = times;
  const most = (macro.window ? 2 : 0) + (macro.slug === "none" ? 0 : 1);
  const some = slugs.includes("pharaoh") ? "pharaoh" : slugs[slugs.length - 1];
  const example = `$${name}(toStartOfDay(now())${macro.slug === "none" ? "" : `, '${some}'`})`;
  if (args.length > most || times.length > (macro.window ? 2 : 0))
    return { ok: false, error: `$${name} takes at most ${[...(macro.window ? ["the window's start", "its end"] : []), ...(macro.slug === "none" ? [] : ["a slug"])].join(", ").replace(/, ([^,]*)$/, " and $1")}: ${USAGE}` };
  if (macro.window && (!start || WORD.test(start))) return { ok: false, error: `$${name} takes the window's start first${macro.slug === "none" ? "" : ", then the slug"}: ${example}` };
  if (end !== undefined && WORD.test(end))
    return { ok: false, error: macro.slug === "none" ? `$${name} takes no slug: ${USAGE}` : `$${name} takes one slug, last: $${name}(toStartOfDay(now()) - INTERVAL 1 DAY, toStartOfDay(now()), '${some}')` };
  if (slugArg !== undefined && !slugs.includes(slug!)) return { ok: false, error: `${slugArg} is not a protocol's slug; the slugs are ${quoted(slugs)}` };
  if (macro.slug === "required" && !slug) return { ok: false, error: `$${name} covers one protocol at a time: $${name}(${quoted(slugs).replace(/, /g, `) or $${name}(`)})` };
  const text = macro.text(start ? time(start) : "", end ? time(end) : undefined, slug);
  // a WITH of the query's own goes on after the shorthand's
  const rest = sql.slice(close + 1).replace(/^\s*WITH\b/i, ",");
  if (!/\S/.test(rest)) return { ok: false, error: `$${name}(…) is only the WITH: ${USAGE}` };
  return { ok: true, sql: text + rest, macro: { name, size: text.length } };
}

/* ------------------------------------------------------------------ */
/* An earlier turn comes back from the page with its shorthand written
   out, and the writer reads only the first 3,000 characters of it, so
   the SELECT after a long WITH is cut off. The shorthand goes back in
   its place, as the writer typed it. */

const MARK = { start: "\u0001start\u0001", end: "\u0001end\u0001" };
const escaped = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** each shorthand's WITH, for every slug and with or without an end, as a pattern that finds it at a query's start;
    the forms with an end come first, since the form without one could read an end as part of the start */
let patterns: { name: string; slug?: string; re: RegExp }[] | undefined;
function patternsOf() {
  return (patterns ??= Object.entries(MACROS).flatMap(([name, macro]) => {
    const slugs = macro.slug === "none" ? [undefined] : macro.slug === "required" ? [...macro.slugs()] : [undefined, ...macro.slugs()];
    return (macro.window ? [true, false] : [false]).flatMap((end) =>
      slugs.map((slug) => {
        const seen = new Set<string>();
        const text = macro.text(macro.window ? MARK.start : "", end ? MARK.end : undefined, slug);
        const source = text
          .split(/(\u0001(?:start|end)\u0001)/)
          .map((part) => {
            const arg = part === MARK.start ? "s" : part === MARK.end ? "e" : null;
            if (!arg) return escaped(part);
            if (seen.has(arg)) return `\\k<${arg}>`;
            seen.add(arg);
            return `(?<${arg}>[\\s\\S]+?)`;
          })
          .join("");
        return { name, slug, re: new RegExp(`^${source}`) };
      }),
    );
  }));
}

/** a query whose WITH a shorthand wrote, with the shorthand back in its place; any other query as it came. A form is
    kept only when it writes out to the same query again */
export function collapseMacros(sql: string, chainId: number): string {
  if (chainId !== DEX_CHAIN_ID) return sql;
  for (const p of patternsOf()) {
    const m = p.re.exec(sql);
    if (!m) continue;
    const args = [m.groups?.s, m.groups?.e, p.slug === undefined ? undefined : `'${p.slug}'`].filter((a): a is string => a !== undefined);
    const short = `$${p.name}(${args.join(", ")})${sql.slice(m[0].length)}`;
    const back = expandMacros(short, chainId);
    if (back.ok && back.sql === sql) return short;
  }
  return sql;
}
