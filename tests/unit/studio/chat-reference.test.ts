import { describe, expect, it } from 'vitest';
import { codeReference } from '@/components/studio/chat-reference';

describe('codeReference', () => {
  it('names the file and lines and fences the code in its language', () => {
    expect(codeReference('contracts/NFT.sol', 12, 14, 'uint256 a;\nuint256 b;\nuint256 c;')).toBe(
      'In `contracts/NFT.sol` lines 12-14:\n```solidity\nuint256 a;\nuint256 b;\nuint256 c;\n```\n',
    );
    expect(codeReference('frontend/app.js', 3, 3, 'x()')).toContain('line 3:\n```javascript');
  });

  it('keeps a fence inside the selection from closing the block, and caps long selections', () => {
    const ref = codeReference('docs/README.md', 1, 1, 'see ```code```');
    expect(ref.match(/```/g)).toHaveLength(2);
    expect(codeReference('contracts/A.sol', 1, 400, 'x'.repeat(5_000))).toContain('(selection truncated)');
  });
});
