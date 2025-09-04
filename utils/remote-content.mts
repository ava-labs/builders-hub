import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

interface FileConfig {
  sourceUrl: string;
  outputPath: string;
  title: string;
  description: string;
  contentUrl: string;
}

async function fetchFileContent(url: string): Promise<string | null> {
  try {
    const response = await axios.get<string>(url);
    return response.data;
  } catch (error) {
    console.error(`Failed to fetch ${url}:`, error);
    return null;
  }
}

function deriveEditUrlFromSourceUrl(sourceUrl: string): string {
  let editUrl = sourceUrl.replace('https://raw.githubusercontent.com/', 'https://github.com/');

  // Handle refs/heads patterns first
  if (editUrl.includes('/refs/heads/main/')) {
    editUrl = editUrl.replace('/refs/heads/main/', '/edit/main/');
  } else if (editUrl.includes('/refs/heads/master/')) {
    editUrl = editUrl.replace('/refs/heads/master/', '/edit/master/');
  } else {
    // Handle direct main/master patterns only if no refs/heads pattern was found
    editUrl = editUrl.replace(/\/main\//, '/edit/main/');
    editUrl = editUrl.replace(/\/master\//, '/edit/master/');
  }

  return editUrl;
}

function replaceRelativeLinks(content: string, sourceBaseUrl: string): string {
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)|<img[^>]*src=['"]([^'"]*)['"]/g;
  // Replace both markdown-style links and img src attributes with absolute links
  const updatedContent = content.replace(
    linkRegex,
    (match, text, markdownLink, imgSrc) => {
      if (markdownLink) {
        if (
          markdownLink.startsWith("http") ||
          markdownLink.startsWith("#") ||
          markdownLink.startsWith("mailto:")
        ) {
          // Skip absolute links and anchors
          return match;
        }
        // Convert markdown-style relative link to absolute link
        return `[${text}](${new URL(markdownLink, sourceBaseUrl).href})`;
      } else if (imgSrc) {
        if (imgSrc.startsWith("http") || imgSrc.startsWith("data:")) {
          // Skip absolute links and data URIs
          return match;
        }
        // Convert img src attribute relative link to absolute link
        return `<img src="${new URL(imgSrc, sourceBaseUrl).href}"`;
      }
      return match;
    }
  );
  return updatedContent;
}

function transformContent(content: string, customTitle: string, customDescription: string, sourceBaseUrl: string, editUrl?: string): string {
  // Remove any existing frontmatter
  content = content.replace(/^---\n[\s\S]*?\n---\n/, '');

  // Remove the first heading as we'll use the frontmatter title
  content = content.replace(/^#\s+.+\n/, '');

  // Convert GitHub-flavored markdown to MDX-compatible syntax
  content = content
    // Convert note blocks to proper MDX format
    .replace(/>\s*\[NOTE\]\s*(.*?)$/gm, ':::note\n$1\n:::')
    .replace(/>\s*\[TIP\]\s*(.*?)$/gm, ':::tip\n$1\n:::')
    // Handle note/warning/info blocks
    .replace(/^:::(\s*note|tip|warning|info|caution)\s*$/gm, ':::$1')
    // Convert image syntax to MDX-compatible format BEFORE handling other ! characters
    .replace(/!\[(.*?)\]\((.*?)\)/g, '<img alt="$1" src="$2" />')
    // Convert admonitions to MDX callouts
    .replace(/^!!!\s+(\w+)\s*\n/gm, ':::$1\n')
    .replace(/^!!\s+(\w+)\s*\n/gm, '::$1\n')
    // Convert any remaining ! at start of lines to text
    .replace(/^!([^[{].*?)$/gm, '$1')
    // Ensure proper spacing around HTML comments
    .replace(/<!--(.*?)-->/g, '{/* $1 */}')
    // Handle any inline ! that might be causing issues
    .replace(/([^`]|^)!([^[{])/g, '$1$2');

  const title = customTitle || 'Untitled';
  const description = customDescription || '';

  const frontmatter = `---
title: ${title}
description: ${description}
edit_url: ${editUrl}
---

`;

  content = content.replace(/^(#{2,6})\s/gm, (match) => '#'.repeat(match.length - 1) + ' ');
  content = replaceRelativeLinks(content, sourceBaseUrl);

  return frontmatter + content;
}

async function updateGitignore(fileConfigs: FileConfig[]): Promise<void> {
  const gitignorePath = '.gitignore';
  const remoteContentComment = '# Remote content output paths';

  let gitignoreContent = '';
  try {
    gitignoreContent = fs.readFileSync(gitignorePath, 'utf-8');
  } catch (error) {
    console.log('No .gitignore file found, creating new one');
  }

  const outputPaths = fileConfigs.map(config => config.outputPath);
  const existingLines = gitignoreContent.split('\n');

  // Find where the remote content section starts and ends
  const commentIndex = existingLines.findIndex(line => line.trim() === remoteContentComment);
  let insertIndex = existingLines.length;
  let remoteContentEndIndex = existingLines.length;

  if (commentIndex !== -1) {
    // Find the end of the remote content section (next comment or empty line)
    remoteContentEndIndex = existingLines.findIndex((line, index) =>
      index > commentIndex && (line.trim().startsWith('#') || line.trim() === '')
    );
    if (remoteContentEndIndex === -1) {
      remoteContentEndIndex = existingLines.length;
    }
    insertIndex = commentIndex;
  }

  // Extract existing remote content paths
  const existingRemotePaths = commentIndex !== -1
    ? existingLines.slice(commentIndex + 1, remoteContentEndIndex).filter(line => line.trim() && !line.startsWith('#'))
    : [];

  // Find missing paths
  const missingPaths = outputPaths.filter(path => !existingRemotePaths.includes(path));

  if (missingPaths.length === 0) {
    console.log('All output paths already exist in .gitignore');
    return;
  }

  // Prepare the new remote content section
  const newRemoteSection = [
    '',
    remoteContentComment,
    ...outputPaths.sort()
  ];

  // Rebuild the .gitignore content
  const beforeSection = commentIndex !== -1 ? existingLines.slice(0, insertIndex) : existingLines;
  const afterSection = commentIndex !== -1 ? existingLines.slice(remoteContentEndIndex) : [];

  const newGitignoreContent = [
    ...beforeSection,
    ...newRemoteSection,
    ...afterSection
  ].join('\n');

  fs.writeFileSync(gitignorePath, newGitignoreContent);
  console.log(`Updated .gitignore with ${missingPaths.length} new remote content paths`);
  missingPaths.forEach(path => console.log(`  Added: ${path}`));
}

async function processFile(fileConfig: FileConfig): Promise<void> {
  const content = await fetchFileContent(fileConfig.sourceUrl);
  if (content) {
    const contentBaseUrl = new URL('.', fileConfig.contentUrl).href;
    const editUrl = deriveEditUrlFromSourceUrl(fileConfig.sourceUrl);

    const transformedContent = transformContent(content, fileConfig.title, fileConfig.description, contentBaseUrl, editUrl);
    const outputDir = path.dirname(fileConfig.outputPath);
    fs.mkdirSync(outputDir, { recursive: true });

    fs.writeFileSync(fileConfig.outputPath, transformedContent);
    console.log(`Processed and saved: ${fileConfig.outputPath}`);
  }
}

async function main(): Promise<void> {
  const fileConfigs: FileConfig[] = [
    {
      sourceUrl: "https://raw.githubusercontent.com/ava-labs/avalanchego/master/vms/platformvm/warp/README.md",
      outputPath: "content/docs/cross-chain/avalanche-warp-messaging/deep-dive.mdx",
      title: "Deep Dive into ICM",
      description: "Learn about Avalanche Warp Messaging, a cross-Avalanche L1 communication protocol on Avalanche.",
      contentUrl: "https://github.com/ava-labs/avalanchego/tree/master/vms/platformvm/warp/",
    },
    {
      sourceUrl: "https://raw.githubusercontent.com/ava-labs/icm-services/refs/heads/main/relayer/README.md",
      outputPath: "content/docs/cross-chain/avalanche-warp-messaging/run-relayer.mdx",
      title: "Run a Relayer",
      description: "Reference relayer implementation for cross-chain Avalanche Interchain Message delivery.",
      contentUrl: "https://github.com/ava-labs/icm-services/blob/main/relayer/",
    },
    {
      sourceUrl: "https://raw.githubusercontent.com/ava-labs/icm-contracts/refs/heads/main/contracts/teleporter/README.md",
      outputPath: "content/docs/cross-chain/teleporter/overview.mdx",
      title: "What is ICM Contracts?",
      description: "ICM Contracts is a messaging protocol built on top of Avalanche Interchain Messaging that provides a developer-friendly interface for sending and receiving cross-chain messages from the EVM.",
      contentUrl: "https://github.com/ava-labs/icm-contracts/blob/main/contracts/teleporter/",
    },
    {
      sourceUrl: "https://raw.githubusercontent.com/ava-labs/icm-contracts/main/README.md",
      outputPath: "content/docs/cross-chain/teleporter/deep-dive.mdx",
      title: "Deep Dive into ICM Contracts",
      description: "ICM Contracts is an EVM compatible cross-Avalanche L1 communication protocol built on top of Avalanche Interchain Messaging (ICM), and implemented as a Solidity smart contract.",
      contentUrl: "https://github.com/ava-labs/teleporter/blob/main/",
    },
    {
      sourceUrl: "https://raw.githubusercontent.com/ava-labs/coreth/master/plugin/evm/config/config.md",
      outputPath: "content/docs/nodes/chain-configs/c-chain.mdx",
      title: "C-Chain Configurations",
      description: "This page describes the configuration options available for the C-Chain.",
      contentUrl: "https://github.com/ava-labs/coreth/blob/master/plugin/evm/config/",
    },
    {
      sourceUrl: "https://raw.githubusercontent.com/ava-labs/teleporter/main/cmd/teleporter-cli/README.md",
      outputPath: "content/docs/cross-chain/teleporter/cli.mdx",
      title: "Teleporter CLI",
      description: "The CLI is a command line interface for interacting with the Teleporter contracts.",
      contentUrl: "https://github.com/ava-labs/teleporter/blob/main/cmd/teleporter-cli/README.md",
    },
    {
      sourceUrl: "https://raw.githubusercontent.com/ava-labs/teleporter/main/contracts/teleporter/registry/README.md",
      outputPath: "content/docs/cross-chain/teleporter/upgradeability.mdx",
      title: "Upgradeability",
      description: "The TeleporterMessenger contract is non-upgradable. However, there could still be new versions of TeleporterMessenger contracts needed to be deployed in the future.",
      contentUrl: "https://github.com/ava-labs/teleporter/blob/main/contracts/teleporter/registry/",
    },
    {
      sourceUrl: "https://raw.githubusercontent.com/ava-labs/coreth/master/precompile/contracts/warp/README.md",
      outputPath: "content/docs/cross-chain/avalanche-warp-messaging/evm-integration.mdx",
      title: "Integration with EVM",
      description: "Avalanche Warp Messaging provides a basic primitive for signing and verifying messages between Avalanche L1s.",
      contentUrl: "https://github.com/ava-labs/coreth/blob/master/precompile/contracts/warp/",
    },
    {
      sourceUrl: "https://raw.githubusercontent.com/ava-labs/avalanchego/master/api/admin/service.md",
      outputPath: "content/docs/api-reference/admin-api.mdx",
      title: "Admin API",
      description: "This page is an overview of the Admin API associated with AvalancheGo.",
      contentUrl: "https://github.com/ava-labs/avalanchego/blob/master/api/admin/",
    },
    {
      sourceUrl: "https://raw.githubusercontent.com/ava-labs/avalanchego/master/api/health/service.md",
      outputPath: "content/docs/api-reference/health-api.mdx",
      title: "Health API",
      description: "This page is an overview of the Health API associated with AvalancheGo.",
      contentUrl: "https://github.com/ava-labs/avalanchego/blob/master/api/health/",
    },
    {
      sourceUrl: "https://raw.githubusercontent.com/ava-labs/avalanchego/master/api/info/service.md",
      outputPath: "content/docs/api-reference/info-api.mdx",
      title: "Info API",
      description: "This page is an overview of the Info API associated with AvalancheGo.",
      contentUrl: "https://github.com/ava-labs/avalanchego/blob/master/api/info/",
    },
    {
      sourceUrl: "https://raw.githubusercontent.com/ava-labs/avalanchego/master/api/metrics/service.md",
      outputPath: "content/docs/api-reference/metrics-api.mdx",
      title: "Metrics API",
      description: "This page is an overview of the Metrics API associated with AvalancheGo.",
      contentUrl: "https://github.com/ava-labs/avalanchego/blob/master/api/metrics/",
    },
    {
      sourceUrl: "https://raw.githubusercontent.com/ava-labs/avalanchego/master/indexer/service.md",
      outputPath: "content/docs/api-reference/index-api.mdx",
      title: "Index API",
      description: "This page is an overview of the Index API associated with AvalancheGo.",
      contentUrl: "https://github.com/ava-labs/avalanchego/blob/master/indexer/",
    },
    {
      sourceUrl: "https://raw.githubusercontent.com/ava-labs/avalanchego/master/vms/platformvm/service.md",
      outputPath: "content/docs/api-reference/p-chain/api.mdx",
      title: "P-Chain API",
      description: "This page is an overview of the P-Chain API associated with AvalancheGo.",
      contentUrl: "https://github.com/ava-labs/avalanchego/blob/master/vms/platformvm/",
    },
    {
      sourceUrl: "https://raw.githubusercontent.com/ava-labs/avalanchego/master/vms/avm/service.md",
      outputPath: "content/docs/api-reference/x-chain/api.mdx",
      title: "X-Chain API",
      description: "This page is an overview of the X-Chain API associated with AvalancheGo.",
      contentUrl: "https://github.com/ava-labs/avalanchego/blob/master/vms/avm/",
    },
    {
      sourceUrl: "https://raw.githubusercontent.com/ava-labs/coreth/master/plugin/evm/api.md",
      outputPath: "content/docs/api-reference/c-chain/api.mdx",
      title: "C-Chain API",
      description: "This page is an overview of the C-Chain API associated with AvalancheGo.",
      contentUrl: "https://github.com/ava-labs/coreth/blob/master/plugin/evm/",
    },
    {
      sourceUrl: "https://raw.githubusercontent.com/ava-labs/avalanche-cli/main/cmd/commands.md",
      outputPath: "content/docs/tooling/cli-commands.mdx",
      title: "CLI Commands",
      description: "Complete list of Avalanche CLI commands and their usage.",
      contentUrl: "https://github.com/ava-labs/avalanche-cli/blob/main/cmd/",
    },
    {
      sourceUrl: "https://raw.githubusercontent.com/ava-labs/avalanchego/master/subnets/config.md",
      outputPath: "content/docs/nodes/configure/avalanche-l1-configs.mdx",
      title: "Avalanche L1 Configs",
      description: "This page describes the configuration options available for Avalanche L1s.",
      contentUrl: "https://github.com/ava-labs/avalanchego/blob/master/subnets/",
    },
    {
      sourceUrl: "https://raw.githubusercontent.com/ava-labs/avalanchego/master/vms/platformvm/config/config.md",
      outputPath: "content/docs/nodes/configure/chain-configs/p-chain.mdx",
      title: "P-Chain Configurations",
      description: "This page describes the configuration options available for the P-Chain.",
      contentUrl: "https://github.com/ava-labs/avalanchego/blob/master/vms/platformvm/config/",
    },
    {
      sourceUrl: "https://raw.githubusercontent.com/ava-labs/avalanchego/master/vms/avm/config.md",
      outputPath: "content/docs/nodes/configure/chain-configs/x-chain.mdx",
      title: "X-Chain Configurations",
      description: "This page describes the configuration options available for the X-Chain.",
      contentUrl: "https://github.com/ava-labs/avalanchego/blob/master/vms/avm/",
    },
    {
      sourceUrl: "https://raw.githubusercontent.com/ava-labs/avalanchego/master/config/config.md",
      outputPath: "content/docs/nodes/configure/configs-flags.mdx",
      title: "AvalancheGo Config Flags",
      description: "This page lists all available configuration options for AvalancheGo nodes.",
      contentUrl: "https://github.com/ava-labs/avalanchego/blob/master/config/",
    },
    {
      sourceUrl: "https://raw.githubusercontent.com/ava-labs/subnet-evm/master/plugin/evm/service.md",
      outputPath: "content/docs/api-reference/subnet-evm-api.mdx",
      title: "Subnet-EVM API",
      description: "This page describes the API endpoints available for Subnet-EVM based blockchains.",
      contentUrl: "https://github.com/ava-labs/subnet-evm/blob/master/plugin/evm/",
    },
    {
      sourceUrl: "https://raw.githubusercontent.com/ava-labs/icm-contracts/refs/heads/main/contracts/validator-manager/README.md",
      outputPath: "content/docs/avalanche-l1s/validator-manager/contract.mdx",
      title: "Validator Manager Contracts",
      description: "This page lists all available contracts for the Validator Manager.",
      contentUrl: "https://github.com/ava-labs/icm-contracts/blob/main/contracts/validator-manager/",
    },
    {
      sourceUrl: "https://raw.githubusercontent.com/ava-labs/icm-contracts/refs/heads/main/contracts/ictt/README.md",
      outputPath: "content/docs/cross-chain/interchain-token-transfer/overview.mdx",
      title: "Avalanche Interchain Token Transfer (ICTT)",
      description: "This page describes the Avalanche Interchain Token Transfer (ICTT)",
      contentUrl: "https://github.com/ava-labs/icm-contracts/blob/main/contracts/ictt/",
    },
    {
      sourceUrl: "https://raw.githubusercontent.com/ava-labs/avalanchego/master/vms/platformvm/config/config.md",
      outputPath: "content/docs/nodes/chain-configs/p-chain.mdx",
      title: "P-Chain",
      description: "This page is an overview of the configurations and flags supported by P-Chain.",
      contentUrl: "https://github.com/ava-labs/avalanchego/blob/master/vms/platformvm/config",
    },
    {
      sourceUrl: "https://raw.githubusercontent.com/ava-labs/subnet-evm/1ab7114c339f866b65cc02dfd586b2ed9041dd0b/precompile/contracts/warp/README.md",
      outputPath: "content/docs/avalanche-l1s/evm-configuration/warpmessenger.mdx",
      title: "WarpMessenger Precompile - Technical Details",
      description: "Technical documentation for the WarpMessenger precompile implementation in subnet-evm.",
      contentUrl: "https://github.com/ava-labs/subnet-evm/blob/1ab7114c339f866b65cc02dfd586b2ed9041dd0b/precompile/contracts/warp/",
    }
  ];

  await updateGitignore(fileConfigs);

  for (const fileConfig of fileConfigs) {
    await processFile(fileConfig);
  }
}

main().catch(console.error);
