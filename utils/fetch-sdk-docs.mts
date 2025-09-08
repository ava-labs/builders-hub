#!/usr/bin/env tsx
/**
 * Standalone script to fetch Avalanche SDK TypeScript documentation
 * Run with: yarn tsx utils/fetch-sdk-docs.mts
 */

import { getAllSDKConfigs } from './remote-content/fetch-sdk-docs.mts';
import { processFile, updateGitignore } from './remote-content/shared.mts';

async function main() {
  console.log('🚀 Fetching Avalanche SDK TypeScript documentation...\n');
  
  try {
    // Get all SDK configurations
    const configs = await getAllSDKConfigs();
    
    console.log(`📋 Found ${configs.length} documentation files to process\n`);
    
    // Update .gitignore with all output paths
    await updateGitignore(configs);
    
    // Process each file
    let successCount = 0;
    let errorCount = 0;
    
    for (const config of configs) {
      try {
        await processFile(config);
        successCount++;
      } catch (error) {
        errorCount++;
        console.error(`\n❌ Error processing ${config.outputPath}:`);
        console.error(`   Source: ${config.sourceUrl}`);
        console.error(`   Error: ${error.message}`);
        if (error.message.includes('acorn')) {
          console.error('   This appears to be an MDX parsing error. The file may contain invalid JSX or JavaScript expressions.');
        }
      }
    }
    
    console.log(`\n✅ Successfully processed ${successCount}/${configs.length} SDK documentation files!`);
    if (errorCount > 0) {
      console.log(`⚠️  Failed to process ${errorCount} files due to errors.`);
    }
    console.log('\n📁 Documentation has been saved to: content/docs/sdks/avalanche-sdk-typescript/');
    
  } catch (error) {
    console.error('❌ Error fetching SDK documentation:', error);
    process.exit(1);
  }
}

// Run the script
main().catch(console.error);
