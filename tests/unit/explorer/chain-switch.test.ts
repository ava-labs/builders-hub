import { describe, expect, it } from 'vitest';

import { chainSwitchTarget, switchTarget } from '@/components/explorer-v2/network-switch';
import { buildTabs } from '@/components/explorer-v2/subnav-tabs';

/* The chain switcher keeps the reader's tab where the target chain has it. It shares its rules with
   the Mainnet/Fuji switch (switchTarget in components/explorer-v2/network-switch.ts). MATRIX is every
   from-page, list and detail, times the switcher's rows: the reviewed output of chainSwitchTarget, cell by
   cell, against the routes and their guards. tests/e2e/explorer/chain-switch.e2e.ts clicks the real
   switcher for a part of it. Paths are below /explorer/. */

// The switcher's rows, in the order of each MATRIX row's landings. undefined is the All Networks row.
// Beam has a Fuji counterpart (beam-l1); Gunzilla is a Mainnet-only L1; AIB is an L1 with no RPC.
const ROWS: (string | undefined)[] = [undefined, 'c-chain', 'p-chain', 'x-chain', 'beam', 'gunzilla', 'aibmainnet'];

type Row = [from: string, fromChain: string | undefined, landings: string[]];

const MATRIX: Row[] = [
  // C-Chain, Mainnet
  ['mainnet/c-chain', 'c-chain', ['mainnet', 'mainnet/c-chain', 'mainnet/p-chain', 'mainnet/x-chain', 'mainnet/beam', 'mainnet/gunzilla', 'mainnet/aibmainnet']],
  ['mainnet/c-chain/address/0xabc', 'c-chain', ['mainnet', 'mainnet/c-chain/address/0xabc', 'mainnet/p-chain', 'mainnet/x-chain', 'mainnet/beam', 'mainnet/gunzilla', 'mainnet/aibmainnet']],
  ['mainnet/c-chain/blocks', 'c-chain', ['mainnet', 'mainnet/c-chain/blocks', 'mainnet/p-chain/blocks', 'mainnet/x-chain/blocks', 'mainnet/beam/blocks', 'mainnet/gunzilla/blocks', 'mainnet/aibmainnet']],
  ['mainnet/c-chain/block/123', 'c-chain', ['mainnet', 'mainnet/c-chain/block/123', 'mainnet/p-chain/blocks', 'mainnet/x-chain/blocks', 'mainnet/beam/blocks', 'mainnet/gunzilla/blocks', 'mainnet/aibmainnet']],
  ['mainnet/c-chain/txs', 'c-chain', ['mainnet', 'mainnet/c-chain/txs', 'mainnet/p-chain/txs', 'mainnet/x-chain/txs', 'mainnet/beam/txs', 'mainnet/gunzilla/txs', 'mainnet/aibmainnet']],
  ['mainnet/c-chain/tx/0xabc', 'c-chain', ['mainnet', 'mainnet/c-chain/tx/0xabc', 'mainnet/p-chain/txs', 'mainnet/x-chain/txs', 'mainnet/beam/txs', 'mainnet/gunzilla/txs', 'mainnet/aibmainnet']],
  ['mainnet/c-chain/txs/atomic', 'c-chain', ['mainnet', 'mainnet/c-chain/txs/atomic', 'mainnet/p-chain/txs', 'mainnet/x-chain/txs', 'mainnet/beam/txs', 'mainnet/gunzilla/txs', 'mainnet/aibmainnet']],
  ['mainnet/c-chain/atomic-tx/2Vicc', 'c-chain', ['mainnet', 'mainnet/c-chain/atomic-tx/2Vicc', 'mainnet/p-chain/txs', 'mainnet/x-chain/txs', 'mainnet/beam/txs', 'mainnet/gunzilla/txs', 'mainnet/aibmainnet']],
  ['mainnet/c-chain/txs/icm', 'c-chain', ['mainnet', 'mainnet/c-chain/txs/icm', 'mainnet/p-chain/txs', 'mainnet/x-chain/txs', 'mainnet/beam/txs/icm', 'mainnet/gunzilla/txs/icm', 'mainnet/aibmainnet']],
  ['mainnet/c-chain/gas', 'c-chain', ['mainnet', 'mainnet/c-chain/gas', 'mainnet/p-chain', 'mainnet/x-chain', 'mainnet/beam/gas', 'mainnet/gunzilla/gas', 'mainnet/aibmainnet']],
  ['mainnet/c-chain/gas/base-fee', 'c-chain', ['mainnet', 'mainnet/c-chain/gas/base-fee', 'mainnet/p-chain', 'mainnet/x-chain', 'mainnet/beam/gas/base-fee', 'mainnet/gunzilla/gas/base-fee', 'mainnet/aibmainnet']],
  ['mainnet/c-chain/query', 'c-chain', ['mainnet/query', 'mainnet/c-chain/query', 'mainnet/p-chain/query', 'mainnet/x-chain', 'mainnet/beam/query', 'mainnet/gunzilla/query', 'mainnet/aibmainnet']],
  ['mainnet/c-chain/query/boards', 'c-chain', ['mainnet/query', 'mainnet/c-chain/query/boards', 'mainnet/p-chain/query/boards', 'mainnet/x-chain', 'mainnet/beam/query/boards', 'mainnet/gunzilla/query/boards', 'mainnet/aibmainnet']],
  ['mainnet/c-chain/query/boards/b-1', 'c-chain', ['mainnet/query', 'mainnet/c-chain/query/boards/b-1', 'mainnet/p-chain/query/boards', 'mainnet/x-chain', 'mainnet/beam/query/boards', 'mainnet/gunzilla/query/boards', 'mainnet/aibmainnet']],
  ['mainnet/c-chain/defi', 'c-chain', ['mainnet', 'mainnet/c-chain/defi', 'mainnet/p-chain', 'mainnet/x-chain', 'mainnet/beam', 'mainnet/gunzilla', 'mainnet/aibmainnet']],
  ['mainnet/c-chain/defi/stablecoins', 'c-chain', ['mainnet', 'mainnet/c-chain/defi/stablecoins', 'mainnet/p-chain', 'mainnet/x-chain', 'mainnet/beam', 'mainnet/gunzilla', 'mainnet/aibmainnet']],
  ['mainnet/c-chain/accounts', 'c-chain', ['mainnet', 'mainnet/c-chain/accounts', 'mainnet/p-chain', 'mainnet/x-chain', 'mainnet/beam/accounts', 'mainnet/gunzilla/accounts', 'mainnet/aibmainnet/accounts']],
  ['mainnet/c-chain/validators', 'c-chain', ['mainnet', 'mainnet/c-chain/validators', 'mainnet/p-chain/validators', 'mainnet/x-chain/validators', 'mainnet/beam/validators', 'mainnet/gunzilla/validators', 'mainnet/aibmainnet/validators']],
  ['mainnet/c-chain/validators/staking', 'c-chain', ['mainnet', 'mainnet/c-chain/validators/staking', 'mainnet/p-chain/staking', 'mainnet/x-chain/validators', 'mainnet/beam/validators', 'mainnet/gunzilla/validators', 'mainnet/aibmainnet/validators']],
  ['mainnet/c-chain/validators/staking/apy', 'c-chain', ['mainnet', 'mainnet/c-chain/validators/staking/apy', 'mainnet/p-chain/staking/apy', 'mainnet/x-chain/validators', 'mainnet/beam/validators', 'mainnet/gunzilla/validators', 'mainnet/aibmainnet/validators']],
  ['mainnet/c-chain/genesis', 'c-chain', ['mainnet', 'mainnet/c-chain/genesis', 'mainnet/p-chain', 'mainnet/x-chain', 'mainnet/beam', 'mainnet/gunzilla', 'mainnet/aibmainnet']],
  ['mainnet/c-chain/verify/0xabc', 'c-chain', ['mainnet', 'mainnet/c-chain/verify/0xabc', 'mainnet/p-chain', 'mainnet/x-chain', 'mainnet/beam', 'mainnet/gunzilla', 'mainnet/aibmainnet']],
  // C-Chain, Fuji: the C-, P- and X-Chain and Beam keep Fuji; Gunzilla and AIB are Mainnet chains
  ['fuji/c-chain', 'c-chain', ['mainnet', 'fuji/c-chain', 'fuji/p-chain', 'fuji/x-chain', 'fuji/beam-l1', 'mainnet/gunzilla', 'mainnet/aibmainnet']],
  ['fuji/c-chain/blocks', 'c-chain', ['mainnet', 'fuji/c-chain/blocks', 'fuji/p-chain/blocks', 'fuji/x-chain/blocks', 'fuji/beam-l1/blocks', 'mainnet/gunzilla/blocks', 'mainnet/aibmainnet']],
  ['fuji/c-chain/block/123', 'c-chain', ['mainnet', 'fuji/c-chain/block/123', 'fuji/p-chain/blocks', 'fuji/x-chain/blocks', 'fuji/beam-l1/blocks', 'mainnet/gunzilla/blocks', 'mainnet/aibmainnet']],
  ['fuji/c-chain/txs', 'c-chain', ['mainnet', 'fuji/c-chain/txs', 'fuji/p-chain/txs', 'fuji/x-chain/txs', 'fuji/beam-l1/txs', 'mainnet/gunzilla/txs', 'mainnet/aibmainnet']],
  ['fuji/c-chain/txs/atomic', 'c-chain', ['mainnet', 'fuji/c-chain/txs/atomic', 'fuji/p-chain/txs', 'fuji/x-chain/txs', 'fuji/beam-l1/txs', 'mainnet/gunzilla/txs', 'mainnet/aibmainnet']],
  ['fuji/c-chain/gas/utilization', 'c-chain', ['mainnet', 'fuji/c-chain/gas/utilization', 'fuji/p-chain', 'fuji/x-chain', 'fuji/beam-l1/gas/utilization', 'mainnet/gunzilla/gas/utilization', 'mainnet/aibmainnet']],
  ['fuji/c-chain/query', 'c-chain', ['mainnet/query', 'fuji/c-chain/query', 'fuji/p-chain/query', 'fuji/x-chain', 'fuji/beam-l1/query', 'mainnet/gunzilla/query', 'mainnet/aibmainnet']],
  ['fuji/c-chain/accounts', 'c-chain', ['mainnet', 'fuji/c-chain/accounts', 'fuji/p-chain', 'fuji/x-chain', 'fuji/beam-l1/accounts', 'mainnet/gunzilla/accounts', 'mainnet/aibmainnet/accounts']],
  ['fuji/c-chain/validators', 'c-chain', ['mainnet', 'fuji/c-chain/validators', 'fuji/p-chain/validators', 'fuji/x-chain/validators', 'fuji/beam-l1', 'mainnet/gunzilla/validators', 'mainnet/aibmainnet/validators']],
  // P-Chain, Mainnet: Staking is the C-Chain's Validators > Staking view; Staking and L1s land on Validators elsewhere
  ['mainnet/p-chain', 'p-chain', ['mainnet', 'mainnet/c-chain', 'mainnet/p-chain', 'mainnet/x-chain', 'mainnet/beam', 'mainnet/gunzilla', 'mainnet/aibmainnet']],
  ['mainnet/p-chain/address/P-avax1abc', 'p-chain', ['mainnet', 'mainnet/c-chain', 'mainnet/p-chain/address/P-avax1abc', 'mainnet/x-chain', 'mainnet/beam', 'mainnet/gunzilla', 'mainnet/aibmainnet']],
  ['mainnet/p-chain/blocks', 'p-chain', ['mainnet', 'mainnet/c-chain/blocks', 'mainnet/p-chain/blocks', 'mainnet/x-chain/blocks', 'mainnet/beam/blocks', 'mainnet/gunzilla/blocks', 'mainnet/aibmainnet']],
  ['mainnet/p-chain/block/123', 'p-chain', ['mainnet', 'mainnet/c-chain/blocks', 'mainnet/p-chain/block/123', 'mainnet/x-chain/blocks', 'mainnet/beam/blocks', 'mainnet/gunzilla/blocks', 'mainnet/aibmainnet']],
  ['mainnet/p-chain/txs', 'p-chain', ['mainnet', 'mainnet/c-chain/txs', 'mainnet/p-chain/txs', 'mainnet/x-chain/txs', 'mainnet/beam/txs', 'mainnet/gunzilla/txs', 'mainnet/aibmainnet']],
  ['mainnet/p-chain/tx/2Vicc', 'p-chain', ['mainnet', 'mainnet/c-chain/txs', 'mainnet/p-chain/tx/2Vicc', 'mainnet/x-chain/txs', 'mainnet/beam/txs', 'mainnet/gunzilla/txs', 'mainnet/aibmainnet']],
  ['mainnet/p-chain/staking', 'p-chain', ['mainnet', 'mainnet/c-chain/validators/staking', 'mainnet/p-chain/staking', 'mainnet/x-chain/validators', 'mainnet/beam/validators', 'mainnet/gunzilla/validators', 'mainnet/aibmainnet/validators']],
  ['mainnet/p-chain/staking/apy', 'p-chain', ['mainnet', 'mainnet/c-chain/validators/staking/apy', 'mainnet/p-chain/staking/apy', 'mainnet/x-chain/validators', 'mainnet/beam/validators', 'mainnet/gunzilla/validators', 'mainnet/aibmainnet/validators']],
  ['mainnet/p-chain/l1s', 'p-chain', ['mainnet', 'mainnet/c-chain/validators', 'mainnet/p-chain/l1s', 'mainnet/x-chain/validators', 'mainnet/beam/validators', 'mainnet/gunzilla/validators', 'mainnet/aibmainnet/validators']],
  ['mainnet/p-chain/validators', 'p-chain', ['mainnet', 'mainnet/c-chain/validators', 'mainnet/p-chain/validators', 'mainnet/x-chain/validators', 'mainnet/beam/validators', 'mainnet/gunzilla/validators', 'mainnet/aibmainnet/validators']],
  ['mainnet/p-chain/validators/l1s', 'p-chain', ['mainnet', 'mainnet/c-chain/validators', 'mainnet/p-chain/validators/l1s', 'mainnet/x-chain/validators', 'mainnet/beam/validators', 'mainnet/gunzilla/validators', 'mainnet/aibmainnet/validators']],
  ['mainnet/p-chain/node/NodeID-7Xhw', 'p-chain', ['mainnet', 'mainnet/c-chain/validators', 'mainnet/p-chain/node/NodeID-7Xhw', 'mainnet/x-chain/validators', 'mainnet/beam/validators', 'mainnet/gunzilla/validators', 'mainnet/aibmainnet/validators']],
  ['mainnet/p-chain/chain/2XyZ', 'p-chain', ['mainnet', 'mainnet/c-chain', 'mainnet/p-chain/chain/2XyZ', 'mainnet/x-chain', 'mainnet/beam', 'mainnet/gunzilla', 'mainnet/aibmainnet']],
  ['mainnet/p-chain/query', 'p-chain', ['mainnet/query', 'mainnet/c-chain/query', 'mainnet/p-chain/query', 'mainnet/x-chain', 'mainnet/beam/query', 'mainnet/gunzilla/query', 'mainnet/aibmainnet']],
  ['mainnet/p-chain/query/boards', 'p-chain', ['mainnet/query', 'mainnet/c-chain/query/boards', 'mainnet/p-chain/query/boards', 'mainnet/x-chain', 'mainnet/beam/query/boards', 'mainnet/gunzilla/query/boards', 'mainnet/aibmainnet']],
  ['mainnet/p-chain/query/boards/b-1', 'p-chain', ['mainnet/query', 'mainnet/c-chain/query/boards', 'mainnet/p-chain/query/boards/b-1', 'mainnet/x-chain', 'mainnet/beam/query/boards', 'mainnet/gunzilla/query/boards', 'mainnet/aibmainnet']],
  // P-Chain, Fuji
  ['fuji/p-chain', 'p-chain', ['mainnet', 'fuji/c-chain', 'fuji/p-chain', 'fuji/x-chain', 'fuji/beam-l1', 'mainnet/gunzilla', 'mainnet/aibmainnet']],
  ['fuji/p-chain/blocks', 'p-chain', ['mainnet', 'fuji/c-chain/blocks', 'fuji/p-chain/blocks', 'fuji/x-chain/blocks', 'fuji/beam-l1/blocks', 'mainnet/gunzilla/blocks', 'mainnet/aibmainnet']],
  ['fuji/p-chain/txs', 'p-chain', ['mainnet', 'fuji/c-chain/txs', 'fuji/p-chain/txs', 'fuji/x-chain/txs', 'fuji/beam-l1/txs', 'mainnet/gunzilla/txs', 'mainnet/aibmainnet']],
  ['fuji/p-chain/validators', 'p-chain', ['mainnet', 'fuji/c-chain/validators', 'fuji/p-chain/validators', 'fuji/x-chain/validators', 'fuji/beam-l1', 'mainnet/gunzilla/validators', 'mainnet/aibmainnet/validators']],
  ['fuji/p-chain/validators/l1s', 'p-chain', ['mainnet', 'fuji/c-chain/validators', 'fuji/p-chain/validators/l1s', 'fuji/x-chain/validators', 'fuji/beam-l1', 'mainnet/gunzilla/validators', 'mainnet/aibmainnet/validators']],
  ['fuji/p-chain/node/NodeID-7Xhw', 'p-chain', ['mainnet', 'fuji/c-chain/validators', 'fuji/p-chain/node/NodeID-7Xhw', 'fuji/x-chain/validators', 'fuji/beam-l1', 'mainnet/gunzilla/validators', 'mainnet/aibmainnet/validators']],
  ['fuji/p-chain/query', 'p-chain', ['mainnet/query', 'fuji/c-chain/query', 'fuji/p-chain/query', 'fuji/x-chain', 'fuji/beam-l1/query', 'mainnet/gunzilla/query', 'mainnet/aibmainnet']],
  // X-Chain, Mainnet
  ['mainnet/x-chain', 'x-chain', ['mainnet', 'mainnet/c-chain', 'mainnet/p-chain', 'mainnet/x-chain', 'mainnet/beam', 'mainnet/gunzilla', 'mainnet/aibmainnet']],
  ['mainnet/x-chain/address/X-avax1abc', 'x-chain', ['mainnet', 'mainnet/c-chain', 'mainnet/p-chain', 'mainnet/x-chain/address/X-avax1abc', 'mainnet/beam', 'mainnet/gunzilla', 'mainnet/aibmainnet']],
  ['mainnet/x-chain/blocks', 'x-chain', ['mainnet', 'mainnet/c-chain/blocks', 'mainnet/p-chain/blocks', 'mainnet/x-chain/blocks', 'mainnet/beam/blocks', 'mainnet/gunzilla/blocks', 'mainnet/aibmainnet']],
  ['mainnet/x-chain/block/123', 'x-chain', ['mainnet', 'mainnet/c-chain/blocks', 'mainnet/p-chain/blocks', 'mainnet/x-chain/block/123', 'mainnet/beam/blocks', 'mainnet/gunzilla/blocks', 'mainnet/aibmainnet']],
  ['mainnet/x-chain/txs', 'x-chain', ['mainnet', 'mainnet/c-chain/txs', 'mainnet/p-chain/txs', 'mainnet/x-chain/txs', 'mainnet/beam/txs', 'mainnet/gunzilla/txs', 'mainnet/aibmainnet']],
  ['mainnet/x-chain/tx/2Vicc', 'x-chain', ['mainnet', 'mainnet/c-chain/txs', 'mainnet/p-chain/txs', 'mainnet/x-chain/tx/2Vicc', 'mainnet/beam/txs', 'mainnet/gunzilla/txs', 'mainnet/aibmainnet']],
  ['mainnet/x-chain/validators', 'x-chain', ['mainnet', 'mainnet/c-chain/validators', 'mainnet/p-chain/validators', 'mainnet/x-chain/validators', 'mainnet/beam/validators', 'mainnet/gunzilla/validators', 'mainnet/aibmainnet/validators']],
  ['mainnet/x-chain/node/NodeID-7Xhw', 'x-chain', ['mainnet', 'mainnet/c-chain/validators', 'mainnet/p-chain/validators', 'mainnet/x-chain/node/NodeID-7Xhw', 'mainnet/beam/validators', 'mainnet/gunzilla/validators', 'mainnet/aibmainnet/validators']],
  ['mainnet/x-chain/asset/2Abc', 'x-chain', ['mainnet', 'mainnet/c-chain', 'mainnet/p-chain', 'mainnet/x-chain/asset/2Abc', 'mainnet/beam', 'mainnet/gunzilla', 'mainnet/aibmainnet']],
  // X-Chain, Fuji
  ['fuji/x-chain/blocks', 'x-chain', ['mainnet', 'fuji/c-chain/blocks', 'fuji/p-chain/blocks', 'fuji/x-chain/blocks', 'fuji/beam-l1/blocks', 'mainnet/gunzilla/blocks', 'mainnet/aibmainnet']],
  ['fuji/x-chain/validators', 'x-chain', ['mainnet', 'fuji/c-chain/validators', 'fuji/p-chain/validators', 'fuji/x-chain/validators', 'fuji/beam-l1', 'mainnet/gunzilla/validators', 'mainnet/aibmainnet/validators']],
  // An L1 with an RPC and a Fuji counterpart (Beam)
  ['mainnet/beam', 'beam', ['mainnet', 'mainnet/c-chain', 'mainnet/p-chain', 'mainnet/x-chain', 'mainnet/beam', 'mainnet/gunzilla', 'mainnet/aibmainnet']],
  ['mainnet/beam/blocks', 'beam', ['mainnet', 'mainnet/c-chain/blocks', 'mainnet/p-chain/blocks', 'mainnet/x-chain/blocks', 'mainnet/beam/blocks', 'mainnet/gunzilla/blocks', 'mainnet/aibmainnet']],
  ['mainnet/beam/block/123', 'beam', ['mainnet', 'mainnet/c-chain/blocks', 'mainnet/p-chain/blocks', 'mainnet/x-chain/blocks', 'mainnet/beam/block/123', 'mainnet/gunzilla/blocks', 'mainnet/aibmainnet']],
  ['mainnet/beam/txs', 'beam', ['mainnet', 'mainnet/c-chain/txs', 'mainnet/p-chain/txs', 'mainnet/x-chain/txs', 'mainnet/beam/txs', 'mainnet/gunzilla/txs', 'mainnet/aibmainnet']],
  ['mainnet/beam/tx/0xabc', 'beam', ['mainnet', 'mainnet/c-chain/txs', 'mainnet/p-chain/txs', 'mainnet/x-chain/txs', 'mainnet/beam/tx/0xabc', 'mainnet/gunzilla/txs', 'mainnet/aibmainnet']],
  ['mainnet/beam/txs/icm', 'beam', ['mainnet', 'mainnet/c-chain/txs/icm', 'mainnet/p-chain/txs', 'mainnet/x-chain/txs', 'mainnet/beam/txs/icm', 'mainnet/gunzilla/txs/icm', 'mainnet/aibmainnet']],
  ['mainnet/beam/gas', 'beam', ['mainnet', 'mainnet/c-chain/gas', 'mainnet/p-chain', 'mainnet/x-chain', 'mainnet/beam/gas', 'mainnet/gunzilla/gas', 'mainnet/aibmainnet']],
  ['mainnet/beam/gas/demand', 'beam', ['mainnet', 'mainnet/c-chain/gas/demand', 'mainnet/p-chain', 'mainnet/x-chain', 'mainnet/beam/gas/demand', 'mainnet/gunzilla/gas/demand', 'mainnet/aibmainnet']],
  ['mainnet/beam/query', 'beam', ['mainnet/query', 'mainnet/c-chain/query', 'mainnet/p-chain/query', 'mainnet/x-chain', 'mainnet/beam/query', 'mainnet/gunzilla/query', 'mainnet/aibmainnet']],
  ['mainnet/beam/query/boards', 'beam', ['mainnet/query', 'mainnet/c-chain/query/boards', 'mainnet/p-chain/query/boards', 'mainnet/x-chain', 'mainnet/beam/query/boards', 'mainnet/gunzilla/query/boards', 'mainnet/aibmainnet']],
  ['mainnet/beam/accounts', 'beam', ['mainnet', 'mainnet/c-chain/accounts', 'mainnet/p-chain', 'mainnet/x-chain', 'mainnet/beam/accounts', 'mainnet/gunzilla/accounts', 'mainnet/aibmainnet/accounts']],
  ['mainnet/beam/validators', 'beam', ['mainnet', 'mainnet/c-chain/validators', 'mainnet/p-chain/validators', 'mainnet/x-chain/validators', 'mainnet/beam/validators', 'mainnet/gunzilla/validators', 'mainnet/aibmainnet/validators']],
  // Beam on Fuji: its slug is beam-l1, and /explorer/fuji/beam is an alias URL of it
  ['fuji/beam/blocks', 'beam-l1', ['mainnet', 'fuji/c-chain/blocks', 'fuji/p-chain/blocks', 'fuji/x-chain/blocks', 'fuji/beam/blocks', 'mainnet/gunzilla/blocks', 'mainnet/aibmainnet']],
  ['fuji/beam-l1/txs', 'beam-l1', ['mainnet', 'fuji/c-chain/txs', 'fuji/p-chain/txs', 'fuji/x-chain/txs', 'fuji/beam-l1/txs', 'mainnet/gunzilla/txs', 'mainnet/aibmainnet']],
  // An L1 with no RPC: Overview, Accounts and Validators only
  ['mainnet/aibmainnet', 'aibmainnet', ['mainnet', 'mainnet/c-chain', 'mainnet/p-chain', 'mainnet/x-chain', 'mainnet/beam', 'mainnet/gunzilla', 'mainnet/aibmainnet']],
  ['mainnet/aibmainnet/accounts', 'aibmainnet', ['mainnet', 'mainnet/c-chain/accounts', 'mainnet/p-chain', 'mainnet/x-chain', 'mainnet/beam/accounts', 'mainnet/gunzilla/accounts', 'mainnet/aibmainnet/accounts']],
  ['mainnet/aibmainnet/validators', 'aibmainnet', ['mainnet', 'mainnet/c-chain/validators', 'mainnet/p-chain/validators', 'mainnet/x-chain/validators', 'mainnet/beam/validators', 'mainnet/gunzilla/validators', 'mainnet/aibmainnet/validators']],
  // The network scope (All Networks)
  ['mainnet', undefined, ['mainnet', 'mainnet/c-chain', 'mainnet/p-chain', 'mainnet/x-chain', 'mainnet/beam', 'mainnet/gunzilla', 'mainnet/aibmainnet']],
  ['mainnet/chains', undefined, ['mainnet/chains', 'mainnet/c-chain', 'mainnet/p-chain', 'mainnet/x-chain', 'mainnet/beam', 'mainnet/gunzilla', 'mainnet/aibmainnet']],
  ['mainnet/token', undefined, ['mainnet/token', 'mainnet/c-chain', 'mainnet/p-chain', 'mainnet/x-chain', 'mainnet/beam', 'mainnet/gunzilla', 'mainnet/aibmainnet']],
  ['mainnet/query', undefined, ['mainnet/query', 'mainnet/c-chain/query', 'mainnet/p-chain/query', 'mainnet/x-chain', 'mainnet/beam/query', 'mainnet/gunzilla/query', 'mainnet/aibmainnet']],
  ['mainnet/icm/0xmsg', undefined, ['mainnet/icm/0xmsg', 'mainnet/c-chain', 'mainnet/p-chain', 'mainnet/x-chain', 'mainnet/beam', 'mainnet/gunzilla', 'mainnet/aibmainnet']],
  ['fuji/icm/0xmsg', undefined, ['fuji/icm/0xmsg', 'fuji/c-chain', 'fuji/p-chain', 'fuji/x-chain', 'fuji/beam-l1', 'mainnet/gunzilla', 'mainnet/aibmainnet']],
];

describe('chainSwitchTarget', () => {
  for (const [from, fromChain, landings] of MATRIX) {
    const cells = ROWS.map((row, i) => [row ?? 'all-networks', landings[i], row] as const);
    it.each(cells)(`switches ${from} to %s: %s`, (_name, expected, row) => {
      expect(chainSwitchTarget(`/explorer/${from}`, fromChain, from.split('/')[0], row)).toBe(`/explorer/${expected}`);
    });
  }
});

/* The rule, read from the tabs themselves, so a new tab needs no new MATRIX row: from each tab of each
   scope, a switch to a scope with a tab of the same name lands on that tab, and a switch to any other
   scope lands on a page that one of its tabs lights. */
const SCOPES: [network: string, chain: string | undefined][] = [
  ['mainnet', undefined],
  ['mainnet', 'c-chain'],
  ['fuji', 'c-chain'],
  ['mainnet', 'p-chain'],
  ['fuji', 'p-chain'],
  ['mainnet', 'x-chain'],
  ['fuji', 'x-chain'],
  ['mainnet', 'beam'],
  ['fuji', 'beam-l1'],
  ['mainnet', 'gunzilla'],
  ['mainnet', 'aibmainnet'],
];

const TAB_CASES = SCOPES.flatMap(([fromNetwork, fromChain]) =>
  buildTabs(fromNetwork, fromChain).flatMap((tab) =>
    SCOPES.map(([network, chain]) => [tab.href, tab.label, fromChain, network, chain] as const),
  ),
);

describe('switchTarget keeps the tab', () => {
  it.each(TAB_CASES)('switches %s (%s) on %s to %s %s', (href, label, fromChain, network, chain) => {
    const landing = switchTarget(href, fromChain, network, chain);
    const tabs = buildTabs(network, chain);
    const same = tabs.find((t) => t.label === label);
    if (same) expect(landing).toBe(same.href);
    else expect(tabs.some((t) => t.isActive(landing))).toBe(true);
  });
});

/* The two switches commute: a chain switch, then the Mainnet/Fuji switch, lands where the network
   switch, then the chain switch, does. */
const FUJI: Record<string, string> = { 'c-chain': 'c-chain', 'p-chain': 'p-chain', 'x-chain': 'x-chain', beam: 'beam-l1' };

const COMPOSE: [from: string, fromChain: string, chain: string, expected: string][] = [
  ['mainnet/c-chain/blocks', 'c-chain', 'p-chain', 'fuji/p-chain/blocks'],
  ['mainnet/c-chain/block/123', 'c-chain', 'x-chain', 'fuji/x-chain/blocks'],
  ['mainnet/c-chain/txs/icm', 'c-chain', 'beam', 'fuji/beam-l1/txs/icm'],
  ['mainnet/c-chain/gas/base-fee', 'c-chain', 'beam', 'fuji/beam-l1/gas/base-fee'],
  ['mainnet/c-chain/query/boards/b-1', 'c-chain', 'p-chain', 'fuji/p-chain/query/boards'],
  ['mainnet/c-chain/validators/staking/apy', 'c-chain', 'p-chain', 'fuji/p-chain/validators'],
  ['mainnet/c-chain/defi', 'c-chain', 'p-chain', 'fuji/p-chain'],
  ['mainnet/p-chain/staking', 'p-chain', 'c-chain', 'fuji/c-chain/validators'],
  ['mainnet/p-chain/validators/l1s', 'p-chain', 'x-chain', 'fuji/x-chain/validators'],
  ['mainnet/p-chain/txs', 'p-chain', 'beam', 'fuji/beam-l1/txs'],
  ['mainnet/x-chain/tx/2Vicc', 'x-chain', 'c-chain', 'fuji/c-chain/txs'],
  ['mainnet/beam/accounts', 'beam', 'c-chain', 'fuji/c-chain/accounts'],
];

describe('the chain switch and the Mainnet/Fuji switch', () => {
  it.each(COMPOSE)('switch %s to Fuji and the %s too: %s', (from, fromChain, chain, expected) => {
    // chain, then network
    const onChain = chainSwitchTarget(`/explorer/${from}`, fromChain, 'mainnet', chain);
    const chainFirst = switchTarget(onChain, chain, 'fuji', FUJI[chain]);
    // network, then chain
    const onFuji = switchTarget(`/explorer/${from}`, fromChain, 'fuji', FUJI[fromChain]);
    const networkFirst = chainSwitchTarget(onFuji, FUJI[fromChain], 'fuji', chain);
    expect(chainFirst).toBe(`/explorer/${expected}`);
    expect(networkFirst).toBe(`/explorer/${expected}`);
  });

  it('loses the tab on a leg through a chain without it: Beam on Fuji has no Validators tab', () => {
    const onBeam = chainSwitchTarget('/explorer/mainnet/c-chain/validators', 'c-chain', 'mainnet', 'beam');
    expect(onBeam).toBe('/explorer/mainnet/beam/validators');
    expect(switchTarget(onBeam, 'beam', 'fuji', 'beam-l1')).toBe('/explorer/fuji/beam-l1');
    const onFuji = switchTarget('/explorer/mainnet/c-chain/validators', 'c-chain', 'fuji', 'c-chain');
    expect(chainSwitchTarget(onFuji, 'c-chain', 'fuji', 'beam')).toBe('/explorer/fuji/beam-l1');
  });
});
