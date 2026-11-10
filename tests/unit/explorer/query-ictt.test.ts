import { createHash } from 'node:crypto';
import { keccak256, toBytes } from 'viem';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/sourcify', () => ({ getVerifiedContractResolvingProxies: vi.fn(async () => null) }));

import { recipeKey } from '@/lib/explorer-query/cache';
import { protocolScope } from '@/lib/explorer-query/checks';
import { runQuery } from '@/lib/explorer-query/clickhouse';
import { fillDrill } from '@/lib/explorer-query/enrich';
import { familyQuestion } from '@/lib/explorer-query/families';
import { guardSql, shadowedAlias } from '@/lib/explorer-query/guard';
import { ICTT_PARTS, ICTT_TOPICS, icttExamples, icttQuestion, icttTurn } from '@/lib/explorer-query/ictt';
import { lendingQuestion } from '@/lib/explorer-query/lending';
import { collapseMacros, expandMacros } from '@/lib/explorer-query/macros';
import { mevQuestion } from '@/lib/explorer-query/mev';
import { networkPrompt, networkVersion } from '@/lib/explorer-query/network-prompt';
import { dexQuestion, promptVersion, systemPrompt, userTurn } from '@/lib/explorer-query/prompt';
import { registryNames } from '@/lib/explorer-query/registry-turn';
import { sqlWindow } from '@/lib/explorer-query/scope';
import { SQL_BUDGET, withSources } from '@/lib/explorer-query/sources';
import { NETWORK_ID } from '@/lib/explorer-query/target';

/* Interchain Token Transfer (ICTT) and ICM in Query: the $ICTT shorthand (ictt.ts, macros.ts), its chapter and turn,
   and the gates that leave such a question to that chapter. */

const C = 43114;
const NUMI = 8021;
/** the parts a chain serves: ictt_transfers on the network alone, ictt_chains on a chain page alone */
const served = (p: string, chainId: number) => (p === 'ictt_transfers' ? chainId === NETWORK_ID : p !== 'ictt_chains' || chainId !== NETWORK_ID);
/** the query service's screen (stats-api query.go, forbiddenRe), as strict as query-lending.test.ts's */
const SCREEN = /\b(insert|alter|drop|create|attach|detach|truncate|optimize|rename|grant|revoke|kill|system|use|set|into\s+outfile|settings|url|s3|s3cluster|remote|remotesecure|file|mysql|postgresql|mongodb|jdbc|odbc|hdfs|azureblobstorage|iceberg|deltalake|hudi|input|executable|cluster|clusterallreplicas|dictionary|merge|view|values|format|numbers|zeros|generaterandom|null|loop)[\s(]/i;

/** each event's canonical signature, as icm-contracts declares it (ITokenTransferrer.sol, ITokenHome.sol,
    ITeleporterMessenger.sol) */
const SIGNATURES: Record<keyof typeof ICTT_TOPICS, string> = {
  tokensSent: 'TokensSent(bytes32,address,(bytes32,address,address,address,uint256,uint256,uint256,address),uint256)',
  tokensAndCallSent: 'TokensAndCallSent(bytes32,address,(bytes32,address,address,bytes,uint256,uint256,address,address,address,uint256,uint256),uint256)',
  tokensRouted: 'TokensRouted(bytes32,(bytes32,address,address,address,uint256,uint256,uint256,address),uint256)',
  tokensAndCallRouted: 'TokensAndCallRouted(bytes32,(bytes32,address,address,bytes,uint256,uint256,address,address,address,uint256,uint256),uint256)',
  tokensWithdrawn: 'TokensWithdrawn(address,uint256)',
  callSucceeded: 'CallSucceeded(address,uint256)',
  callFailed: 'CallFailed(address,uint256)',
  remoteRegistered: 'RemoteRegistered(bytes32,address,uint256,uint8)',
  collateralAdded: 'CollateralAdded(bytes32,address,uint256,uint256)',
  sendMessage: 'SendCrossChainMessage(bytes32,bytes32,(uint256,address,bytes32,address,uint256,address[],(uint256,address)[],bytes),(address,uint256))',
  receiveMessage: 'ReceiveCrossChainMessage(bytes32,bytes32,address,address,(uint256,address,bytes32,address,uint256,address[],(uint256,address)[],bytes))',
  messageExecuted: 'MessageExecuted(bytes32,bytes32)',
  messageExecutionFailed: 'MessageExecutionFailed(bytes32,bytes32,(uint256,address,bytes32,address,uint256,address[],(uint256,address)[],bytes))',
  receiptReceived: 'ReceiptReceived(bytes32,bytes32,address,(address,uint256))',
  deposit: 'Deposit(address,uint256)',
};

const ICTT = [
  'How many stablecoins are currently held in the ICTT bridges on the C-Chain?',
  'Top ICTT tokens by volume in the last 30 days',
  'ICTT transfers between the C-Chain and Numi per day this month',
  'Which ICTT bridges exist for USDC on the C-Chain?',
  'Which ICTT transfers are still waiting for delivery?',
  'ICM messages Dexalot sent and received this week and how many failed',
  'ICTT transfers from Numi to the C-Chain in the last 7 days',
  'Bridged USDC over ICTT this week',
  'ICTT withdrawals and collateral added this month',
  'Which bridges hold the most right now?',
];
// DEX, lending and registry questions about tokens bridged in (BTC.b, WETH.e): a bridge word alone takes nothing from them
const BRIDGED = [
  'Which bridged tokens have the most swap volume today?',
  'How much bridged BTC is borrowed on lending markets?',
  'Liquidity of bridged token pools today',
  'Daily DEX volume of BTC.b, a bridged token',
  'Top bridged tokens deposited into GMX this week',
  'Bridge transactions on GMX this week',
  'Top pools for bridged WETH.e this week',
  'Swap volume of bridged tokens today',
  'Top borrowers of bridged assets this month',
  'Liquidity of bridged BTC.b pools',
  'Which DEX has the most bridged token volume?',
];
const OTHERS = ['USDC transfers today', 'Aave deposits this week', 'USDC bridged through CCTP today', 'Stargate bridge volume this week', 'Top pools by volume today'];

describe('the ICTT and ICM topics', () => {
  it('are keccak256 of the signatures icm-contracts declares', () => {
    for (const [name, signature] of Object.entries(SIGNATURES)) expect(ICTT_TOPICS[name as keyof typeof ICTT_TOPICS], name).toBe(keccak256(toBytes(signature)).slice(2));
  });
});

describe('an ICTT or ICM question', () => {
  it('names a bridge, ICTT or ICM, on a mainnet EVM chain or the network, or follows a turn that read the shorthand', () => {
    for (const chainId of [C, NUMI, NETWORK_ID]) for (const q of ICTT) expect(icttQuestion(chainId, q), `${chainId}: ${q}`).toBe(true);
    for (const q of OTHERS) expect(icttQuestion(C, q), q).toBe(false);
    // Fuji, the P-Chain and a testnet L1 stay as they were
    for (const chainId of [43113, 1, 5, 2201]) expect(icttQuestion(chainId, ICTT[0]), String(chainId)).toBe(false);
    expect(icttQuestion(C, 'make it weekly', [{ prompt: 'x', sql: '$ICTT(now() - INTERVAL 7 DAY) SELECT count() FROM ictt_sends' }])).toBe(true);
    expect(icttQuestion(NETWORK_ID, 'only the delivered ones', [{ prompt: 'x', sql: 'WITH ictt_transfers AS (SELECT 1) SELECT 1' }])).toBe(true);
  });

  it('trips no DEX, lending, family or MEV chapter, and the network sends none of them to the C-Chain', () => {
    for (const q of ICTT) expect([dexQuestion, lendingQuestion, familyQuestion, mevQuestion].filter((f) => f(C, q)).map((f) => f.name), q).toEqual([]);
    // a question that names CCTP or Circle stays CCTP's, bridged USDC with no ICTT word too
    expect(familyQuestion(C, 'ICTT against CCTP: bridged USDC this week')).toBe(true);
    expect(familyQuestion(C, 'bridged USDC today')).toBe(true);
    expect(dexQuestion(C, 'Top pools by volume today')).toBe(true);
    // a question that names a DEX or a lending protocol still gets its chapter beside the ICTT one
    expect(dexQuestion(C, 'Bridged tokens swapped on Pharaoh this week')).toBe(true);
    expect(lendingQuestion(C, 'ICTT tokens deposited on Aave this week')).toBe(true);
    // in a question that names ICTT, only the words a bridge's events share leave the DEX and lending chapters out: a
    // swap, a DEX, a loan or a borrow keeps them
    for (const q of ['Which ICTT tokens are swapped most on DEXs this week?', 'ICTT bridged tokens borrowed on lending markets']) {
      expect(dexQuestion(C, q) || lendingQuestion(C, q), q).toBe(true);
      expect(icttQuestion(C, q), q).toBe(true);
    }
  });

  it("leaves a DEX, lending or registry question about bridged tokens as it was: a bridge word alone adds no chapter there", () => {
    for (const q of BRIDGED) {
      expect(dexQuestion(C, q) || lendingQuestion(C, q) || registryNames(C, q).length > 0, q).toBe(true);
      expect(icttQuestion(C, q), q).toBe(false);
      expect(icttTurn(C, q), q).toBe('');
    }
    expect(registryNames(C, 'Bridge transactions on GMX this week')).toEqual(['GMX']);
    expect(lendingQuestion(C, 'How much bridged BTC is borrowed on lending markets?')).toBe(true);
    expect(dexQuestion(C, 'Which bridged tokens have the most swap volume today?')).toBe(true);
    // a bridge word that no other chapter claims is ICTT's
    expect(icttQuestion(C, 'Which bridges exist on this chain?')).toBe(true);
  });

  it("names L1s, not the registry's contracts: Dexalot in an ICM question is a chain", () => {
    const q = 'ICM messages Dexalot sent and received this week';
    expect(registryNames(C, 'Dexalot activity this week')).toEqual(['Dexalot']);
    expect(registryNames(C, q)).toEqual([]);
    const sql = "SELECT count() AS n FROM raw_logs WHERE chain_id = 43114 AND block_time >= toMonday(now()) AND topic0 = unhex('2a211ad4a59ab9d003852404f9c57c690704ee755f3c79d2c2812ad32da99df8')";
    expect(protocolScope(sql, ['Dexalot activity this week'], C)).toMatch(/^the question names Dexalot/);
    expect(protocolScope(sql, [q], C)).toBeNull();
  });

  it('is told its first rules in its turn, and the recipe key holds the turn', () => {
    const q = 'stablecoins held in the ictt bridges now';
    expect(icttTurn(C, q)).toContain('opens with $ICTT(start), $ICTT(start, end) or $ICTT()');
    expect(icttTurn(C, q)).toContain('What the bridges hold now is ictt_held, after $ICTT(): one row per token');
    expect(icttTurn(C, q)).toContain("This chain's tables hold its own side of a transfer or a message only.");
    expect(icttTurn(NUMI, 'trace ICTT message 0x9205afdee4202e45e70d90d267f0893d75cead6870abde86b25129c0f247b97c')).toContain("the note says the other side is on the other chain's rows");
    expect(icttTurn(NETWORK_ID, q)).toContain('ictt_transfers holds both sides of each send');
    for (const other of OTHERS) expect(icttTurn(C, other), other).toBe('');
    expect(icttTurn(43113, q)).toBe('');
    expect(userTurn(C, q, new Date()).split('\n\n')[0]).toContain(icttTurn(C, q).trim());
    const v = promptVersion(C, dexQuestion(C, q), lendingQuestion(C, q), familyQuestion(C, q), mevQuestion(C, q), icttQuestion(C, q));
    expect(recipeKey(C, q)).toBe(createHash('sha256').update(`${C}\n${v}\n${q}\n\n${icttTurn(C, q)}`).digest('hex').slice(0, 32));
    expect(recipeKey(NETWORK_ID, q)).toBe(createHash('sha256').update(`${NETWORK_ID}\n${networkVersion(true)}\n${q}\n\n${icttTurn(NETWORK_ID, q)}`).digest('hex').slice(0, 32));
  });
});

describe('the ICTT chapter', () => {
  const base = { chainId: C, chainName: 'C-Chain', symbol: 'AVAX', schema: '', coverage: null };

  it('comes under a prompt version of its own on the C-Chain and an L1, and leaves the plain prompt as it was', () => {
    const plain = systemPrompt(base);
    const ictt = systemPrompt({ ...base, ictt: true });
    expect(ictt).toContain('## Interchain token transfers and ICM');
    expect(ictt).toContain('$ICTT() SELECT');
    expect(plain).not.toContain('$ICTT');
    expect(ictt.startsWith(plain.slice(0, plain.indexOf('## Query rules')))).toBe(true);
    expect(promptVersion(C, false, false, false, false, true)).not.toBe(promptVersion(C));
    const l1 = { ...base, chainId: NUMI, chainName: 'Numi', symbol: 'NUMI' };
    const answered = 'A transfer or a message between this chain and another is not about another chain: answer this chain\'s side of it.';
    expect(systemPrompt({ ...l1, ictt: true })).toContain(answered);
    expect(systemPrompt({ ...l1, ictt: true })).toContain('C-Chain 0x0427d4b22a2a78bcddd456742caf91b56badbff985ee19aef14573e7343fd652');
    expect(systemPrompt(l1)).not.toContain(answered);
    expect(promptVersion(NUMI, false, false, false, false, true)).not.toBe(promptVersion(NUMI));
    // Fuji's prompt stays as it was
    expect(systemPrompt({ ...base, chainId: 43113, ictt: true })).toBe(systemPrompt({ ...base, chainId: 43113 }));
    for (const text of [ictt, systemPrompt({ ...l1, ictt: true })]) expect(text).not.toContain('\u2014');
  });

  it("is the network's variant, which keeps ICTT and ICM on the network and every other question's key", () => {
    const plain = networkPrompt({ schema: '', coverage: null, chains: [] });
    const ictt = networkPrompt({ schema: '', coverage: null, chains: [], ictt: true });
    expect(plain).toContain('liquid staking, bridges or MEV');
    expect(ictt).toContain("liquid staking, Circle's CCTP (ICTT bridges and ICM are this page's) or MEV");
    expect(ictt).toContain('ictt_transfers: each of the window');
    expect(plain).not.toContain('ictt_');
    expect(networkVersion(true)).not.toBe(networkVersion());
    expect(networkVersion(true)).toMatch(/^[0-9a-f]{12}$/);
    expect(ictt).not.toContain('\u2014');
  });
});

describe('$ICTT', () => {
  const held = '$ICTT() SELECT lower(concat(\'0x\', hex(token))) AS token_address, round(sum(held_tokens), 2) AS held_usd FROM ictt_held WHERE stable GROUP BY token';
  const out = (sql: string, chainId: number) => {
    const x = expandMacros(sql, chainId);
    return x.ok ? x.sql : `refused: ${x.error}`;
  };

  it('leaves as the shorthand with its window, for stats-api to write out', () => {
    expect(out(held, C)).toBe(held);
    expect(out('$ICTT(now() - INTERVAL 7 DAY, now() - INTERVAL 1 DAY) SELECT count() AS n FROM ictt_sends', C)).toBe('$ICTT(now() - INTERVAL 7 DAY, now() - INTERVAL 1 DAY) SELECT count() AS n FROM ictt_sends');
    // a quoted date is a DateTime, a WITH typed before it is its own, and a WITH after it goes on after its parts
    expect(out("$ICTT('2026-10-01') SELECT count() AS n FROM ictt_arrivals", C)).toBe("$ICTT(toDateTime('2026-10-01')) SELECT count() AS n FROM ictt_arrivals");
    expect(out('WITH $ICTT(toMonday(now())) SELECT count() AS n FROM ictt_sends', NETWORK_ID)).toBe('$ICTT(toMonday(now())) SELECT count() AS n FROM ictt_sends');
    expect(out('$ICTT() WITH s AS (SELECT home FROM ictt_held) SELECT count() AS n FROM s', NUMI)).toBe('$ICTT(), s AS (SELECT home FROM ictt_held) SELECT count() AS n FROM s');
    // no decoder leaves this server
    expect(out(held, NETWORK_ID)).not.toMatch(/ AS \(|unhex\(|raw_logs/);
  });

  it('serves ictt_transfers on the network alone, ictt_chains on a chain page alone, needs a part, and stays off Fuji', () => {
    expect(out('$ICTT(now() - INTERVAL 1 DAY) SELECT count() AS n FROM ictt_transfers', NETWORK_ID)).toBe('$ICTT(now() - INTERVAL 1 DAY) SELECT count() AS n FROM ictt_transfers');
    expect(out('$ICTT(now() - INTERVAL 1 DAY) SELECT count() AS n FROM ictt_transfers', C)).toMatch(/^refused: ictt_transfers is the network's/);
    expect(out('$ICTT() SELECT chain FROM ictt_chains', NETWORK_ID)).toMatch(/^refused: ictt_chains is a chain page's: on the network, name a chain from chain_names/);
    expect(out('$ICTT(now() - INTERVAL 1 DAY) SELECT 1 AS n FROM raw_logs WHERE chain_id = 43114 AND block_time >= now() - INTERVAL 1 HOUR', C)).toMatch(/^refused: \$ICTT stands for ictt_bridges, ictt_tokens, ictt_held, ictt_sends, ictt_arrivals, ictt_chains: read one/);
    expect(out('$ICTT(now() - INTERVAL 1 DAY) SELECT 1 AS n FROM raw_logs WHERE block_time >= now() - INTERVAL 1 HOUR', NETWORK_ID)).toMatch(/^refused: \$ICTT stands for ictt_bridges, ictt_tokens, ictt_held, ictt_sends, ictt_arrivals, ictt_transfers: read one/);
    expect(out('$ICTT(\'x\') SELECT count() AS n FROM ictt_sends', C)).toMatch(/^refused: \$ICTT takes the window's start first/);
    expect(expandMacros(held, 43113)).toEqual({ ok: true, sql: held });
    const fuji = guardSql(held, 43113);
    expect(fuji.ok ? '' : fuji.error).toBe('the query must start with SELECT or WITH');
    // the C-Chain's own shorthands stay the C-Chain's, on an L1 and on the network
    for (const chainId of [NUMI, NETWORK_ID]) expect(guardSql('$DEX(now() - INTERVAL 1 DAY) SELECT count() AS swaps FROM legs', chainId).ok, String(chainId)).toBe(false);
  });

  it('passes the guard and the query service screen in every part, and keeps its window', () => {
    const now = Date.UTC(2026, 9, 13, 12);
    for (const chainId of [C, NUMI, NETWORK_ID]) {
      for (const part of ICTT_PARTS.filter((p) => served(p, chainId))) {
        for (const call of ['$ICTT()', '$ICTT(now() - INTERVAL 7 DAY)', '$ICTT(toStartOfDay(now()) - INTERVAL 7 DAY, toStartOfDay(now()))']) {
          const sql = `${call} SELECT count() AS n FROM ${part}`;
          const g = guardSql(sql, chainId);
          expect(g.ok ? '' : g.error, `${chainId} ${sql}`).toBe('');
          if (!g.ok) continue;
          // stats-api reads the parts as this chain's rows, so a chain page names no chain_id for them
          expect(g.sql, `${chainId} ${sql}`).toBe(`${sql}\nLIMIT 2000`);
          expect(g.tables, `${chainId} ${sql}`).toEqual([]);
          expect(SCREEN.test(g.sql), `${chainId} ${sql}`).toBe(false);
          expect(shadowedAlias(g.sql, true), `${chainId} ${sql}`).toBeNull();
          expect(collapseMacros(g.sql, chainId), `${chainId} ${sql}`).toBe(g.sql);
          const w = sqlWindow(g.sql, now);
          if (call === '$ICTT()') expect(w).toBeNull();
          else expect(w !== null && w !== 'unknown' && w.start, sql).toBeGreaterThan(now - 8 * 86_400_000);
        }
      }
    }
  });

  it("names its chain where it reads a raw table beside the parts, and reads no other chain's", () => {
    const beside = (filter: string) => `$ICTT(now() - INTERVAL 1 DAY) SELECT count() AS n FROM ictt_sends AS s INNER JOIN raw_txs AS t ON t.hash = s.tx WHERE ${filter}t.block_time >= now() - INTERVAL 1 DAY`;
    const bare = guardSql(beside(''), C);
    expect(bare.ok ? '' : bare.error).toBe('filter every table on chain_id = 43114');
    const named = guardSql(beside('t.chain_id = 43114 AND '), C);
    expect(named.ok ? named.tables : named.error).toEqual(['raw_txs']);
    const other = guardSql('$ICTT() SELECT count() AS n FROM ictt_held WHERE chain_id = 8021', C);
    expect(other.ok ? '' : other.error).toBe('only chain_id = 43114 is readable on this page');
  });
});

describe('a query with $ICTT, sent to stats-api', () => {
  const env = { ...process.env };
  afterEach(() => {
    process.env = { ...env };
    vi.unstubAllGlobals();
  });

  it("carries the page's chain, which stats-api writes the shorthand out on", async () => {
    process.env.STATS_QUERY_KEY = 'k';
    delete process.env.QUERY_CLICKHOUSE_URL;
    const sent: unknown[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        sent.push(JSON.parse(String(init.body)));
        return new Response(JSON.stringify({ columns: ['n'], types: ['UInt64'], rows: [[1]], rowCount: 1, truncated: false, elapsedMs: 1, complete: true }), { status: 200 });
      }),
    );
    const sql = '$ICTT() SELECT count() AS n FROM ictt_held\nLIMIT 2000';
    await runQuery(sql, NETWORK_ID);
    await runQuery(sql, NUMI);
    expect(sent).toMatchObject([
      { sql, chainId: 0 },
      { sql, chainId: NUMI },
    ]);
  });

  it('is refused on a direct ClickHouse URL, which cannot write it out', async () => {
    process.env.QUERY_CLICKHOUSE_URL = 'http://localhost:8123';
    await expect(runQuery('$ICTT() SELECT count() AS n FROM ictt_held', C)).rejects.toThrow(/written out by stats-api/);
  });
});

describe("the chapter's worked examples", () => {
  // the network's chain list from the catalog, the longest it can be
  beforeEach(() => vi.stubGlobal('fetch', vi.fn(async () => new Response('down', { status: 503 }))));
  afterEach(() => vi.unstubAllGlobals());

  /** a row with a value for each placeholder of a drill */
  const rowFor = (drill: string) =>
    Object.fromEntries(
      [...drill.matchAll(/\{\{(\w+)(?::(\w+))?\}\}/g)].map(([, col, mode]) => [col, mode === 'bytes' ? `0x${(col.endsWith('_id') ? 'ab' : 'cd').repeat(col.endsWith('_id') ? 32 : 20)}` : col === 'chain_id' ? 43114 : '2026-10-01']),
    );

  it('pass the guard, name no expression after a column, fit the query service and pass its screen', async () => {
    for (const chainId of [C, NUMI, NETWORK_ID]) {
      const lines = icttExamples(chainId).split('\n');
      const sqls = lines.flatMap((l) => {
        if (/^(\$ICTT|SELECT |WITH )/.test(l)) return [l];
        if (!l.startsWith('drill: ')) return [];
        const d = fillDrill(l.slice(7), rowFor(l));
        return d.ok ? [d.sql] : [`not filled: ${d.error}`];
      });
      // five examples on the C-Chain, two on an L1, six on the network, with their drills
      expect(sqls.length, String(chainId)).toBe({ [C]: 9, [NUMI]: 4, [NETWORK_ID]: 8 }[chainId]);
      for (const sql of sqls) {
        const g = guardSql(sql, chainId);
        expect(g.ok ? '' : `${g.error}: ${sql.slice(0, 80)}`, String(chainId)).toBe('');
        if (!g.ok) continue;
        expect(shadowedAlias(g.sql, true), sql.slice(0, 80)).toBeNull();
        const sent = await withSources(g.sql, chainId);
        expect(Buffer.byteLength(sent.sql), sql.slice(0, 80)).toBeLessThanOrEqual(SQL_BUDGET);
        expect(SCREEN.test(sent.sql), sql.slice(0, 80)).toBe(false);
      }
    }
  });

  it("answer the held stablecoins per token on the C-Chain, and every chain's on the network", () => {
    expect(icttExamples(C)).toContain('$ICTT() SELECT lower(concat(\'0x\', hex(token))) AS token_address, count() AS homes, round(sum(held_tokens), 2) AS held_usd FROM ictt_held WHERE stable GROUP BY token');
    expect(icttExamples(NETWORK_ID)).toContain('FROM ictt_held AS h INNER JOIN chain_names AS n ON n.chain_id = h.chain_id WHERE h.stable');
    // a chain page names the other chain by its blockchain ID: Numi's on the C-Chain, the C-Chain's on an L1
    expect(icttExamples(C)).toContain("destination_blockchain_id = unhex('d32cc4660bcf8fa7971589f666fddb5ab22aee7e75dcb30b19829a65d4fb0063')");
    expect(icttExamples(NUMI)).toContain("destination_blockchain_id = unhex('0427d4b22a2a78bcddd456742caf91b56badbff985ee19aef14573e7343fd652')");
    expect(icttExamples(NUMI)).not.toContain('ictt_held');
    // ICM counts each message once: a retried send logs SendCrossChainMessage again with the same ID
    expect(icttExamples(NETWORK_ID)).toContain('uniqExactIf(topic1, topic0 = unhex(\'2a211ad4a59ab9d003852404f9c57c690704ee755f3c79d2c2812ad32da99df8\')) AS sent');
    expect(icttExamples(NETWORK_ID)).not.toMatch(/countIf\(topic0 = /);
  });

  it('rank tokens in both directions: by home on the network, by sends and arrivals on a chain page', () => {
    const net = icttExamples(NETWORK_ID);
    // one key per token: each send joins its home's token, a home's sends and its remotes' both
    expect(net).toContain('FROM ictt_sends AS s INNER JOIN ictt_tokens AS k ON k.chain_id = s.home_chain_id AND k.home = s.home');
    expect(net).toContain("countIf(s.role = 'home') AS from_home, countIf(s.role = 'remote') AS from_remotes");
    expect(net).toContain('WHERE NOT s.routed GROUP BY home_chain, s.home_chain_id, k.token');
    expect(net).not.toMatch(/WHERE (s\.)?role = 'home'/);
    const c = icttExamples(C);
    expect(c).toContain('FROM (SELECT bridge, true AS outbound, amount FROM ictt_sends WHERE NOT routed UNION ALL SELECT bridge, false AS outbound, amount FROM ictt_arrivals) AS x LEFT JOIN ictt_tokens AS k ON k.home = x.bridge');
    // the bridges of one token name the remote's chain from the catalog, and say which homes they cannot list
    expect(c).toContain("if(c.chain = '', lower(concat('0x', hex(b.remote_blockchain_id))), c.chain) AS remote_chain");
    expect(c).toContain('LEFT JOIN ictt_chains AS c ON c.blockchain_id = b.remote_blockchain_id');
    expect(c).toContain('a home that never moved tokens has no event that names its token, so it is not listed, and the note says so');
    // a count stays out of a chart of dollars
    for (const text of [c, net]) expect(text).toContain("held_usd alone is the chart's series, as homes is a count");
  });
});
