import axios from 'axios';
import { FileConfig } from './shared.mts';
import { smartSplitSlugToTitle } from './string-utils.mts';

interface GitHubTreeItem {
  path: string;
  mode: string;
  type: string;
  sha: string;
  size?: number;
  url: string;
}

interface GitHubTreeResponse {
  sha: string;
  url: string;
  tree: GitHubTreeItem[];
  truncated: boolean;
}

/**
 * Fetches the file tree from a GitHub repository
 */
async function fetchGitHubTree(owner: string, repo: string, branch: string = 'main'): Promise<GitHubTreeItem[]> {
  try {
    // First, get the latest commit SHA for the branch
    const branchResponse = await axios.get(`https://api.github.com/repos/${owner}/${repo}/branches/${branch}`);
    const commitSha = branchResponse.data.commit.sha;
    
    // Then, get the tree for that commit with recursive=true to get all files
    const treeResponse = await axios.get<GitHubTreeResponse>(
      `https://api.github.com/repos/${owner}/${repo}/git/trees/${commitSha}?recursive=true`
    );
    
    return treeResponse.data.tree;
  } catch (error) {
    console.error(`Failed to fetch GitHub tree for ${owner}/${repo}:`, error);
    return [];
  }
}

/**
 * Filters and maps documentation files to FileConfig objects
 */
function mapDocsToConfigs(
  files: GitHubTreeItem[],
  owner: string,
  repo: string,
  branch: string,
  docsPattern: RegExp,
  outputBasePath: string,
  excludePattern?: RegExp
): FileConfig[] {
  const configs: FileConfig[] = [];
  
  // Filter for markdown files in docs directories
  const docFiles = files.filter(file => 
    file.type === 'blob' && 
    docsPattern.test(file.path) &&
    (file.path.endsWith('.md') || file.path.endsWith('.mdx')) &&
    (!excludePattern || !excludePattern.test(file.path))
  );
  
  
  docFiles.forEach(file => {
    const pathParts = file.path.split('/');
    const filename = pathParts[pathParts.length - 1] || '';
    const filenameBase = filename.replace(/\.(md|mdx)$/i, '');
    const isReadme = /README\.(md|mdx)$/i.test(filename);

    // Determine SDK root (chainkit|client|interchain)
    const sdkRoot = pathParts[0];
    const sdkDisplay = sdkRoot === 'chainkit' ? 'Chainkit' : sdkRoot === 'client' ? 'Client' : sdkRoot === 'interchain' ? 'Interchain' : '';

    // Known slug → human title map to avoid concatenations like "Addressbalances"
    const slugTitleMap: Record<string, string> = {
      addressbalances: 'Address Balances',
      addresschains: 'Address Chains',
      addresscontracts: 'Address Contracts',
      addresstransactions: 'Address Transactions',
      addresses: 'Addresses',
      avalanche: 'Avalanche',
      contracts: 'Contracts',
      data: 'Data',
      evmblocks: 'EVM Blocks',
      evmchains: 'EVM Chains',
      evmtransactions: 'EVM Transactions',
      icm: 'ICM',
      l1validators: 'L1 Validators',
      metrics: 'Metrics',
      metricschains: 'Metrics Chains',
      networks: 'Networks',
      nfts: 'NFTs',
      operations: 'Operations',
      primarynetwork: 'Primary Network',
      primarynetworkbalances: 'Primary Network Balances',
      primarynetworkblocks: 'Primary Network Blocks',
      primarynetworktransactions: 'Primary Network Transactions',
      rewards: 'Rewards',
      signatureaggregator: 'Signature Aggregator',
      subnets: 'Subnets',
      teleporter: 'Teleporter',
      usagemetrics: 'Usage Metrics',
      utxos: 'UTXOs',
      vertices: 'Vertices',
      webhooks: 'Webhooks'
    };

    // Build a human title from a slug (fallback)
    const toTitle = (slug: string) => slugTitleMap[slug] || smartSplitSlugToTitle(slug);

    // Determine a better slug candidate for section titles
    let slugCandidate = filenameBase;
    // If README in nested dir → use parent directory name
    if (isReadme && pathParts.length > 1) {
      const parentDir = pathParts[pathParts.length - 2];
      slugCandidate = parentDir || slugCandidate;
    }
    // If index file inside a section folder → use the folder name
    if (!isReadme && /^index$/i.test(filenameBase) && pathParts.length > 1) {
      const parentDir = pathParts[pathParts.length - 2];
      slugCandidate = parentDir || slugCandidate;
    }

    // Compute title base
    let titleBase = toTitle(slugCandidate);

    // Determine final title and description
    let title = titleBase;
    let description = '';

    if (sdkDisplay) {
      if (isReadme && pathParts.length === 2) {
        // Top-level SDK README (e.g., chainkit/README.md)
        title = `${sdkDisplay} SDK Overview`;
        description = `Overview and guide for the ${sdkDisplay} SDK.`;
      } else {
        // Child pages should not be prefixed with SDK name
        title = titleBase;
        description = `${sdkDisplay} SDK documentation for ${titleBase.toLowerCase()}`;
      }
    }
    
    // Generate output path
    let outputPath = file.path;
    
    // Handle different directory structures
    if (file.path.match(/^(chainkit|client|interchain)\/docs\//)) {
      // Files in docs/ subdirectory
      outputPath = outputPath.replace(/^(chainkit|client|interchain)\/docs\//, `${outputBasePath}/$1/`);
    } else if (file.path.match(/^(chainkit|client|interchain)\//)) {
      // Files directly in the SDK directory
      outputPath = outputPath.replace(/^(chainkit|client|interchain)\//, `${outputBasePath}/$1/`);
    }
    
    // Convert README files to index.mdx
    outputPath = outputPath.replace(/README\.(md|mdx)$/i, 'index.mdx');
    // Ensure all files have .mdx extension
    outputPath = outputPath.replace(/\.md$/, '.mdx');
    
    configs.push({
      sourceUrl: `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${file.path}`,
      outputPath,
      title,
      description: description || `Documentation for ${titleBase}`,
      contentUrl: `https://github.com/${owner}/${repo}/blob/${branch}/${file.path.substring(0, file.path.lastIndexOf('/'))}`,
    });
  });
  
  return configs;
}

/**
 * Fetches all SDK documentation configurations dynamically from the GitHub repository
 */
export async function fetchAvalancheSDKConfigs(): Promise<FileConfig[]> {
  const owner = 'ava-labs';
  const repo = 'avalanche-sdk-typescript';
  const branch = 'main';
  
  console.log(`Fetching documentation structure from ${owner}/${repo}...`);
  
  const files = await fetchGitHubTree(owner, repo, branch);
  
  if (files.length === 0) {
    console.warn('No files found in repository. Using fallback configuration.');
    return [];
  }
  
  // Pattern to match documentation files in the SDK subdirectories
  // Include auto-generated models and operations directories as well
  const docsPattern = /^(chainkit|client|interchain)\//;
  const excludePattern = undefined as unknown as RegExp | undefined;
  
  const configs = mapDocsToConfigs(
    files,
    owner,
    repo,
    branch,
    docsPattern,
    'content/docs/sdks/avalanche-sdk-typescript',
    excludePattern
  );
  
  console.log(`Found ${configs.length} documentation files to fetch.`);
  
  return configs;
}

/**
 * Gets all SDK configurations including static ones and dynamically fetched ones
 */
export async function getAllSDKConfigs(): Promise<FileConfig[]> {
  const configs: FileConfig[] = [];
  
  // Add static AvalancheJS config
  configs.push({
    sourceUrl: "https://raw.githubusercontent.com/ava-labs/avalanchejs/refs/heads/master/README.md",
    outputPath: "content/docs/sdks/avalanchejs/installation.mdx",
    title: "Installation",
    description: "This page is an overview of the AvalancheJS installation.",
    contentUrl: "https://github.com/ava-labs/avalanchejs/blob/refs/heads/master/",
  });
  
  // Add main Avalanche SDK TypeScript README
  configs.push({
    sourceUrl: "https://raw.githubusercontent.com/ava-labs/avalanche-sdk-typescript/main/README.md",
    outputPath: "content/docs/sdks/avalanche-sdk-typescript/installation.mdx",
    title: "Installation",
    description: "This page is an overview of the Avalanche SDK Typescript installation.",
    contentUrl: "https://github.com/ava-labs/avalanche-sdk-typescript/blob/main/",
  });
  
  // Fetch all other docs dynamically
  const dynamicConfigs = await fetchAvalancheSDKConfigs();
  configs.push(...dynamicConfigs);
  
  return configs;
}
