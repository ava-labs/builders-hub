import { FileConfig } from './shared.mts';
import axios from 'axios';

interface GitHubRelease {
  tag_name: string;
  name: string;
  body: string;
  draft: boolean;
  prerelease: boolean;
  published_at: string;
  html_url: string;
  assets: {
    name: string;
    browser_download_url: string;
    size: number;
  }[];
}

interface ReleaseInfo {
  version: string;
  name: string;
  body: string;
  isPrerelease: boolean;
  publishedAt: string;
  htmlUrl: string;
  component: 'icm-relayer' | 'signature-aggregator';
  assets: {
    name: string;
    downloadUrl: string;
    size: number;
  }[];
}

/**
 * Fetch releases from the ICM Services GitHub repository
 */
async function fetchIcmServicesReleases(): Promise<GitHubRelease[]> {
  try {
    const response = await axios.get<GitHubRelease[]>(
      'https://api.github.com/repos/ava-labs/icm-services/releases',
      {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Avalanche-Docs-Bot'
        },
        params: {
          per_page: 30 // Get more releases since there are two components
        }
      }
    );

    return response.data.filter(release => !release.draft);
  } catch (error) {
    console.error('Failed to fetch ICM Services releases from GitHub:', error);
    throw new Error('Unable to fetch ICM Services releases from GitHub repository');
  }
}

/**
 * Parse release information from GitHub release data
 */
function parseReleaseInfo(release: GitHubRelease): ReleaseInfo {
  // Determine which component this release is for based on tag name
  let component: 'icm-relayer' | 'signature-aggregator';
  if (release.tag_name.startsWith('icm-relayer')) {
    component = 'icm-relayer';
  } else if (release.tag_name.startsWith('signature-aggregator')) {
    component = 'signature-aggregator';
  } else {
    // Default to relayer for older releases
    component = 'icm-relayer';
  }

  // Extract version number from tag (e.g., "icm-relayer-v1.7.4" -> "v1.7.4")
  const version = release.tag_name.replace(/^(icm-relayer-|signature-aggregator-)/, '');

  return {
    version,
    name: release.name || release.tag_name,
    body: release.body || '',
    isPrerelease: release.prerelease,
    publishedAt: release.published_at,
    htmlUrl: release.html_url,
    component,
    assets: release.assets.map(asset => ({
      name: asset.name,
      downloadUrl: asset.browser_download_url,
      size: asset.size
    }))
  };
}

/**
 * Format file size in human readable format
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Generate the ICM Services releases MDX content
 */
function generateIcmReleasesContent(releases: ReleaseInfo[]): string {
  // Separate releases by component
  const relayerReleases = releases.filter(r => r.component === 'icm-relayer');
  const sigAggReleases = releases.filter(r => r.component === 'signature-aggregator');

  // Get latest stable releases for each component
  const latestRelayer = relayerReleases.find(r => !r.isPrerelease);
  const latestSigAgg = sigAggReleases.find(r => !r.isPrerelease);

  // Format date for display
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  // Generate release section for a single release
  const generateReleaseSection = (release: ReleaseInfo) => {
    const releaseType = release.isPrerelease ? ' (Pre-release)' : '';
    const linuxAmd64 = release.assets.find(a => a.name.includes('linux_amd64') && a.name.endsWith('.tar.gz') && !a.name.endsWith('.sig'));
    const linuxArm64 = release.assets.find(a => a.name.includes('linux_arm64') && a.name.endsWith('.tar.gz') && !a.name.endsWith('.sig'));
    const darwinAmd64 = release.assets.find(a => a.name.includes('darwin_amd64') && a.name.endsWith('.tar.gz') && !a.name.endsWith('.sig'));
    const darwinArm64 = release.assets.find(a => a.name.includes('darwin_arm64') && a.name.endsWith('.tar.gz') && !a.name.endsWith('.sig'));

    // Extract summary from release body (first paragraph)
    let summary = release.body.split(/\n##/)[0].trim();
    // Remove "What's Changed" section if present
    summary = summary.replace(/^## What's Changed[\s\S]*$/m, '').trim();
    // Remove "Changelog" section if present
    summary = summary.replace(/^## Changelog[\s\S]*$/m, '').trim();
    // Get first meaningful paragraph
    const paragraphs = summary.split('\n\n').filter(p => p.trim() && !p.startsWith('*'));
    const briefSummary = paragraphs[0]?.slice(0, 400) || '';

    return `
### ${release.version}${releaseType}

**Released:** ${formatDate(release.publishedAt)} | [View on GitHub](${release.htmlUrl})

${briefSummary}${briefSummary.length >= 400 ? '...' : ''}

<Accordions>
<Accordion title="Download Assets">

| Platform | File | Size |
|----------|------|------|
${linuxAmd64 ? `| Linux (AMD64) | [${linuxAmd64.name}](${linuxAmd64.downloadUrl}) | ${formatFileSize(linuxAmd64.size)} |` : ''}
${linuxArm64 ? `| Linux (ARM64) | [${linuxArm64.name}](${linuxArm64.downloadUrl}) | ${formatFileSize(linuxArm64.size)} |` : ''}
${darwinAmd64 ? `| macOS (AMD64) | [${darwinAmd64.name}](${darwinAmd64.downloadUrl}) | ${formatFileSize(darwinAmd64.size)} |` : ''}
${darwinArm64 ? `| macOS (ARM64) | [${darwinArm64.name}](${darwinArm64.downloadUrl}) | ${formatFileSize(darwinArm64.size)} |` : ''}

</Accordion>
</Accordions>
`;
  };

  // Generate sections for each component (limit to 5 most recent stable releases each)
  const relayerSections = relayerReleases
    .filter(r => !r.isPrerelease)
    .slice(0, 5)
    .map(generateReleaseSection)
    .join('\n');

  const sigAggSections = sigAggReleases
    .filter(r => !r.isPrerelease)
    .slice(0, 5)
    .map(generateReleaseSection)
    .join('\n');

  const content = `---
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

  return content;
}

/**
 * Generate configurations for ICM Services releases
 */
export async function getIcmReleasesConfigs(): Promise<FileConfig[]> {
  console.log('Fetching ICM Services releases from GitHub...');

  const releases = await fetchIcmServicesReleases();
  const releaseInfos = releases.map(parseReleaseInfo);

  const relayerCount = releaseInfos.filter(r => r.component === 'icm-relayer').length;
  const sigAggCount = releaseInfos.filter(r => r.component === 'signature-aggregator').length;
  console.log(`Found ${releaseInfos.length} releases (${relayerCount} relayer, ${sigAggCount} signature-aggregator)`);

  // Generate the releases page content
  const content = generateIcmReleasesContent(releaseInfos);

  const configs: FileConfig[] = [
    {
      sourceUrl: 'https://api.github.com/repos/ava-labs/icm-services/releases',
      outputPath: 'content/docs/cross-chain/avalanche-warp-messaging/releases.mdx',
      title: 'ICM Services Releases',
      description: 'Track ICM Relayer and Signature Aggregator releases, version compatibility, and download binaries.',
      contentUrl: 'https://github.com/ava-labs/icm-services/releases',
      content: content
    }
  ];

  return configs;
}
