import { FileConfig } from './shared.mts';
import {
  fetchGitHubReleases,
  parseBaseReleaseInfo,
  formatDate,
  generateReleaseAccordion,
  BaseReleaseInfo
} from './github-releases.mts';

/**
 * Extract ACP references from release body
 */
function extractAcps(body: string): string[] {
  const acpMatches = body.match(/ACP-(\d+)/g);
  return acpMatches ? [...new Set(acpMatches)] : [];
}

/**
 * Generate the AvalancheGo releases MDX content
 */
function generateReleasesContent(releases: BaseReleaseInfo[]): string {
  const stableReleases = releases.filter(r => !r.isPrerelease);
  const latestStable = stableReleases[0];

  // AvalancheGo uses linux-amd64 (hyphen) and macos naming
  const avalancheGoAssetPatterns = [
    { platform: 'Linux (AMD64)', pattern: 'linux-amd64' },
    { platform: 'Linux (ARM64)', pattern: 'linux-arm64' },
    { platform: 'macOS', pattern: 'macos', extension: '.zip' }
  ];

  const releaseSections = releases.slice(0, 10).map(release => {
    const acps = extractAcps(release.body);
    const acpLine = acps.length > 0 ? `**ACPs Included:** ${acps.join(', ')}\n` : '';

    return generateReleaseAccordion(release, {
      showName: true,
      summaryMaxLength: 300,
      assetPatterns: avalancheGoAssetPatterns,
      extraContent: acpLine
    });
  }).join('\n');

  return `---
title: AvalancheGo Releases
description: Track AvalancheGo releases, network upgrades, and version compatibility for your node.
---

This page is automatically generated from the [AvalancheGo GitHub releases](https://github.com/ava-labs/avalanchego/releases).

## Current Recommended Version

| Network | Version | Release Name | Type |
|---------|---------|--------------|------|
| **Mainnet** | ${latestStable?.version || 'N/A'} | ${latestStable?.name || 'N/A'} | Stable |
| **Fuji Testnet** | ${latestStable?.version || 'N/A'} | ${latestStable?.name || 'N/A'} | Stable |

<Callout type="info">
**Always run the latest stable release** unless you're specifically testing pre-release versions on Fuji.
</Callout>

## Using the Installer Script

The [AvalancheGo installer script](/docs/nodes/run-a-node/using-install-script/installing-avalanche-go) supports installing specific versions.

### List Available Versions

\`\`\`bash
./avalanchego-installer.sh --list
\`\`\`

### Install a Specific Version

\`\`\`bash
./avalanchego-installer.sh --version ${latestStable?.version || 'v1.14.0'}
\`\`\`

### Upgrade Existing Installation

Simply run the installer script again to upgrade to the latest version:

\`\`\`bash
./avalanchego-installer.sh
\`\`\`

## Recent Releases

${releaseSections}

## All Releases

For a complete list of all AvalancheGo releases with full changelogs, visit the official [GitHub Releases page](https://github.com/ava-labs/avalanchego/releases).

## Staying Updated

### Avalanche Notify Service

Subscribe to the [Avalanche Notify service](/docs/nodes/maintain/enroll-in-avalanche-notify) to receive email notifications about new releases.

### GitHub Notifications

1. Go to the [AvalancheGo repository](https://github.com/ava-labs/avalanchego)
2. Click **Watch** → **Custom** → Check **Releases** → **Apply**

## Related Resources

- [Upgrade Your Node](/docs/nodes/maintain/upgrade) - Step-by-step upgrade instructions
- [Installing AvalancheGo](/docs/nodes/run-a-node/using-install-script/installing-avalanche-go) - Initial installation guide
- [Backup and Restore](/docs/nodes/maintain/backup-restore) - Backup your node before upgrading
`;
}

/**
 * Generate configurations for AvalancheGo releases
 */
export async function getReleasesConfigs(): Promise<FileConfig[]> {
  console.log('Fetching AvalancheGo releases from GitHub...');

  const releases = await fetchGitHubReleases('ava-labs', 'avalanchego', 20);
  const releaseInfos = releases.map(parseBaseReleaseInfo);

  console.log(`Found ${releaseInfos.length} releases`);

  const content = generateReleasesContent(releaseInfos);

  return [
    {
      sourceUrl: 'https://api.github.com/repos/ava-labs/avalanchego/releases',
      outputPath: 'content/docs/nodes/maintain/releases.mdx',
      title: 'AvalancheGo Releases',
      description: 'Track AvalancheGo releases, network upgrades, and version compatibility for your node.',
      contentUrl: 'https://github.com/ava-labs/avalanchego/releases',
      content
    }
  ];
}
