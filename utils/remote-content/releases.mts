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
  assets: {
    name: string;
    downloadUrl: string;
    size: number;
  }[];
}

/**
 * Fetch releases from the AvalancheGo GitHub repository
 */
async function fetchAvalancheGoReleases(): Promise<GitHubRelease[]> {
  try {
    const response = await axios.get<GitHubRelease[]>(
      'https://api.github.com/repos/ava-labs/avalanchego/releases',
      {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Avalanche-Docs-Bot'
        },
        params: {
          per_page: 20 // Get the 20 most recent releases
        }
      }
    );

    return response.data.filter(release => !release.draft);
  } catch (error) {
    console.error('Failed to fetch AvalancheGo releases from GitHub:', error);
    throw new Error('Unable to fetch AvalancheGo releases from GitHub repository');
  }
}

/**
 * Parse release information from GitHub release data
 */
function parseReleaseInfo(release: GitHubRelease): ReleaseInfo {
  return {
    version: release.tag_name,
    name: release.name || release.tag_name,
    body: release.body || '',
    isPrerelease: release.prerelease,
    publishedAt: release.published_at,
    htmlUrl: release.html_url,
    assets: release.assets.map(asset => ({
      name: asset.name,
      downloadUrl: asset.browser_download_url,
      size: asset.size
    }))
  };
}

/**
 * Extract network upgrade info from release body
 */
function extractNetworkUpgradeInfo(body: string): { acps: string[]; activationDate?: string } {
  const acps: string[] = [];
  let activationDate: string | undefined;

  // Match ACP references like [ACP-181], ACP-181, etc.
  const acpMatches = body.match(/ACP-(\d+)/g);
  if (acpMatches) {
    acps.push(...new Set(acpMatches));
  }

  // Try to extract mainnet activation date
  const dateMatch = body.match(/(?:mainnet|Mainnet)[^\n]*(?:on|at)\s+([A-Za-z]+\s+\d+(?:st|nd|rd|th)?,?\s+\d{4})/i);
  if (dateMatch) {
    activationDate = dateMatch[1];
  }

  return { acps, activationDate };
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
 * Generate the releases MDX content
 */
function generateReleasesContent(releases: ReleaseInfo[]): string {
  const stableReleases = releases.filter(r => !r.isPrerelease);
  const latestStable = stableReleases[0];

  // Format date for display
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  // Generate release sections
  const releaseSections = releases.slice(0, 10).map(release => {
    const { acps } = extractNetworkUpgradeInfo(release.body);
    const releaseType = release.isPrerelease ? ' (Pre-release)' : '';
    const linuxAmd64 = release.assets.find(a => a.name.includes('linux-amd64') && a.name.endsWith('.tar.gz') && !a.name.endsWith('.sig'));
    const linuxArm64 = release.assets.find(a => a.name.includes('linux-arm64') && a.name.endsWith('.tar.gz') && !a.name.endsWith('.sig'));
    const macos = release.assets.find(a => a.name.includes('macos') && a.name.endsWith('.zip') && !a.name.endsWith('.sig'));

    // Extract summary from release body (first paragraph or up to first ##)
    let summary = release.body.split(/\n##/)[0].trim();
    // Remove the "What's Changed" section if it's at the beginning
    summary = summary.replace(/^## What's Changed[\s\S]*$/m, '').trim();
    // Get first meaningful paragraph
    const paragraphs = summary.split('\n\n').filter(p => p.trim() && !p.startsWith('**'));
    const briefSummary = paragraphs[0]?.slice(0, 300) || '';

    return `
### ${release.version} - ${release.name}${releaseType}

**Released:** ${formatDate(release.publishedAt)} | [View on GitHub](${release.htmlUrl})

${briefSummary}${briefSummary.length >= 300 ? '...' : ''}

${acps.length > 0 ? `**ACPs Included:** ${acps.join(', ')}\n` : ''}
<Accordions>
<Accordion title="Download Assets">

| Platform | File | Size |
|----------|------|------|
${linuxAmd64 ? `| Linux (AMD64) | [${linuxAmd64.name}](${linuxAmd64.downloadUrl}) | ${formatFileSize(linuxAmd64.size)} |` : ''}
${linuxArm64 ? `| Linux (ARM64) | [${linuxArm64.name}](${linuxArm64.downloadUrl}) | ${formatFileSize(linuxArm64.size)} |` : ''}
${macos ? `| macOS | [${macos.name}](${macos.downloadUrl}) | ${formatFileSize(macos.size)} |` : ''}

</Accordion>
</Accordions>
`;
  }).join('\n');

  const content = `---
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

  return content;
}

/**
 * Generate configurations for AvalancheGo releases
 */
export async function getReleasesConfigs(): Promise<FileConfig[]> {
  console.log('Fetching AvalancheGo releases from GitHub...');

  const releases = await fetchAvalancheGoReleases();
  const releaseInfos = releases.map(parseReleaseInfo);

  console.log(`Found ${releaseInfos.length} releases`);

  // Generate the releases page content
  const content = generateReleasesContent(releaseInfos);

  const configs: FileConfig[] = [
    {
      sourceUrl: 'https://api.github.com/repos/ava-labs/avalanchego/releases', // Not actually used for fetching
      outputPath: 'content/docs/nodes/maintain/releases.mdx',
      title: 'AvalancheGo Releases',
      description: 'Track AvalancheGo releases, network upgrades, and version compatibility for your node.',
      contentUrl: 'https://github.com/ava-labs/avalanchego/releases',
      content: content // Directly provide generated content
    }
  ];

  return configs;
}
