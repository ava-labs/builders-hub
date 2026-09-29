import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/clickhouse/client', () => ({ withQuerySlot: vi.fn() }));

import { paddedAddress, unpadAddresses } from '@/lib/explorer-query/clickhouse';
import { fillDrill } from '@/lib/explorer-query/enrich';
import { guardSql, shadowedAlias } from '@/lib/explorer-query/guard';
import { expandMacros } from '@/lib/explorer-query/macros';
import { pchainPrompt, systemPrompt } from '@/lib/explorer-query/prompt';

const LOGS = "FROM raw_logs WHERE chain_id = 43114 AND block_time >= now() - INTERVAL 1 DAY";
const TOPIC = "unhex('ddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef')";

/** a DEX example's shorthand written out, as the guard writes it */
function expandDex(sql: string): string {
  const x = expandMacros(sql, 43114);
  if (!x.ok) throw new Error(x.error);
  return x.sql;
}

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

describe('the flow and finite-value rules', () => {
  const prompt = (chainId: number, dex = false) => systemPrompt({ chainId, chainName: 'a chain', symbol: 'AVAX', schema: '', coverage: null, dex });
  const FINITE = 'Divide by nullIf(x, 0), and wrap a ratio or a quantile in ifNotFinite(x, NULL)';

  it('ask for sender and receiver pairs on the mainnet C-Chain only', () => {
    for (const p of [prompt(43114), prompt(43114, true)]) expect(p).toContain('\n- Flows: when the question asks where value went, from whom or to whom');
    for (const p of [prompt(43113), prompt(432204)]) expect(p).not.toContain('- Flows:');
  });

  it("give the active-address note to an answer that counts them, and leave Fuji's rule as it was", () => {
    // a replay of L02 (Aave's largest borrowers) ended its note on active addresses
    for (const p of [prompt(43114), prompt(43114, true), prompt(432204)]) {
      expect(p).toContain('An answer whose query counts active addresses (this uniqExactArray over raw_txs) says in its note');
      expect(p).toContain('An answer about other addresses (borrowers, depositors, holders, senders of a token) never says it.');
    }
    expect(prompt(43113)).toContain('An answer about active addresses says in its note that they are the senders and recipients of transactions');
    expect(prompt(43113)).not.toContain('borrowers, depositors');
  });

  it('guard every division on each EVM chain but Fuji, whose prompt stays as it was, and say so once', () => {
    for (const p of [prompt(43114), prompt(43114, true), prompt(432204)]) expect(p.split(FINITE)).toHaveLength(2);
    expect(prompt(43113)).not.toContain('nullIf(x, 0)');
  });
});

describe('the DEX chapter', () => {
  it('writes its swap drills with the Swap topic names $POOLS defines, not their hex', () => {
    // qlatency, 2026-09-29: hex topic literals were 218 of a DEX answer's 969 output tokens (median), about 1 s of writing
    const p = systemPrompt({ chainId: 43114, chainName: 'Avalanche C-Chain', symbol: 'AVAX', schema: '', coverage: null, dex: true });
    const drills = p.split('\n').filter((l) => l.startsWith('drill: ') && l.includes('v2_swap, v3_swap, lb_swap, v4_swap'));
    expect(drills.length).toBeGreaterThanOrEqual(3);
    for (const d of drills) {
      expect(d).toMatch(/^drill: \$POOLS\(/);
      expect(d).not.toContain("unhex('");
    }
  });
});

describe('the NFT and new-contract rules', () => {
  const prompt = (chainId: number, dex = false) => systemPrompt({ chainId, chainName: 'a chain', symbol: 'AVAX', schema: '', coverage: null, dex });

  it('read both NFT standards and every creation call on each EVM chain but Fuji, whose prompt stays as it was', () => {
    // the night audit's G13 ranked ERC-721 collections alone, and its G18 counted the transactions that deploy a contract
    for (const p of [prompt(43114), prompt(43114, true), prompt(432204)]) {
      expect(p.split("TransferSingle unhex('c3d58168c5ae7397731d063d5bbf3d657854427343f4c083240f7aacaa2d0f62')")).toHaveLength(2);
      expect(p).toContain("TransferBatch unhex('4a39dc06d4c0dbc64b70af90fd698a233a518aa5d07e595d983b8c0526c8f7fb')");
      expect(p).toContain("Count them with startsWith(call_type, 'CREAT') AND tx_success");
    }
    expect(prompt(43113)).not.toContain('TransferSingle');
    expect(prompt(43113)).not.toContain("'CREAT'");
  });

  it('leave the zero address out of a token\'s wallets, and keep a contract\'s plain transfers in its count', () => {
    // the L1 audit's L16 counted mints as sends and called an ERC-721's transfers ERC-20; its L05 dropped plain transfers
    for (const p of [prompt(43114), prompt(43419)]) {
      expect(p).toContain("uniqExactIf(topic1, topic1 != unhex(repeat('00', 32)))");
      expect(p).toContain('HAVING countIf(length(input) >= 4) > 0');
    }
    expect(prompt(43113)).not.toContain('Mints and burns');
    expect(prompt(43113)).not.toContain('Contracts by transactions');
  });

  it('teaches a creation filter the guard passes', () => {
    const sql = "SELECT count() AS new_contracts FROM raw_traces WHERE chain_id = 43114 AND block_time >= now() - INTERVAL 24 HOUR AND startsWith(call_type, 'CREAT') AND tx_success";
    expect(guardSql(sql, 43114).ok).toBe(true);
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
