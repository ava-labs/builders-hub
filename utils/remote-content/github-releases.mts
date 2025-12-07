import axios from 'axios';

/**
 * Shared types and utilities for fetching GitHub releases
 */

export interface GitHubRelease {
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

export interface ReleaseAsset {
  name: string;
  downloadUrl: string;
  size: number;
}

export interface BaseReleaseInfo {
  version: string;
  name: string;
  body: string;
  isPrerelease: boolean;
  publishedAt: string;
  htmlUrl: string;
  assets: ReleaseAsset[];
}

/**
 * Fetch releases from a GitHub repository
 */
export async function fetchGitHubReleases(
  owner: string,
  repo: string,
  perPage: number = 20
): Promise<GitHubRelease[]> {
  try {
    const response = await axios.get<GitHubRelease[]>(
      `https://api.github.com/repos/${owner}/${repo}/releases`,
      {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Avalanche-Docs-Bot'
        },
        params: {
          per_page: perPage
        }
      }
    );

    return response.data.filter(release => !release.draft);
  } catch (error) {
    console.error(`Failed to fetch releases from ${owner}/${repo}:`, error);
    throw new Error(`Unable to fetch releases from GitHub repository ${owner}/${repo}`);
  }
}

/**
 * Parse basic release information from GitHub release data
 */
export function parseBaseReleaseInfo(release: GitHubRelease): BaseReleaseInfo {
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
 * Format file size in human readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Format date for display
 */
export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

/**
 * Extract summary from release body (first meaningful paragraph)
 */
export function extractReleaseSummary(body: string, maxLength: number = 300): string {
  // Split at first ## heading
  let summary = body.split(/\n##/)[0].trim();
  // Remove "What's Changed" section if present
  summary = summary.replace(/^## What's Changed[\s\S]*$/m, '').trim();
  // Remove "Changelog" section if present
  summary = summary.replace(/^## Changelog[\s\S]*$/m, '').trim();
  // Get first meaningful paragraph (not starting with * or **)
  const paragraphs = summary.split('\n\n').filter(p => p.trim() && !p.startsWith('*') && !p.startsWith('**'));
  const briefSummary = paragraphs[0]?.slice(0, maxLength) || '';
  return briefSummary.length >= maxLength ? `${briefSummary}...` : briefSummary;
}

/**
 * Find a release asset by platform pattern
 */
export function findAsset(
  assets: ReleaseAsset[],
  pattern: string,
  extension: string = '.tar.gz'
): ReleaseAsset | undefined {
  return assets.find(a =>
    a.name.includes(pattern) &&
    a.name.endsWith(extension) &&
    !a.name.endsWith('.sig')
  );
}

/**
 * Generate download assets table row
 */
export function generateAssetRow(
  platform: string,
  asset: ReleaseAsset | undefined
): string {
  if (!asset) return '';
  return `| ${platform} | [${asset.name}](${asset.downloadUrl}) | ${formatFileSize(asset.size)} |`;
}

/**
 * Generate a release section with accordion for download assets
 */
export function generateReleaseAccordion(
  release: BaseReleaseInfo,
  options: {
    showName?: boolean;
    summaryMaxLength?: number;
    assetPatterns: { platform: string; pattern: string; extension?: string }[];
    extraContent?: string;
  }
): string {
  const releaseType = release.isPrerelease ? ' (Pre-release)' : '';
  const summary = extractReleaseSummary(release.body, options.summaryMaxLength || 300);
  const title = options.showName
    ? `${release.version} - ${release.name}${releaseType}`
    : `${release.version}${releaseType}`;

  const assetRows = options.assetPatterns
    .map(({ platform, pattern, extension }) =>
      generateAssetRow(platform, findAsset(release.assets, pattern, extension || '.tar.gz'))
    )
    .filter(row => row)
    .join('\n');

  return `
### ${title}

**Released:** ${formatDate(release.publishedAt)} | [View on GitHub](${release.htmlUrl})

${summary}

${options.extraContent || ''}
<Accordions>
<Accordion title="Download Assets">

| Platform | File | Size |
|----------|------|------|
${assetRows}

</Accordion>
</Accordions>
`;
}
