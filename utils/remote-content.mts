// Main orchestrator script for remote content processing
import { updateGitignore, processFile, type FileConfig } from './remote-content/shared.mts';
import { parsers } from './remote-content/parsers/index.mts';
import { getCrossChainConfigs } from './remote-content/cross-chain.mts';
import { getApisConfigs } from './remote-content/apis.mts';
import { getPrimaryNetworkConfigs } from './remote-content/primary-network.mts';
import { getAvalancheL1sConfigs } from './remote-content/avalanche-l1s.mts';
import { getAcpsConfigs } from './remote-content/acps.mts';
import { getToolingConfigs } from './remote-content/tooling.mts';
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
  
  // Collect all file configurations organized by section
  const allSections = [
    { name: 'Cross-Chain', configs: getCrossChainConfigs() },
    { name: 'APIs', configs: getApisConfigs() },
    { name: 'Primary Network', configs: getPrimaryNetworkConfigs() },
    { name: 'Avalanche L1s', configs: getAvalancheL1sConfigs() },
    { name: 'Tooling', configs: getToolingConfigs() },
    { name: 'ACPs', configs: await getAcpsConfigs() },
    // { name: 'SDKS', configs: getSDKSConfigs() },
  ];

  // Flatten all configs for gitignore update
  const allConfigs = allSections.flatMap(section => section.configs);
  
  console.log(`📝 Updating .gitignore with ${allConfigs.length} output paths...`);
  await updateGitignore(allConfigs);

  // Process each section
  for (const section of allSections) {
    await processSection(section.name, section.configs);
  }

  console.log(`\n🎉 All sections completed! Processed ${allConfigs.length} files total.`);
}

main().catch(console.error);
