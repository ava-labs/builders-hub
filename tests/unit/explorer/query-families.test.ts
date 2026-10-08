import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/sourcify', () => ({ getVerifiedContractResolvingProxies: vi.fn(async () => null) }));

import { protocolScope, unitName } from '@/lib/explorer-query/checks';
import { fillDrill } from '@/lib/explorer-query/enrich';
import { CCTP, FAMILY_LISTS, FAMILY_NAMES, OPENTRADE_POOLS, SAVAX, VAULTS, familyQuestion } from '@/lib/explorer-query/families';
import { guardSql, shadowedAlias } from '@/lib/explorer-query/guard';
import { lendingQuestion } from '@/lib/explorer-query/lending';
import { dexQuestion, promptVersion, systemPrompt } from '@/lib/explorer-query/prompt';
import { SQL_BUDGET, withSources } from '@/lib/explorer-query/sources';

/** the query service's screen (stats-api query.go, forbiddenRe): one of these words, then a space or "(" */
const SCREEN = /\b(insert|alter|drop|create|attach|detach|truncate|optimize|rename|grant|revoke|kill|system|use|set|into\s+outfile|settings|url|s3|s3cluster|remote|remotesecure|file|mysql|postgresql|mongodb|jdbc|odbc|hdfs|azureblobstorage|iceberg|deltalake|hudi|input|executable|cluster|clusterallreplicas|dictionary|merge|view|values|format|numbers|zeros|generaterandom|null|loop)[\s(]/i;
const FAMILY = [
  'AVAX staked into sAVAX and redeemed per day this week',
  'What is the sAVAX exchange rate per day over the last 30 days?',
  'How many sAVAX exist now?',
  'USDC out of Avalanche through CCTP today, per destination chain',
  'How much USDC came into Avalanche over CCTP today?',
  'Deposits and withdrawals per vault this week for Avant, Spark and Hypha',
  "savUSD's share price per day this month",
  'OpenTrade deposits and redemptions per pool this month',
  'Liquid staking inflows this week',
];
const OTHERS = [
  'What is the volume per DEX today?',
  'Who are the largest borrowers on Aave right now?',
  'USDC transfers per 5 minutes, count and volume',
  'Busiest senders in the last hour',
  'Active addresses per day this week',
  'Where did USDC go yesterday?',
];
const ask = (families: boolean) => systemPrompt({ chainId: 43114, chainName: 'Avalanche C-Chain', symbol: 'AVAX', schema: '', coverage: null, families });

describe('the families', () => {
  it("come from the registry: four vaults with their asset's decimals, OpenTrade's pools, sAVAX and CCTP", () => {
    expect(VAULTS.map((v) => `${v.protocol} ${v.symbol} ${v.decimals}/${v.shareDecimals}`)).toEqual(['Avant avUSD 18/18', 'Avant avBTC 18/18', 'Spark USDC 6/6', 'Hypha WAVAX 18/18']);
    expect(OPENTRADE_POOLS.length).toBe(35);
    expect(SAVAX).toBe('0x2b2c81e08f1af8835a78bb2a90ae924ace0ea4be');
    for (const a of Object.values(CCTP)) expect(a).toMatch(/^0x[0-9a-f]{40}$/);
    expect(FAMILY_LISTS.vaults).toHaveLength(4);
    expect(FAMILY_LISTS.ot_eur_pools).toHaveLength(5);
  });

  it('name each contract, list and topic in a form the query service reads', () => {
    for (const [name, value] of Object.entries(FAMILY_NAMES)) {
      if (name === 'ot_pools') expect(value).toMatch(/^arrayMap\(x -> base64Decode\(x\), \['[A-Za-z0-9+/]{27}=?'(,'[A-Za-z0-9+/]{27}=?')*\]\)$/);
      else if (name === 'cctp_domains') expect(value).toMatch(/^map\(toUInt32\(0\), 'Ethereum', 1, 'Avalanche', /);
      else if (name === 'vault_decimals' || name === 'vault_share_decimals') expect(value).toMatch(/^\[\d+(, \d+){3}\]$/);
      else if (name === 'vault_prices') expect(value).toBe("['usd','btc','usd','avax']");
      else if (name === 'vaults' || name === 'ot_eur_pools') expect(value).toMatch(/^\[unhex\('[0-9a-f]{40}'\)(, unhex\('[0-9a-f]{40}'\))*\]$/);
      else expect(value, name).toMatch(/^unhex\('([0-9a-f]{40}|[0-9a-f]{64})'\)$/);
    }
  });
});

describe('a question about vaults, staking or bridges', () => {
  it('names one of them, on the mainnet C-Chain only', () => {
    for (const q of FAMILY) expect(familyQuestion(43114, q), q).toBe(true);
    for (const q of OTHERS) expect(familyQuestion(43114, q), q).toBe(false);
    for (const chainId of [43113, 432204, 1]) expect(familyQuestion(chainId, FAMILY[0])).toBe(false);
    // a follow-up keeps it when an earlier turn read their contracts
    expect(familyQuestion(43114, 'make it weekly', [{ prompt: 'x', sql: 'SELECT 1 FROM raw_logs WHERE address = savax_token' }])).toBe(true);
    expect(familyQuestion(43114, 'make it weekly', [{ prompt: 'x', sql: "SELECT px['savax'] FROM lpx" }])).toBe(false);
  });

  it('gets the chapter, and every other prompt stays as it was', () => {
    const plain = ask(false);
    const families = ask(true);
    expect(plain).not.toContain('## Vaults, staking and bridges');
    expect(families).toContain('## Vaults, staking and bridges');
    expect(families.startsWith(plain.slice(0, plain.indexOf('## Query rules')))).toBe(true);
    expect(promptVersion(43114, false, false, true)).not.toBe(promptVersion(43114));
    expect(promptVersion(43114, true, true, false)).toBe(promptVersion(43114, true, true));
    for (const chainId of [43113, 432204]) expect(systemPrompt({ chainId, chainName: 'x', symbol: 'AVAX', schema: '', coverage: null, families: true })).not.toContain('## Vaults');
    for (const q of FAMILY.slice(0, 3)) expect(dexQuestion(43114, q) || lendingQuestion(43114, q), q).toBe(false);
  });
});

describe('the family worked examples', () => {
  const prompt = ask(true);
  const chapter = prompt.slice(prompt.indexOf('AVAX staked into sAVAX and redeemed per day this week'), prompt.indexOf('The 15 token contracts with the most transfers'));
  const lines = chapter.split('\n');
  const example = (l: string) => /^(\$PRICES\(|SELECT |WITH )/.test(l);
  const row = { day: '2026-09-27', vault_address: VAULTS[0].vault };

  it('are five, and two of them open into their records', () => {
    expect(lines.filter(example)).toHaveLength(5);
    expect(lines.filter((l) => l.startsWith('drill: '))).toHaveLength(2);
  });

  it('pass the guard, name no expression after a column, fit the query service with the names, and pass its screen', async () => {
    const sqls = lines.flatMap((l) => {
      if (example(l)) return [l];
      if (!l.startsWith('drill: ')) return [];
      const d = fillDrill(l.slice(7), row);
      return d.ok ? [d.sql] : [`not filled: ${d.error}`];
    });
    expect(sqls).toHaveLength(7);
    for (const sql of sqls) {
      const g = guardSql(sql, 43114);
      expect(g.ok ? '' : `${g.error}: ${sql.slice(0, 80)}`).toBe('');
      if (!g.ok) continue;
      expect(shadowedAlias(g.sql, true), sql.slice(0, 80)).toBeNull();
      const out = await withSources(g.sql, 43114);
      expect(Buffer.byteLength(out.sql)).toBeLessThanOrEqual(SQL_BUDGET);
      expect(SCREEN.test(out.sql), sql.slice(0, 80)).toBe(false);
      // every name the query reads is defined in front of it
      for (const name of Object.keys(FAMILY_NAMES)) if (new RegExp(`\\b${name}\\b`).test(g.sql)) expect(out.sql, name).toContain(` AS ${name}`);
      // a token amount keeps its digits, and only dollars round
      expect(unitName(sql, 43114), sql.slice(0, 80)).toBeNull();
    }
  });
});

describe('a question that names one of their protocols', () => {
  it('is answered from its contracts, read by address or by a list the server names', () => {
    const scope = (sql: string, q: string) => protocolScope(sql, [q], 43114);
    const vault = "SELECT count() AS n FROM raw_logs WHERE chain_id = 43114 AND block_time >= toMonday(now()) AND has(vaults, address) AND topic0 = vault_deposit_t";
    expect(scope(vault, 'Avant deposits this week')).toBeNull();
    expect(scope("SELECT count() AS n FROM raw_logs WHERE chain_id = 43114 AND block_time >= toMonday(now()) AND topic0 = vault_deposit_t", 'Avant deposits this week')).toMatch(/^the question names Avant, and the query reads none of Avant's contracts/);
    expect(scope("SELECT count() AS n FROM raw_logs WHERE chain_id = 43114 AND block_time >= toMonday(now()) AND has(ot_pools, address)", 'OpenTrade deposits this month')).toBeNull();
    expect(scope("SELECT count() AS n FROM raw_logs WHERE chain_id = 43114 AND block_time >= toStartOfDay(now()) AND address = cctp_messenger_v2", 'Circle CCTP transfers today')).toBeNull();
  });
});

describe('a family query that types a literal', () => {
  const refused = (sql: string, chainId = 43114) => {
    const g = guardSql(sql, chainId);
    return g.ok ? '' : g.error;
  };
  const q = (where: string) => `SELECT count() AS n FROM raw_logs WHERE chain_id = 43114 AND block_time >= toMonday(now()) AND ${where}`;
  const stray = "unhex('2a211ad4a59ab9d003852404f9c57c690704ee755f3c79d2c2812ad32da99df8')";

  it('is refused when it defines a name of ours, writes one of our contracts a few digits off, or a topic none of them has', () => {
    expect(refused(`WITH unhex('${SAVAX.slice(2)}') AS savax_token ${q('address = savax_token AND topic0 = submitted_t')}`)).toMatch(/^savax_token is a name our server defines in front of the query; a WITH of your own may not define it/);
    expect(refused(q(`address = unhex('${SAVAX.slice(2, 8)}${'0'.repeat(34)}')`))).toMatch(/^unhex\('2b2c8100…000000'\) is not Benqi's sAVAX, whose address our server names savax_token: write savax_token, as it is$/);
    // ICM's SendCrossChainMessage, which the base prompt writes out, on a CCTP messenger
    expect(refused(q(`address = cctp_messenger_v2 AND topic0 = ${stray}`))).toMatch(/^unhex\('2a211ad4…a99df8'\) is no event of these contracts: .* cctp_burn_v1_t, cctp_burn_v2_t/);
  });

  it('passes our names, their events written out right, and a lending event read beside them', () => {
    expect(refused(q('address = savax_token AND topic0 IN (submitted_t, savax_redeem_t)'))).toBe('');
    expect(refused(q(`address = cctp_messenger_v2 AND topic0 = unhex('0c8c1cbdc5190613ebd485511d4e2812cfa45eecb79d845893331fedad5130a5')`))).toBe('');
    expect(refused(q(`has(ot_pools, address) AND topic0 IN (ot_rate_t, ot_rate_old_t)`))).toBe('');
    expect(refused(q(`address = savax_token AND topic0 = unhex('ddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef')`))).toBe('');
    // the cancel and the overdue of an unlock, by our names
    expect(refused(q('address = savax_token AND topic0 IN (savax_cancel_t, savax_overdue_t)'))).toBe('');
    // an event the contract logs, written out: sAVAX's UnlockCancelled (the r6 audit's L02 truth)
    expect(refused(q(`address = savax_token AND topic0 = unhex('7e4a9502fd577f76f1dc8c9c8f63196816f7c1bd73c6db99f888e8d7bb2f8998')`))).toBe('');
    expect(refused(q(`address IN (savax_token, aave_pool) AND topic0 IN (unhex('efefaba5e921573100900a3ad9cf29f222d995fb3b6045797eaea7521bd8d6f0'), unhex('bb0070894135d02edfa550b04d7e5e141aa8090b46e57597ad45bfedd6554498'))`))).toBe('');
    // any other chain keeps its behavior
    expect(refused(q(`address = cctp_messenger_v2 AND topic0 = ${stray}`).replace('43114', '43113'), 43113)).toBe('');
  });
});
