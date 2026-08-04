import { describe, expect, it } from 'vitest';
import {
  deriveWsUrl,
  genAnsibleByoCommand,
  genHelmBlockscoutCommand,
  genInClusterRpcUrls,
  genTerraformBlockscoutCommand,
} from '@/components/toolbox/console/layer-1/explorer/avalancheDeployCommands';

const BLOCKCHAIN_ID = '2q9e4r6Mu3U68nU1fYjgbR6JvwrRx36CohpAX5UQxse55x1Q5';

describe('genTerraformBlockscoutCommand', () => {
  it('inlines literal chain values and quotes the chain name', () => {
    const cmd = genTerraformBlockscoutCommand({
      blockchainId: BLOCKCHAIN_ID,
      evmChainId: 99999,
      chainName: 'My L1',
    });
    expect(cmd).toBe(
      [
        'make deploy-blockscout \\',
        `  CHAIN_ID=${BLOCKCHAIN_ID} \\`,
        '  EVM_CHAIN_ID=99999 \\',
        '  CHAIN_NAME="My L1"',
      ].join('\n'),
    );
  });

  it('omits CLOUD for aws and includes it for gcp/azure', () => {
    const aws = genTerraformBlockscoutCommand({ blockchainId: 'x', evmChainId: 1, chainName: 'A', cloud: 'aws' });
    expect(aws).not.toContain('CLOUD=');
    const gcp = genTerraformBlockscoutCommand({ blockchainId: 'x', evmChainId: 1, chainName: 'A', cloud: 'gcp' });
    expect(gcp).toContain('CLOUD=gcp');
    const azure = genTerraformBlockscoutCommand({ blockchainId: 'x', evmChainId: 1, chainName: 'A', cloud: 'azure' });
    expect(azure).toContain('CLOUD=azure');
  });
});

describe('genAnsibleByoCommand', () => {
  it('passes rpc_url and ws_url together', () => {
    const cmd = genAnsibleByoCommand({
      blockchainId: BLOCKCHAIN_ID,
      evmChainId: 42,
      chainName: 'My L1',
      rpcUrl: 'https://node.example.com/ext/bc/abc/rpc',
      wsUrl: 'wss://node.example.com/ext/bc/abc/ws',
    });
    expect(cmd).toContain(`-e "l1_chain_id=${BLOCKCHAIN_ID}"`);
    expect(cmd).toContain('-e "l1_evm_chain_id=42"');
    expect(cmd).toContain('-e "rpc_url=https://node.example.com/ext/bc/abc/rpc"');
    expect(cmd).toContain('-e \'ws_url="wss://node.example.com/ext/bc/abc/ws"\'');
  });

  it('inner-quotes l1_name so ansible preserves multi-word names', () => {
    const cmd = genAnsibleByoCommand({
      blockchainId: 'x',
      evmChainId: 1,
      chainName: 'My L1',
      rpcUrl: 'https://node.example.com/ext/bc/abc/rpc',
    });
    expect(cmd).toContain('-e \'l1_name="My L1"\'');
  });

  it('always emits an explicit ws_url override — empty when unknown — to defeat the playbook default', () => {
    const cmd = genAnsibleByoCommand({
      blockchainId: 'x',
      evmChainId: 1,
      chainName: 'A',
      rpcUrl: 'https://node.example.com/rpc-gateway',
    });
    expect(cmd).toContain('-e \'ws_url=""\'');
    expect(cmd.endsWith('\\')).toBe(false);
  });
});

describe('genHelmBlockscoutCommand', () => {
  it('renders the direct helm install with all l1 values set', () => {
    const cmd = genHelmBlockscoutCommand({
      blockchainId: BLOCKCHAIN_ID,
      evmChainId: 99999,
      chainName: 'My L1',
      rpcUrl: `http://l1-rpc:9650/ext/bc/${BLOCKCHAIN_ID}/rpc`,
      wsUrl: `ws://l1-rpc:9650/ext/bc/${BLOCKCHAIN_ID}/ws`,
    });
    expect(cmd).toContain('helm upgrade --install blockscout ./helm/blockscout');
    expect(cmd).toContain(`--set "l1.chainId=${BLOCKCHAIN_ID}"`);
    expect(cmd).toContain('--set "l1.evmChainId=99999"');
    expect(cmd).toContain('--set "l1.chainName=My L1"');
    expect(cmd).toContain(`--set "l1.rpcUrl=http://l1-rpc:9650/ext/bc/${BLOCKCHAIN_ID}/rpc"`);
    expect(cmd).toContain(`--set "l1.wsUrl=ws://l1-rpc:9650/ext/bc/${BLOCKCHAIN_ID}/ws"`);
  });

  it('never emits an empty l1.wsUrl --set line', () => {
    const cmd = genHelmBlockscoutCommand({
      blockchainId: 'x',
      evmChainId: 1,
      chainName: 'A',
      rpcUrl: 'https://node.example.com/rpc-gateway',
    });
    expect(cmd).not.toContain('l1.wsUrl');
    expect(cmd.endsWith('\\')).toBe(false);
  });

  it('escapes commas and double quotes in the chain name for --set', () => {
    const cmd = genHelmBlockscoutCommand({
      blockchainId: 'x',
      evmChainId: 1,
      chainName: 'My L1, "The Chain"',
      rpcUrl: 'https://node.example.com/ext/bc/abc/rpc',
    });
    expect(cmd).toContain('--set "l1.chainName=My L1\\, \\"The Chain\\""');
  });
});

describe('genTerraformBlockscoutCommand quoting', () => {
  it('escapes double quotes in the chain name', () => {
    const cmd = genTerraformBlockscoutCommand({
      blockchainId: 'x',
      evmChainId: 1,
      chainName: 'The "Best" L1',
    });
    expect(cmd).toContain('CHAIN_NAME="The \\"Best\\" L1"');
  });
});

describe('genInClusterRpcUrls', () => {
  it('targets the avalanche-deploy l1-rpc release', () => {
    expect(genInClusterRpcUrls(BLOCKCHAIN_ID)).toEqual({
      rpcUrl: `http://l1-rpc:9650/ext/bc/${BLOCKCHAIN_ID}/rpc`,
      wsUrl: `ws://l1-rpc:9650/ext/bc/${BLOCKCHAIN_ID}/ws`,
    });
  });
});

describe('deriveWsUrl', () => {
  it('derives wss from https and rewrites /rpc to /ws', () => {
    expect(deriveWsUrl('https://node.example.com/ext/bc/abc/rpc')).toBe('wss://node.example.com/ext/bc/abc/ws');
  });

  it('derives ws from http', () => {
    expect(deriveWsUrl('http://10.0.0.5:9650/ext/bc/abc/rpc')).toBe('ws://10.0.0.5:9650/ext/bc/abc/ws');
  });

  it('tolerates trailing slashes', () => {
    expect(deriveWsUrl('https://node.example.com/ext/bc/abc/rpc/')).toBe('wss://node.example.com/ext/bc/abc/ws');
  });

  it('returns null for URLs not ending in /rpc', () => {
    expect(deriveWsUrl('https://rpc-gateway.example.com/mychain')).toBeNull();
  });

  it('returns null for non-http protocols', () => {
    expect(deriveWsUrl('ipc:///tmp/geth.ipc/rpc')).toBeNull();
  });
});
