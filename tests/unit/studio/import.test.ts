import { describe, expect, it } from 'vitest';
import { briefMarkdown, parseRemappings, planImport, satisfiesPragma } from '@/lib/studio/import';

const foundry = [
  {
    path: 'my-token/foundry.toml',
    content: '[profile.default]\nsrc = "src"\nremappings = ["openzeppelin/=lib/openzeppelin-contracts/contracts/"]',
  },
  { path: 'my-token/remappings.txt', content: '@solmate/=lib/solmate/src/\nforge-std/=lib/forge-std/src/' },
  {
    path: 'my-token/src/Token.sol',
    content:
      '// SPDX-License-Identifier: MIT\npragma solidity ^0.8.20;\nimport {ERC20} from "openzeppelin/token/ERC20/ERC20.sol";\nimport {Owned} from "@solmate/auth/Owned.sol";\nimport "./utils/Math.sol";\ncontract Token is ERC20 {}',
  },
  { path: 'my-token/src/utils/Math.sol', content: 'pragma solidity >=0.8.0 <0.9.0;\nlibrary Math {}' },
  { path: 'my-token/src/Old.sol', content: 'pragma solidity 0.7.6;\ncontract Old {}' },
  {
    path: 'my-token/test/Token.t.sol',
    content:
      'pragma solidity ^0.8.20;\nimport "forge-std/Test.sol";\nimport {Token} from "../src/Token.sol";\nimport {Token as T} from "src/Token.sol";\ncontract TokenTest {}',
  },
  {
    path: 'my-token/script/Deploy.s.sol',
    content: 'pragma solidity ^0.8.20;\nimport {Script} from "forge-std/Script.sol";\ncontract Deploy {}',
  },
  { path: 'my-token/lib/openzeppelin-contracts/contracts/token/ERC20/ERC20.sol', content: 'contract ERC20 {}' },
  { path: 'my-token/out/Token.sol/Token.json', content: '{}' },
  { path: 'my-token/README.md', content: '# My token' },
  { path: 'my-token/.github/workflows/test.yml', content: 'on: push' },
];

describe('planImport', () => {
  const plan = planImport(foundry);
  const byPath = Object.fromEntries(plan.files.map((f) => [f.path, f]));

  it('maps a Foundry layout into Studio folders, dropping the shared root folder', () => {
    expect(plan.framework).toBe('foundry');
    expect(Object.keys(byPath).sort()).toEqual([
      'contracts/Old.sol',
      'contracts/Token.sol',
      'contracts/utils/Math.sol',
      'docs/README.md',
      'script/Deploy.s.sol',
      'test/Token.t.sol',
    ]);
    expect(plan.counts).toEqual({ contracts: 3, tests: 1, scripts: 1, docs: 1 });
    expect(byPath['contracts/Token.sol'].from).toBe('src/Token.sol');
  });

  it('never imports dependencies, build output or hidden folders', () => {
    const skipped = Object.fromEntries(plan.skipped.map((s) => [s.path, s.reason]));
    expect(skipped['lib/openzeppelin-contracts/contracts/token/ERC20/ERC20.sol']).toBe('dependency or build output');
    expect(skipped['out/Token.sol/Token.json']).toBe('dependency or build output');
    expect(skipped['.github/workflows/test.yml']).toBe('hidden file or folder');
  });

  it("rewrites imports to the moved folders and to Studio's OpenZeppelin", () => {
    expect(byPath['contracts/Token.sol'].content).toContain('from "@openzeppelin/contracts/token/ERC20/ERC20.sol"');
    expect(byPath['contracts/Token.sol'].content).toContain('import "./utils/Math.sol"');
    expect(byPath['test/Token.t.sol'].content).toContain('from "../contracts/Token.sol"');
    expect(byPath['test/Token.t.sol'].content).toContain('from "contracts/Token.sol"');
  });

  it('says which imports Studio can and cannot compile', () => {
    expect(plan.imports).toEqual({
      supported: ['@openzeppelin/contracts'],
      testOnly: ['forge-std'],
      unsupported: ['@solmate/auth'],
    });
  });

  it('flags contracts pinned to a compiler Studio does not use', () => {
    expect(plan.pragmaConflicts).toEqual([{ path: 'contracts/Old.sol', pragma: '0.7.6' }]);
  });

  it('keeps a Hardhat layout and notes an older OpenZeppelin', () => {
    const hardhat = planImport([
      { path: 'hardhat.config.ts', content: 'export default {}' },
      { path: 'package.json', content: JSON.stringify({ dependencies: { '@openzeppelin/contracts': '^4.9.3' } }) },
      {
        path: 'contracts/Vault.sol',
        content: 'pragma solidity ^0.8.0;\nimport "@openzeppelin/contracts/access/Ownable.sol";',
      },
      { path: 'node_modules/@openzeppelin/contracts/access/Ownable.sol', content: 'contract Ownable {}' },
    ]);
    expect(hardhat.framework).toBe('hardhat');
    expect(hardhat.files.map((f) => f.path)).toEqual(['contracts/Vault.sol']);
    expect(hardhat.openZeppelin).toEqual({ declared: '^4.9.3', studio: '5.3.0' });
  });

  it('skips files too large to store and paths Studio cannot hold', () => {
    const plan = planImport([
      { path: 'src/Big.sol', content: 'x'.repeat(201 * 1024) },
      { path: 'src/my folder/A.sol', content: 'contract A {}' },
    ]);
    expect(plan.files).toEqual([]);
    expect(plan.skipped.map((s) => s.reason)).toEqual([
      'larger than 200 KB',
      'folder or file name Studio cannot store',
    ]);
  });
});

describe('satisfiesPragma', () => {
  it.each([
    ['^0.8.20', true],
    ['^0.8.29', false],
    ['>=0.8.0 <0.9.0', true],
    ['0.8.19', false],
    ['=0.8.28', true],
    ['~0.8.20', true],
    ['^0.7.0 || ^0.8.0', true],
    ['<0.8.20', false],
  ])('0.8.28 against %s is %s', (constraint, expected) => {
    expect(satisfiesPragma('0.8.28', constraint)).toBe(expected);
  });
});

describe('parseRemappings', () => {
  it('reads remappings.txt and foundry.toml, dropping contexts', () => {
    expect(
      parseRemappings([
        { path: 'remappings.txt', content: 'src:@oz/=lib/oz/\n# comment\n' },
        { path: 'foundry.toml', content: 'remappings = ["a/=lib/a/"]' },
      ]),
    ).toEqual([
      { prefix: '@oz/', target: 'lib/oz/' },
      { prefix: 'a/', target: 'lib/a/' },
    ]);
  });
});

describe('briefMarkdown', () => {
  it('records what the builder needs and what Studio found', () => {
    const brief = briefMarkdown(planImport(foundry), 'A capped ERC-20 for our game.', ['audit', 'deploy']);
    expect(brief).toContain('A capped ERC-20 for our game.');
    expect(brief).toContain('- Audit them');
    expect(brief).toContain('- Plan and run deploy steps on testnet');
    expect(brief).toContain('- @solmate/auth');
    expect(brief).toContain('contracts/Old.sol (0.7.6)');
  });

  it("keeps the builder's own sections when a re-import says nothing new", () => {
    const first = briefMarkdown(planImport(foundry), 'A capped ERC-20 for our game.', ['audit']);
    const again = briefMarkdown(planImport(foundry.filter((f) => !f.path.endsWith('Old.sol'))), '', [], first);
    expect(again).toContain('A capped ERC-20 for our game.');
    expect(again).toContain('- Audit them');
    expect(again).not.toContain('Old.sol');
    expect(briefMarkdown(planImport(foundry), 'Now a vault too.', [], first)).not.toContain('A capped ERC-20');
  });
});
