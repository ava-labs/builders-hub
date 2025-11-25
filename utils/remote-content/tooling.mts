import { FileConfig } from './shared.mts';

/**
 * Tooling and developer tools content configurations
 * Includes CLI and other development tools
 */
export function getToolingConfigs(): FileConfig[] {
  return [
    {
      sourceUrl: "https://raw.githubusercontent.com/ava-labs/avalanche-cli/main/cmd/commands.md",
      outputPath: "content/docs/tooling/cli-commands.mdx",
      title: "CLI Commands",
      description: "Complete list of Avalanche CLI commands and their usage.",
      contentUrl: "https://github.com/ava-labs/avalanche-cli/blob/main/cmd/",
    },
  ];
}

