// Main orchestrator script for remote content processing
import { updateGitignore, processFile, type FileConfig } from './remote-content/shared.mts';
import { parsers } from './remote-content/parsers/index.mts';
import { getFixedSections, getGitHubSections } from './remote-content/sections.mts';

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
  const allSections = [...getFixedSections(), ...(await getGitHubSections())];

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
