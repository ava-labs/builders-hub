import { describe, expect, it } from 'vitest';
import ExampleERC20 from '@/contracts/icm-contracts/compiled/ExampleERC20.json';

// The ICTT Token step, DeployExampleERC20 and the Activity row say that the deploy mints 10,000,000,000 tokens.
describe('the compiled ExampleERC20', () => {
  it('mints 1e28 base units to the deployer: 10,000,000,000 tokens at 18 decimals', () => {
    const supply = 10n ** 28n;
    // The constructor pushes msg.sender (CALLER, 0x33), then the amount (PUSH12, 0x6b), then calls _mint.
    const mintToDeployer = `336b${supply.toString(16).padStart(24, '0')}`;
    expect(ExampleERC20.bytecode.object.toLowerCase()).toContain(mintToDeployer);
    expect(supply / 10n ** 18n).toBe(10_000_000_000n);
  });
});
