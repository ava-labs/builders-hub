import { describe, expect, it } from 'vitest';
import {
  blueprintCatalog,
  formatBlueprintForModel,
  formatCatalogForModel,
  listBlueprintIds,
  listBlueprints,
  loadRegistry,
  resolveRef,
  UnresolvedRefError,
} from '@/lib/blueprints';
import { collectRefs, parseRef } from '@/lib/blueprints/refs';
import { validateAll } from '@/lib/blueprints/validate';

describe('blueprints directory', () => {
  it('has no validation issues', () => {
    expect(validateAll()).toEqual([]);
  });

  it('lists every blueprint in the model catalog', () => {
    const ids = listBlueprintIds();
    const catalog = formatCatalogForModel();
    for (const id of ids) expect(catalog).toContain(`\`${id}\``);
    expect(blueprintCatalog().map((entry) => entry.id)).toEqual(ids);
  });

  it('gives the model resolved registry values, not references to look up', () => {
    const registry = loadRegistry();
    const context = formatBlueprintForModel('usdc-checkout');
    expect(context).toContain(registry.networks['fuji-c-chain'].tokens.USDC.address);

    const mainnet = formatBlueprintForModel('usdc-checkout', { bindings: { networks: { main: 'mainnet-c-chain' } } });
    expect(mainnet).toContain(registry.networks['mainnet-c-chain'].tokens.USDC.address);
  });

  it('gives the model helper libraries, not only manifest-listed contracts', () => {
    const context = formatBlueprintForModel('icm-identity-layer');
    expect(context).toContain('## contracts/IdentityMessages.sol');
    expect(context).toContain('test/IdentityLayer.t.sol');
  });

  it('ships Foundry tests with every blueprint that has contracts', () => {
    for (const blueprint of listBlueprints()) {
      if (blueprint.sources.length === 0) continue;
      expect(blueprint.tests.length, `${blueprint.manifest.id} has contracts but no test/*.t.sol`).toBeGreaterThan(0);
    }
  });
});

describe('references', () => {
  const registry = loadRegistry();

  it('parses every scope and rejects malformed paths', () => {
    expect(parseRef('$net.main.chainlink.feeds.AVAX/USD.address')).toEqual({
      scope: 'net',
      path: ['main', 'chainlink', 'feeds', 'AVAX/USD', 'address'],
    });
    expect(parseRef('$out.deploy-token.address')?.scope).toBe('out');
    expect(parseRef('$nope.x')).toBeNull();
    expect(parseRef('$net.main..tokens')).toBeNull();
  });

  it('collects references at any depth', () => {
    expect(collectRefs({ a: ['$param.x', { b: '$ctx.builder' }], c: 'literal', d: 1 })).toEqual([
      '$param.x',
      '$ctx.builder',
    ]);
  });

  it('resolves network values through the bound role', () => {
    const value = resolveRef('$net.home.teleporter.registry', registry, { networks: { home: 'fuji-c-chain' } });
    expect(value).toBe(registry.networks['fuji-c-chain'].teleporter?.registry);
  });

  it('treats values only known at run time as unresolved until bound', () => {
    const unbound = () => resolveRef('$net.remote.teleporter.registry', registry, { networks: { remote: 'l1' } });
    expect(unbound).toThrow(UnresolvedRefError);

    const registryAddress = '0x1111111111111111111111111111111111111111';
    const bound = resolveRef('$net.remote.teleporter.registry', registry, {
      networks: { remote: 'l1' },
      runtime: { l1: { teleporter: { messenger: null, registry: registryAddress } } },
    });
    expect(bound).toBe(registryAddress);
  });

  it('resolves step outputs and context values', () => {
    const bindings = {
      networks: {},
      outputs: { 'deploy-token': { address: '0x2222222222222222222222222222222222222222' } },
      ctx: { builder: '0x3333333333333333333333333333333333333333' },
    };
    expect(resolveRef('$out.deploy-token.address', registry, bindings)).toBe('0x2222222222222222222222222222222222222222');
    expect(resolveRef('$ctx.builder', registry, bindings)).toBe('0x3333333333333333333333333333333333333333');
    expect(() => resolveRef('$out.later.address', registry, bindings)).toThrow(UnresolvedRefError);
  });
});
