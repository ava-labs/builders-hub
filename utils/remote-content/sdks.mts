import { FileConfig } from './shared.mts';

export function getSDKSConfigs(): FileConfig[] {
  return [
    {
      sourceUrl: "https://raw.githubusercontent.com/ava-labs/avalanchejs/refs/heads/master/README.md",
      outputPath: "content/docs/sdks/avalanchejs/installation.mdx",
      title: "Installation",
      description: "This page is an overview of the AvalancheJS installation.",
      contentUrl: "https://github.com/ava-labs/avalanchejs/blob/refs/heads/master/",
    }
  ];
} 