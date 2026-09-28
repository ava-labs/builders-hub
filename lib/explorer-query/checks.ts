/* Checks on the query the writer hands in as its answer, run with the
   question beside it (answer.ts), each sent back to the writer once. A
   question that names a protocol our contract registry lists (Aave,
   Benqi, a DEX, a bridge) is answered from that protocol's contracts; an
   answer for one of the protocols a question names says so; and a value
   column is named by the unit it holds. */

import registryData from "@/data/contract-registry.json";
import { AAVE_SLUG, LENDING_NAMES, LENDING_PROTOCOLS, LENDING_TOKENS } from "./lending";
import { DEX_CHAIN_ID, DEX_PROTOCOLS, DEX_TOKENS } from "./protocols";
import { isFuji } from "./target";

/* A question that names a protocol our contract registry lists (Aave,
   Benqi, a DEX, a bridge) is answered from that protocol's contracts. A
   query that reads none of them (by address, by the protocol's slug in
   a shorthand or our tables, or by a name our server defines for one of
   them) answers about something else under the protocol's name. The
   query is read as the writer typed it, so a shorthand counts only with
   its slug. Mainnet C-Chain only, as the registry is. */

interface Listed {
  address: string;
  name: string;
  protocol?: string;
  role?: string;
  active?: boolean;
}
const REGISTRY = registryData as { contracts: Listed[]; protocolSlugs: Record<string, string> };
const LISTED = REGISTRY.contracts.filter((e) => e.protocol && e.active !== false && /^0x[0-9a-f]{40}$/i.test(e.address));
const SLUGS = REGISTRY.protocolSlugs;
const hexOf = (address: string) => address.slice(2).toLowerCase();
const KNOWN = new Set([...LISTED.map((e) => hexOf(e.address)), ...[...DEX_TOKENS, ...LENDING_TOKENS].map((t) => hexOf(t.token))]);
/** names no reader means as a protocol: the chain itself, shared contracts, bots */
const NOT_NAMED = /^(avalanche|infrastructure|unknown dex aggregator)$|\bbot\b|^mev\b/i;
/** protocols named with a common word, taken only as the name is written: "Curve", not "the curve" */
const WORDS = new Set(["curve", "relay", "rain", "socket", "arena", "balancer", "spark", "gamma", "steer", "tundra", "agora", "beefy"]);
/** the contracts our server names for a query (aave_pool), and the table that holds a protocol's contracts */
const SERVER_NAMES = Object.entries(LENDING_NAMES).flatMap(([name, value]) => (/^unhex\('[0-9a-f]{40}'\)$/.test(value) ? [[name, value.slice(7, 47)] as const] : []));
const TABLES: Record<string, string> = Object.fromEntries(Object.keys(LENDING_PROTOCOLS).filter((slug) => slug !== AAVE_SLUG).map((slug) => [slug, "lending_markets"]));
const ROLE_ORDER = ["pool", "factory", "market", "router", "configurator"];
const literal = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** each name a reader may type for a protocol, with the protocols it may mean, the one of that name first: "Pharaoh" is
    also Pharaoh Exchange, and "LFJ" is also Trader Joe, as the registry says */
let names: { any: RegExp; cased: RegExp; protocols: Map<string, string[]> } | undefined;
function protocolNames() {
  if (names) return names;
  const all = [...new Set(LISTED.map((e) => e.protocol!))].filter((p) => !NOT_NAMED.test(p));
  const protocols = new Map<string, string[]>();
  for (const protocol of all) {
    const slug = SLUGS[protocol];
    for (const form of new Set([protocol, protocol.replace(/\s*\(.*\)\s*$/, ""), ...(slug ? [slug, slug.replace(/-/g, " ")] : [])].map((f) => f.trim()))) {
      if (form.length < 3) continue;
      const key = WORDS.has(form.toLowerCase()) ? form : form.toLowerCase();
      protocols.set(key, [...(protocols.get(key) ?? []), protocol]);
    }
  }
  for (const [key, own] of protocols) {
    const k = key.toLowerCase();
    const longer = all.filter((p) => p.toLowerCase().startsWith(`${k} `));
    const was = own.flatMap((p) => /\(fka ([^)]+)\)/i.exec(p)?.[1] ?? []).filter((w) => all.includes(w));
    const now = all.filter((p) => new RegExp(`\\(fka ${literal(k)}\\)`, "i").test(p));
    protocols.set(key, [...new Set([...own, ...longer, ...was, ...now])]);
  }
  // the longest name first, so "Aave V2" is read before "Aave"
  const alternatives = (keys: string[]) => keys.sort((a, b) => b.length - a.length).map(literal).join("|");
  const keys = [...protocols.keys()];
  const re = (list: string[], flags: string) => new RegExp(`(?<![\\w.-])(?:${alternatives(list)})(?![\\w-])`, flags);
  names = { any: re(keys.filter((k) => k === k.toLowerCase()), "gi"), cased: re(keys.filter((k) => k !== k.toLowerCase()), "g"), protocols };
  return names;
}

/** the protocols a question names, each as the ones its name may mean: from the newest of `questions` that names any,
    so "the dollar value" after "aave deposits" is Aave's */
export function namedIn(questions: readonly string[]): string[][] {
  const { any, cased, protocols } = protocolNames();
  for (const q of questions) {
    const found = [...[...q.matchAll(any)].map((m) => m[0].toLowerCase()), ...[...q.matchAll(cased)].map((m) => m[0])].map((k) => protocols.get(k) ?? []);
    if (found.length) return found;
  }
  return [];
}

/** the shorthands that read every protocol of a family when they take no slug, with the family's slugs */
const FAMILIES = [
  { shorthands: ["$lend(", "$liquidations("], single: ["$debts(", "$markets("], slugs: () => Object.keys(LENDING_PROTOCOLS), open: "$LEND(start)" },
  { shorthands: ["$dex(", "$pools("], single: [], slugs: () => Object.keys(DEX_PROTOCOLS), open: "$DEX(start)" },
];

/** why a query does not read the protocol its question names, or null. `sql` is the query as the writer typed it (a
    shorthand not written out); `questions` is the question, then the turns before it, newest first. A shorthand with no
    slug reads every protocol of its family, so it counts for a question that names two of them, and for one it does not.
    $DEBTS and $MARKETS take one protocol at a time, so for a question about two they count for both */
export function protocolScope(sql: string, questions: readonly string[], chainId: number): string | null {
  if (chainId !== DEX_CHAIN_ID) return null;
  const text = sql.toLowerCase();
  const addresses = new Set([...text.matchAll(/(?<![0-9a-f])[0-9a-f]{40}(?![0-9a-f])/g)].map((m) => m[0]));
  const groups = namedIn(questions);
  const familyOf = (protocol: string) => FAMILIES.find((f) => f.slugs().includes(SLUGS[protocol] ?? ""));
  // a family the question names two protocols of, read by one of its shorthands with none of its slugs; or by one that
  // covers a single protocol (debts, markets), whose answer says which protocol it covers
  const whole = (f: (typeof FAMILIES)[number]) =>
    groups.filter((g) => g.some((p) => familyOf(p) === f)).length >= 2 &&
    ((f.shorthands.some((x) => text.includes(x)) && !f.slugs().some((slug) => text.includes(`'${slug}'`))) || f.single.some((x) => text.includes(x)));
  const readsProtocol = (protocol: string) => {
    const hexes = LISTED.filter((e) => e.protocol === protocol).map((e) => hexOf(e.address));
    const slug = SLUGS[protocol];
    const family = familyOf(protocol);
    if (hexes.some((h) => addresses.has(h))) return true;
    if (slug && (text.includes(`'${slug}'`) || (TABLES[slug] && new RegExp(`\\b${TABLES[slug]}\\b`).test(text)))) return true;
    if (SERVER_NAMES.some(([name, hex]) => hexes.includes(hex) && new RegExp(`\\b${name}\\b`).test(text))) return true;
    if (family && whole(family)) return true;
    // a DEX's pools are not listed, only its factories: an address the registry and the token lists do not know may be one
    return !!slug && Object.hasOwn(DEX_PROTOCOLS, slug) && [...addresses].some((h) => !KNOWN.has(h));
  };
  const missed = groups.find((group) => group.length > 0 && !group.some(readsProtocol));
  if (!missed) return null;
  const protocol = missed[0];
  const slug = SLUGS[protocol];
  const family = familyOf(protocol);
  const named = groups.map((g) => g[0]).filter((p) => familyOf(p) === family);
  const rank = (role?: string) => ROLE_ORDER.indexOf(role ?? "") + 1 || 99;
  const listed = LISTED.filter((e) => e.protocol === protocol)
    .sort((a, b) => rank(a.role) - rank(b.role))
    .slice(0, 4)
    .map((e) => `${e.address.toLowerCase()} (${e.name})`)
    .join(", ");
  const how =
    family && named.length >= 2
      ? `The question names ${named.join(" and ")}: open the query with ${family.open} and no slug, which reads all of them, and keep protocol as a column (or filter protocol IN (${named.map((p) => `'${SLUGS[p]}'`).join(", ")})).`
      : slug && Object.hasOwn(DEX_PROTOCOLS, slug)
        ? `Open it with $DEX(start, '${slug}'), which reads ${protocol}'s pools from its factories in our registry: ${listed}.`
        : slug && Object.hasOwn(LENDING_PROTOCOLS, slug)
          ? `Open it with $LEND(start, '${slug}') for its supplies, withdrawals, borrows and repayments, or with $LIQUIDATIONS, $DEBTS or $MARKETS and '${slug}'. Its contracts in our registry: ${listed}.`
          : `Read its contracts in our registry: ${listed}.`;
  return `the question names ${protocol}, and the query reads none of ${protocol}'s contracts, so its rows are not ${protocol}'s. ${how} Then call render_chart again.`;
}

/** what the note of a query that answers one of the lending protocols its question names must say, or null: $DEBTS and
    $MARKETS take one protocol per query, so the answer says which one it covers and offers the other as the next question */
export function oneProtocol(sql: string, note: string, questions: readonly string[], chainId: number): string | null {
  if (chainId !== DEX_CHAIN_ID) return null;
  const m = /\$(debts|markets)\s*\(\s*'([a-z0-9-]+)'\s*\)/.exec(sql.toLowerCase());
  if (!m) return null;
  const name = (slug: string) => LENDING_PROTOCOLS[slug] ?? slug;
  const others = [...new Set(namedIn(questions).flatMap((g) => g.map((p) => SLUGS[p]).filter((slug) => slug && slug !== m[2] && Object.hasOwn(LENDING_PROTOCOLS, slug)).slice(0, 1)))];
  if (others.length === 0) return null;
  const said = /\bonly\b/i.test(note) && others.every((slug) => note.toLowerCase().includes(name(slug).toLowerCase()));
  if (said) return null;
  const covered = name(m[2]);
  const next = `Ask for ${others.map((slug) => `${name(slug)}'s`).join(" and ")} ${m[1]} next.`;
  return `the question names ${[covered, ...others.map(name)].join(" and ")}, and $${m[1].toUpperCase()} covers one protocol per query, so this answer covers ${covered} only. Say that in the note, and offer the other as the next question ("${next}"). Then call render_chart again with the same SQL.`;
}

/** the columns of a query's outer SELECT, each as its expression and its name */
function outerColumns(sql: string): { expr: string; name: string }[] {
  // strings are blanked, so a comma or a word in one splits nothing
  const text = sql.replace(/'(?:[^'\\]|\\.)*'/g, (q) => "'" + " ".repeat(q.length - 2) + "'");
  let depth = 0;
  let select = -1;
  let from = -1;
  const cuts: number[] = [];
  for (let i = 0; i < text.length && from < 0; i++) {
    const c = text[i];
    if (c === "(") depth++;
    else if (c === ")") depth--;
    else if (depth === 0 && /\bSELECT\b/iy.test(text.slice(i, i + 7)) && !/\w/.test(text[i - 1] ?? "")) select = i + 6;
    else if (depth === 0 && select >= 0 && /^FROM\b/i.test(text.slice(i, i + 5)) && !/\w/.test(text[i - 1] ?? "")) from = i;
    else if (depth === 0 && select >= 0 && c === ",") cuts.push(i);
  }
  if (select < 0) return [];
  const end = from < 0 ? text.length : from;
  return [select, ...cuts.filter((c) => c > select && c < end)]
    .map((at, j, all) => sql.slice(at + 1, all[j + 1] ?? end).trim())
    .flatMap((item) => {
      const m = /^([\s\S]*?)\s+AS\s+`?(\w+)`?$/i.exec(item);
      return m ? [{ expr: m[1], name: m[2] }] : [];
    });
}

/** why a value column holds another unit than its name says, or null: a column named for AVAX made from a USD value
    or a price in dollars (D16's fees_avax held dollars, and the table read it as AVAX). Every chain but Fuji */
export function unitName(sql: string, chainId: number): string | null {
  if (isFuji(chainId)) return null;
  const wrong = outerColumns(sql).find((c) => /(^|_)avax$/i.test(c.name) && /\busd\b|\bprice\b|\bpx\s*\[/i.test(c.expr));
  return wrong
    ? `${wrong.name} is named for AVAX, and it is made from a value in dollars (usd or a price). Name a value by its unit, _usd for dollars and _avax for AVAX, and make it hold that unit: ${wrong.name.replace(/avax$/i, "usd")} for this one. Then call render_chart again.`
    : null;
}
