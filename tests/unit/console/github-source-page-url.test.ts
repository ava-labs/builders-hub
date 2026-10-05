import { describe, expect, it } from 'vitest';
import { githubSourcePageUrl } from '@/components/console/contract-deploy-viewer';

const COMMIT = '4d5ab0b6c1f6b5d2e9a3c7f8e0b1a2c3d4e5f6a7';

describe('githubSourcePageUrl', () => {
  it('maps a raw.githubusercontent.com URL to the /blob/ page', () => {
    expect(
      githubSourcePageUrl(
        `https://raw.githubusercontent.com/ava-labs/icm-services/${COMMIT}/contracts/mocks/ExampleERC20.sol`,
      ),
    ).toBe(`https://github.com/ava-labs/icm-services/blob/${COMMIT}/contracts/mocks/ExampleERC20.sol`);
  });

  it('keeps a branch ref path', () => {
    expect(
      githubSourcePageUrl('https://raw.githubusercontent.com/ava-labs/avalanchego/refs/heads/master/graft/a.go'),
    ).toBe('https://github.com/ava-labs/avalanchego/blob/refs/heads/master/graft/a.go');
  });

  it('maps a github.com /raw/ URL to the /blob/ page', () => {
    expect(
      githubSourcePageUrl('https://github.com/OpenZeppelin/openzeppelin-contracts/raw/v4.9.0/contracts/a.sol'),
    ).toBe('https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v4.9.0/contracts/a.sol');
  });

  it('keeps a /blob/ URL and a URL on another host as they are', () => {
    const blob = 'https://github.com/mds1/multicall/blob/main/src/Multicall3.sol';
    expect(githubSourcePageUrl(blob)).toBe(blob);
    const other = 'https://example.com/raw/a.sol';
    expect(githubSourcePageUrl(other)).toBe(other);
  });
});
