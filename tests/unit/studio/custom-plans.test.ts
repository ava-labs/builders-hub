import { describe, expect, it } from 'vitest';
import { parseAbi } from 'viem';
import { loadRegistry } from '@/lib/blueprints';
import { customManifest } from '@/server/services/studio/custom-plans';
import type { CustomPlanInput } from '@/types/studio';

const tokenAbi = parseAbi([
  'constructor(string name, uint256 cap, address owner)',
  'function mint(address to, uint256 amount)',
  'function cap() view returns (uint256)',
  'function name() view returns (string)',
  'function balanceOf(address) view returns (uint256)',
]);
const vaultAbi = parseAbi(['constructor(address token)', 'function token() view returns (address)']);

const contracts = [
  { file: 'contracts/Token.sol', name: 'Token', abi: tokenAbi, bytecode: '0x60', bytecodeHash: '0x', deployable: true },
  { file: 'contracts/Vault.sol', name: 'Vault', abi: vaultAbi, bytecode: '0x60', bytecodeHash: '0x', deployable: true },
  { file: 'contracts/IToken.sol', name: 'IToken', abi: [], bytecode: '0x', bytecodeHash: '0x', deployable: false },
] as never;

const registry = loadRegistry();

function plan(overrides: Partial<CustomPlanInput> = {}): CustomPlanInput {
  return {
    title: 'Game token and vault',
    description: 'Deploys the capped token, a vault holding it, and mints to the builder.',
    networks: { main: 'fuji-c-chain' },
    steps: [
      {
        id: 'deploy-token',
        title: 'Deploy the token',
        kind: 'deploy',
        network: 'main',
        contract: 'Token',
        args: ['Game', '1000000', '$ctx.builder'],
      },
      {
        id: 'deploy-vault',
        title: 'Deploy the vault',
        kind: 'deploy',
        network: 'main',
        contract: 'Vault',
        args: ['$out.deploy-token.address'],
      },
      {
        id: 'mint',
        title: 'Mint to the builder',
        kind: 'call',
        network: 'main',
        contract: 'Token',
        target: '$out.deploy-token.address',
        function: 'mint',
        args: ['$ctx.builder', '1000'],
        signer: 'builder',
      },
    ],
    checks: [
      {
        description: 'The vault holds the token',
        after: 'deploy-vault',
        network: 'main',
        contract: 'Vault',
        target: '$out.deploy-vault.address',
        function: 'token',
        expect: { equals: '$out.deploy-token.address' },
      },
    ],
    ...overrides,
  };
}

const problems = (input: CustomPlanInput) => {
  try {
    customManifest(input, contracts, registry);
    return [];
  } catch (error) {
    return (error as Error).message.split('\n- ').slice(1);
  }
};

describe('customManifest', () => {
  it('builds a manifest the runner accepts, with the contracts from the build and a read panel', () => {
    const manifest = customManifest(plan(), contracts, registry);
    expect(manifest.id).toBe('custom-plan');
    expect(manifest.networks).toEqual({
      main: { description: 'main network', default: 'fuji-c-chain', allowed: ['fuji-c-chain'] },
    });
    expect(manifest.contracts).toEqual([
      { name: 'Token', description: 'Token from this project', source: 'contracts/Token.sol' },
      { name: 'Vault', description: 'Vault from this project', source: 'contracts/Vault.sol' },
    ]);
    expect(manifest.steps.map((s) => s.signer)).toEqual(['deployer', 'deployer', 'builder']);
    expect(manifest.panel).toEqual([
      { step: 'deploy-token', read: ['cap', 'name'], write: [] },
      { step: 'deploy-vault', read: ['token'], write: [] },
    ]);
  });

  it('lists every problem at once', () => {
    const bad = plan({
      networks: { main: 'mainnet-c-chain' },
      steps: [
        { id: 'deploy-token', title: 'Deploy', kind: 'deploy', network: 'main', contract: 'Token', args: ['Game'] },
        { id: 'deploy-missing', title: 'Deploy', kind: 'deploy', network: 'main', contract: 'Nope' },
        { id: 'deploy-iface', title: 'Deploy', kind: 'deploy', network: 'main', contract: 'IToken' },
        {
          id: 'mint',
          title: 'Mint',
          kind: 'call',
          network: 'main',
          contract: 'Token',
          target: '$out.later.address',
          function: 'mint',
          args: ['$param.to'],
        },
        { id: 'later', title: 'Later', kind: 'deploy', network: 'other', contract: 'Vault', args: ['$ctx.nobody'] },
      ],
      checks: [],
    });
    expect(problems(bad)).toEqual([
      'network main: mainnet-c-chain is not a testnet; plans run on testnet first',
      "step deploy-token: Token's constructor takes 3 arguments, got 1",
      'step deploy-missing: the latest build has no contract Nope; compile first or check the name',
      'step deploy-iface: IToken is not deployable (an interface, abstract, or needs library linking)',
      'step mint: Token.mint takes 2 arguments, got 1',
      'step mint: $out.later.address is used before step later runs',
      'step mint: $param.to: plans for your own contracts take no parameters; write the value itself',
      'step later: undeclared network role other',
      'step later: $ctx.nobody is not deployer or builder',
    ]);
  });

  it('checks references to step outputs and registry values', () => {
    expect(
      problems(
        plan({
          steps: [
            {
              id: 'read-cap',
              title: 'Read',
              kind: 'read',
              network: 'main',
              contract: 'Token',
              target: '$net.main.tokens.USDC.address',
              function: 'cap',
            },
            {
              id: 'deploy-vault',
              title: 'Vault',
              kind: 'deploy',
              network: 'main',
              contract: 'Vault',
              args: ['$out.read-cap.address'],
            },
          ],
          checks: [],
        }),
      ),
    ).toEqual(['step deploy-vault: step read-cap has no output address; use address (deploy) or txHash']);
  });
});
