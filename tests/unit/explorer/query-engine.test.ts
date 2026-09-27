import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/clickhouse/client', () => ({ withQuerySlot: vi.fn() }));

import { paddedAddress, unpadAddresses } from '@/lib/explorer-query/clickhouse';
import { fillDrill } from '@/lib/explorer-query/enrich';
import { guardSql, shadowedAlias } from '@/lib/explorer-query/guard';
import { expandDex, pchainPrompt, systemPrompt } from '@/lib/explorer-query/prompt';

const LOGS = "FROM raw_logs WHERE chain_id = 43114 AND block_time >= now() - INTERVAL 1 DAY";
const TOPIC = "unhex('ddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef')";

/** every worked example and drill of a prompt, the drills filled with a placeholder's own name as its value */
function examples(prompt: string): string[] {
  return prompt.split('\n').flatMap((l) => {
    const sql = l.startsWith('drill: ') ? l.slice(7) : /^(WITH|SELECT|\$DEX\(|\$POOLS\()/.test(l) && !l.includes('$START') ? l : null;
    return sql ? [expandDex(sql).replace(/\{\{(\w+)(:bytes)?\}\}/g, (_m, c: string, b?: string) => (b ? `unhex('${'00'.repeat(20)}')` : `'${c}'`))] : [];
  });
}

describe('an alias that hides its column', () => {
  it('is refused when its WHERE or ON writes the name bare', () => {
    const sql = `SELECT hex(topic0) AS topic0, count() AS logs ${LOGS} AND topic0 IN (${TOPIC}) GROUP BY topic0`;
    expect(shadowedAlias(sql)).toBe('topic0');
    const g = guardSql(sql, 43114);
    expect(g.ok ? '' : g.error).toBe('the alias topic0 hides the column topic0, so its WHERE or ON reads the alias; give the alias another name');
    expect(shadowedAlias('WITH s AS (SELECT 1 AS pool) SELECT hex(s.pool) AS pool FROM s INNER JOIN p ON pool = p.pool')).toBe('pool');
    expect(shadowedAlias(`SELECT lower(concat('0x', hex(l.address))) AS address FROM raw_logs AS l WHERE l.chain_id = 43114 AND address = unhex('00')`)).toBe('address');
  });

  it('passes when the other mentions are qualified, in another SELECT, or only group and order', () => {
    expect(shadowedAlias(`SELECT hex(topic0) AS topic0, count() AS logs ${LOGS} AND raw_logs.topic0 IN (${TOPIC}) GROUP BY topic0 ORDER BY topic0`)).toBeNull();
    expect(shadowedAlias(`WITH a AS (SELECT topic0 ${LOGS} AND topic0 = ${TOPIC}) SELECT hex(topic0) AS topic0 FROM a`)).toBeNull();
    expect(shadowedAlias(`SELECT hex(address) AS address ${LOGS} AND raw_logs.address IN (SELECT address ${LOGS} AND topic0 = ${TOPIC})`)).toBeNull();
    // a column under its own name, a CAST inside, and an alias of another name
    expect(shadowedAlias('SELECT s.pool AS pool FROM s INNER JOIN p ON pool = p.pool')).toBeNull();
    expect(shadowedAlias(`SELECT hex(topic0) AS event_topic ${LOGS} AND topic0 = ${TOPIC}`)).toBeNull();
    expect(shadowedAlias(`SELECT CAST(block_number AS String) AS n ${LOGS} AND block_number > 1`)).toBeNull();
    // a string that reads like one is not one
    expect(shadowedAlias(`SELECT 'hex(topic0) AS topic0' AS s ${LOGS} AND topic0 = ${TOPIC}`)).toBeNull();
  });

  it('is in no worked example of any prompt, and every example still passes the guard', () => {
    const prompts: [number, string][] = [
      [43114, systemPrompt({ chainId: 43114, chainName: 'Avalanche C-Chain', symbol: 'AVAX', schema: '', coverage: null })],
      [43114, systemPrompt({ chainId: 43114, chainName: 'Avalanche C-Chain', symbol: 'AVAX', schema: '', coverage: null, dex: true })],
      [432204, systemPrompt({ chainId: 432204, chainName: 'Dexalot', symbol: 'ALOT', schema: '', coverage: null })],
      [1, pchainPrompt({ chainId: 1, network: 'mainnet', schema: '', coverage: null })],
    ];
    for (const [chainId, prompt] of prompts) {
      const sqls = examples(prompt);
      expect(sqls.length).toBeGreaterThan(5);
      for (const sql of sqls) {
        expect(shadowedAlias(sql)).toBeNull();
        const g = guardSql(sql, chainId);
        expect(g.ok ? '' : `${g.error}: ${sql.slice(0, 120)}`).toBe('');
      }
    }
  });
});

describe('an address read from a log topic', () => {
  const padded = (tail: string) => `0x${'0'.repeat(24)}${tail}`;

  it('shows its 20 bytes, the zero address and a vanity address among them', () => {
    expect(paddedAddress(padded('b97ef9ef8734c71904d8002f8b6bc66dd9c48a6e'))).toBe('0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e');
    expect(paddedAddress(padded('0'.repeat(40)))).toBe(`0x${'0'.repeat(40)}`);
    expect(paddedAddress(padded('0000000000001ff3684f28c67538d4d072c22734'))).toBe('0x0000000000001ff3684f28c67538d4d072c22734');
  });

  it('is never a 32-byte number, such as a v3 position id, nor a value in a column no address name marks', () => {
    expect(paddedAddress(padded(`${'0'.repeat(35)}1559b`))).toBeNull();
    const id = padded(`${'0'.repeat(35)}1559b`);
    const address = padded('b97ef9ef8734c71904d8002f8b6bc66dd9c48a6e');
    const rows: Record<string, unknown>[] = [{ token_id: address, topic2: address, token0: address, recipient: id, to_address: address, from: address, contract: address }];
    unpadAddresses(['token_id', 'topic2', 'token0', 'recipient', 'to_address', 'from', 'contract'].map((name) => ({ name, type: 'String' })), rows);
    expect(rows[0]).toEqual({ token_id: address, topic2: address, token0: address, recipient: id, to_address: address.replace(/^0x0{24}/, '0x'), from: address.replace(/^0x0{24}/, '0x'), contract: address.replace(/^0x0{24}/, '0x') });
  });
});

describe('a drill template', () => {
  it('keeps its placeholders apart from the alias screen', () => {
    const d = fillDrill(`SELECT block_time AS t ${LOGS} AND address = {{contract:bytes}}`, { contract: '0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e' });
    expect(d.ok && shadowedAlias(d.sql)).toBeNull();
  });
});
