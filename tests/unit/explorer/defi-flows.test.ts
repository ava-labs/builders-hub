import { describe, expect, it } from 'vitest';

import registry from '@/data/contract-registry.json';
import {
  labelOf,
  largestMoves,
  largestSql,
  pairsSql,
  registryIndex,
  summarize,
  symbolOf,
  type MoveRow,
  type PairRow,
  type RegistryContract,
} from '@/lib/defi/flows';

const AAVE = 'a97684ead0e402dc232d5a977953df7ecbab3cdb';
const AAVE_2 = '794a61358d6845594f94dc1db02a252b5b4814ad';
const BENQI = '8729438eb15e2c8b576fcc6aecda6a148776c0f5';
const ROUTER = '60ae616a2155ee3d9a68541ba4544862310933d4';
const BOT = '631fca4a0000000000000000aaaaaaaa0000beef';
const WALLET_PROXY = 'ee7ae85f0000000000000000bbbbbbbb0000cafe';
const TOKEN = 'b97ef9ef8734c71904d8002f8b6bc66dd9c48a6e';
const EOA = '1111111111111111111111111111111111111111';
const EOA_2 = '2222222222222222222222222222222222222222';

const contracts: RegistryContract[] = [
  { address: `0x${AAVE}`, name: 'Aave Pool', protocol: 'Aave V2 & V3', category: 'lending', type: 'controller' },
  { address: `0x${AAVE_2}`, name: 'Aave Pool V3', protocol: 'Aave', category: 'lending', type: 'controller' },
  { address: `0x${BENQI}`, name: 'Benqi', protocol: 'BENQI', category: 'lending', type: 'controller' },
  { address: `0x${ROUTER}`, name: 'Joe Router', protocol: 'LFJ (fka Trader Joe)', category: 'dex', type: 'router' },
  { address: `0x${BOT}`, name: 'Arb bot', protocol: 'Selini Capital', category: 'dex', type: 'other', subcategory: 'arbitrage' },
  { address: `0x${WALLET_PROXY}`, name: 'Proxy', protocol: 'Infrastructure', category: 'infrastructure', type: 'other' },
  { address: `0x${TOKEN}`, name: 'USDC', protocol: 'Circle', category: 'token', type: 'token' },
  // 39 hex digits: a typo in the registry, skipped
  { address: '0x835866d37afb8cb8f8334dccdaf66cf01832ff5', name: 'qiDAI', protocol: 'Benqi', category: 'lending', type: 'pool' },
];
const index = registryIndex(contracts);

describe('registryIndex', () => {
  it('labels protocols, folds bots into MEV and treats wallets and tokens as wallets', () => {
    expect(index.labels.size).toBe(7);
    expect(labelOf(index, AAVE)).toEqual({ name: 'Aave', category: 'lending', kind: 'protocol' });
    expect(labelOf(index, `0x${BENQI.toUpperCase()}`)).toMatchObject({ name: 'Benqi', kind: 'protocol' });
    expect(labelOf(index, ROUTER).name).toBe('Trader Joe');
    expect(labelOf(index, BOT).kind).toBe('mev');
    expect(labelOf(index, WALLET_PROXY).kind).toBe('wallet');
    expect(labelOf(index, TOKEN).kind).toBe('wallet');
    expect(labelOf(index, EOA)).toMatchObject({ kind: 'wallet', name: 'Wallets' });
    expect(labelOf(index, '')).toMatchObject({ kind: 'wallet' });
  });

  it('encodes each contract as its 4-byte key, bytes 12 to 15', () => {
    const keys = Buffer.from(index.keys, 'base64').toString('hex').match(/.{8}/g);
    expect(keys).toContain(AAVE.slice(24, 32));
    expect(keys).toHaveLength(7);
  });

  it('keeps the real registry under the 8 KB query cap', () => {
    const real = registryIndex(registry.contracts as RegistryContract[]);
    expect(real.labels.size).toBeGreaterThan(400);
    expect(Buffer.byteLength(pairsSql(real.keys, 168))).toBeLessThan(8192);
    expect(Buffer.byteLength(largestSql(real.keys, 168, 300))).toBeLessThan(8192);
  });
});

describe('summarize', () => {
  const rows: PairRow[] = [
    { src: '', dst: AAVE, cls: 'usd', usd: 100, n: 1 }, // a deposit
    { src: AAVE_2, dst: '', cls: 'avax', usd: 40, n: 1 }, // a withdrawal, from the same protocol under an alias
    { src: AAVE, dst: AAVE_2, cls: 'usd', usd: 999, n: 1 }, // inside Aave: not a flow
    { src: BOT, dst: ROUTER, cls: 'usd', usd: 500, n: 3 }, // an MEV bot: left out
    { src: WALLET_PROXY, dst: '', cls: 'usd', usd: 70, n: 1 }, // wallet to wallet: not a flow
    { src: WALLET_PROXY, dst: BENQI, cls: 'usd', usd: 30, n: 1 }, // a smart wallet deposits into Benqi
    { src: AAVE, dst: ROUTER, cls: 'usd', usd: 10, n: 1 }, // protocol to protocol
  ];
  const s = summarize(rows, index, 24);

  it('counts the MEV share against the labeled gross, and leaves it out', () => {
    expect(s.gross).toBe(100 + 40 + 500 + 30 + 10);
    expect(s.mev).toBe(500);
  });

  it('sums each category and protocol, with the stablecoin part apart', () => {
    const lending = s.categories.find((c) => c.category === 'lending')!;
    expect(lending).toMatchObject({ inflow: 130, outflow: 50, net: 80, stableNet: 120 });
    const aave = s.protocols.find((p) => p.name === 'Aave')!;
    expect(aave).toMatchObject({ inflow: 100, outflow: 50, net: 50, category: 'lending' });
    expect(s.protocols.find((p) => p.name === 'Trader Joe')).toMatchObject({ inflow: 10, outflow: 0 });
  });

  it('draws edges between categories, with wallets on either side', () => {
    expect(s.edges).toEqual(
      expect.arrayContaining([
        { source: 'wallet', target: 'lending', usd: 130 },
        { source: 'lending', target: 'wallet', usd: 40 },
        { source: 'lending', target: 'dex', usd: 10 },
      ]),
    );
  });
});

describe('largestMoves', () => {
  const row = (tx: string, from: string, to: string, usd: number, token = TOKEN): MoveRow => ({
    time: '2026-09-25 13:44:02',
    tx,
    log_index: 0,
    token,
    from_addr: from,
    to_addr: to,
    usd,
  });

  it('keeps the biggest leg of each transaction and names the direction', () => {
    const moves = largestMoves(
      [
        row('aa', EOA, AAVE, 50),
        row('aa', EOA, AAVE, 900),
        row('bb', AAVE, EOA_2, 700),
        row('cc', BOT, AAVE, 5000),
        row('dd', AAVE, AAVE_2, 800),
        row('ee', EOA, EOA_2, 600),
        row('ff', AAVE, BENQI, 300),
      ],
      index,
    );
    expect(moves.map((m) => [m.tx, m.usd, m.direction])).toEqual([
      ['0xaa', 900, 'in'],
      ['0xbb', 700, 'out'],
      ['0xff', 300, 'between'],
    ]);
    expect(moves[0]).toMatchObject({ token: 'USDC', from: { name: null, address: `0x${EOA}` }, to: { name: 'Aave', category: 'lending' } });
  });

  it('names the priced tokens', () => {
    expect(symbolOf('0xB31F66AA3C1E785363F0875A1B74E27B85FD66C7')).toBe('WAVAX');
    expect(symbolOf('0xdead')).toBe('token');
  });
});
