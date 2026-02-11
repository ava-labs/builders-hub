import { FileConfig } from './shared.mts';
import {
  fetchGitHubReleases,
  parseBaseReleaseInfo,
  formatDate,
  generateReleaseAccordion,
  BaseReleaseInfo,
  GitHubRelease
} from './github-releases.mts';

type IcmComponent = 'icm-relayer' | 'signature-aggregator';

interface IcmReleaseInfo extends BaseReleaseInfo {
  component: IcmComponent;
}

/**
 * Parse ICM release with component detection
 */
function parseIcmReleaseInfo(release: GitHubRelease): IcmReleaseInfo {
  const base = parseBaseReleaseInfo(release);

  // Determine component from tag name
  let component: IcmComponent = 'icm-relayer';
  if (release.tag_name.startsWith('signature-aggregator')) {
    component = 'signature-aggregator';
  }

  // Extract clean version (e.g., "icm-relayer-v1.7.4" -> "v1.7.4")
  const version = release.tag_name.replace(/^(icm-relayer-|signature-aggregator-)/, '');

  return {
    ...base,
    version,
    component
  };
}

/**
 * Generate the ICM Services releases MDX content
 */
function generateIcmReleasesContent(releases: IcmReleaseInfo[]): string {
  const relayerReleases = releases.filter(r => r.component === 'icm-relayer');
  const sigAggReleases = releases.filter(r => r.component === 'signature-aggregator');

  const latestRelayer = relayerReleases.find(r => !r.isPrerelease);
  const latestSigAgg = sigAggReleases.find(r => !r.isPrerelease);

  // ICM Services uses linux_amd64 (underscore) and darwin naming
  const icmAssetPatterns = [
    { platform: 'Linux (AMD64)', pattern: 'linux_amd64' },
    { platform: 'Linux (ARM64)', pattern: 'linux_arm64' },
    { platform: 'macOS (AMD64)', pattern: 'darwin_amd64' },
    { platform: 'macOS (ARM64)', pattern: 'darwin_arm64' }
  ];

  const generateSections = (componentReleases: IcmReleaseInfo[]) =>
    componentReleases
      .filter(r => !r.isPrerelease)
      .slice(0, 5)
      .map(release => generateReleaseAccordion(release, {
        showName: false,
        summaryMaxLength: 400,
        assetPatterns: icmAssetPatterns
      }))
      .join('\n');

  const relayerSections = generateSections(relayerReleases);
  const sigAggSections = generateSections(sigAggReleases);

  return `---
title: ICM Services Releases
description: Track ICM Relayer and Signature Aggregator releases, version compatibility, and download binaries.
---

This page is automatically generated from the [ICM Services GitHub releases](https://github.com/ava-labs/icm-services/releases).

## Current Recommended Versions

| Component | Version | Released | Type |
|-----------|---------|----------|------|
| **ICM Relayer** | ${latestRelayer?.version || 'N/A'} | ${latestRelayer ? formatDate(latestRelayer.publishedAt) : 'N/A'} | Stable |
| **Signature Aggregator** | ${latestSigAgg?.version || 'N/A'} | ${latestSigAgg ? formatDate(latestSigAgg.publishedAt) : 'N/A'} | Stable |

<Callout type="warn">
**Important:** ICM Services must be compatible with your AvalancheGo version. Always check the release notes for network upgrade compatibility requirements.
</Callout>

## Quick Installation

### ICM Relayer

\`\`\`bash
# Download the latest release (Linux AMD64)
curl -sL -o icm-relayer.tar.gz https://github.com/ava-labs/icm-services/releases/download/icm-relayer-${latestRelayer?.version || 'v1.7.4'}/icm-relayer_${latestRelayer?.version.replace('v', '') || '1.7.4'}_linux_amd64.tar.gz

# Extract and install
tar -xzf icm-relayer.tar.gz
sudo install icm-relayer /usr/local/bin
\`\`\`

### Signature Aggregator

\`\`\`bash
# Download the latest release (Linux AMD64)
curl -sL -o signature-aggregator.tar.gz https://github.com/ava-labs/icm-services/releases/download/signature-aggregator-${latestSigAgg?.version || 'v0.5.3'}/signature-aggregator_${latestSigAgg?.version.replace('v', '') || '0.5.3'}_linux_amd64.tar.gz

# Extract and install
tar -xzf signature-aggregator.tar.gz
sudo install signature-aggregator /usr/local/bin
\`\`\`

### Docker

Both components are available as Docker images:

\`\`\`bash
# ICM Relayer
docker pull avaplatform/icm-relayer:latest

# Signature Aggregator
docker pull avaplatform/signature-aggregator:latest
\`\`\`

## ICM Relayer Releases

The ICM Relayer listens for Warp message events on source blockchains and constructs transactions to relay messages to destination blockchains.

${relayerSections}

## Signature Aggregator Releases

The Signature Aggregator collects and aggregates BLS signatures from validators to create valid Warp message proofs.

${sigAggSections}

## All Releases

For a complete list of all ICM Services releases including pre-releases, visit the official [GitHub Releases page](https://github.com/ava-labs/icm-services/releases).

## Related Resources

- [Run a Relayer](/docs/cross-chain/avalanche-warp-messaging/run-relayer) - Detailed relayer setup guide
- [Avalanche Warp Messaging Overview](/docs/cross-chain/avalanche-warp-messaging/overview) - Understanding AWM
- [ICM Contracts](/docs/cross-chain/icm-contracts/overview) - Smart contract integration
`;
}

/**
 * Generate configurations for ICM Services releases
 */
export async function getIcmReleasesConfigs(): Promise<FileConfig[]> {
  console.log('Fetching ICM Services releases from GitHub...');

  const releases = await fetchGitHubReleases('ava-labs', 'icm-services', 30);
  const releaseInfos = releases.map(parseIcmReleaseInfo);

  const relayerCount = releaseInfos.filter(r => r.component === 'icm-relayer').length;
  const sigAggCount = releaseInfos.filter(r => r.component === 'signature-aggregator').length;
  console.log(`Found ${releaseInfos.length} releases (${relayerCount} relayer, ${sigAggCount} signature-aggregator)`);

  const content = generateIcmReleasesContent(releaseInfos);

  return [
    {
      sourceUrl: 'https://api.github.com/repos/ava-labs/icm-services/releases',
      outputPath: 'content/docs/cross-chain/avalanche-warp-messaging/releases.mdx',
      title: 'ICM Services Releases',
      description: 'Track ICM Relayer and Signature Aggregator releases, version compatibility, and download binaries.',
      contentUrl: 'https://github.com/ava-labs/icm-services/releases',
      content
    }
  ];
}
