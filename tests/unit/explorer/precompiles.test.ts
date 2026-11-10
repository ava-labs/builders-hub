import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { precompileValue } from '@/components/explorer-v2/evm/format';
import { EvmTxStory } from '@/components/explorer-v2/evm/EvmTxStory';
import { TxLogs } from '@/components/explorer-v2/evm/TxLogs';
import { knownAddress } from '@/lib/evm-explorer';
import { precompileActs, type PrecompileAct } from '@/lib/precompiles';
import { decodeEventWithAbi, decodeFunctionWithAbi } from '@/lib/sourcify-client';
import { storyOf, type StoryInput } from '@/lib/tx-story';

const DEPLOYER_LIST = '0x0200000000000000000000000000000000000000';
const MINTER = '0x0200000000000000000000000000000000000001';
const TX_LIST = '0x0200000000000000000000000000000000000002';
const FEES = '0x0200000000000000000000000000000000000003';
const REWARDS = '0x0200000000000000000000000000000000000004';
const WARP = '0x0200000000000000000000000000000000000005';
const TELEPORTER = '0x253b2784c75e510dd0ff1da844684a1ac0aa5fcf';
const word = (hex: string) => `0x${hex.replace(/^0x/, '').padStart(64, '0')}`;

/* Real receipts, as the explorer API serves them. */

// StraitsX (5566) 0x06ab06d5…d375: the sender minted 1,000 STX to another account
const MINT = {
  from: '0x9c7a8c47fecef5db19fa3c927232f3737d389a9c',
  to: MINTER,
  input: '0x4f5aaaba0000000000000000000000008cc4d23d8556fdb5875f17b6d6d7149380f24d9300000000000000000000000000000000000000000000003635c9adc5dea00000',
  success: true,
  logs: [
    {
      address: MINTER,
      topics: ['0x400cd392f3d56fd10bb1dbd5839fdda8298208ddaa97b368faa053e1850930ee', word('9c7a8c47fecef5db19fa3c927232f3737d389a9c'), word('8cc4d23d8556fdb5875f17b6d6d7149380f24d93')],
      data: word('3635c9adc5dea00000'),
    },
  ],
};

// Beam (4337) 0x55a67466…7608: setFeeConfig, gas limit 8M to 25M, denominator 72 to 36
const FEE_CONFIG = [0x7a1200, 2, 0xe8d4a51000, 0x2faf080, 0x48, 0, 0x5f5e100, 0x989680];
const NEW_CONFIG = [0x17d7840, 2, 0xe8d4a51000, 0x2faf080, 0x24, 0, 0x5f5e100, 0x989680];
const FEE_CHANGE = {
  from: '0x277280e8337e64a3a8e8b795d4e8e5e00bf6e203',
  to: FEES,
  input: `0x8f10b586${NEW_CONFIG.map((n) => word(n.toString(16)).slice(2)).join('')}`,
  success: true,
  logs: [
    {
      address: FEES,
      topics: ['0x4c98e43adb5962c18f3f0e6dd066e2a2de258d3b4f695b317b77c8f27cd044fc', word('277280e8337e64a3a8e8b795d4e8e5e00bf6e203')],
      data: `0x${[...FEE_CONFIG, ...NEW_CONFIG].map((n) => word(n.toString(16)).slice(2)).join('')}`,
    },
  ],
};

// Watr (192) 0xdb30ab72…98fc: setManager on the Fee Manager, from no role
const ROLE = {
  from: '0xd943b4da31bc25c0faff75954dd6892480d4138e',
  to: FEES,
  input: '0xd0ebdbe7000000000000000000000000467020aecaa21ff9b113727b9f250c827aa3f205',
  success: true,
  logs: [
    {
      address: FEES,
      topics: ['0xcdb7ea01f00a414d78757bdb0f6391664ba3fedf987eed280927c1e7d695be3e', word('3'), word('467020aecaa21ff9b113727b9f250c827aa3f205'), word('d943b4da31bc25c0faff75954dd6892480d4138e')],
      data: word('0'),
    },
  ],
};

// Beam (4337) 0x19c201b0…07c1, Gunzilla (43419) 0x39e8768d…f12a, Tixchain (13790) 0xc2fe647f…0c98
const rewardTx = (from: string, input: string, topics: string[]) => ({ from, to: REWARDS, input, success: true, logs: [{ address: REWARDS, topics, data: '0x' }] });
const REWARD_ADDRESS = rewardTx('0x155e596a3901d937902c72f49a24a2815ec94f8a', '0x5e00e67900000000000000000000000039c694a6f5c2987b9ce12fdc037b8d5e3c026aec', [
  '0xc2a9e07cba6f4920acaa5933bd0406949d5dbef7ee698e786ea23e8708f32a6c',
  word('155e596a3901d937902c72f49a24a2815ec94f8a'),
  word('0'),
  word('39c694a6f5c2987b9ce12fdc037b8d5e3c026aec'),
]);
const FEE_RECIPIENTS = rewardTx('0x02d16347ba80b1d5813850d4336e2f702212bc51', '0x0329099f', ['0xabb1949bd129fef9b84601a48aee89d600d90074ca10216a02ce43996be55991', word('02d16347ba80b1d5813850d4336e2f702212bc51')]);
const BURN = rewardTx('0xf735bde1ebc62b3d45e64fe302216da6368dec36', '0xbc178628', ['0xeb121f0335efe8f4b8ebef7793c18c171834696989656a8c345acc558359fabf', word('f735bde1ebc62b3d45e64fe302216da6368dec36')]);

// Beam (4337) 0x938298b8…992c, 2023, before Durango: setEnabled on the Transaction Allow List, and no log
const BEFORE_LOGS = { from: '0x277280e8337e64a3a8e8b795d4e8e5e00bf6e203', to: TX_LIST, input: '0x0aaf704300000000000000000000000088665b09c93a0c5cd908fbc685e57f53206d1639', success: true, logs: [] };

// Fuji C-Chain 0x782d411d…3e38: Teleporter sent a message, which the Warp precompile logged
// (its message cut to four bytes here)
const WARP_SEND = {
  from: '0xe16560b47eff6332ec81e436051aeb1a6e8a4006',
  to: TELEPORTER,
  input: '0x62448850',
  success: true,
  logs: [
    {
      address: WARP,
      topics: ['0x56600c567728a800c0aa927500f831cb451df66a7af570eb4df4dfbf4674887d', word(TELEPORTER), '0xd4308f1affe313aaaa832f67e46341fc3530c6b33c499e5f3eb68a56b4c5e67b'],
      data: `${word('20')}${word('4').slice(2)}${'ab'.padEnd(64, '0')}`,
    },
  ],
};

const story = (tx: { from: string; to: string }, acts: PrecompileAct[], more: Partial<StoryInput> = {}) =>
  storyOf({ actor: tx.from, to: tx.to, success: true, nativeNet: 0n, transfers: [], eventNames: [], targetIsToken: false, methodName: null, acts, ...more });

const text = (html: string) => html.replace(/<[^>]+>/g, '').replace(/&#x27;/g, "'");

describe('the precompiles', () => {
  it('are named on an L1, and on the C-Chain only the Warp Messenger is', () => {
    expect(knownAddress(MINTER, '5566')?.label).toBe('Native Minter');
    expect(knownAddress(DEPLOYER_LIST, 4337)?.label).toBe('Contract Deployer Allow List');
    expect(knownAddress(REWARDS, '13790')?.abi).toBeDefined();
    expect(knownAddress(MINTER, '43114')).toBeUndefined();
    expect(knownAddress(FEES, '43113')).toBeUndefined();
    expect(knownAddress(WARP, '43114')?.label).toBe('Warp Messenger');
    // with no chain, a precompile is not named, and the fixtures still are
    expect(knownAddress(MINTER)).toBeUndefined();
    expect(knownAddress('0x0100000000000000000000000000000000000000')?.label).toBe('Burn Address');
  });

  it('decode their calls and logs through the verified-ABI decoders, a tuple field by field', () => {
    const call = decodeFunctionWithAbi(knownAddress(MINTER, '5566')?.abi, MINT.input);
    expect(call?.name).toBe('mintNativeCoin');
    expect(call?.params.map((p) => [p.name, p.value])).toEqual([
      ['addr', '0x8CC4D23D8556Fdb5875F17b6d6D7149380F24D93'],
      ['amount', '1000000000000000000000'],
    ]);
    const ev = decodeEventWithAbi(knownAddress(FEES, '4337')?.abi, FEE_CHANGE.logs[0]);
    expect(ev?.name).toBe('FeeConfigChanged');
    expect(ev?.params[1].components?.slice(0, 2)).toEqual([
      { name: 'gasLimit', type: 'uint256', value: '8000000' },
      { name: 'targetBlockRate', type: 'uint256', value: '2' },
    ]);
    expect(ev?.params[2].components?.[0].value).toBe('25000000');
  });

  it('read a mint from its log', () => {
    expect(precompileActs('5566', MINT)).toEqual([{ kind: 'mint', at: MINTER, by: MINT.from, to: '0x8cc4d23d8556fdb5875f17b6d6d7149380f24d93', amount: 1000n * 10n ** 18n }]);
  });

  it('read a fee change field by field, what it was beside what it is', () => {
    const [act] = precompileActs('4337', FEE_CHANGE);
    expect(act.kind).toBe('fees');
    if (act.kind !== 'fees') return;
    expect(act.fields).toHaveLength(8);
    expect(act.fields.filter((f) => f.was !== f.now)).toEqual([
      { name: 'gasLimit', was: 8_000_000n, now: 25_000_000n },
      { name: 'baseFeeChangeDenominator', was: 72n, now: 36n },
    ]);
  });

  it('read roles, reward settings and Warp sends from their logs', () => {
    expect(precompileActs('192', ROLE)).toEqual([{ kind: 'role', at: FEES, by: ROLE.from, account: '0x467020aecaa21ff9b113727b9f250c827aa3f205', role: 3, was: 0 }]);
    expect(precompileActs('4337', REWARD_ADDRESS)).toEqual([
      { kind: 'rewardAddress', at: REWARDS, by: REWARD_ADDRESS.from, to: '0x39c694a6f5c2987b9ce12fdc037b8d5e3c026aec', was: '0x0000000000000000000000000000000000000000' },
    ]);
    expect(precompileActs('43419', FEE_RECIPIENTS)).toEqual([{ kind: 'feeRecipients', at: REWARDS, by: FEE_RECIPIENTS.from }]);
    expect(precompileActs('13790', BURN)).toEqual([{ kind: 'burnFees', at: REWARDS, by: BURN.from }]);
    expect(precompileActs('43113', WARP_SEND)).toEqual([{ kind: 'warp', at: WARP, by: TELEPORTER }]);
  });

  it('read a direct call from its calldata when the chain logged nothing', () => {
    expect(precompileActs('4337', BEFORE_LOGS)).toEqual([{ kind: 'role', at: TX_LIST, by: BEFORE_LOGS.from, account: '0x88665b09c93a0c5cd908fbc685e57f53206d1639', role: 1, was: null }]);
    const [act] = precompileActs('4337', { ...FEE_CHANGE, logs: [] });
    expect(act.kind === 'fees' && act.fields.map((f) => [f.name, f.was, f.now]).slice(0, 2)).toEqual([
      ['gasLimit', null, 25_000_000n],
      ['targetBlockRate', null, 2n],
    ]);
  });

  it('find nothing in a reverted call, or at a Native Minter address on the C-Chain', () => {
    expect(precompileActs('5566', { ...MINT, success: false })).toEqual([]);
    expect(precompileActs('43114', MINT)).toEqual([]);
  });
});

describe('the story of a precompile call', () => {
  it('tells a mint as the minted coin, from the sender or through a contract', () => {
    const direct = story(MINT, precompileActs('5566', MINT));
    expect(direct).toMatchObject({ verb: 'mint', primary: { token: null, amount: 1000n * 10n ** 18n }, direct: true });
    const viaContract = story({ from: '0x1111111111111111111111111111111111111111', to: TELEPORTER }, precompileActs('5566', MINT));
    expect(viaContract).toMatchObject({ verb: 'mint', direct: false, counterparty: TELEPORTER });
  });

  it('tells a new role or setting as a configure, ahead of any asset it moved', () => {
    expect(story(ROLE, precompileActs('192', ROLE)).verb).toBe('configure');
    const withSend = story(BURN, precompileActs('13790', BURN), { nativeNet: -5n });
    expect(withSend.verb).toBe('configure');
    expect(withSend.acts).toHaveLength(1);
  });

  it('tells a bare Warp send as a message, and one that moved assets as a bridge', () => {
    const acts = precompileActs('43113', WARP_SEND);
    expect(story(WARP_SEND, acts, { eventNames: ['SendCrossChainMessage', 'SendWarpMessage'] })).toMatchObject({ verb: 'message', direct: false });
    expect(story(WARP_SEND, acts, { eventNames: ['SendWarpMessage'], nativeNet: -10n }).verb).toBe('bridge');
  });

  it('reads it in words, with the amount in the native coin and a fee change field by field', () => {
    const tokens = new Map();
    const render = (s: ReturnType<typeof story>, actor: string, chainId: string, symbol: string) =>
      text(renderToStaticMarkup(createElement(EvmTxStory, { story: s, actor, chainId, base: '/explorer/mainnet/l1', symbol, tokens, usd: null, counts: { transfers: 0, events: 1, calls: null } })));
    expect(render(story(MINT, precompileActs('5566', MINT)), MINT.from, '5566', 'STX')).toContain('0x9c7a8c47fe…9a9c minted 1,000STX to 0x8cc4d23d85…4d93');
    const fees = render(story(FEE_CHANGE, precompileActs('4337', FEE_CHANGE)), FEE_CHANGE.from, '4337', 'BEAM');
    expect(fees).toContain('changed the fee config on Fee Manager');
    expect(fees).toContain('Gas limit8,000,000→25,000,000');
    expect(fees).not.toContain('Target block rate');
    expect(render(story(ROLE, precompileActs('192', ROLE)), ROLE.from, '192', 'WATR')).toContain('made 0x467020aeca…f205 a manager of Fee Manager (had no role)');
    expect(render(story(BEFORE_LOGS, precompileActs('4337', BEFORE_LOGS)), BEFORE_LOGS.from, '4337', 'BEAM')).toContain('enabled 0x88665b09c9…1639 on Transaction Allow List');
    expect(render(story(WARP_SEND, precompileActs('43113', WARP_SEND), { methodName: 'sendCrossChainMessage' }), WARP_SEND.from, '43113', 'AVAX')).toContain(
      'called sendCrossChainMessage on 0x253b2784c7…5fcf, which sent a Warp message',
    );
  });

  it('lists a precompile log with its event and arguments in the chain units', () => {
    const html = text(renderToStaticMarkup(createElement(TxLogs, { logs: MINT.logs.map((l, i) => ({ ...l, logIndex: i })), base: '/explorer/mainnet/straitsx', chainId: '5566', symbol: 'STX' })));
    expect(html).toContain('Native Minter');
    expect(html).toContain('NativeCoinMinted');
    expect(html).toContain('recipient0x8cc4d23d8556fdb5875f17b6d6d7149380f24d93');
    expect(html).toContain('amount1,000 STX');
  });
});

describe('a precompile value', () => {
  it('reads in the unit its name means', () => {
    expect(precompileValue('amount', 5_000_000_000n * 10n ** 18n, 'BEAM')).toBe('5,000,000,000 BEAM');
    expect(precompileValue('role', '2', 'BEAM')).toBe('Admin');
    expect(precompileValue('oldRole', '0', 'BEAM')).toBe('None');
    expect(precompileValue('minBaseFee', 25_000_000_000n, 'AVAX')).toBe('25.00 nAVAX');
    expect(precompileValue('minBaseFee', 1n, 'AVAX')).toBe('1 wei');
    expect(precompileValue('targetBlockRate', 2n, 'AVAX')).toBe('2 s');
    expect(precompileValue('gasLimit', 15_000_000n, 'AVAX')).toBe('15,000,000');
  });
});
