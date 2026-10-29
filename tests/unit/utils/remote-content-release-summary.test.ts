import { describe, expect, it } from 'vitest';
import { extractReleaseSummary } from '@/utils/remote-content/github-releases.mts';

// The avalanchego v1.14.0 release body, verbatim with its CRLF line ends, up to its second heading
// (gh api repos/ava-labs/avalanchego/releases/tags/v1.14.0). extractReleaseSummary reads only the text before the
// first ## heading. At 300 characters the old cut fell inside the ACP-204 URL and left .../ACPs/20, a dead link on
// /docs/nodes/releases.
const V1_14_0_BODY =
  'This release schedules the activation of the following Avalanche Community Proposals (ACPs):\r\n' +
  '- [ACP-181](https://github.com/avalanche-foundation/ACPs/blob/main/ACPs/181-p-chain-epoched-views/README.md) P-Chain Epoched Views\r\n' +
  '- [ACP-204](https://github.com/avalanche-foundation/ACPs/blob/main/ACPs/204-precompile-secp256r1/README.md) Precompile for secp256r1 Curve Support\r\n' +
  '- [ACP-226](https://github.com/avalanche-foundation/ACPs/blob/main/ACPs/226-dynamic-minimum-block-times/README.md) Dynamic Minimum Block Times\r\n' +
  '\r\n' +
  'The ACPs in this upgrade go into effect at 11 AM ET (4 PM UTC) on Wednesday, November 19th, 2025 on Mainnet.\r\n' +
  '\r\n' +
  '**All Mainnet nodes must upgrade before 11 AM ET, November 19th 2025.**\r\n' +
  '\r\n' +
  'The plugin version is updated to `44`; all plugins must update to be compatible.\r\n' +
  '\r\n' +
  '## LibEVM Hook Registration\r\n' +
  '\r\n' +
  'This release includes changes for how EVM modifications are registered with libevm. For consumers of avalanchego as a library, manual registration of libevm callbacks is now required.\r\n';

const urls = (text: string) => text.match(/https?:\/\/[^\s)]+/g) ?? [];

describe('extractReleaseSummary', () => {
  it('keeps every link of the v1.14.0 summary whole', () => {
    const summary = extractReleaseSummary(V1_14_0_BODY, 300);
    expect(summary).toBe(
      'This release schedules the activation of the following Avalanche Community Proposals (ACPs):\r\n' +
        '- [ACP-181](https://github.com/avalanche-foundation/ACPs/blob/main/ACPs/181-p-chain-epoched-views/README.md) P-Chain Epoched Views...',
    );
    for (const url of urls(summary)) expect(V1_14_0_BODY).toContain(`(${url})`);
  });

  it('never leaves a partial URL, for any length', () => {
    for (let maxLength = 20; maxLength <= 500; maxLength++) {
      const summary = extractReleaseSummary(V1_14_0_BODY, maxLength);
      expect(summary.length).toBeLessThanOrEqual(maxLength + 3);
      for (const url of urls(summary)) expect(V1_14_0_BODY).toContain(`(${url})`);
    }
  });

  it('cuts plain text between words', () => {
    expect(extractReleaseSummary('one two three four', 12)).toBe('one two...');
  });

  it('keeps a first word or link that alone is longer than maxLength', () => {
    const link =
      '[ACP-204](https://github.com/avalanche-foundation/ACPs/blob/main/ACPs/204-precompile-secp256r1/README.md)';
    expect(extractReleaseSummary(`${link} Precompile for secp256r1 Curve Support`, 20)).toBe(`${link}...`);
    expect(extractReleaseSummary(`- ${link} Precompile for secp256r1 Curve Support`, 20)).toBe(`- ${link}...`);
    const url = 'https://github.com/ava-labs/avalanchego/releases/tag/v1.14.0';
    expect(extractReleaseSummary(url, 20)).toBe(url);
  });

  it('returns a paragraph that fits as it is', () => {
    expect(extractReleaseSummary('Fixes a crash on start.', 23)).toBe('Fixes a crash on start.');
  });
});
