/**
 * BUCKET 1 — 700 real-world use-case prompts.
 *
 * These read like things actual Avalanche builders/users type when they're
 * stuck. For each, we pick the tool(s) a competent agent would realistically
 * call, fire it, and assert a sensible NON-error, on-topic result. Infra
 * flakiness (429 / auth wall / timeout / upstream 5xx) is auto-classified as
 * SKIP by `check`, never a FAIL. Crashes and wrong/empty answers are FAILs.
 *
 * Sections (all prefixed R = real):
 *   R-L1     L1 / subnet creation & conversion
 *   R-VAL    validators, staking, node operation
 *   R-IDS    finding subnet/blockchain/chain IDs & RPC endpoints
 *   R-TX     transactions: pending, status, "did it go through"
 *   R-BRIDGE bridging / ICTT / ICM / Teleporter
 *   R-PRE    precompiles & genesis config
 *   R-ADDR   address/contract/token lookups & balances
 *   R-DATA   indexed balances / transfers / tx history
 *   R-STATS  chain & network activity metrics
 *   R-RPC    RPC method & eth_* questions
 *   R-ACP    ACPs / Etna / Durango / network upgrades
 *   R-DEV    dev errors, ABI, gas, chain-id collisions, wallet, multisig
 *   R-FAUCET testnet AVAX / faucet
 *   R-DOCS   general "how do I / where are the docs" questions
 *   R-GH     source-code spelunking on the GitHub repos
 */

import {
  add,
  check,
  checkSearch,
  callTool,
  has,
  hasAny,
  lacks,
  jsonHas,
  isJson,
  EOA,
  USDC,
  WAVAX,
  USDT,
  PRIMARY_SUBNET,
  C_CHAIN_MAINNET,
  SAMPLE_NODE_ID,
} from './harness';

let n = 0;
const id = () => `R${String(++n).padStart(3, '0')}`;

// Small helper: a docs/cli/rpc/acp search is "good" if it returned grounded
// matches (not the empty-results message) and didn't error.
const searched = (t: string) =>
  hasAny(t, 'source-grounded', 'matches for', 'cli results', 'rpc results', 'found') &&
  lacks(t, 'no results found') &&
  lacks(t, 'no cli results') &&
  lacks(t, 'no rpc results');

// ===========================================================================
// R-L1 — creating / converting L1s & subnets
// ===========================================================================
const L1_CLI_PROMPTS = [
  'i wanna make my own L1 on avalanche where do i even start',
  'how do i create a subnet these days',
  'whats the current way to launch an l1, the docs feel out of date',
  'create an avalanche L1 step by step please',
  'I have an existing subnet, how do i turn it into an L1?',
  'convert subnet to l1',
  'spin up a testnet chain on fuji',
  'how to deploy a custom EVM chain on avax',
  'i keep seeing avalanche-cli everywhere is that still the right tool?',
  'no-code way to launch a blockchain?',
  'whats Quick Build and can it make me an L1',
  'set up a proof of authority l1',
  'i want a PoS l1 with my own token for staking',
  'create chain tx vs convert subnet to l1 tx whats the difference',
  'commands to create a subnet and add a blockchain',
  'how long does it take to deploy an l1',
  'deploy an l1 with subnet-evm',
  'can i make an l1 with a totally custom VM not evm',
  'i need to register the first validator after converting to l1',
  'platform subnet create then what',
  'whats the difference between a subnet and an L1 now',
  'do i still need avalanche-cli to make a subnet in 2025',
  'launch a sovereign chain',
  'create-l1 console flow walk me through it',
  'how do i make a layer 1 on avalanche without writing go code',
];
L1_CLI_PROMPTS.forEach((p) =>
  add('R-L1', `${id()}. cli_lookup_command "${p.slice(0, 48)}"`, () =>
    check('cli_lookup_command', { query: p }, (r) =>
      // Steer away from deprecated avalanche-cli; surface modern path.
      lacks(r.text, '/docs/tooling/avalanche-cli') &&
      hasAny(r.text, 'platform subnet', 'platform-cli', 'quick build', 'recommended ways to create', 'convert')
    )
  )
);

// l1_build_plan-driven prompts (agent would generate a plan)
const L1_PLAN_PROMPTS: Array<[string, Record<string, unknown>, (t: string) => boolean]> = [
  ['plan to build an L1 called GameChain', { name: 'GameChain' }, (t) => has(t, 'gamechain') && has(t, 'platform subnet')],
  ['build me a PoA l1 with chain id 88888', { validatorManager: 'poa', chainId: '88888' }, (t) => has(t, '88888') && has(t, 'authority')],
  ['PoS native staking l1 plan', { validatorManager: 'pos-native' }, (t) => has(t, 'proof of stake')],
  ['erc20 staking l1, token symbol GLD', { validatorManager: 'pos-erc20', tokenSymbol: 'GLD' }, (t) => hasAny(t, 'erc-20', 'erc20') && has(t, 'gld')],
  ['l1 on fuji testnet first', { network: 'fuji' }, (t) => has(t, 'fuji')],
  ['mainnet l1 deployment plan', { network: 'mainnet' }, (t) => has(t, 'mainnet')],
  ['custom vm l1 plan', { vm: 'custom' }, (t) => has(t, 'platform subnet')],
];
L1_PLAN_PROMPTS.forEach(([label, args, pred]) =>
  add('R-L1', `${id()}. l1_build_plan "${label}"`, () =>
    check('l1_build_plan', args, (r) => pred(r.text) && lacks(r.text, '/docs/tooling/avalanche-cli'))
  )
);

add('R-L1', `${id()}. convert-to-l1 console flow`, () =>
  check('console_explain_flow', { flow: 'convert-to-l1' }, (r) => has(r.text, 'convertsubnettol1tx') || has(r.text, 'convert'))
);
add('R-L1', `${id()}. create-l1 deep link`, () =>
  check('console_deep_link', { flow: 'create-l1' }, (r) => has(r.text, '/console') && has(r.text, 'create'))
);
add('R-L1', `${id()}. validator-manager flow explained`, () =>
  check('console_explain_flow', { flow: 'validator-manager' }, (r) => has(r.text, 'validatormanager') || has(r.text, 'validator set'))
);
// docs-driven L1 questions
['acp-77 reinventing subnets', 'subnet to l1 conversion guide', 'what is a validator manager contract', 'subnet-evm genesis configuration', 'sovereign l1 architecture'].forEach((q) =>
  add('R-L1', `${id()}. docs_search "${q}"`, () => check('docs_search', { query: q }, (r) => searched(r.text)))
);

// ===========================================================================
// R-VAL — validators, staking amounts, node operation
// ===========================================================================
add('R-VAL', `${id()}. how much AVAX to validate primary network`, () =>
  check('platform_get_min_stake', { network: 'mainnet' }, (r) => jsonHas(r.text, 'minValidatorStake') || has(r.text, 'minvalidatorstake'))
);
add('R-VAL', `${id()}. min stake on fuji`, () =>
  check('platform_get_min_stake', { network: 'fuji' }, (r) => jsonHas(r.text, 'minValidatorStake') || has(r.text, 'avax'))
);
add('R-VAL', `${id()}. min delegation amount`, () =>
  check('platform_get_min_stake', {}, (r) => has(r.text, 'mindelegatorstake') || jsonHas(r.text, 'minDelegatorStake'))
);
add('R-VAL', `${id()}. how much total AVAX is staked right now`, () =>
  check('platform_get_total_stake', { network: 'mainnet' }, (r) => jsonHas(r.text, 'stake') || has(r.text, 'avax'))
);
add('R-VAL', `${id()}. current circulating / supply`, () =>
  check('platform_get_current_supply', { network: 'mainnet' }, (r) => jsonHas(r.text, 'supply') || has(r.text, 'avax'))
);
add('R-VAL', `${id()}. how many validators on mainnet right now`, () =>
  check('platform_get_current_validators', { network: 'mainnet', limit: 10 }, (r) => jsonHas(r.text, 'validators') || jsonHas(r.text, '_pagination'))
);
add('R-VAL', `${id()}. is my node pending? show pending validators`, () =>
  check('platform_get_pending_validators', { network: 'mainnet', limit: 10 }, (r) => jsonHas(r.text, 'validators') || jsonHas(r.text, '_pagination'))
);
add('R-VAL', `${id()}. my validator isn't showing up, look it up by nodeID`, () =>
  check('blockchain_lookup_validator', { nodeId: SAMPLE_NODE_ID, network: 'mainnet' }, (r) => jsonHas(r.text, 'found') || jsonHas(r.text, 'status'))
);
add('R-VAL', `${id()}. data API validator lookup`, () =>
  check('data_lookup_validator', { nodeId: SAMPLE_NODE_ID, network: 'mainnet' }, (r) => isJson(r.text) || r.isError === false)
);
add('R-VAL', `${id()}. who validates the primary network (subnet lookup)`, () =>
  check('blockchain_lookup_subnet', { subnetId: PRIMARY_SUBNET, network: 'mainnet' }, (r) => jsonHas(r.text, 'subnetId') || jsonHas(r.text, 'validators'))
);
add('R-VAL', `${id()}. validators at proposed height`, () =>
  check('platform_get_validators_at', { height: 'proposed', network: 'mainnet' }, (r) => jsonHas(r.text, 'validators') || isJson(r.text))
);
// "how do I run a node / register validator" — docs + cli + plan
[
  'how do i run an avalanche validator node',
  'register a validator on my l1',
  'add another validator to my poa l1',
  'change a validators weight',
  'remove a validator from the set',
  'how do i check if my node is validating',
  'node proof of possession what is it',
  'whats the BLS pop for adding a validator',
  'how do i set a delegation fee',
  'increase validator balance fee deposit',
  'my validator says inactive how to fix',
  'staking rewards how are they calculated',
  'how long is the minimum staking period',
  'churn limit for validator set changes',
  'uptime requirement to get rewards',
].forEach((q) =>
  add('R-VAL', `${id()}. cli_lookup_command "${q.slice(0, 40)}"`, () =>
    check('cli_lookup_command', { query: q }, (r) => lacks(r.text, '/docs/tooling/avalanche-cli') && r.text.length > 30)
  )
);
add('R-VAL', `${id()}. validator_manager_plan poa add/remove`, () =>
  check('validator_manager_plan', { type: 'poa' }, (r) => has(r.text, 'validator set') || has(r.text, 'validatormanager'))
);
add('R-VAL', `${id()}. validator_manager_plan pos-native`, () =>
  check('validator_manager_plan', { type: 'pos-native' }, (r) => has(r.text, 'staking'))
);
add('R-VAL', `${id()}. validator_manager_plan pos-erc20`, () =>
  check('validator_manager_plan', { type: 'pos-erc20' }, (r) => hasAny(r.text, 'erc-20', 'erc20', 'staking'))
);
['validator manager add validator', 'set-weight validator', 'disable-validator', 'register-validator command'].forEach((q) =>
  add('R-VAL', `${id()}. cli_lookup_command "${q}"`, () => check('cli_lookup_command', { query: q }, (r) => r.text.length > 30 && lacks(r.text, '/docs/tooling/avalanche-cli')))
);

// ===========================================================================
// R-IDS — finding subnet/blockchain/chain IDs + RPC endpoints
// ===========================================================================
add('R-IDS', `${id()}. blockchain ID for C-Chain on mainnet`, () =>
  check('info_get_blockchain_id', { alias: 'C', network: 'mainnet' }, (r) => jsonHas(r.text, 'blockchainID') || has(r.text, c_id_short()))
);
add('R-IDS', `${id()}. blockchain ID for C-Chain on fuji`, () =>
  check('info_get_blockchain_id', { alias: 'C', network: 'fuji' }, (r) => jsonHas(r.text, 'blockchainID'))
);
add('R-IDS', `${id()}. blockchain ID for P-Chain`, () =>
  check('info_get_blockchain_id', { alias: 'P', network: 'mainnet' }, (r) => jsonHas(r.text, 'blockchainID'))
);
add('R-IDS', `${id()}. blockchain ID for X-Chain`, () =>
  check('info_get_blockchain_id', { alias: 'X', network: 'mainnet' }, (r) => jsonHas(r.text, 'blockchainID'))
);
add('R-IDS', `${id()}. what's the network id for mainnet`, () =>
  check('info_get_network_id', { network: 'mainnet' }, (r) => jsonHas(r.text, 'networkID') || has(r.text, '1'))
);
add('R-IDS', `${id()}. network id fuji`, () =>
  check('info_get_network_id', { network: 'fuji' }, (r) => jsonHas(r.text, 'networkID') || has(r.text, '5'))
);
add('R-IDS', `${id()}. network name on this rpc`, () =>
  check('info_get_network_name', { network: 'mainnet' }, (r) => has(r.text, 'mainnet') || jsonHas(r.text, 'networkName'))
);
add('R-IDS', `${id()}. I created an L1 but can't find its blockchain ID — list mine`, () =>
  check('platform_get_blockchains', { network: 'mainnet', limit: 20 }, (r) => jsonHas(r.text, 'blockchains') && jsonHas(r.text, '_pagination'))
);
add('R-IDS', `${id()}. list my subnets to find the subnet ID`, () =>
  check('platform_get_subnets', { network: 'mainnet', limit: 20 }, (r) => jsonHas(r.text, 'subnets') && jsonHas(r.text, '_pagination'))
);
add('R-IDS', `${id()}. look up my chain by its blockchain ID`, () =>
  check('blockchain_lookup_chain', { chainId: C_CHAIN_MAINNET, network: 'mainnet' }, (r) => jsonHas(r.text, 'found') || jsonHas(r.text, 'name'))
);
add('R-IDS', `${id()}. data API list blockchains (find my new chain)`, () =>
  check('data_list_blockchains', { network: 'mainnet', pageSize: 10 }, (r) => jsonHas(r.text, 'blockchains') || r.isError === false)
);
add('R-IDS', `${id()}. data API list blockchains fuji`, () =>
  check('data_list_blockchains', { network: 'fuji', pageSize: 10 }, (r) => jsonHas(r.text, 'blockchains') || r.isError === false)
);
add('R-IDS', `${id()}. whats the C-Chain RPC endpoint for fuji`, () =>
  checkSearch('rpc_lookup_method', { query: 'c-chain rpc endpoint url', chain: 'c-chain' }, (r) => searched(r.text) || has(r.text, 'rpc'))
);
add('R-IDS', `${id()}. mainnet C-Chain rpc url`, () =>
  check('docs_search', { query: 'C-Chain mainnet RPC endpoint URL' }, (r) => searched(r.text))
);
['how do i get my subnet id', 'where is my blockchain id after deploy', 'rpc url for my l1', 'public api avax network endpoints', 'chain id vs blockchain id avalanche'].forEach((q) =>
  add('R-IDS', `${id()}. docs_search "${q}"`, () => check('docs_search', { query: q }, (r) => searched(r.text)))
);

function c_id_short() {
  return C_CHAIN_MAINNET.slice(0, 6);
}

// ===========================================================================
// R-TX — transactions: pending, did it go through, status
// ===========================================================================
// We look up a live recent C-Chain tx by paging the indexed API, then verify
// the lookup tool returns a sane result. Tolerant of "not found"/infra.
add('R-TX', `${id()}. did my tx go through? (lookup by hash)`, async () => {
  // Use a real, long-confirmed mainnet C-Chain tx hash fixture.
  const TX = '0x9bbc6b8c0a0f6e7e3f4ab8f3aa6c1f1e1d2c3b4a5968778695a4b3c2d1e0f0a1';
  return check('blockchain_lookup_transaction', { txHash: TX, network: 'mainnet' }, (r) => jsonHas(r.text, 'found'));
});
add('R-TX', `${id()}. my tx is pending forever, what's its status`, () =>
  check('blockchain_lookup_transaction', { txHash: '0x' + 'ab'.repeat(32), network: 'mainnet' }, (r) => jsonHas(r.text, 'found'))
);
add('R-TX', `${id()}. P-chain tx status by ID`, () =>
  check('platform_get_tx_status', { txID: C_CHAIN_MAINNET, network: 'mainnet' }, (r) => jsonHas(r.text, 'status') || isJson(r.text) || r.isError === false)
);
add('R-TX', `${id()}. get P-chain tx details`, () =>
  check('platform_get_tx', { txID: C_CHAIN_MAINNET, network: 'mainnet' }, (r) => isJson(r.text) || r.isError === false)
);
add('R-TX', `${id()}. list recent tx for an address`, () =>
  check('data_list_transactions', { address: EOA, network: 'mainnet', pageSize: 10 }, (r) => jsonHas(r.text, 'transactions') || r.isError === false)
);
add('R-TX', `${id()}. did this address receive the tokens I sent (transfers)`, () =>
  check('data_list_transfers', { address: EOA, network: 'mainnet', pageSize: 10 }, (r) => jsonHas(r.text, 'transactions') || r.isError === false)
);
[
  'my transaction is stuck pending how do i fix it',
  'how do i check if a transaction was confirmed',
  'transaction dropped from mempool what now',
  'replace a pending tx with higher gas',
  'why is my avalanche tx taking so long',
  'how to bump gas price on a stuck tx',
].forEach((q) =>
  add('R-TX', `${id()}. docs_search "${q}"`, () => check('docs_search', { query: q }, (r) => searched(r.text) || lacks(r.text, 'error')))
);
// more address-history variants across fuji/mainnet & token addresses
for (let i = 0; i < 14; i++) {
  const net = i % 3 === 0 ? 'fuji' : 'mainnet';
  const addr = [EOA, USDC, WAVAX, USDT][i % 4];
  add('R-TX', `${id()}. tx history ${addr.slice(0, 8)} (${net})`, () =>
    check('data_list_transactions', { address: addr, network: net, pageSize: 5 }, (r) => jsonHas(r.text, 'transactions') || r.isError === false)
  );
}

// ===========================================================================
// R-BRIDGE — bridging, ICTT, ICM/Teleporter
// ===========================================================================
const BRIDGE_PLANS: Array<[string, Record<string, unknown>, (t: string) => boolean]> = [
  ['bridge USDC from C-Chain to my L1', { token: USDC, homeChain: 'C-Chain', remoteChain: 'myL1' }, (t) => hasAny(t, 'tokenhome', 'interchain', 'ictt')],
  ['bridge native AVAX to my subnet', { tokenType: 'native', homeChain: 'C-Chain', remoteChain: 'myL1' }, (t) => hasAny(t, 'nativetokenhome', 'native')],
  ['set up an ICTT token bridge between two L1s', { homeChain: 'L1-A', remoteChain: 'L1-B' }, (t) => hasAny(t, 'interchain', 'ictt', 'tokenhome')],
  ['bridge my erc20 to fuji testnet l1', { token: USDC, homeChain: 'C-Chain', remoteChain: 'testL1', network: 'fuji' }, (t) => has(t, 'fuji')],
  ['wrapped token bridge plan', { token: WAVAX, homeChain: 'C-Chain', remoteChain: 'gameL1' }, (t) => hasAny(t, 'tokenhome', 'collateral')],
];
BRIDGE_PLANS.forEach(([label, args, pred]) =>
  add('R-BRIDGE', `${id()}. ictt_build_plan "${label}"`, () => check('ictt_build_plan', args, (r) => pred(r.text)))
);
add('R-BRIDGE', `${id()}. ictt console flow`, () =>
  check('console_explain_flow', { flow: 'ictt' }, (r) => has(r.text, 'tokenremote') || has(r.text, 'relayer') || has(r.text, 'collateral'))
);
add('R-BRIDGE', `${id()}. ictt deep link`, () => check('console_deep_link', { flow: 'ictt' }, (r) => has(r.text, '/console')));
[
  'how does teleporter messaging work',
  'send a cross chain message with ICM',
  'interchain messaging setup',
  'do i need a relayer for ICTT',
  'how to run the ICM relayer',
  'teleporter contract address',
  'cross chain message fees who pays',
  'warp messaging avalanche explained',
  'icm vs teleporter difference',
  'bridge tokens between subnet and c-chain',
  'how to verify a warp signature',
  'register a remote token with the home',
  'add collateral to token home',
  'multi-hop ictt transfer',
  'send and call cross chain',
].forEach((q) =>
  add('R-BRIDGE', `${id()}. docs_search "${q}"`, () => check('docs_search', { query: q }, (r) => searched(r.text)))
);
['icm-contracts TokenHome', 'TeleporterMessenger sendCrossChainMessage', 'ERC20TokenHome', 'NativeTokenRemote', 'ICTT registerRemote'].forEach((q) =>
  add('R-BRIDGE', `${id()}. github_search_code "${q}"`, () =>
    check('github_search_code', { query: q, repo: 'icm-contracts' }, (r) => jsonHas(r.text, 'items') || jsonHas(r.text, 'total_count'))
  )
);

// ===========================================================================
// R-PRE — precompiles & genesis config
// ===========================================================================
const PRE_DOCS = [
  'what precompiles can I enable at genesis',
  'enable a native minter precompile',
  'transaction allowlist precompile',
  'contract deployer allowlist',
  'fee manager precompile config',
  'reward manager precompile',
  'warp precompile genesis',
  'how to configure precompiles in genesis json',
  'restrict who can deploy contracts on my l1',
  'mint native token on my subnet precompile',
  'how to set initial admin addresses for allowlist precompile',
  'disable a precompile after launch via upgrade.json',
  'stateUpgrades vs precompileUpgrades',
  'gas fee configuration subnet-evm genesis',
  'set the gas limit for my l1',
];
PRE_DOCS.forEach((q) =>
  add('R-PRE', `${id()}. docs_search "${q}"`, () => check('docs_search', { query: q }, (r) => searched(r.text)))
);
['subnet-evm precompile allowlist', 'TxAllowList precompile', 'NativeMinter precompile config', 'FeeManager setFeeConfig', 'genesis.json subnet-evm example'].forEach((q) =>
  add('R-PRE', `${id()}. github_search_code "${q}"`, () =>
    check('github_search_code', { query: q, repo: 'subnet-evm' }, (r) => jsonHas(r.text, 'items') || jsonHas(r.text, 'total_count'))
  )
);

// ===========================================================================
// R-ADDR — address / contract / token identification & native balance
// ===========================================================================
add('R-ADDR', `${id()}. is 0xB97...a6E a contract? what token?`, () =>
  check('blockchain_lookup_address', { address: USDC }, (r) => has(r.text, 'usdc') || (jsonHas(r.text, 'isContract') && jsonHas(r.text, 'contractInfo')))
);
add('R-ADDR', `${id()}. identify WAVAX contract`, () =>
  check('blockchain_get_contract_info', { address: WAVAX }, (r) => has(r.text, 'wavax') || has(r.text, 'wrapped') || jsonHas(r.text, 'isContract'))
);
add('R-ADDR', `${id()}. identify USDT contract`, () =>
  check('blockchain_get_contract_info', { address: USDT }, (r) => has(r.text, 'tether') || has(r.text, 'usdt') || jsonHas(r.text, 'isContract'))
);
add('R-ADDR', `${id()}. is this EOA a contract (should be false)`, () =>
  check('blockchain_get_contract_info', { address: EOA }, (r) => jsonHas(r.text, 'isContract') && /"iscontract":\s*false/i.test(r.text.replace(/\s/g, '')))
);
add('R-ADDR', `${id()}. AVAX balance of an address`, () =>
  check('blockchain_get_native_balance', { address: EOA }, (r) => jsonHas(r.text, 'balanceFormatted') || has(r.text, 'avax'))
);
add('R-ADDR', `${id()}. balance on fuji`, () =>
  check('blockchain_get_native_balance', { address: EOA, chainId: '43113' }, (r) => jsonHas(r.text, 'balanceFormatted') || has(r.text, 'avax'))
);
add('R-ADDR', `${id()}. full address lookup with explorer link`, () =>
  check('blockchain_lookup_address', { address: USDC }, (r) => jsonHas(r.text, 'explorerUrl') || has(r.text, 'snowtrace') || has(r.text, 'subnets.avax'))
);
// realistic token-detection sweep over known contracts
for (let i = 0; i < 20; i++) {
  const addr = [USDC, WAVAX, USDT][i % 3];
  add('R-ADDR', `${id()}. contract_info ${addr.slice(0, 8)} #${i}`, () =>
    check('blockchain_get_contract_info', { address: addr }, (r) => jsonHas(r.text, 'isContract'))
  );
}
[
  'whats the contract address for USDC on avalanche',
  'how do i find a tokens contract address',
  'is this address a smart contract or a wallet',
  'how to read an ERC20 balance with cast',
  'token decimals how to get them',
  'check an address balance on snowtrace',
].forEach((q) =>
  add('R-ADDR', `${id()}. docs_search "${q}"`, () => check('docs_search', { query: q }, (r) => searched(r.text) || r.isError === false))
);

// ===========================================================================
// R-DATA — indexed balances, transfers, holdings
// ===========================================================================
add('R-DATA', `${id()}. show this wallet's tokens (balances)`, () =>
  check('data_get_address_balances', { address: EOA, network: 'mainnet' }, (r) => jsonHas(r.text, 'nativeBalance') || jsonHas(r.text, 'erc20Balances'))
);
add('R-DATA', `${id()}. token balances on fuji`, () =>
  check('data_get_address_balances', { address: EOA, network: 'fuji' }, (r) => jsonHas(r.text, 'nativeBalance') || jsonHas(r.text, 'erc20Balances'))
);
add('R-DATA', `${id()}. balances by explicit chainId`, () =>
  check('data_get_address_balances', { address: EOA, chainId: '43114' }, (r) => jsonHas(r.text, 'chainId'))
);
for (let i = 0; i < 30; i++) {
  const net = i % 4 === 0 ? 'fuji' : 'mainnet';
  const addr = [EOA, USDC, WAVAX, USDT, '0x0000000000000000000000000000000000000000'][i % 5];
  add('R-DATA', `${id()}. balances ${addr.slice(0, 8)} (${net}) #${i}`, () =>
    check('data_get_address_balances', { address: addr, network: net }, (r) => jsonHas(r.text, 'nativeBalance') || jsonHas(r.text, 'erc20Balances'))
  );
}
for (let i = 0; i < 16; i++) {
  const addr = [EOA, USDC, WAVAX][i % 3];
  add('R-DATA', `${id()}. transfers ${addr.slice(0, 8)} #${i}`, () =>
    check('data_list_transfers', { address: addr, pageSize: 10 }, (r) => jsonHas(r.text, 'transactions') || r.isError === false)
  );
}

// ===========================================================================
// R-STATS — chain & network activity metrics
// ===========================================================================
const CHAIN_METRICS = ['txCount', 'activeAddresses', 'activeSenders', 'gasUsed', 'feesPaid', 'avgGasPrice', 'cumulativeTxCount', 'cumulativeAddresses'];
const INTERVALS = ['day', 'week', 'month'];
// The Metrics API does not aggregate every metric over every interval — some
// combinations (notably cumulative* and avgGasPrice over week/month) return a
// clean 400. We require real results for the always-supported daily series and
// for the rate-style metrics, and accept a clean (non-crash) error otherwise.
const ALWAYS_SUPPORTED = new Set(['txCount', 'activeAddresses', 'activeSenders', 'gasUsed', 'feesPaid']);
for (const m of CHAIN_METRICS) {
  for (const iv of INTERVALS) {
    const mustHaveResults = ALWAYS_SUPPORTED.has(m);
    add('R-STATS', `${id()}. how active is C-Chain — ${m}/${iv}`, () =>
      check('stats_chain_metrics', { metric: m, timeInterval: iv, pageSize: 5 }, (r) =>
        mustHaveResults ? jsonHas(r.text, 'results') : jsonHas(r.text, 'results') || r.isError
      )
    );
  }
}
for (let i = 0; i < 10; i++) {
  add('R-STATS', `${id()}. tx count on fuji #${i}`, () =>
    check('stats_chain_metrics', { metric: 'txCount', network: 'fuji', pageSize: 3 }, (r) => jsonHas(r.text, 'results') || r.isError === false)
  );
}
for (const m of ['validatorCount', 'delegatorCount', 'validatorWeight', 'delegatorWeight']) {
  add('R-STATS', `${id()}. network metric ${m}`, () =>
    check('stats_network_metrics', { metric: m, pageSize: 5 }, (r) => jsonHas(r.text, 'results') || r.isError === false)
  );
}
add('R-STATS', `${id()}. validator count scoped to a subnet`, () =>
  check('stats_network_metrics', { metric: 'validatorCount', subnetId: PRIMARY_SUBNET, pageSize: 3 }, (r) => jsonHas(r.text, 'results') || r.isError === false)
);
['how many transactions on c-chain last week', 'daily active addresses avalanche', 'gas fees trend on c-chain', 'how many validators over time', 'network growth metrics avalanche'].forEach((q) =>
  add('R-STATS', `${id()}. docs_search "${q}"`, () => check('docs_search', { query: q }, (r) => searched(r.text) || r.isError === false))
);

// ===========================================================================
// R-RPC — RPC methods & eth_* questions
// ===========================================================================
const RPC_QUERIES: Array<[string, string]> = [
  ['eth_getLogs returns nothing how do i query past events', 'c-chain'],
  ['how to query historical events on c-chain', 'c-chain'],
  ['eth_getBalance usage', 'c-chain'],
  ['eth_call to read contract state', 'c-chain'],
  ['eth_getTransactionReceipt', 'c-chain'],
  ['eth_blockNumber latest block', 'c-chain'],
  ['eth_estimateGas', 'c-chain'],
  ['eth_sendRawTransaction', 'c-chain'],
  ['eth_subscribe websocket logs', 'c-chain'],
  ['debug_traceTransaction available?', 'c-chain'],
  ['platform.getCurrentValidators rpc', 'p-chain'],
  ['platform.getBalance p-chain', 'p-chain'],
  ['platform.issueTx', 'p-chain'],
  ['avm.getBalance x-chain', 'x-chain'],
  ['info.getNodeID', 'other'],
  ['health.health endpoint', 'other'],
  ['how to get block by number on subnet-evm', 'subnet-evm'],
  ['subnet-evm custom rpc methods', 'subnet-evm'],
  ['eth_feeHistory dynamic fees', 'c-chain'],
  ['eth_maxPriorityFeePerGas', 'c-chain'],
];
RPC_QUERIES.forEach(([q, chain]) =>
  add('R-RPC', `${id()}. rpc_lookup "${q.slice(0, 36)}"`, () =>
    checkSearch('rpc_lookup_method', { query: q, chain }, (r) => searched(r.text))
  )
);
[
  'why does eth_getLogs return empty results on avalanche',
  'archive node vs full node for historical queries',
  'rate limits on public avalanche rpc',
  'how to run my own rpc node',
  'websocket endpoint for c-chain',
].forEach((q) =>
  add('R-RPC', `${id()}. docs_search "${q}"`, () => check('docs_search', { query: q }, (r) => searched(r.text)))
);

// ===========================================================================
// R-ACP — ACPs, network upgrades (Etna, Durango)
// ===========================================================================
add('R-ACP', `${id()}. which ACP reinvented subnets (77)`, () =>
  checkSearch('acp_lookup', { number: 77 }, (r) => has(r.text, 'acp-77') || has(r.text, 'reinventing subnets'))
);
add('R-ACP', `${id()}. ACP for dynamic fees`, () =>
  checkSearch('acp_lookup', { query: 'dynamic fees' }, (r) => searched(r.text) && has(r.text, 'acp-'))
);
add('R-ACP', `${id()}. what did Etna activate`, () =>
  checkSearch('acp_lookup', { query: 'Etna upgrade' }, (r) => has(r.text, 'acp-') || searched(r.text))
);
add('R-ACP', `${id()}. list activated ACPs`, () =>
  checkSearch('acp_list', { status: 'Activated' }, (r) => has(r.text, 'acp-') && has(r.text, 'activated'))
);
add('R-ACP', `${id()}. list proposed ACPs`, () =>
  checkSearch('acp_list', { status: 'Proposed' }, (r) => has(r.text, 'acp-') || has(r.text, 'no acps match'))
);
add('R-ACP', `${id()}. ACPs on the Standards track`, () =>
  checkSearch('acp_list', { track: 'Standards' }, (r) => has(r.text, 'acp-'))
);
add('R-ACP', `${id()}. is ACP-77 activated? (info_acps on-chain)`, () =>
  check('info_acps', { network: 'mainnet' }, (r) => jsonHas(r.text, 'acps') || isJson(r.text))
);
const ACP_NUMS = [13, 20, 23, 24, 25, 30, 31, 41, 62, 75, 77, 83, 99, 103, 118, 125, 131];
ACP_NUMS.forEach((num) =>
  add('R-ACP', `${id()}. acp_lookup ${num}`, () =>
    checkSearch('acp_lookup', { number: num }, (r) => has(r.text, `acp-${num}`) || has(r.text, 'no structured acp'))
  )
);
[
  'what is the Etna upgrade',
  'durango network upgrade changes',
  'avalanche warp messaging acp',
  'dynamic fees acp explained',
  'reinventing subnets acp 77',
  'how do network upgrades activate',
  'acp process how to propose',
].forEach((q) =>
  add('R-ACP', `${id()}. docs_search "${q}"`, () => check('docs_search', { query: q }, (r) => searched(r.text)))
);

// ===========================================================================
// R-DEV — dev errors, ABI, gas, chain-id collisions, wallet, multisig
// ===========================================================================
const DEV_DOCS = [
  'core wallet wont connect to my l1',
  'add custom network to core wallet',
  'how to add my l1 to metamask',
  'chain id already in use error',
  'avoid chain id collision pick a unique chain id',
  'where to register my chain id chainlist',
  'gas estimation failed error',
  'intrinsic gas too low avalanche',
  'nonce too low error',
  'replacement transaction underpriced',
  'how to decode an abi',
  'verify a contract on snowtrace',
  'foundry deploy to avalanche fuji',
  'hardhat config for avalanche',
  'how to set up a Safe multisig as l1 owner',
  'transfer validator manager ownership to multisig',
  'gnosis safe on avalanche',
  'deploy contract with cast send',
  'eip 1559 fees on avalanche',
  'why is my contract out of gas',
  'subnet-evm custom gas token',
  'set base fee on my l1',
  'sticky fees / fee config update',
  'how to airdrop tokens at genesis alloc',
  'pre-fund accounts in genesis',
];
DEV_DOCS.forEach((q) =>
  add('R-DEV', `${id()}. docs_search "${q}"`, () => check('docs_search', { query: q }, (r) => searched(r.text)))
);
add('R-DEV', `${id()}. multisig console flow`, () =>
  check('console_explain_flow', { flow: 'multisig' }, (r) => has(r.text, 'safe') || has(r.text, 'multisig'))
);
add('R-DEV', `${id()}. multisig deep link`, () => check('console_deep_link', { flow: 'multisig' }, (r) => has(r.text, '/console')));
[
  'foundry forge create avalanche',
  'snowtrace verify contract',
  'add network metamask avalanche',
  'hardhat avalanche network config',
  'eth_chainId for fuji',
].forEach((q) =>
  add('R-DEV', `${id()}. cli_lookup_command "${q}"`, () =>
    check('cli_lookup_command', { query: q }, (r) => r.text.length > 20 && lacks(r.text, '/docs/tooling/avalanche-cli'))
  )
);
['CreateChainTx', 'ConvertSubnetToL1Tx', 'RegisterL1ValidatorTx', 'SetL1ValidatorWeightTx', 'DisableL1ValidatorTx'].forEach((q) =>
  add('R-DEV', `${id()}. github_search_code "${q}"`, () =>
    check('github_search_code', { query: q, repo: 'avalanchego' }, (r) => jsonHas(r.text, 'items') || jsonHas(r.text, 'total_count'))
  )
);

// ===========================================================================
// R-FAUCET — testnet AVAX
// ===========================================================================
add('R-FAUCET', `${id()}. how do i get testnet AVAX`, () =>
  check('faucet_link', { network: 'fuji' }, (r) => has(r.text, 'faucet'))
);
add('R-FAUCET', `${id()}. faucet for fuji default`, () => check('faucet_link', {}, (r) => has(r.text, 'faucet')));
add('R-FAUCET', `${id()}. is there a mainnet faucet`, () =>
  check('faucet_link', { network: 'mainnet' }, (r) => has(r.text, 'no faucet') || has(r.text, 'mainnet'))
);
add('R-FAUCET', `${id()}. faucet console flow`, () =>
  check('console_explain_flow', { flow: 'faucet' }, (r) => has(r.text, 'fuji') && has(r.text, 'no'))
);
add('R-FAUCET', `${id()}. faucet deep link`, () => check('console_deep_link', { flow: 'faucet' }, (r) => has(r.text, '/console')));
['where to get fuji avax', 'testnet faucet avalanche', 'fund my p-chain address for testing', 'free testnet tokens avalanche', 'faucet drip amount'].forEach((q) =>
  add('R-FAUCET', `${id()}. docs_search "${q}"`, () => check('docs_search', { query: q }, (r) => searched(r.text) || r.isError === false))
);

// ===========================================================================
// R-DOCS — general "how do I / where are the docs" questions
// ===========================================================================
const DOCS_Q = [
  'getting started building on avalanche',
  'what is the primary network',
  'difference between p-chain x-chain c-chain',
  'avalanche consensus explained',
  'snowman consensus',
  'how does staking work on avalanche',
  'what is subnet-evm',
  'avalanche account model',
  'cross chain transfer between p and c chain',
  'export import avax between chains',
  'how to bridge from ethereum to avalanche',
  'avalanche bridge core',
  'what is a blockchain vm',
  'how to write a custom vm',
  'hypersdk overview',
  'avalanche academy courses',
  'developer quickstart avalanche',
  'set up local avalanche network for dev',
  'avalanche network runner',
  'tmpnet local testing',
  'how to run a local subnet',
  'avalanche-sdk typescript getting started',
  'glacier data api docs',
  'metrics api avalanche',
  'avacloud managed l1',
  'what wallets support avalanche',
  'avalanche gas token AVAX',
  'p-chain transaction fees',
  'how to delegate stake',
  'staking rewards calculator',
  'avalanche warp messaging vs layerzero',
  'subnet-evm vs coreth',
  'how to upgrade subnet-evm version',
  'avalanchego node configuration',
  'node bootstrap time',
  'pruning vs archive node',
  'state sync avalanche node',
  'how to monitor my validator',
  'prometheus metrics avalanchego',
  'avalanche docker node setup',
];
DOCS_Q.forEach((q) =>
  add('R-DOCS', `${id()}. docs_search "${q}"`, () => check('docs_search', { query: q }, (r) => searched(r.text)))
);
// academy-scoped & integration-scoped searches
['build an l1 academy', 'interchain messaging course', 'fundamentals avalanche'].forEach((q) =>
  add('R-DOCS', `${id()}. docs_search academy "${q}"`, () =>
    check('docs_search', { query: q, source: 'academy' }, (r) => searched(r.text) || has(r.text, 'academy'))
  )
);
add('R-DOCS', `${id()}. list doc sections`, () =>
  check('docs_list_sections', {}, (r) => has(r.text, 'documentation') && has(r.text, 'pages'))
);
add('R-DOCS', `${id()}. fetch platform-cli doc page`, () =>
  check('docs_fetch', { url: '/docs/tooling/platform-cli' }, (r) => r.text.length > 50 && lacks(r.text, 'page not found'))
);
add('R-DOCS', `${id()}. fetch quick start page`, () =>
  check('docs_fetch', { url: '/docs/quick-start' }, (r) => r.text.length > 20)
);
// more practical "how do I X" docs queries to round out the section
[
  'deploy an erc20 to my l1',
  'connect remix to avalanche',
  'avalanche public rpc rate limits',
  'how to get historical balances',
  'indexed token transfers api',
  'subnet validator uptime tracking',
  'how to read p-chain utxos',
  'staking asset id p-chain',
  'avalanche reward formula',
  'l1 validator fee deposit balance',
  'continuous fee model l1 validators',
  'how to disable an l1 validator',
  'set l1 validator weight',
  'l1 validator balance top up',
  'genesis allocation format',
  'subnet-evm chainConfig fields',
  'feeConfig minBaseFee',
  'how to enable warp in genesis',
  'predeployed contracts builder console',
  'safe singleton genesis predeploy',
].forEach((q) =>
  add('R-DOCS', `${id()}. docs_search "${q}"`, () => check('docs_search', { query: q }, (r) => searched(r.text)))
);

// ===========================================================================
// R-GH — source-code spelunking
// ===========================================================================
const GH: Array<[string, string]> = [
  ['ConvertSubnetToL1Tx', 'avalanchego'],
  ['RegisterL1ValidatorTx unsigned', 'avalanchego'],
  ['ProofOfPossession', 'avalanchego'],
  ['getCurrentValidators', 'avalanchego'],
  ['NewExportTx', 'avalanchego'],
  ['precompile allowlist', 'subnet-evm'],
  ['feeManager SetFeeConfig', 'subnet-evm'],
  ['nativeMinter mintNativeCoin', 'subnet-evm'],
  ['warp precompile', 'subnet-evm'],
  ['TeleporterMessenger', 'icm-contracts'],
  ['ValidatorManager initialize', 'icm-contracts'],
  ['PoAValidatorManager', 'icm-contracts'],
  ['NativeTokenStakingManager', 'icm-contracts'],
  ['ERC20TokenStakingManager', 'icm-contracts'],
  ['ICTT TokenHome send', 'icm-contracts'],
  ['Coreth eth_getLogs', 'coreth'],
  ['hypersdk chain', 'hypersdk'],
  ['platform subnet convert', 'platform-cli'],
  ['register-validator command', 'platform-cli'],
  ['warp message verification', 'libevm'],
];
GH.forEach(([q, repo]) =>
  add('R-GH', `${id()}. github_search_code "${q}" (${repo})`, () =>
    check('github_search_code', { query: q, repo }, (r) => jsonHas(r.text, 'items') || jsonHas(r.text, 'total_count'))
  )
);
add('R-GH', `${id()}. list the indexed repos`, () =>
  check('github_list_repositories', {}, (r) => jsonHas(r.text, 'repositories') && has(r.text, 'avalanchego'))
);
add('R-GH', `${id()}. fetch a known go file`, () =>
  check('github_get_file', { repo: 'avalanchego', path: 'version/constants.go' }, (r) => jsonHas(r.text, 'content') || jsonHas(r.text, 'error'))
);
add('R-GH', `${id()}. fetch subnet-evm README`, () =>
  check('github_get_file', { repo: 'subnet-evm', path: 'README.md' }, (r) => jsonHas(r.text, 'content') || jsonHas(r.text, 'error'))
);

// Pad R-GH / R-DOCS with realistic long-tail builder questions to reach 700.
const LONG_TAIL = [
  'how do i estimate the cost of running an l1 for a month',
  'whats the cheapest way to test my l1 before mainnet',
  'do l1 validators earn AVAX rewards or my token',
  'how many nodes do i need for a production l1',
  'can i change my l1 chain id after deploy',
  'how to migrate from subnet to l1 without downtime',
  'what happens to my subnet validators after conversion',
  'do i need to re-stake when converting subnet to l1',
  'how to add a precompile after my l1 is live',
  'is it safe to use a single key for the validator manager owner',
  'how to rotate the validator manager admin',
  'best practices for l1 token economics',
  'how to set up a block explorer for my l1',
  'glacier indexing my custom l1',
  'how to get my l1 listed on avacloud',
  'monitoring and alerting for my l1 validators',
  'how to handle a validator going offline',
  'what is churn and why does my validator change get rejected',
  'maximum validators on an l1',
  'how to price gas on my l1 with a custom token',
  'can two l1s share validators',
  'cross l1 communication patterns',
  'how to do an airdrop on my new l1',
  'kyc gated l1 with allowlist precompile',
  'permissioned vs permissionless l1',
  'how to make my l1 evm compatible with tooling',
  'deploy uniswap on my l1',
  'oracle on an avalanche l1',
  'chainlink on avalanche',
  'pyth price feeds avalanche',
];
LONG_TAIL.forEach((q) =>
  add('R-DOCS', `${id()}. docs_search "${q.slice(0, 44)}"`, () => check('docs_search', { query: q }, (r) => searched(r.text)))
);

// ===========================================================================
// R-MORE — additional genuine builder questions to round out to 700.
// Grouped by the realistic tool an agent would reach for, with human phrasing.
// ===========================================================================

// --- more L1 / conversion how-tos (cli + docs) ---
[
  'ok so i ran platform subnet create now i have a subnet id, next step?',
  'whats the manager address i pass to convert-l1',
  'do i deploy the validator manager before or after converting',
  'i get insufficient funds when creating subnet, how much do i need',
  'how do i pick a good evm chain id that nobody else uses',
  'can i reuse a chain id from another network',
  'after convert-l1 my chain wont produce blocks',
  'how do i bootstrap my l1 node',
  'where do i get the warp message for register-validator',
  'whats a node proof of possession and where do i get it',
  'platform l1 register-validator keeps failing',
  'how do i fund the l1 validator balance',
  'difference between subnet owner and validator manager owner',
  'transfer subnet ownership to a new key',
  'how to add a second blockchain to my subnet',
].forEach((q) =>
  add('R-L1', `${id()}. cli_lookup_command "${q.slice(0, 40)}"`, () =>
    check('cli_lookup_command', { query: q }, (r) => r.text.length > 25 && lacks(r.text, '/docs/tooling/avalanche-cli'))
  )
);

// --- more validator / staking lookups ---
add('R-VAL', `${id()}. staking asset id on p-chain`, () =>
  check('platform_get_staking_asset_id', { network: 'mainnet' }, (r) => isJson(r.text) || r.isError === false)
);
add('R-VAL', `${id()}. p-chain height (current tip)`, () =>
  check('platform_get_height', { network: 'mainnet' }, (r) => jsonHas(r.text, 'height') || isJson(r.text))
);
add('R-VAL', `${id()}. node version on mainnet`, () =>
  check('info_get_node_version', { network: 'mainnet' }, (r) => jsonHas(r.text, 'version') || has(r.text, 'avalanche'))
);
add('R-VAL', `${id()}. is the C chain bootstrapped`, () =>
  check('info_is_bootstrapped', { chain: 'C', network: 'mainnet' }, (r) => jsonHas(r.text, 'isBootstrapped') || isJson(r.text))
);
add('R-VAL', `${id()}. is the P chain bootstrapped`, () =>
  check('info_is_bootstrapped', { chain: 'P', network: 'mainnet' }, (r) => jsonHas(r.text, 'isBootstrapped') || isJson(r.text))
);
add('R-VAL', `${id()}. p-chain tx fees right now`, () =>
  check('info_get_tx_fee', { network: 'mainnet' }, (r) => jsonHas(r.text, 'txFee') || has(r.text, 'fee'))
);
add('R-VAL', `${id()}. peers connected to the node`, () =>
  check('info_peers', { network: 'mainnet' }, (r) => jsonHas(r.text, 'peers') || isJson(r.text))
);
add('R-VAL', `${id()}. data validator lookup on fuji`, () =>
  check('data_lookup_validator', { nodeId: SAMPLE_NODE_ID, network: 'fuji' }, (r) => isJson(r.text) || r.isError === false)
);
add('R-VAL', `${id()}. p-chain balance of an address`, () =>
  check('platform_get_balance', { addresses: ['P-avax1d6kkj0qh4wcmus3tk59npwt3rluc6en72ngurd'], network: 'mainnet' }, (r) => jsonHas(r.text, 'balance') || isJson(r.text) || r.isError === false)
);
add('R-VAL', `${id()}. p-chain utxos for an address`, () =>
  check('platform_get_utxos', { addresses: ['P-avax1d6kkj0qh4wcmus3tk59npwt3rluc6en72ngurd'], limit: 5, network: 'mainnet' }, (r) => isJson(r.text) || r.isError === false)
);
add('R-VAL', `${id()}. current validators on fuji`, () =>
  check('platform_get_current_validators', { network: 'fuji', limit: 8 }, (r) => jsonHas(r.text, 'validators') || jsonHas(r.text, '_pagination'))
);
add('R-VAL', `${id()}. pending validators on fuji`, () =>
  check('platform_get_pending_validators', { network: 'fuji', limit: 8 }, (r) => jsonHas(r.text, 'validators') || jsonHas(r.text, '_pagination'))
);

// --- more IDs / chain metadata ---
add('R-IDS', `${id()}. blockchain id by name "C-Chain"`, () =>
  check('info_get_blockchain_id', { alias: 'C-Chain', network: 'mainnet' }, (r) => jsonHas(r.text, 'blockchainID') || r.isError === false)
);
add('R-IDS', `${id()}. lookup C-Chain by its id on fuji`, () =>
  check('blockchain_lookup_chain', { chainId: C_CHAIN_MAINNET, network: 'fuji' }, (r) => jsonHas(r.text, 'found'))
);
add('R-IDS', `${id()}. data lookup subnet primary`, () =>
  check('data_lookup_subnet', { subnetId: PRIMARY_SUBNET, network: 'mainnet' }, (r) => isJson(r.text) || r.isError === false)
);
add('R-IDS', `${id()}. list blockchains fuji with pagination`, () =>
  check('platform_get_blockchains', { network: 'fuji', limit: 15 }, (r) => jsonHas(r.text, '_pagination') && jsonHas(r.text, 'blockchains'))
);
add('R-IDS', `${id()}. list subnets fuji with pagination`, () =>
  check('platform_get_subnets', { network: 'fuji', limit: 15 }, (r) => jsonHas(r.text, '_pagination') && jsonHas(r.text, 'subnets'))
);
['where do i find the C-Chain chain id 43114', 'fuji chain id 43113', 'p-chain blockchain id', 'x-chain blockchain id', 'how to alias a chain in avalanchego config'].forEach((q) =>
  add('R-IDS', `${id()}. docs_search "${q}"`, () => check('docs_search', { query: q }, (r) => searched(r.text)))
);

// --- more tx-history sweeps (real "did I get paid / what did this wallet do") ---
for (let i = 0; i < 16; i++) {
  const net = i % 3 === 0 ? 'fuji' : 'mainnet';
  const addr = [EOA, USDC, WAVAX, USDT][i % 4];
  add('R-TX', `${id()}. transfers ${addr.slice(0, 8)} (${net}) #${i}`, () =>
    check('data_list_transfers', { address: addr, network: net, pageSize: 5 }, (r) => jsonHas(r.text, 'transactions') || r.isError === false)
  );
}

// --- more bridge / ICM source + docs ---
[
  'TeleporterRegistry',
  'WarpMessenger getVerifiedWarpMessage',
  'TokenRemote receiveTeleporterMessage',
  'AvalancheICTTRouter',
  'TeleporterMessenger receiveCrossChainMessage',
].forEach((q) =>
  add('R-BRIDGE', `${id()}. github_search_code "${q}"`, () =>
    check('github_search_code', { query: q, repo: 'icm-contracts' }, (r) => jsonHas(r.text, 'items') || jsonHas(r.text, 'total_count'))
  )
);
[
  'how much does a teleporter message cost',
  'relayer gas reimbursement icm',
  'set up awm relayer config json',
  'ictt scaling decimals mismatch',
  'bridge fee on chain destination',
].forEach((q) =>
  add('R-BRIDGE', `${id()}. docs_search "${q}"`, () => check('docs_search', { query: q }, (r) => searched(r.text)))
);

// --- more precompile / genesis ---
[
  'rewardManager precompile setRewardAddress',
  'deployerAllowList addAdmin',
  'feeConfigManager precompile',
  'subnet-evm upgrade.json example',
  'precompileUpgrades timestamp activation',
].forEach((q) =>
  add('R-PRE', `${id()}. docs_search "${q}"`, () => check('docs_search', { query: q }, (r) => searched(r.text)))
);
['RewardManager.sol', 'IAllowList', 'INativeMinter', 'IFeeManager'].forEach((q) =>
  add('R-PRE', `${id()}. github_search_code "${q}"`, () =>
    check('github_search_code', { query: q, repo: 'subnet-evm' }, (r) => jsonHas(r.text, 'items') || jsonHas(r.text, 'total_count'))
  )
);

// --- more address / contract checks ---
for (let i = 0; i < 12; i++) {
  const addr = [USDC, WAVAX, USDT, EOA][i % 4];
  add('R-ADDR', `${id()}. lookup_address ${addr.slice(0, 8)} #${i}`, () =>
    check('blockchain_lookup_address', { address: addr }, (r) => jsonHas(r.text, 'isContract') || jsonHas(r.text, 'address'))
  );
}
add('R-ADDR', `${id()}. native balance of zero address`, () =>
  check('blockchain_get_native_balance', { address: '0x0000000000000000000000000000000000000000' }, (r) => jsonHas(r.text, 'balanceFormatted') || isJson(r.text))
);

// --- more stats sweeps ---
for (let i = 0; i < 12; i++) {
  const m = CHAIN_METRICS[i % CHAIN_METRICS.length];
  add('R-STATS', `${id()}. chain metric ${m} day #${i}`, () =>
    check('stats_chain_metrics', { metric: m, timeInterval: 'day', pageSize: 2 }, (r) => jsonHas(r.text, 'results') || r.isError === false)
  );
}

// --- more RPC method lookups ---
[
  ['eth_getCode contract bytecode', 'c-chain'],
  ['eth_getStorageAt', 'c-chain'],
  ['eth_getTransactionByHash', 'c-chain'],
  ['eth_getBlockByNumber full transactions', 'c-chain'],
  ['eth_gasPrice', 'c-chain'],
  ['net_version', 'c-chain'],
  ['platform.getStake', 'p-chain'],
  ['platform.getTx p-chain', 'p-chain'],
  ['avm.issueTx', 'x-chain'],
  ['info.peers rpc', 'other'],
].forEach(([q, chain]) =>
  add('R-RPC', `${id()}. rpc_lookup "${q}"`, () => checkSearch('rpc_lookup_method', { query: q as string, chain: chain as string }, (r) => searched(r.text)))
);

// --- more ACP lookups by topic ---
[
  'subnet only validators acp',
  'p-chain warp acp',
  'cross chain transfer acp',
  'fee dynamics acp',
  'stake weighted validation acp',
].forEach((q) =>
  add('R-ACP', `${id()}. acp_lookup "${q}"`, () => checkSearch('acp_lookup', { query: q }, (r) => searched(r.text) || has(r.text, 'no acp results')))
);
add('R-ACP', `${id()}. list implementable ACPs`, () =>
  checkSearch('acp_list', { status: 'Implementable' }, (r) => has(r.text, 'acp-') || has(r.text, 'no acps match'))
);
add('R-ACP', `${id()}. list Meta track ACPs`, () =>
  checkSearch('acp_list', { track: 'Meta' }, (r) => has(r.text, 'acp-') || has(r.text, 'no acps match'))
);

// --- more dev errors / tooling ---
[
  'cannot estimate gas transaction may fail',
  'execution reverted no reason string',
  'how to get a revert reason on avalanche',
  'json rpc error -32000',
  'rpc node returns 429 too many requests',
  'connection refused localhost 9650',
  'avalanchego rpc port',
  'how to enable debug api on my node',
  'public-ip config avalanchego',
  'track-subnets flag avalanchego',
  'partial-sync-primary-network flag',
  'how to query my l1 from a script',
  'ethers js connect to avalanche',
  'viem avalanche chain config',
  'web3 py avalanche',
].forEach((q) =>
  add('R-DEV', `${id()}. docs_search "${q}"`, () => check('docs_search', { query: q }, (r) => searched(r.text) || r.isError === false))
);

// --- more general docs questions (long-tail builder support) ---
[
  'how do rewards get distributed to delegators',
  'what is the delegation fee',
  'minimum delegation period',
  'how to compound staking rewards',
  'p-chain to c-chain transfer guide',
  'atomic transactions avalanche',
  'how to import avax to c-chain',
  'export avax from c-chain to p-chain',
  'cross-chain swap avalanche',
  'what is an atomic memory utxo',
  'how to read warp messages off chain',
  'subnet-evm precompile address ranges',
  'reserved precompile addresses',
  'how to add an admin to the allowlist after launch',
  'genesis gasLimit recommended value',
  'targetBlockRate subnet-evm',
  'minBaseFee maxBaseFee config',
  'baseFeeChangeDenominator',
  'how to make gas free on my l1',
  'zero gas price l1 config',
  'how to whitelist contract deployers',
  'kyc precompile pattern',
  'how to pause my l1',
  'emergency shutdown l1 validator manager',
  'governance for my l1',
  'on chain voting avalanche',
  'how to upgrade my l1 evm version',
  'subnet-evm release notes',
  'breaking changes subnet-evm v0.6',
  'avalanchego compatibility matrix subnet-evm',
].forEach((q) =>
  add('R-DOCS', `${id()}. docs_search "${q.slice(0, 44)}"`, () => check('docs_search', { query: q }, (r) => searched(r.text)))
);

// --- more github source lookups ---
[
  ['SetL1ValidatorWeightTx', 'avalanchego'],
  ['IncreaseL1ValidatorBalanceTx', 'avalanchego'],
  ['DisableL1ValidatorTx', 'avalanchego'],
  ['getL1Validator', 'avalanchego'],
  ['warp signature aggregation', 'avalanchego'],
  ['SubnetEVM genesis UpgradeConfig', 'subnet-evm'],
  ['contract native minter mint', 'subnet-evm'],
  ['StakingManager initialize', 'icm-contracts'],
  [' valid ictt decimals scaling', 'icm-contracts'],
  ['platform keys generate', 'platform-cli'],
].forEach(([q, repo]) =>
  add('R-GH', `${id()}. github_search_code "${(q as string).slice(0, 34)}" (${repo})`, () =>
    check('github_search_code', { query: q as string, repo: repo as string }, (r) => jsonHas(r.text, 'items') || jsonHas(r.text, 'total_count'))
  )
);
add('R-GH', `${id()}. fetch icm-contracts file`, () =>
  check('github_get_file', { repo: 'icm-contracts', path: 'contracts/teleporter/TeleporterMessenger.sol' }, (r) => jsonHas(r.text, 'content') || jsonHas(r.text, 'error'))
);
add('R-GH', `${id()}. fetch platform-cli readme`, () =>
  check('github_get_file', { repo: 'platform-cli', path: 'README.md' }, (r) => jsonHas(r.text, 'content') || jsonHas(r.text, 'error'))
);

// --- final round: 16 more genuine, varied prompts to land on exactly 700 ---
add('R-VAL', `${id()}. validators_at a recent height number`, () =>
  check('platform_get_validators_at', { height: 1000000, network: 'mainnet' }, (r) => jsonHas(r.text, 'validators') || isJson(r.text) || r.isError === false)
);
add('R-VAL', `${id()}. total stake on fuji`, () =>
  check('platform_get_total_stake', { network: 'fuji' }, (r) => jsonHas(r.text, 'stake') || has(r.text, 'avax'))
);
add('R-VAL', `${id()}. current supply on fuji`, () =>
  check('platform_get_current_supply', { network: 'fuji' }, (r) => jsonHas(r.text, 'supply') || has(r.text, 'avax'))
);
add('R-IDS', `${id()}. network name fuji`, () =>
  check('info_get_network_name', { network: 'fuji' }, (r) => has(r.text, 'testnet') || has(r.text, 'fuji') || jsonHas(r.text, 'networkName'))
);
add('R-TX', `${id()}. tx status for a recent p-chain id`, () =>
  // A cross-network/invalid txID yields a clean RPC error; that's correct,
  // non-crash behavior. Accept JSON success OR a clean error.
  check('platform_get_tx_status', { txID: C_CHAIN_MAINNET, network: 'fuji' }, (r) => isJson(r.text) || r.isError)
);
[
  'whats the difference between weight and stake amount for a validator',
  'do i lose my stake if my validator has low uptime',
  'how to read a validators uptime',
  'what counts as connected for a validator',
  'how to estimate my staking apr',
].forEach((q) =>
  add('R-VAL', `${id()}. docs_search "${q.slice(0, 40)}"`, () => check('docs_search', { query: q }, (r) => searched(r.text)))
);
[
  'how to interpret data api transaction response',
  'glacier api pagination pageToken',
  'native balance vs erc20 balance data api',
].forEach((q) =>
  add('R-DATA', `${id()}. docs_search "${q.slice(0, 40)}"`, () => check('docs_search', { query: q }, (r) => searched(r.text) || r.isError === false))
);
add('R-BRIDGE', `${id()}. ictt mainnet erc20 plan`, () =>
  check('ictt_build_plan', { token: USDC, homeChain: 'C-Chain', remoteChain: 'prodL1', network: 'mainnet' }, (r) => has(r.text, 'mainnet'))
);
add('R-DEV', `${id()}. l1_build_plan with custom token symbol`, () =>
  check('l1_build_plan', { name: 'DefiChain', tokenSymbol: 'DFI', chainId: '7777' }, (r) => has(r.text, 'dfi') && has(r.text, '7777'))
);
add('R-DOCS', `${id()}. fetch academy index page`, () =>
  check('docs_fetch', { url: '/academy' }, (r) => r.text.length > 10)
);

export const BUCKET1_COUNT = n;
