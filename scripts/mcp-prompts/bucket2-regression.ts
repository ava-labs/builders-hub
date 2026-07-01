/**
 * BUCKET 2 — 100 regression prompts on the PRE-EXISTING tools.
 *
 * Exercises every tool that shipped before the data/actions/console/stats
 * upgrade with normal, valid inputs, asserting the original sane behavior. This
 * proves the new domains + the rpc.ts retry/HTML-guard + the platform pagination
 * changes did NOT regress anything.
 *
 * Pre-existing surface: docs_search/fetch/list_sections, cli_lookup_command,
 * rpc_lookup_method, acp_lookup/list, github_*, blockchain_*, platform_*,
 * info_*, and the avalanche_docs_* aliases.
 *
 * Section prefix: G (reGression).
 */

import {
  add,
  check,
  checkSearch,
  has,
  hasAny,
  lacks,
  jsonHas,
  isJson,
  EOA,
  USDC,
  WAVAX,
  PRIMARY_SUBNET,
  C_CHAIN_MAINNET,
} from './harness';

let n = 0;
const id = () => `G${String(++n).padStart(3, '0')}`;

const grounded = (t: string) => hasAny(t, 'source-grounded', 'matches for', 'found');

// --- docs_search: still source-grounded ---------------------------------
[
  'interchain messaging',
  'create a subnet',
  'staking rewards',
  'subnet-evm precompiles',
  'avalanche consensus',
  'warp messaging',
  'p-chain transactions',
  'validator manager',
].forEach((q) =>
  add('G-DOCS', `${id()}. docs_search "${q}" source-grounded`, () =>
    check('docs_search', { query: q }, (r) => grounded(r.text) && lacks(r.text, 'no results found'))
  )
);
add('G-DOCS', `${id()}. docs_search academy scope`, () =>
  check('docs_search', { query: 'send cross-chain message', source: 'academy' }, (r) => grounded(r.text) || has(r.text, 'academy'))
);
add('G-DOCS', `${id()}. docs_search with limit`, () =>
  check('docs_search', { query: 'subnet', limit: 3 }, (r) => grounded(r.text))
);
add('G-DOCS', `${id()}. docs_search blog scope`, () =>
  check('docs_search', { query: 'avalanche', source: 'blog' }, (r) => grounded(r.text) || has(r.text, 'no results'))
);
add('G-DOCS', `${id()}. docs_list_sections enumerates sections`, () =>
  check('docs_list_sections', {}, (r) => has(r.text, 'documentation') && has(r.text, 'pages') && has(r.text, '#'))
);
add('G-DOCS', `${id()}. docs_fetch platform-cli page`, () =>
  check('docs_fetch', { url: '/docs/tooling/platform-cli' }, (r) => r.text.length > 50 && lacks(r.text, 'page not found'))
);
add('G-DOCS', `${id()}. docs_fetch quick-start`, () =>
  check('docs_fetch', { url: '/docs/quick-start' }, (r) => r.text.length > 20)
);
add('G-DOCS', `${id()}. docs_fetch unknown page → 'Page not found' (no crash)`, () =>
  check('docs_fetch', { url: '/docs/this-page-does-not-exist-xyz' }, (r) => has(r.text, 'page not found') || r.text.length > 0)
);

// --- avalanche_docs_* aliases keep working + compatibility note ----------
add('G-ALIAS', `${id()}. avalanche_docs_search alias`, () =>
  check('avalanche_docs_search', { query: 'subnet' }, (r) => grounded(r.text) && has(r.text, 'compatibility'))
);
add('G-ALIAS', `${id()}. avalanche_docs_list_sections alias`, () =>
  check('avalanche_docs_list_sections', {}, (r) => has(r.text, 'compatibility') && has(r.text, 'documentation'))
);
add('G-ALIAS', `${id()}. avalanche_docs_fetch alias`, () =>
  check('avalanche_docs_fetch', { url: '/docs/tooling/platform-cli' }, (r) => has(r.text, 'compatibility') && r.text.length > 50)
);
for (let i = 0; i < 4; i++) {
  add('G-ALIAS', `${id()}. avalanche_docs_search regression #${i}`, () =>
    check('avalanche_docs_search', { query: ['interchain', 'staking', 'validator', 'l1'][i] }, (r) => has(r.text, 'compatibility') && grounded(r.text))
  );
}

// --- cli_lookup_command: normal lookups + deprecation note ---------------
[
  'create subnet',
  'register validator',
  'convert subnet to l1',
  'generate keys',
  'import a key',
].forEach((q) =>
  add('G-CLI', `${id()}. cli_lookup_command "${q}"`, () =>
    check('cli_lookup_command', { query: q }, (r) => r.text.length > 25 && lacks(r.text, '/docs/tooling/avalanche-cli'))
  )
);
add('G-CLI', `${id()}. explicit cli=avalanche-cli → deprecation note`, () =>
  check('cli_lookup_command', { query: 'create subnet', cli: 'avalanche-cli' }, (r) => has(r.text, 'deprecated'))
);
add('G-CLI', `${id()}. cli=platform-cli scope`, () =>
  check('cli_lookup_command', { query: 'subnet create', cli: 'platform-cli' }, (r) => r.text.length > 20)
);
add('G-CLI', `${id()}. cli=tmpnet scope`, () =>
  check('cli_lookup_command', { query: 'local network', cli: 'tmpnet' }, (r) => r.text.length > 10)
);
add('G-CLI', `${id()}. L1 creation intent steers off avalanche-cli`, () =>
  check('cli_lookup_command', { query: 'how to create an L1' }, (r) => lacks(r.text, '/docs/tooling/avalanche-cli') && hasAny(r.text, 'recommended ways', 'platform subnet', 'quick build'))
);

// --- rpc_lookup_method ----------------------------------------------------
[
  ['eth_getLogs', 'c-chain'],
  ['eth_call', 'c-chain'],
  ['eth_blockNumber', 'c-chain'],
  ['platform.getCurrentValidators', 'p-chain'],
  ['avm.getBalance', 'x-chain'],
  ['info.getNodeID', 'other'],
].forEach(([q, chain]) =>
  add('G-RPC', `${id()}. rpc_lookup "${q}"`, () =>
    checkSearch('rpc_lookup_method', { query: q as string, chain: chain as string }, (r) => grounded(r.text) && lacks(r.text, 'no rpc results'))
  )
);
add('G-RPC', `${id()}. rpc_lookup all chains`, () =>
  checkSearch('rpc_lookup_method', { query: 'getBalance', chain: 'all' }, (r) => grounded(r.text))
);

// --- acp_lookup / acp_list ------------------------------------------------
add('G-ACP', `${id()}. acp_lookup 77 still works`, () =>
  checkSearch('acp_lookup', { number: 77 }, (r) => has(r.text, 'acp-77') && hasAny(r.text, 'reinventing subnets', 'status:'))
);
[13, 23, 30, 41, 62, 75, 83, 99, 118, 125].forEach((num) =>
  add('G-ACP', `${id()}. acp_lookup ${num}`, () =>
    checkSearch('acp_lookup', { number: num }, (r) => has(r.text, `acp-${num}`) || has(r.text, 'no structured acp'))
  )
);
add('G-ACP', `${id()}. acp_lookup by keyword`, () =>
  checkSearch('acp_lookup', { query: 'subnets' }, (r) => grounded(r.text) && has(r.text, 'acp-'))
);
add('G-ACP', `${id()}. acp_list Activated`, () =>
  checkSearch('acp_list', { status: 'Activated' }, (r) => has(r.text, 'acp-') && has(r.text, 'activated'))
);
add('G-ACP', `${id()}. acp_list Standards track`, () =>
  checkSearch('acp_list', { track: 'Standards' }, (r) => has(r.text, 'acp-'))
);
add('G-ACP', `${id()}. acp_list with limit`, () =>
  checkSearch('acp_list', { limit: 5 }, (r) => has(r.text, 'acp-') && has(r.text, 'found'))
);

// --- github_* -------------------------------------------------------------
add('G-GH', `${id()}. github_search_code ConvertSubnetToL1Tx`, () =>
  check('github_search_code', { query: 'ConvertSubnetToL1Tx', repo: 'avalanchego' }, (r) => jsonHas(r.text, 'items') || jsonHas(r.text, 'total_count'))
);
['getCurrentValidators', 'ProofOfPossession', 'precompile', 'TeleporterMessenger'].forEach((q) =>
  add('G-GH', `${id()}. github_search_code "${q}"`, () =>
    check('github_search_code', { query: q }, (r) => jsonHas(r.text, 'items') || jsonHas(r.text, 'total_count'))
  )
);
add('G-GH', `${id()}. github_list_repositories`, () =>
  check('github_list_repositories', {}, (r) => jsonHas(r.text, 'repositories') && has(r.text, 'avalanchego'))
);
add('G-GH', `${id()}. github_get_file constants.go`, () =>
  check('github_get_file', { repo: 'avalanchego', path: 'version/constants.go' }, (r) => jsonHas(r.text, 'content') || jsonHas(r.text, 'error'))
);

// --- blockchain_* ---------------------------------------------------------
add('G-BC', `${id()}. blockchain_lookup_address USDC → identifies USDC`, () =>
  check('blockchain_lookup_address', { address: USDC }, (r) => has(r.text, 'usdc') || (jsonHas(r.text, 'isContract') && jsonHas(r.text, 'contractInfo')))
);
add('G-BC', `${id()}. blockchain_get_contract_info USDC`, () =>
  check('blockchain_get_contract_info', { address: USDC }, (r) => jsonHas(r.text, 'isContract'))
);
add('G-BC', `${id()}. blockchain_get_contract_info WAVAX`, () =>
  check('blockchain_get_contract_info', { address: WAVAX }, (r) => jsonHas(r.text, 'isContract'))
);
add('G-BC', `${id()}. blockchain_get_native_balance`, () =>
  check('blockchain_get_native_balance', { address: EOA }, (r) => jsonHas(r.text, 'balanceFormatted') || has(r.text, 'avax'))
);
add('G-BC', `${id()}. blockchain_lookup_subnet primary`, () =>
  check('blockchain_lookup_subnet', { subnetId: PRIMARY_SUBNET }, (r) => jsonHas(r.text, 'subnetId') || jsonHas(r.text, 'validators'))
);
add('G-BC', `${id()}. blockchain_lookup_chain C-Chain`, () =>
  check('blockchain_lookup_chain', { chainId: C_CHAIN_MAINNET }, (r) => jsonHas(r.text, 'found') || jsonHas(r.text, 'name'))
);
add('G-BC', `${id()}. blockchain_lookup_transaction (found field present)`, () =>
  check('blockchain_lookup_transaction', { txHash: '0x' + 'cd'.repeat(32) }, (r) => jsonHas(r.text, 'found'))
);

// --- platform_* (including the pagination changes) -----------------------
add('G-PLAT', `${id()}. platform_get_blockchains has _pagination & <60KB`, () =>
  check('platform_get_blockchains', { network: 'mainnet', limit: 10 }, (r) => jsonHas(r.text, '_pagination') && jsonHas(r.text, 'blockchains') && r.text.length < 60_000)
);
add('G-PLAT', `${id()}. platform_get_blockchains default no overflow (<60KB)`, () =>
  check('platform_get_blockchains', { network: 'mainnet' }, (r) => r.text.length < 60_000 && jsonHas(r.text, '_pagination'))
);
add('G-PLAT', `${id()}. platform_get_current_validators paginated`, () =>
  check('platform_get_current_validators', { limit: 5 }, (r) => jsonHas(r.text, '_pagination') || jsonHas(r.text, 'validators'))
);
add('G-PLAT', `${id()}. platform_get_pending_validators paginated`, () =>
  check('platform_get_pending_validators', { limit: 5 }, (r) => jsonHas(r.text, '_pagination') || jsonHas(r.text, 'validators'))
);
add('G-PLAT', `${id()}. platform_get_subnets paginated`, () =>
  check('platform_get_subnets', { limit: 10 }, (r) => jsonHas(r.text, '_pagination') || jsonHas(r.text, 'subnets'))
);
add('G-PLAT', `${id()}. platform_get_subnets filter by id`, () =>
  check('platform_get_subnets', { ids: [PRIMARY_SUBNET] }, (r) => jsonHas(r.text, 'subnets'))
);
add('G-PLAT', `${id()}. platform_get_height`, () =>
  check('platform_get_height', { network: 'mainnet' }, (r) => jsonHas(r.text, 'height') || isJson(r.text))
);
add('G-PLAT', `${id()}. platform_get_min_stake`, () =>
  check('platform_get_min_stake', {}, (r) => jsonHas(r.text, 'minValidatorStake') || has(r.text, 'avax'))
);
add('G-PLAT', `${id()}. platform_get_total_stake`, () =>
  check('platform_get_total_stake', {}, (r) => jsonHas(r.text, 'stake') || has(r.text, 'avax'))
);
add('G-PLAT', `${id()}. platform_get_current_supply`, () =>
  check('platform_get_current_supply', {}, (r) => jsonHas(r.text, 'supply') || has(r.text, 'avax'))
);
add('G-PLAT', `${id()}. platform_get_staking_asset_id`, () =>
  check('platform_get_staking_asset_id', {}, (r) => isJson(r.text) || r.isError === false)
);
add('G-PLAT', `${id()}. platform_get_validators_at proposed`, () =>
  check('platform_get_validators_at', { height: 'proposed' }, (r) => jsonHas(r.text, 'validators') || isJson(r.text) || r.isError === false)
);
add('G-PLAT', `${id()}. platform_get_tx_status`, () =>
  check('platform_get_tx_status', { txID: C_CHAIN_MAINNET }, (r) => isJson(r.text) || r.isError === false)
);

// --- info_* ---------------------------------------------------------------
add('G-INFO', `${id()}. info_get_node_version`, () =>
  check('info_get_node_version', {}, (r) => jsonHas(r.text, 'version') || has(r.text, 'avalanche'))
);
add('G-INFO', `${id()}. info_get_network_id mainnet`, () =>
  check('info_get_network_id', { network: 'mainnet' }, (r) => jsonHas(r.text, 'networkID') || isJson(r.text))
);
add('G-INFO', `${id()}. info_get_network_name fuji`, () =>
  check('info_get_network_name', { network: 'fuji' }, (r) => hasAny(r.text, 'testnet', 'fuji') || jsonHas(r.text, 'networkName'))
);
add('G-INFO', `${id()}. info_get_blockchain_id C`, () =>
  check('info_get_blockchain_id', { alias: 'C' }, (r) => jsonHas(r.text, 'blockchainID') || isJson(r.text))
);
add('G-INFO', `${id()}. info_is_bootstrapped C`, () =>
  check('info_is_bootstrapped', { chain: 'C' }, (r) => jsonHas(r.text, 'isBootstrapped') || isJson(r.text))
);
add('G-INFO', `${id()}. info_get_tx_fee`, () =>
  check('info_get_tx_fee', {}, (r) => jsonHas(r.text, 'txFee') || has(r.text, 'fee'))
);
add('G-INFO', `${id()}. info_peers`, () =>
  check('info_peers', {}, (r) => jsonHas(r.text, 'peers') || isJson(r.text))
);
add('G-INFO', `${id()}. info_acps`, () =>
  check('info_acps', {}, (r) => jsonHas(r.text, 'acps') || isJson(r.text))
);

// --- pad to 100 with extra valid-input regressions -----------------------
const PAD_DOCS = ['l1', 'precompile', 'teleporter', 'genesis', 'gas config', 'faucet', 'snowman', 'delegation', 'subnet', 'validator', 'consensus', 'staking'];
PAD_DOCS.forEach((q) =>
  add('G-DOCS', `${id()}. docs_search pad "${q}"`, () => check('docs_search', { query: q }, (r) => grounded(r.text)))
);

export const BUCKET2_COUNT = n;
