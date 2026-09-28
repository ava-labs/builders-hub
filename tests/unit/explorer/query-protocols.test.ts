import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/sourcify', () => ({ getVerifiedContractResolvingProxies: vi.fn(async () => null) }));

import registry from '@/data/contract-registry.json';
import { enrichNames, fillDrill } from '@/lib/explorer-query/enrich';
import { guardSql, shadowedAlias } from '@/lib/explorer-query/guard';
import { DEX_FACTORIES, DEX_PRICE_POOL, DEX_PROTOCOLS, DEX_TOKENS, DEX_TOPICS, dexContractName, dexFamilies, factoriesFor, factoriesSql, readsPositions, tokensFor, tokensSql, type DexFactory, type DexToken } from '@/lib/explorer-query/protocols';
import { createHash } from 'node:crypto';
import { recipeKey } from '@/lib/explorer-query/cache';
import { expandMacros, feesRead } from '@/lib/explorer-query/macros';
import { dexQuestion, promptVersion, systemPrompt } from '@/lib/explorer-query/prompt';
import { refLine, refSchema, SQL_BUDGET, withSources } from '@/lib/explorer-query/sources';

/** the query service's screen (stats-api query.go, forbiddenRe): one of these words, then a space or "(" */
const SCREEN = /\b(insert|alter|drop|create|attach|detach|truncate|optimize|rename|grant|revoke|kill|system|use|set|into\s+outfile|settings|url|s3|s3cluster|remote|remotesecure|file|mysql|postgresql|mongodb|jdbc|odbc|hdfs|azureblobstorage|iceberg|deltalake|executable|urlcluster|filecluster|hudi|redis|sqlite)\s*[(\s]/is;
const ADDRESS = /^0x[0-9a-f]{40}$/;
const POOLS = "SELECT f.protocol AS protocol, count() AS pools FROM raw_logs AS l INNER JOIN dex_factories AS f ON l.address = f.factory WHERE l.chain_id = 43114 AND f.chain_id = 43114 AND l.block_time >= '2020-09-23' GROUP BY protocol";
const hex = (i: number, fill: string) => `0x${i.toString(16).padStart(40, fill)}`;
const packed = (address: string) => Buffer.from(address.slice(2), 'hex').toString('base64');
/** what the two tables may take of the query service's 8 KiB, so a DEX query and its pool WITH still fit */
const TABLES_BUDGET = 3072;
/** a registry of the size the real one will have */
const FACTORIES: DexFactory[] = Array.from({ length: 40 }, (_, i) => ({ protocol: `protocol-${i % 20}`, version: `v${i % 3}`, family: 'univ3', factory: hex(i, 'a'), positions: i % 4 ? [] : [hex(i, 'b')] }));
const TOKENS: DexToken[] = Array.from({ length: 30 }, (_, i) => ({ token: hex(i, 'c'), symbol: `T${i}`, decimals: 18, quote: i < 6 ? 'usd' : '' }));
const entries = (registry as { contracts: { address: string; category?: string; family?: string; active?: boolean; protocol?: string }[] }).contracts;

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => Response.json({ tokens: {} })),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('DEX registry', () => {
  it('reads each active DEX factory of the contract registry once, as a lowercase address, under a protocol with a slug', () => {
    const factories = DEX_FACTORIES.map((f) => f.factory);
    for (const a of [...factories, ...DEX_FACTORIES.flatMap((f) => f.positions)]) expect(a).toMatch(ADDRESS);
    expect(new Set(factories).size).toBe(factories.length);
    for (const f of DEX_FACTORIES) expect(DEX_PROTOCOLS[f.protocol]).toBeTruthy();
    const listed = entries.filter((e) => e.category === 'dex' && e.family && e.active !== false).map((e) => e.address.toLowerCase());
    expect(new Set(factories)).toEqual(new Set(listed));
    for (const e of entries.filter((x) => x.active === false)) expect(factories).not.toContain(e.address.toLowerCase());
  });

  it('counts volume in the four US dollar stablecoins, and in WAVAX and native AVAX, and knows each token once', () => {
    for (const t of DEX_TOKENS) expect(t.token).toMatch(ADDRESS);
    expect(new Set(DEX_TOKENS.map((t) => t.token)).size).toBe(DEX_TOKENS.length);
    expect(DEX_TOKENS.filter((t) => t.quote === 'usd').map((t) => [t.symbol, t.decimals])).toEqual([['USDC', 6], ['USDt', 6], ['USDC.e', 6], ['USDT.e', 6]]);
    expect(DEX_TOKENS.filter((t) => t.quote === 'avax').map((t) => t.token)).toEqual(['0xb31f66aa3c1e785363f0875a1b74e27b85fd66c7', '0x0000000000000000000000000000000000000000']);
  });
});

describe('DEX registry with other families in it', () => {
  afterEach(() => {
    vi.doUnmock('@/data/contract-registry.json');
    vi.resetModules();
  });

  it('loads lending entries and families it has no rules for, and reads only the active DEX families it knows', async () => {
    vi.resetModules();
    // the shapes of dexreg's lending registry: role and underlying fields, the aave-v3 and compound families
    vi.doMock('@/data/contract-registry.json', () => ({
      default: {
        protocolSlugs: { 'Trader Joe': 'trader-joe', Benqi: 'benqi', 'Aave V3': 'aave-v3', Curve: 'curve' },
        contracts: [
          { address: '0x9Ad6C38BE94206cA50bb0d90783181662f0Cfa10', name: 'Joe Factory', protocol: 'Trader Joe', category: 'dex', type: 'factory', family: 'univ2', version: 'v1' },
          { address: '0x9ad6c38be94206ca50bb0d90783181662f0cfa10', name: 'Joe Factory, listed again', protocol: 'Trader Joe', category: 'dex', type: 'factory', family: 'univ2', version: 'v1' },
          { address: '0x6e77932a92582f504ff6c4bdbcef7da6c198aeef', name: 'LB Factory v2.0', protocol: 'Trader Joe', category: 'dex', type: 'factory', family: 'lb-v2.0', version: 'LB v2.0', active: false },
          { address: '0x486af39519b4dc9a7fccd318217352830e8ad9b4', name: 'Benqi Comptroller', protocol: 'Benqi', category: 'lending', type: 'controller', family: 'compound', version: 'core', role: 'comptroller' },
          { address: '0x5c0401e81bc07ca70fad469b451682c0d747ef1c', name: 'qiAVAX', protocol: 'Benqi', category: 'lending', type: 'pool', family: 'compound', version: 'core', role: 'market', underlying: '0x0000000000000000000000000000000000000000' },
          { address: '0x794a61358d6845594f94dc1db02a252b5b4814ad', name: 'Pool', protocol: 'Aave V3', category: 'lending', type: 'pool', family: 'aave-v3', version: 'v3', role: 'pool' },
          { address: '0x0000000000000000000000000000000000000c0c', name: 'A pool', protocol: 'Curve', category: 'dex', type: 'pool', family: 'curve', version: 'v1' },
        ],
      },
    }));
    const { DEX_FACTORIES: factories, DEX_PROTOCOLS: protocols } = await import('@/lib/explorer-query/protocols');
    expect(factories).toEqual([{ protocol: 'trader-joe', version: 'v1', family: 'univ2', factory: '0x9ad6c38be94206ca50bb0d90783181662f0cfa10', positions: [] }]);
    expect(protocols).toEqual({ 'trader-joe': 'Trader Joe' });
  });
});

describe('DEX tables', () => {
  it('are readable on the C-Chain on mainnet only', () => {
    expect(guardSql(POOLS, 43114).ok).toBe(true);
    expect(guardSql(POOLS.replaceAll('43114', '43113'), 43113).ok).toBe(false);
    expect(guardSql(POOLS.replaceAll('43114', '432204'), 432204).ok).toBe(false);
    expect(guardSql('SELECT count() FROM dex_tokens WHERE chain_id = 1', 1).ok).toBe(false);
    expect(guardSql('WITH dex_tokens AS (SELECT 1 AS x) SELECT x FROM dex_tokens WHERE chain_id = 43114', 43114).ok).toBe(false);
    // the DEX chapter describes the two tables, so the schema card of every other question stays as it was
    expect(refSchema(43114)).toEqual([]);
    expect(refSchema(43113)).toEqual([]);
  });

  it('are defined in front of a query that reads them, pass the query service screen, and say where they come from', async () => {
    const out = await withSources(POOLS, 43114);
    expect(out.sql.startsWith('WITH dex_factories AS (SELECT toUInt64(43114) AS chain_id')).toBe(true);
    expect(out.sql).not.toContain('dex_tokens AS');
    expect(out.sql).toContain(`'${packed(DEX_FACTORIES[0].factory)}'`);
    expect(out.sql).toContain('base64Decode(tupleElement(r, 4)) AS factory');
    expect(SCREEN.test(out.sql)).toBe(false);
    expect(out.sources.map((s) => s.table)).toEqual(['dex_factories']);
    expect(out.sources[0].text).toBe(`Protocols and their pool factories come from our contract registry: ${DEX_FACTORIES.length} factories of ${new Set(DEX_FACTORIES.map((f) => f.protocol)).size} protocols.`);
    const both = await withSources(`${POOLS} UNION ALL SELECT 'tokens', count() FROM dex_tokens WHERE chain_id = 43114`, 43114);
    expect(both.sources.map((s) => s.table)).toEqual(['dex_factories', 'dex_tokens']);
    expect(both.sources[1].text).toBe(`Token decimals come from our list of the ${DEX_TOKENS.length} tokens with the most DEX volume.`);
    expect(SCREEN.test(both.sql)).toBe(false);
  });

  it('stay under their byte budget as spliced, the registry as it is and one of the size the real one will have', async () => {
    const both = `${POOLS} UNION ALL SELECT 'tokens', count() FROM dex_tokens WHERE chain_id = 43114`;
    const out = await withSources(both, 43114);
    expect(Buffer.byteLength(out.sql) - Buffer.byteLength(both)).toBeLessThanOrEqual(TABLES_BUDGET);
    const bytes = Buffer.byteLength(factoriesSql(43114, FACTORIES)) + Buffer.byteLength(tokensSql(43114, TOKENS));
    expect(bytes).toBeLessThan(SQL_BUDGET / 2);
  });

  it('keep every factory for a long query that reads both, and trim the tokens first, never the quote tokens', async () => {
    const whole = Buffer.byteLength(factoriesSql(43114, DEX_FACTORIES, false));
    const all = Buffer.byteLength(tokensSql(43114));
    const quotes = DEX_TOKENS.filter((t) => t.quote !== '');
    const base = `${POOLS} UNION ALL SELECT 'tokens', count() FROM dex_tokens WHERE chain_id = 43114 AND ''`;
    // room for every factory and about half the tokens past the quote ones
    const free = whole + Buffer.byteLength(tokensSql(43114, quotes)) + Math.floor((all - Buffer.byteLength(tokensSql(43114, quotes))) / 2);
    const query = `${base.slice(0, -2)}'${'x'.repeat(SQL_BUDGET - 64 - free - Buffer.byteLength(base))}'`;
    const out = await withSources(query, 43114);
    for (const f of DEX_FACTORIES) expect(out.sql).toContain(`'${packed(f.factory)}'`);
    for (const t of quotes) expect(out.sql).toContain(`'${packed(t.token)}'`);
    const [factories, tokens] = out.sources;
    expect(factories.known).toBe(DEX_FACTORIES.length);
    expect(tokens.known).toBeLessThan(DEX_TOKENS.length);
    expect(tokens.known).toBeGreaterThanOrEqual(quotes.length);
    expect(Buffer.byteLength(out.sql)).toBeLessThanOrEqual(SQL_BUDGET);
  });

  it('send the positions contracts only to a query that reads them, and fit the woofi rows last', async () => {
    const all = DEX_FACTORIES.flatMap((f) => f.positions.map(packed));
    expect(all.length).toBeGreaterThan(0);
    const plain = await withSources(POOLS, 43114);
    expect(plain.sql).toContain('emptyArrayString() AS positions');
    for (const p of all) expect(plain.sql).not.toContain(p);
    const lp = await withSources(POOLS.replace('count() AS pools', 'count() AS pools, sum(length(f.positions)) AS contracts'), 43114);
    for (const p of all) expect(lp.sql).toContain(`'${p}'`);
    expect(Buffer.byteLength(lp.sql) - Buffer.byteLength(plain.sql)).toBeGreaterThan(300);
    for (const q of ['SELECT * FROM dex_factories', 'SELECT f.* FROM dex_factories AS f', 'SELECT has(positions, x)']) expect(readsPositions(q), q).toBe(true);
    // the DEX WITH multiplies and reads no positions, and a count(*) reads no column
    const fees = expandMacros('$DEX(toStartOfDay(now())) SELECT round(sum(fee_usd), 2) AS fees_usd, sum(fee_in) AS raw FROM legs', 43114);
    expect(fees.ok).toBe(true);
    expect(fees.ok && readsPositions(fees.sql)).toBe(false);
    expect(readsPositions('SELECT count(*) AS n FROM dex_factories')).toBe(false);
    // woofi's contracts create no pools for the DEX WITH, so a short room leaves them out first, unless the query names them
    const pooled = DEX_FACTORIES.filter((f) => f.family !== 'woofi');
    const room = Buffer.byteLength(factoriesSql(43114, pooled, false));
    expect(factoriesFor(POOLS, room).kept).toEqual(pooled);
    const woofi = factoriesFor(`${POOLS} AND f.protocol = 'woofi'`, room).kept;
    expect(woofi.filter((f) => f.family === 'woofi')).toHaveLength(DEX_FACTORIES.length - pooled.length);
  });

  it('keep what a long query names when the whole registry does not fit, the quote tokens always', () => {
    const query = "SELECT count() FROM dex_factories WHERE protocol = 'protocol-7'";
    const room = 1200;
    const f = factoriesFor(query, room, FACTORIES);
    expect(Buffer.byteLength(f.sql)).toBeLessThanOrEqual(room);
    expect(f.kept.length).toBeLessThan(FACTORIES.length);
    expect(f.kept.filter((x) => x.protocol === 'protocol-7')).toHaveLength(2);
    // the rest in the registry's order
    expect(f.kept.filter((x) => x.protocol !== 'protocol-7').map((x) => x.factory)).toEqual(FACTORIES.filter((x) => x.protocol !== 'protocol-7').slice(0, f.kept.length - 2).map((x) => x.factory));
    const named = TOKENS[20].token.slice(2);
    const t = tokensFor(`SELECT decimals FROM dex_tokens WHERE token = unhex('${named}')`, 500, TOKENS);
    expect(Buffer.byteLength(t.sql)).toBeLessThanOrEqual(500);
    expect(t.kept.slice(0, 6).every((x) => x.quote === 'usd')).toBe(true);
    expect(t.kept.map((x) => x.token)).toContain(TOKENS[20].token);
    // nothing fitting keeps the whole list, so the send fails with the query's own size
    expect(factoriesFor(query, 10, FACTORIES).kept).toHaveLength(FACTORIES.length);
  });
});

describe('DEX names', () => {
  it("names a protocol's slug and the registry's factories", async () => {
    const [f] = DEX_FACTORIES;
    const rows = [{ protocol: f.protocol, factory: f.factory, pools: 3 }];
    const columns = [
      { name: 'protocol', type: 'String' },
      { name: 'factory', type: 'String' },
      { name: 'pools', type: 'UInt64' },
    ];
    const names = await enrichNames(43114, columns, rows, 'http://localhost:3000');
    expect(names.protocol).toEqual({ [f.protocol]: DEX_PROTOCOLS[f.protocol] });
    expect(names.factory).toEqual({ [f.factory]: dexContractName(f.factory) });
    expect(dexContractName(f.factory)).toBe(`${DEX_PROTOCOLS[f.protocol]}${f.version ? ` ${f.version}` : ''} factory`);
    const withPositions = DEX_FACTORIES.find((x) => x.positions.length > 1) ?? DEX_FACTORIES.find((x) => x.positions.length);
    if (withPositions) for (const a of withPositions.positions) expect(dexContractName(a)).toBe(`${DEX_PROTOCOLS[withPositions.protocol]}${withPositions.version ? ` ${withPositions.version}` : ''} positions`);
    // another chain's rows keep their values
    expect((await enrichNames(43113, columns, rows, 'http://localhost:3000')).protocol).toBeUndefined();
  });
});

describe('registry names', () => {
  afterEach(() => {
    vi.resetModules();
  });

  it('name a registry contract from its protocol and name, before Sourcify, and leave its tokens to the token list', async () => {
    // a fresh module, so the token list is this test's own: USDC by its symbol, as the page's list names it
    vi.resetModules();
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ tokens: { '0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e': { symbol: 'USDC', name: 'USD Coin' } } })));
    const { enrichNames: namesOf } = await import('@/lib/explorer-query/enrich');
    const listed = (registry as { contracts: { address: string; name: string; protocol: string; category: string }[] }).contracts;
    const at = (name: string) => listed.find((e) => e.name === name)?.address ?? '';
    // the registry's unattributed contracts go by proxy type: a verified name reads better, and theirs is the last resort
    const [verified, bare] = listed.filter((e) => e.protocol === 'Infrastructure' && e.category !== 'token');
    const { getVerifiedContractResolvingProxies } = await import('@/lib/sourcify');
    vi.mocked(getVerifiedContractResolvingProxies).mockImplementation(async (_chainId, address) =>
      address === verified.address ? ({ match: 'match', name: 'VaultV2', compilerVersion: null, language: null, verifiedAt: null, abi: [] } as never) : null,
    );
    const rows = [
      { from_address: at('qiUSDC'), to_address: at('Benqi Comptroller'), amount: 1 },
      { from_address: at('aAvaUSDC'), to_address: at('Joe Router V1'), amount: 2 },
      { from_address: at('USDC'), to_address: hex(7, 'e'), amount: 3 },
      { from_address: verified.address, to_address: bare.address, amount: 4 },
    ];
    const columns = [
      { name: 'from_address', type: 'String' },
      { name: 'to_address', type: 'String' },
      { name: 'amount', type: 'Float64' },
    ];
    const names = await namesOf(43114, columns, rows, 'http://localhost:3000');
    expect(names.from_address).toEqual({ [at('qiUSDC')]: 'Benqi qiUSDC', [at('aAvaUSDC')]: 'Aave aAvaUSDC', [at('USDC')]: 'USDC', [verified.address]: 'VaultV2' });
    // a name that already says its protocol is not said twice; an address the registry does not list stays unnamed
    expect(names.to_address).toEqual({ [at('Benqi Comptroller')]: 'Benqi Comptroller', [at('Joe Router V1')]: 'Joe Router V1', [bare.address]: bare.name });
    // the registry is the C-Chain's: an L1's rows are named by the token list alone
    const other = await namesOf(432204, columns, rows, 'http://localhost:3000');
    expect(other.from_address).toEqual({ [at('USDC')]: 'USDC', [verified.address]: 'VaultV2' });
    expect(other.to_address).toBeUndefined();
  });
});

describe('the DEX variant of the prompt', () => {
  const ask = (dex: boolean) => systemPrompt({ chainId: 43114, chainName: 'Avalanche C-Chain', symbol: 'AVAX', schema: '', coverage: null, dex });

  it('goes to questions about DEXs and protocols only, on the mainnet C-Chain', () => {
    for (const q of ['What is the volume per DEX today?', 'Pharaoh volume per day this week', 'Top pools by swaps on Trader Joe today', 'Who are the top LPs of the Uniswap v3 WAVAX/USDC pool?', 'WOOFi volume per day this week', 'The largest swaps today', 'Blackhole liquidity providers'])
      expect(dexQuestion(43114, q)).toBe(true);
    for (const q of ['USDC transfers per 5 minutes, count and volume', 'Busiest senders in the last hour', 'Most called methods', 'Fees burned per 5 minutes'])
      expect(dexQuestion(43114, q)).toBe(false);
    expect(dexQuestion(43113, 'Pharaoh volume per day this week')).toBe(false);
    expect(dexQuestion(432204, 'Top pools by swaps')).toBe(false);
    // a follow-up keeps it when an earlier turn read the DEX tables
    expect(dexQuestion(43114, 'make it weekly', [{ prompt: 'what is this', sql: 'SELECT count() FROM dex_factories WHERE chain_id = 43114' }])).toBe(true);
  });

  it('leaves every other C-Chain prompt as it was, and names the variant in the recipe key', () => {
    const plain = ask(false);
    expect(plain).not.toContain('dex_factories');
    expect(plain).not.toContain('## DEXs');
    expect(ask(true).startsWith(plain.slice(0, plain.indexOf('## Query rules')))).toBe(true);
    expect(promptVersion(43114, true)).not.toBe(promptVersion(43114));
    const key = (version: string, q: string) => createHash('sha256').update(`43114\n${version}\n${q}\n`).digest('hex').slice(0, 32);
    expect(recipeKey(43114, 'Pharaoh volume per day this week')).toBe(key(promptVersion(43114, true), 'pharaoh volume per day this week'));
    expect(recipeKey(43114, 'Most called methods')).toBe(key(promptVersion(43114), 'most called methods'));
  });
});

describe('DEX rules and worked examples', () => {
  const prompt = systemPrompt({ chainId: 43114, chainName: 'Avalanche C-Chain', symbol: 'AVAX', schema: '', coverage: null, dex: true });
  const start = prompt.indexOf('The DEX WITH.');
  const chapter = prompt.slice(start, prompt.indexOf('The 15 token contracts with the most transfers'));
  const lines = chapter.split('\n');
  const row = { t: '2026-09-27', pool_address: hex(1, 'a'), provider: hex(2, 'b'), token: DEX_TOKENS[0].token, protocol: DEX_FACTORIES[0].protocol };
  /** an example's first line: its SQL, or the shorthand for the DEX WITH and then its own part */
  const example = (l: string) => /^(WITH|SELECT|\$DEX\(|\$POOLS\()/.test(l) && !l.includes('$START');
  const expandDex = (sql: string) => {
    const x = expandMacros(sql, 43114);
    return x.ok ? x.sql : `not expanded: ${x.error}`;
  };
  const sqls = lines.flatMap((l) => {
    if (example(l)) return [expandDex(l)];
    if (!l.startsWith('drill: ')) return [];
    const d = fillDrill(expandDex(l.slice(7)), row);
    return d.ok ? [d.sql] : [`not filled: ${d.error}`];
  });

  it("give each family's events, the tables' columns, the price pool and the slugs", () => {
    for (const f of dexFamilies()) expect(prompt).toContain(`  - ${f}: `);
    for (const t of Object.values(DEX_TOPICS)) expect(prompt).toContain(`unhex('${t}')`);
    expect(prompt).toContain(DEX_PRICE_POOL);
    expect(prompt).toContain(`- ${refLine('dex_factories')}: `);
    expect(prompt).toContain(`- ${refLine('dex_tokens')}: `);
    for (const slug of Object.keys(DEX_PROTOCOLS)) expect(prompt).toContain(`'${slug}' (`);
    for (const chainId of [43113, 432204]) expect(systemPrompt({ chainId, chainName: 'x', symbol: 'AVAX', schema: '', coverage: null, dex: true })).not.toContain('dex_factories');
  });

  it("give WooSwap's fields by the byte each starts at, so the writer counts no words", () => {
    // a replay of D19 took "swapVol word 4" for byte 161, which is swapFee: 0 USD on a day of 315,710
    const woofi = prompt.split('\n').find((l) => l.startsWith('  - woofi: ')) ?? '';
    // WooSwap(fromToken indexed, toToken indexed, fromAmount, toAmount, from, to indexed, rebateTo, swapVol, swapFee): its
    // data is the six fields not indexed, a word each
    const data = ['fromAmount', 'toAmount', 'from', 'rebateTo', 'swapVol', 'swapFee'];
    for (const [k, name] of data.entries()) if (name !== 'from' && name !== 'rebateTo') expect(woofi).toContain(`${name} substring(data, ${1 + 32 * k}, 32)`);
    expect(woofi).toContain("so WOOFi's volume is sum(toFloat64(reinterpretAsUInt256(reverse(substring(data, 129, 32))))) / 1e6 over every swap");
    expect(woofi).toContain('swapFee is its fee, never its volume.');
    expect(woofi).not.toMatch(/\bword \d/);
  });

  it('print no DEX WITH to copy, and are eight, each with a drill a row fills', () => {
    expect(start).toBeGreaterThan(0);
    expect(prompt.split('uniqExact(tx, pool) AS swaps').length - 1).toBe(4);
    // the writer copied a printed WITH into its final: about 2,300 output tokens and 24 s a call
    expect(prompt).not.toMatch(/legs AS \(SELECT|swap_logs AS \(|\$(START|END|PROTOCOL)\b/);
    expect(lines.filter(example)).toHaveLength(8);
    expect(lines.filter((l) => l.startsWith('drill: '))).toHaveLength(8);
    expect(sqls.filter((s) => s.startsWith('not filled'))).toEqual([]);
    for (const sql of sqls) expect(sql).not.toMatch(/\$(DEX|POOLS|START|PROTOCOL)\b|^not expanded/);
    // the guard writes the shorthand out, so the query it passes is the one the test expands
    const first = lines.find((l) => l.startsWith('$DEX('))!;
    const g = guardSql(first, 43114);
    expect(g.ok && g.sql.startsWith(expandDex(first))).toBe(true);
  });

  it('count swaps by transaction and pool, and carry priced swaps beside the volume', () => {
    const volume = lines.filter((l) => l.includes('AS volume_usd') && !l.includes('$START'));
    expect(volume).toHaveLength(4);
    for (const l of volume) {
      expect(l).toMatch(/uniqExact\((g\.)?tx, (g\.)?pool\) AS swaps/);
      expect(l).toContain('AS priced_swaps');
      expect(l).not.toMatch(/count\(\) AS swaps/);
    }
  });

  it('name no expression after a column, pass the guard, fit the query service with the tables, and pass its screen', async () => {
    expect(sqls).toHaveLength(16);
    for (const sql of sqls) {
      expect(shadowedAlias(sql, true)).toBeNull();
      const g = guardSql(sql, 43114);
      expect(g.ok ? '' : g.error).toBe('');
      if (!g.ok) continue;
      expect(g.sql.length).toBeLessThanOrEqual(6000);
      const out = await withSources(g.sql, 43114);
      expect(Buffer.byteLength(out.sql)).toBeLessThanOrEqual(SQL_BUDGET);
      // with a registry of the real one's size, the query still leaves the tables their budget; a query that reads a
      // swap's fee has a longer WITH, and leaves them today's registry and token list whole
      const tables = feesRead(sql) ? Buffer.byteLength(factoriesSql(43114)) + Buffer.byteLength(tokensSql(43114)) : TABLES_BUDGET;
      expect(Buffer.byteLength(g.sql) + tables + 64, sql.slice(0, 60)).toBeLessThanOrEqual(SQL_BUDGET);
      expect(SCREEN.test(out.sql)).toBe(false);
    }
  });
});
