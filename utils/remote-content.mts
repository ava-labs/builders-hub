// Main orchestrator script for remote content processing
import { updateGitignore, processFile, type FileConfig } from './remote-content/shared.mts';
import { parsers } from './remote-content/parsers/index.mts';
import { getCrossChainConfigs } from './remote-content/cross-chain.mts';
import { getApisConfigs } from './remote-content/apis.mts';
import { getPrimaryNetworkConfigs } from './remote-content/primary-network.mts';
import { getAvalancheL1sConfigs } from './remote-content/avalanche-l1s.mts';
import { getAcpsConfigs } from './remote-content/acps.mts';
import { getToolingConfigs } from './remote-content/tooling.mts';
import { getReleasesConfigs } from './remote-content/releases.mts';
import { getIcmReleasesConfigs } from './remote-content/icm-releases.mts';
// import { getSDKSConfigs } from './remote-content/sdks.mts';

/**
 * Process files for a specific section
 */
async function processSection(sectionName: string, configs: FileConfig[]): Promise<void> {
  console.log(`\n🔄 Processing ${sectionName} section (${configs.length} files)...`);
  
  for (const fileConfig of configs) {
    await processFile(fileConfig, parsers[sectionName]);
  }
  
  console.log(`✅ Completed ${sectionName} section`);
}

async function main(): Promise<void> {
  console.log('🚀 Starting remote content processing...\n');

  const sectionLoaders = [
    { name: 'Cross-Chain', loadConfigs: async () => getCrossChainConfigs() },
    { name: 'APIs', loadConfigs: async () => getApisConfigs() },
    { name: 'Primary Network', loadConfigs: async () => getPrimaryNetworkConfigs() },
    { name: 'Avalanche L1s', loadConfigs: async () => getAvalancheL1sConfigs() },
    { name: 'Tooling', loadConfigs: async () => getToolingConfigs() },
    { name: 'ACPs', loadConfigs: async () => getAcpsConfigs() },
    { name: 'Releases', loadConfigs: async () => getReleasesConfigs() },
    { name: 'ICM Releases', loadConfigs: async () => getIcmReleasesConfigs() },
    // { name: 'SDKS', loadConfigs: async () => getSDKSConfigs() },
  ];
  const allSections: { name: string; configs: FileConfig[] }[] = [];
  const failedSections = new Set<string>();

  for (const section of sectionLoaders) {
    try {
      const configs = await section.loadConfigs();
      allSections.push({ name: section.name, configs });
    } catch (error) {
      failedSections.add(section.name);
      console.error(`❌ Failed to prepare ${section.name} section:`, error);
    }
  }

  if (allSections.length === 0) {
    throw new Error('Remote content generation failed for every section.');
  }

  // Flatten all configs for gitignore update
  const allConfigs = allSections.flatMap(section => section.configs);
  
  console.log(`📝 Updating .gitignore with ${allConfigs.length} output paths...`);
  await updateGitignore(allConfigs);

  // Process each section
  for (const section of allSections) {
    try {
      await processSection(section.name, section.configs);
    } catch (error) {
      failedSections.add(section.name);
      console.error(`❌ Failed to process ${section.name} section:`, error);
    }
  }

  if (failedSections.size > 0) {
    throw new Error(
      `Remote content generation failed for section${failedSections.size === 1 ? '' : 's'}: ${[...failedSections].join(', ')}`
    );
  }

  console.log(`\n🎉 All sections completed! Processed ${allConfigs.length} files total.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
