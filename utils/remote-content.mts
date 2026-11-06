// Main orchestrator script for remote content processing
import { updateGitignore, processFile, type FileConfig } from './remote-content/shared.mts';
import { parsers } from './remote-content/parsers/index.mts';
import { getFixedSections, getGitHubSections } from './remote-content/sections.mts';

/**
 * Process files for a specific section. Returns the configs whose source gave no content.
 */
async function processSection(sectionName: string, configs: FileConfig[]): Promise<FileConfig[]> {
  console.log(`\n🔄 Processing ${sectionName} section (${configs.length} files)...`);

  const missing: FileConfig[] = [];
  for (const fileConfig of configs) {
    if (!(await processFile(fileConfig, parsers[sectionName]))) missing.push(fileConfig);
  }

  console.log(`✅ Completed ${sectionName} section`);
  return missing;
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
  const missing: FileConfig[] = [];
  for (const section of allSections) {
    missing.push(...(await processSection(section.name, section.configs)));
  }

  console.log(`\n🎉 All sections completed! Processed ${allConfigs.length} files total.`);

  // A source that gives no content (usually an upstream repo moved or deleted the file) leaves its page out of the
  // site, and the docs sidebar drops its link. A Vercel deploy continues without the page, because a move in another
  // repo must not block it. In GitHub Actions (the nightly link check, .github/workflows/link-check.yml) the sync fails
  // instead, so the move is reported within a day. REMOTE_CONTENT_STRICT=1 does the same locally.
  if (missing.length > 0) {
    console.error(`\n❌ ${missing.length} remote source(s) gave no content. These pages are missing from the site:`);
    for (const config of missing) console.error(`  ${config.outputPath}\n    source: ${config.sourceUrl}`);
    if (process.env.GITHUB_ACTIONS === 'true' || process.env.REMOTE_CONTENT_STRICT === '1') process.exitCode = 1;
  }
}

main().catch(console.error);
