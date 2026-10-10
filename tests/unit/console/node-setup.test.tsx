import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { StorageRequirements } from '@/components/toolbox/components/StorageRequirements';
import {
  generateChainConfig,
  generateDockerCommand,
  generatePrimaryNetworkDockerCommand,
  isDebugTraceOn,
  l1PortsTileText,
  l1StorageTileText,
  primaryValidatorStorageNote,
} from '@/components/toolbox/console/layer-1/nodeConfig';

type NodeType = 'validator' | 'rpc' | 'archival';

// The storage settings that each node-type preset sets (the preset effects of AvalancheGoDockerL1.tsx and
// AvalancheGoDockerPrimaryNetwork.tsx).
const PRESETS: Record<NodeType, { pruningEnabled: boolean; stateSyncEnabled: boolean; skipTxIndexing: boolean }> = {
  validator: { pruningEnabled: true, stateSyncEnabled: true, skipTxIndexing: true },
  rpc: { pruningEnabled: true, stateSyncEnabled: true, skipTxIndexing: false },
  archival: { pruningEnabled: false, stateSyncEnabled: false, skipTxIndexing: false },
};

/** The "Initial" and "/mo" figures that the storage chart shows, as numbers of GB. */
const chartFigures = (nodeType: NodeType, network: 'mainnet' | 'fuji', variant: 'primary' | 'l1') => {
  const html = renderToStaticMarkup(
    createElement(StorageRequirements, { nodeType, ...PRESETS[nodeType], network, variant, debugEnabled: false }),
  );
  const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
  const match = text.match(/(\d+(?:\.\d+)?)(GB|TB) Initial \+(\d+(?:\.\d+)?)(GB|TB) \/mo/);
  if (!match) throw new Error(`no storage figures in: ${text}`);
  const gb = (value: string, unit: string) => Number(value) * (unit === 'TB' ? 1000 : 1);
  return { initial: gb(match[1], match[2]), monthly: gb(match[3], match[4]) };
};

describe('debug trace (F-06)', () => {
  it('never gives a validator the debug APIs, even when the hidden toggle is on', () => {
    expect(isDebugTraceOn('validator', true)).toBe(false);
    const config = generateChainConfig('validator', true);
    expect(config['eth-apis']).toBeUndefined();
  });

  it('keeps the admin API for a validator when the debug toggle is on', () => {
    const config = generateChainConfig('validator', true, true);
    expect(config['eth-apis']).toContain('admin');
    expect(config['eth-apis']).not.toContain('debug-tracer');
  });

  it('gives RPC and archival nodes the debug APIs when the toggle is on', () => {
    for (const nodeType of ['rpc', 'archival'] as const) {
      expect(isDebugTraceOn(nodeType, true)).toBe(true);
      expect(generateChainConfig(nodeType, true)['eth-apis']).toContain('debug-tracer');
      expect(generateChainConfig(nodeType, false)['eth-apis']).toBeUndefined();
    }
  });
});

describe('L1 Set up Instance tiles (F-20)', () => {
  it('shows the storage chart Initial figure for each node type and network', () => {
    for (const nodeType of ['validator', 'rpc', 'archival'] as const) {
      for (const network of ['mainnet', 'fuji'] as const) {
        const { initial } = chartFigures(nodeType, network, 'l1');
        const label = network === 'fuji' ? 'Fuji' : 'Mainnet';
        expect(l1StorageTileText(nodeType, network === 'fuji')).toBe(`~${initial} GB ${label}`);
      }
    }
  });

  it('lists only the P2P port for a validator', () => {
    expect(l1PortsTileText('validator')).toBe('9651 P2P');
    expect(l1PortsTileText('rpc')).toBe('9651 P2P · 9650 RPC');
    expect(l1PortsTileText('archival')).toBe('9651 P2P · 9650 RPC');
  });

  it('matches the Docker command: a validator binds the RPC port to localhost', () => {
    expect(generateDockerCommand('subnet', 'chain', {}, 'validator', 5)).toContain('-p 127.0.0.1:9650:9650');
    expect(generateDockerCommand('subnet', 'chain', {}, 'rpc', 5)).toContain('-p 9650:9650');
  });
});

describe('Primary Network validator storage note (F-20)', () => {
  it('uses the storage chart figures for the validator settings', () => {
    for (const network of ['mainnet', 'fuji'] as const) {
      const { initial, monthly } = chartFigures('validator', network, 'primary');
      expect(primaryValidatorStorageNote(network === 'fuji')).toBe(
        `With the validator settings, storage starts at about ${initial} GB and grows about ${monthly} GB a month.`,
      );
    }
  });
});

describe('Run Docker copy (F-08)', () => {
  const envFlags = (command: string) => command.match(/-e [A-Z_]+=/g) ?? [];

  it('passes the config file path and the VM ID to an L1 node, and nothing else', () => {
    expect(envFlags(generateDockerCommand('subnet', 'chain', {}, 'validator', 5, 'vm'))).toEqual([
      '-e AVAGO_CONFIG_FILE=',
      '-e VM_ID=',
    ]);
  });

  it('passes only the config file path to a Primary Network node', () => {
    expect(envFlags(generatePrimaryNetworkDockerCommand('validator', 1))).toEqual(['-e AVAGO_CONFIG_FILE=']);
  });
});
