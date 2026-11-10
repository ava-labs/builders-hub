import { describe, expect, test } from 'e2e';
import { z } from 'zod';
import { callTool } from './mcp-call';

// Primary Network ids. They are fixed on-chain values.
const PRIMARY_SUBNET_ID = '11111111111111111111111111111111LpoYY';
const C_CHAIN_ID_MAINNET = '2q9e4r6Mu3U68nU1fYjgbR6JvwrRx36CohpAX5UQxse55x1Q5';
const C_CHAIN_ID_FUJI = 'yH8D7ThNJkxmtkuv2jgBa4P1Rn3Qpr4pPr7QYNfcdoS6k6HWp';
const X_CHAIN_ID_MAINNET = '2oYMBNV4eNHyqk2fjjV5nVQLDbtmNJzq5s3qs3Lo6ftnC6FByM';
const CORETH_VM_ID = 'mgj786NP7uDwBCcq6YwThhaN8FLyybkCa4zBWTQbNgmK6k9A6';
const AVM_VM_ID = 'jvYyfQTxGMJLuGWa55kdP2p2zSUYsQ5Raupu4TW34ZAUBAbtq';

// The tests do not check the vmName value. The tool labels only Subnet-EVM and returns "Custom VM"
// for the C-Chain and the X-Chain on purpose (lib/mcp/tools/lib/constants.ts). The vmID identifies the VM.
const FoundChain = z.object({
  found: z.literal(true),
  query: z.string(),
  chainId: z.string(),
  name: z.string(),
  subnetId: z.string(),
  vmID: z.string(),
  vmName: z.string(),
  network: z.string(),
  explorerUrl: z.string(),
  note: z.string().min(1).optional(),
});

const ChainNotFound = z.object({ found: z.literal(false), query: z.string(), error: z.string().min(1) });

const SubnetLookup = z.object({
  kind: z.literal('subnet'),
  subnetId: z.string(),
  network: z.string(),
  result: z.unknown(),
});

// API tests run once, on the target without a browser engine (platform "api").
describe('MCP blockchain lookups', { platforms: ['api'], tags: ['api', 'mcp'] }, () => {
  test('chainId 43113 resolves to the Fuji C-Chain, not to a mainnet default', async ({ app }) => {
    const res = await callTool(app, 'blockchain_lookup_chain', { chainId: 43113 });
    expect(res.isError, res.text).toBe(false);
    const chain = expect(res.json).toMatchSchema(FoundChain);
    expect(chain).toMatchObject({
      chainId: C_CHAIN_ID_FUJI,
      name: 'C-Chain',
      subnetId: PRIMARY_SUBNET_ID,
      vmID: CORETH_VM_ID,
      network: expect.stringMatching(/fuji/i),
      explorerUrl: 'https://explorer-test.avax.network/c-chain',
    });
    // An EVM chain id pins the network, so the tool must not report a match on the other network.
    expect(chain.note).toBeUndefined();
  });

  test('chainId 43114 resolves to the Mainnet C-Chain and its explorer', async ({ app }) => {
    const res = await callTool(app, 'blockchain_lookup_chain', { chainId: 43114 });
    expect(res.isError, res.text).toBe(false);
    const chain = expect(res.json).toMatchSchema(FoundChain);
    expect(chain).toMatchObject({
      chainId: C_CHAIN_ID_MAINNET,
      name: 'C-Chain',
      subnetId: PRIMARY_SUBNET_ID,
      vmID: CORETH_VM_ID,
      network: 'Mainnet',
      explorerUrl: 'https://explorer.avax.network/c-chain',
    });
    expect(chain.note).toBeUndefined();
  });

  test('X-Chain resolves with the AVM vm id and the x-chain explorer', async ({ app }) => {
    const res = await callTool(app, 'blockchain_lookup_chain', { name: 'X-Chain' });
    expect(res.isError, res.text).toBe(false);
    const chain = expect(res.json).toMatchSchema(FoundChain);
    expect(chain).toMatchObject({
      chainId: X_CHAIN_ID_MAINNET,
      name: 'X-Chain',
      vmID: AVM_VM_ID,
      network: 'Mainnet',
      explorerUrl: 'https://explorer.avax.network/x-chain',
    });
  });

  test('P-Chain resolves from its fixed record, because getBlockchains does not list it', async ({ app }) => {
    const res = await callTool(app, 'blockchain_lookup_chain', { name: 'P-Chain' });
    expect(res.isError, res.text).toBe(false);
    const chain = expect(res.json).toMatchSchema(FoundChain);
    expect(chain).toMatchObject({
      chainId: PRIMARY_SUBNET_ID,
      name: 'P-Chain',
      vmID: 'platformvm',
      network: 'Mainnet',
      explorerUrl: 'https://explorer.avax.network/p-chain',
    });
    expect(chain.note).toBeDefined();
  });

  test('an unknown chain id returns found: false', async ({ app }) => {
    const res = await callTool(app, 'blockchain_lookup_chain', { chainId: 999999 });
    expect(res.isError, res.text).toBe(false);
    const answer = expect(res.json).toMatchSchema(ChainNotFound);
    expect(answer.query).toBe('999999');
  });

  test('onchain_lookup classifies the primary subnet id as a subnet', async ({ app }) => {
    const res = await callTool(app, 'onchain_lookup', { value: PRIMARY_SUBNET_ID });
    expect(res.isError, res.text).toBe(false);
    const answer = expect(res.json).toMatchSchema(SubnetLookup);
    expect(answer).toMatchObject({ subnetId: PRIMARY_SUBNET_ID, network: 'mainnet' });
  });
});
