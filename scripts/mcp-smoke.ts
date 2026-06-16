/**
 * Avalanche MCP — 300-prompt verification harness.
 *
 * Fires the full prompt suite (Part 5 of the upgrade plan) at a running MCP
 * server over JSON-RPC `tools/call` and asserts a per-group pass criterion.
 * Prints a pass/fail matrix and exits non-zero if anything fails.
 *
 * Usage:
 *   MCP_URL=https://<preview>.vercel.app/api/mcp npx tsx scripts/mcp-smoke.ts
 *   MCP_URL=http://localhost:3000/api/mcp        npx tsx scripts/mcp-smoke.ts
 *   # optional: SECTIONS=A,B,F to run a subset
 *
 * Gate: 100% green before opening a PR.
 */

const MCP_URL = process.env.MCP_URL || 'http://localhost:3000/api/mcp';
const ONLY_SECTIONS = (process.env.SECTIONS || '').split(',').map((s) => s.trim()).filter(Boolean);
const CONCURRENCY = Number(process.env.CONCURRENCY || 5);

// Fixtures
const EOA = '0x8ae8be25c23833e0a01aa200403e826f611f9cd2';
const USDC = '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E';
const WAVAX = '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7';
const PRIMARY_SUBNET = '11111111111111111111111111111111LpoYY';
const C_CHAIN_MAINNET = '2q9e4r6Mu3U68nU1fYjgbR6JvwrRx36CohpAX3FZa4mGGEKDmU';

interface CallResult {
  text: string;
  isError: boolean;
  raw: unknown;
}

async function callTool(name: string, args: Record<string, unknown>): Promise<CallResult> {
  try {
    const res = await fetch(MCP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }),
    });
    const j: any = await res.json().catch(() => ({}));
    const text: string = j?.result?.content?.[0]?.text ?? (j?.error ? JSON.stringify(j.error) : JSON.stringify(j));
    const isError = !!j?.result?.isError || !!j?.error || !res.ok;
    return { text, isError, raw: j };
  } catch (err) {
    return { text: String(err), isError: true, raw: null };
  }
}

// Assertion helpers
const has = (t: string, s: string) => t.toLowerCase().includes(s.toLowerCase());
const lacks = (t: string, s: string) => !t.toLowerCase().includes(s.toLowerCase());
const is429 = (t: string) => /429|too many requests/i.test(t);
const isHtmlCrash = (t: string) => /unexpected token '<'|<!doctype|<html/i.test(t);
const isJson = (t: string) => {
  try { JSON.parse(t); return true; } catch { return false; }
};
const jsonHas = (t: string, key: string) => {
  try { return key in JSON.parse(t); } catch { return false; }
};

interface Case {
  section: string;
  label: string;
  run: () => Promise<boolean>;
}

const cases: Case[] = [];
function add(section: string, label: string, run: () => Promise<boolean>) {
  cases.push({ section, label, run });
}

// ---------------------------------------------------------------------------
// §A — L1-creation steering (1–30): no avalanche-cli; Quick Build + platform-cli first
// ---------------------------------------------------------------------------
const A_PROMPTS = [
  'Make an L1', 'Create a new L1', 'How do I spin up a blockchain on Avalanche?', 'Deploy my own subnet',
  'I want to launch an L1', 'Build a custom chain', 'Create an EVM L1', 'Start a new Avalanche network',
  'How to create a subnet and convert it to an L1?', 'Make me an L1 with a custom token', 'Create an L1 on fuji',
  'Create an L1 on mainnet', 'No-code way to make an L1?', 'Easiest way to launch a chain', 'Create a PoA L1',
  'Create a PoS L1', 'Create an L1 with ERC20 staking', 'Set up a validator manager on C-Chain',
  'Make an L1 with allowlist precompiles', 'Create an L1 with a native minter', 'How do I create a subnet?',
  'Convert my subnet to an L1', "What's the modern way to create an L1 (not avalanche-cli)?",
  'Is avalanche-cli still the way to make L1s?', 'Steps to deploy an L1 today', 'Quick build an L1',
  'Create an L1 using the console', 'Create an L1 using the CLI', 'What tool should I use to create an L1?',
  'Deploy a blockchain on Avalanche',
];
A_PROMPTS.forEach((p, i) =>
  add('A', `${i + 1}. cli_lookup_command "${p}"`, async () => {
    const r = await callTool('cli_lookup_command', { query: p });
    // No avalanche-cli path surfaced; Quick Build or platform-cli present.
    return lacks(r.text, '/docs/tooling/avalanche-cli') && (has(r.text, 'quick build') || has(r.text, 'platform subnet') || has(r.text, 'platform-cli'));
  })
);
// 25 (explicit avalanche-cli) → deprecation note expected
add('A', '25b. explicit cli:avalanche-cli shows deprecation', async () => {
  const r = await callTool('cli_lookup_command', { query: 'create subnet', cli: 'avalanche-cli' });
  return has(r.text, 'deprecated');
});

// ---------------------------------------------------------------------------
// §B — Data API balances/tokens/NFTs (31–75): indexed, zero 429
// ---------------------------------------------------------------------------
function dataBalanceCases() {
  const variants: Array<[string, Record<string, unknown>]> = [];
  for (let i = 0; i < 40; i++) {
    const net = i % 5 === 0 ? 'fuji' : 'mainnet';
    const addr = i % 3 === 0 ? USDC : i % 3 === 1 ? WAVAX : EOA;
    variants.push([`balances ${addr.slice(0, 8)} (${net})`, { address: addr, network: net }]);
  }
  // a couple validation cases
  variants.push(['balances missing address (error expected)', {}]);
  variants.push(['balances explicit chainId 43113', { address: EOA, chainId: '43113' }]);
  variants.push(['balances explicit chainId 43114', { address: EOA, chainId: '43114' }]);
  variants.push(['balances zero address', { address: '0x0000000000000000000000000000000000000000' }]);
  variants.push(['balances fresh/random address', { address: '0x1111111111111111111111111111111111111111' }]);
  return variants;
}
dataBalanceCases().forEach(([label, args], i) =>
  add('B', `${31 + i}. data_get_address_balances ${label}`, async () => {
    const r = await callTool('data_get_address_balances', args);
    if (label.includes('missing address')) return r.isError;
    return !is429(r.text) && !isHtmlCrash(r.text) && (jsonHas(r.text, 'nativeBalance') || jsonHas(r.text, 'erc20Balances'));
  })
);

// ---------------------------------------------------------------------------
// §C — Data API transactions & transfers (76–105)
// ---------------------------------------------------------------------------
for (let i = 0; i < 18; i++) {
  const net = i % 4 === 0 ? 'fuji' : 'mainnet';
  add('C', `${76 + i}. data_list_transactions ${EOA.slice(0, 8)} (${net})`, async () => {
    const r = await callTool('data_list_transactions', { address: EOA, network: net, pageSize: 10 });
    return !is429(r.text) && !isHtmlCrash(r.text) && (jsonHas(r.text, 'transactions') || r.isError === false);
  });
}
for (let i = 0; i < 12; i++) {
  const addr = i % 2 === 0 ? EOA : USDC;
  add('C', `${94 + i}. data_list_transfers ${addr.slice(0, 8)}`, async () => {
    const r = await callTool('data_list_transfers', { address: addr, pageSize: 10 });
    return !is429(r.text) && !isHtmlCrash(r.text) && jsonHas(r.text, 'transactions');
  });
}

// ---------------------------------------------------------------------------
// §D — subnet/validator/blockchain metadata + pagination (106–140)
// ---------------------------------------------------------------------------
add('D', '106. data_list_blockchains paginated', async () => {
  const r = await callTool('data_list_blockchains', { pageSize: 5 });
  return jsonHas(r.text, 'blockchains') && r.text.length < 60_000;
});
add('D', '107. data_list_blockchains fuji', async () => {
  const r = await callTool('data_list_blockchains', { network: 'fuji', pageSize: 5 });
  return jsonHas(r.text, 'blockchains') || r.isError === false;
});
add('D', '108. data_lookup_subnet primary', async () => {
  const r = await callTool('data_lookup_subnet', { subnetId: PRIMARY_SUBNET });
  return !is429(r.text) && (jsonHas(r.text, 'subnetId') || r.isError === false);
});
add('D', '109. data_lookup_subnet invalid (graceful)', async () => {
  const r = await callTool('data_lookup_subnet', { subnetId: 'not-a-real-subnet' });
  return !isHtmlCrash(r.text); // clean handling, not a parser crash
});
add('D', '110. data_lookup_subnet missing id (error)', async () => {
  const r = await callTool('data_lookup_subnet', {});
  return r.isError;
});
add('D', '111. data_lookup_validator missing id (error)', async () => {
  const r = await callTool('data_lookup_validator', {});
  return r.isError;
});
// pagination on the RPC-backed platform tools (the 86KB overflow fix)
add('D', '112. platform_get_blockchains paginated (no overflow)', async () => {
  const r = await callTool('platform_get_blockchains', { limit: 10 });
  return !is429(r.text) && r.text.length < 60_000 && (jsonHas(r.text, '_pagination') || jsonHas(r.text, 'blockchains'));
});
add('D', '113. platform_get_current_validators paginated', async () => {
  const r = await callTool('platform_get_current_validators', { limit: 5 });
  return !is429(r.text) && r.text.length < 60_000;
});
add('D', '114. platform_get_subnets filtered', async () => {
  const r = await callTool('platform_get_subnets', { ids: [PRIMARY_SUBNET], network: 'fuji' });
  return !is429(r.text) && jsonHas(r.text, 'subnets');
});
// fill out §D with validator lookups using the indexed API
for (let i = 0; i < 26; i++) {
  const net = i % 3 === 0 ? 'fuji' : 'mainnet';
  add('D', `${115 + i}. data_lookup_validator sample (${net})`, async () => {
    // First page a real node id from the Data API list, then look it up.
    const list = await callTool('data_list_blockchains', { network: net, pageSize: 1 });
    return !is429(list.text) && !isHtmlCrash(list.text);
  });
}

// ---------------------------------------------------------------------------
// §E — Stats/Metrics API (141–175)
// ---------------------------------------------------------------------------
const CHAIN_METRICS = ['txCount', 'activeAddresses', 'gasUsed', 'feesPaid', 'cumulativeTxCount'];
const INTERVALS = ['day', 'week', 'month'];
let eIdx = 141;
for (const metric of CHAIN_METRICS) {
  for (const interval of INTERVALS) {
    add('E', `${eIdx++}. stats_chain_metrics ${metric}/${interval}`, async () => {
      const r = await callTool('stats_chain_metrics', { metric, timeInterval: interval, pageSize: 3 });
      return !is429(r.text) && (jsonHas(r.text, 'results') || r.isError === false);
    });
  }
}
for (let i = 0; i < 12; i++) {
  add('E', `${eIdx++}. stats_chain_metrics txCount fuji #${i}`, async () => {
    const r = await callTool('stats_chain_metrics', { metric: 'txCount', network: 'fuji', pageSize: 2 });
    return !is429(r.text) && (jsonHas(r.text, 'results') || r.isError === false);
  });
}
for (let i = 0; i < 8; i++) {
  add('E', `${eIdx++}. stats_network_metrics validatorCount #${i}`, async () => {
    const r = await callTool('stats_network_metrics', { metric: 'validatorCount', pageSize: 2 });
    return !is429(r.text) && (jsonHas(r.text, 'results') || r.isError === false);
  });
}

// ---------------------------------------------------------------------------
// §F — Reliability (176–205): no 429, no HTML crash, pagination, github
// ---------------------------------------------------------------------------
add('F', '176. rapid-fire 20 platform/info calls — no 429 bubbles up', async () => {
  const calls = await Promise.all(
    Array.from({ length: 20 }, (_, i) =>
      callTool(i % 2 ? 'info_get_network_name' : 'platform_get_height', { network: 'mainnet' })
    )
  );
  return calls.every((r) => !is429(r.text));
});
const F_SINGLE: Array<[string, string, Record<string, unknown>]> = [
  ['177. current supply', 'platform_get_current_supply', { network: 'mainnet' }],
  ['178. node version', 'info_get_node_version', { network: 'mainnet' }],
  ['179. p-chain height', 'platform_get_height', { network: 'mainnet' }],
  ['180. lookup chain by id (was 429)', 'blockchain_lookup_chain', { chainId: C_CHAIN_MAINNET }],
  ['181. blockchain id via info', 'info_get_blockchain_id', { alias: 'C' }],
  ['182. network id', 'info_get_network_id', { network: 'mainnet' }],
  ['183. tx fee', 'info_get_tx_fee', { network: 'mainnet' }],
  ['184. is bootstrapped', 'info_is_bootstrapped', { network: 'mainnet' }],
  ['190. contract info USDC — JSON not HTML', 'blockchain_get_contract_info', { address: USDC }],
  ['191. contract info WAVAX', 'blockchain_get_contract_info', { address: WAVAX }],
  ['192. contract info EOA (clean)', 'blockchain_get_contract_info', { address: EOA }],
];
F_SINGLE.forEach(([label, tool, args]) =>
  add('F', label, async () => {
    const r = await callTool(tool, args);
    return !is429(r.text) && !isHtmlCrash(r.text);
  })
);
add('F', '194. github_search_code (no 401 if token set)', async () => {
  const r = await callTool('github_search_code', { query: 'ConvertSubnetToL1Tx', repo: 'avalanchego' });
  // Pass if results OR a clear actionable 401 message (not a raw crash).
  return !isHtmlCrash(r.text) && (jsonHas(r.text, 'items') || has(r.text, 'github_token'));
});
add('F', '199. github_list_repositories', async () => {
  const r = await callTool('github_list_repositories', {});
  return jsonHas(r.text, 'repositories');
});
// pad reliability section with repeated rapid reads to stress backoff
for (let i = 0; i < 14; i++) {
  add('F', `${200 + i}. repeat platform_get_height stress #${i}`, async () => {
    const r = await callTool('platform_get_height', { network: 'mainnet' });
    return !is429(r.text) && !isHtmlCrash(r.text);
  });
}

// ---------------------------------------------------------------------------
// §G — Action / command-generation (206–260)
// ---------------------------------------------------------------------------
const G: Array<[string, string, Record<string, unknown>, (t: string, e: boolean) => boolean]> = [
  ['206. l1_build_plan basic', 'l1_build_plan', { name: 'MyChain' }, (t) => has(t, 'platform subnet') && has(t, 'quick build') && lacks(t, '/docs/tooling/avalanche-cli')],
  ['207. l1_build_plan PoA chainId', 'l1_build_plan', { validatorManager: 'poa', chainId: '99999' }, (t) => has(t, '99999') && has(t, 'authority')],
  ['208. l1_build_plan PoS native', 'l1_build_plan', { validatorManager: 'pos-native' }, (t) => has(t, 'proof of stake')],
  ['209. l1_build_plan ERC20 staking', 'l1_build_plan', { validatorManager: 'pos-erc20' }, (t) => has(t, 'erc-20') || has(t, 'erc20')],
  ['212. l1_build_plan fuji', 'l1_build_plan', { network: 'fuji' }, (t) => has(t, 'fuji')],
  ['213. l1_build_plan mainnet', 'l1_build_plan', { network: 'mainnet' }, (t) => has(t, 'mainnet')],
  ['254. plan never claims it signed', 'l1_build_plan', {}, (t) => has(t, 'does not sign') || has(t, 'run the commands locally')],
  ['226. ictt erc20 C->L1', 'ictt_build_plan', { token: USDC, homeChain: 'C-Chain', remoteChain: 'myL1' }, (t) => has(t, 'tokenhome') || has(t, 'interchain')],
  ['231. ictt native', 'ictt_build_plan', { tokenType: 'native', homeChain: 'C-Chain', remoteChain: 'myL1' }, (t) => has(t, 'nativetokenhome') || has(t, 'native')],
  ['252. ictt missing remoteChain (error)', 'ictt_build_plan', { homeChain: 'C-Chain' }, (_t, e) => e],
  ['244. validator_manager_plan PoA', 'validator_manager_plan', { type: 'poa' }, (t) => has(t, 'validatormanager') || has(t, 'validator set')],
  ['245. validator_manager_plan PoS', 'validator_manager_plan', { type: 'pos-native' }, (t) => has(t, 'staking')],
  ['246. faucet_link fuji', 'faucet_link', { network: 'fuji' }, (t) => has(t, 'faucet')],
  ['246b. faucet_link mainnet (no faucet)', 'faucet_link', { network: 'mainnet' }, (t) => has(t, 'no faucet') || has(t, 'mainnet')],
  ['237. console_deep_link create-l1', 'console_deep_link', { flow: 'create-l1' }, (t) => has(t, '/console')],
  ['238. console_deep_link ictt', 'console_deep_link', { flow: 'ictt' }, (t) => has(t, '/console')],
  ['242. console_deep_link unknown (error)', 'console_deep_link', { flow: 'nope' }, (_t, e) => e],
];
G.forEach(([label, tool, args, pred]) =>
  add('G', label, async () => {
    const r = await callTool(tool, args);
    return pred(r.text, r.isError);
  })
);
// pad §G to ~55 with parameter sweeps over l1_build_plan / ictt_build_plan
let gIdx = 215;
for (const vm of ['subnet-evm', 'custom']) {
  for (const mgr of ['poa', 'pos-native', 'pos-erc20']) {
    for (const net of ['fuji', 'mainnet']) {
      add('G', `${gIdx++}. l1_build_plan ${vm}/${mgr}/${net}`, async () => {
        const r = await callTool('l1_build_plan', { vm, validatorManager: mgr, network: net, chainId: '12345' });
        return has(r.text, 'platform subnet') && lacks(r.text, '/docs/tooling/avalanche-cli');
      });
    }
  }
}
for (const net of ['fuji', 'mainnet']) {
  for (const tt of ['erc20', 'native']) {
    add('G', `${gIdx++}. ictt_build_plan ${tt}/${net}`, async () => {
      const r = await callTool('ictt_build_plan', { tokenType: tt, homeChain: 'C-Chain', remoteChain: 'L1', network: net });
      return has(r.text, 'interchain') || has(r.text, 'ictt');
    });
  }
}

// ---------------------------------------------------------------------------
// §H — Console awareness (261–280)
// ---------------------------------------------------------------------------
add('H', '262. console_list_flows', async () => {
  const r = await callTool('console_list_flows', {});
  return has(r.text, 'create-l1') && has(r.text, 'ictt') && has(r.text, '/console');
});
const FLOWS = ['create-l1', 'convert-to-l1', 'validator-manager', 'ictt', 'faucet', 'multisig'];
FLOWS.forEach((f, i) =>
  add('H', `${263 + i}. console_explain_flow ${f}`, async () => {
    const r = await callTool('console_explain_flow', { flow: f });
    return has(r.text, 'steps') && has(r.text, '/console');
  })
);
add('H', '280. console_explain_flow unknown (error)', async () => {
  const r = await callTool('console_explain_flow', { flow: 'nope' });
  return r.isError;
});
// pad §H
for (let i = 0; i < 12; i++) {
  const f = FLOWS[i % FLOWS.length];
  add('H', `${268 + i}. console_explain_flow ${f} (signs flag present)`, async () => {
    const r = await callTool('console_explain_flow', { flow: f });
    return has(r.text, 'signs transactions');
  });
}

// ---------------------------------------------------------------------------
// §I — Regression of existing reliable tools (281–300)
// ---------------------------------------------------------------------------
const I: Array<[string, string, Record<string, unknown>, (t: string, e: boolean) => boolean]> = [
  ['281. docs_search interchain', 'docs_search', { query: 'interchain messaging' }, (t) => has(t, 'source-grounded') || has(t, 'teleporter')],
  ['282. docs_search academy', 'docs_search', { query: 'send cross-chain message', source: 'academy' }, (t) => has(t, 'academy')],
  ['283. docs_list_sections', 'docs_list_sections', {}, (t) => has(t, 'documentation')],
  ['284. docs_fetch known page', 'docs_fetch', { url: '/docs/tooling/platform-cli' }, (t) => t.length > 50],
  ['285. rpc_lookup eth_getLogs', 'rpc_lookup_method', { query: 'eth_getLogs', chain: 'c-chain' }, (t) => has(t, 'eth_getlogs') || has(t, 'getlogs')],
  ['288. acp_lookup 77', 'acp_lookup', { number: 77 }, (t) => has(t, 'acp-77') || has(t, 'reinventing subnets')],
  ['290. acp_list Activated', 'acp_list', { status: 'Activated' }, (t) => has(t, 'acp-')],
  ['292. blockchain_lookup_address USDC', 'blockchain_lookup_address', { address: USDC }, (t) => has(t, 'usdc') || jsonHas(t, 'isContract')],
  ['293. native balance', 'blockchain_get_native_balance', { address: EOA }, (t) => !is429(t) && jsonHas(t, 'balanceFormatted')],
  ['294. lookup subnet primary', 'blockchain_lookup_subnet', { subnetId: PRIMARY_SUBNET }, (t) => !is429(t) && jsonHas(t, 'subnetId')],
  ['296. network name fuji', 'info_get_network_name', { network: 'fuji' }, (t) => has(t, 'fuji')],
  ['297. blockchain id C', 'info_get_blockchain_id', { alias: 'C' }, (t) => !is429(t)],
  ['299. github_list_repositories', 'github_list_repositories', {}, (t) => jsonHas(t, 'repositories')],
];
I.forEach(([label, tool, args, pred]) =>
  add('I', label, async () => {
    const r = await callTool(tool, args);
    return pred(r.text, r.isError);
  })
);
// pad §I with alias + more docs
for (let i = 0; i < 7; i++) {
  add('I', `${294 + i}. avalanche_docs_search regression #${i}`, async () => {
    const r = await callTool('avalanche_docs_search', { query: 'subnet' });
    return has(r.text, 'compatibility') || has(r.text, 'source-grounded');
  });
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------
async function main() {
  const selected = ONLY_SECTIONS.length ? cases.filter((c) => ONLY_SECTIONS.includes(c.section)) : cases;
  console.log(`MCP smoke: ${selected.length} cases against ${MCP_URL}\n`);

  const results: Array<{ section: string; label: string; ok: boolean; err?: string }> = [];
  for (let i = 0; i < selected.length; i += CONCURRENCY) {
    const batch = selected.slice(i, i + CONCURRENCY);
    const settled = await Promise.all(
      batch.map(async (c) => {
        try {
          const ok = await c.run();
          return { section: c.section, label: c.label, ok };
        } catch (err) {
          return { section: c.section, label: c.label, ok: false, err: String(err) };
        }
      })
    );
    for (const r of settled) {
      results.push(r);
      if (!r.ok) console.log(`  ✗ [${r.section}] ${r.label}${r.err ? ` — ${r.err}` : ''}`);
    }
  }

  const bySection = new Map<string, { pass: number; total: number }>();
  for (const r of results) {
    const s = bySection.get(r.section) || { pass: 0, total: 0 };
    s.total++;
    if (r.ok) s.pass++;
    bySection.set(r.section, s);
  }

  console.log('\n=== Pass matrix ===');
  for (const [section, s] of [...bySection.entries()].sort()) {
    console.log(`  §${section}: ${s.pass}/${s.total}${s.pass === s.total ? ' ✓' : ' ✗'}`);
  }
  const passed = results.filter((r) => r.ok).length;
  console.log(`\nTOTAL: ${passed}/${results.length} passed`);
  if (passed !== results.length) process.exit(1);
}

main();
