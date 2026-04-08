import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

async function reorderDataApiSections() {
  const dataApiMetaPath = 'content/docs/api-reference/data-api/meta.json';

  if (!existsSync(dataApiMetaPath)) {
    console.log('  ⚠️  Data API meta.json not found, skipping reorder');
    return;
  }

  try {
    const metaContent = readFileSync(dataApiMetaPath, 'utf-8');
    const meta = JSON.parse(metaContent);

    if (!meta.pages || !Array.isArray(meta.pages)) {
      console.log('  ⚠️  No pages array found in meta.json');
      return;
    }

    // Remove signature-aggregator from wherever it is
    const pages = meta.pages.filter((page: string) => page !== 'signature-aggregator');

    // Find the ICM Services section and insert signature-aggregator after interchain-messaging
    const icmSectionIndex = pages.indexOf('---ICM Services---');
    
    if (icmSectionIndex !== -1) {
      // Find where to insert (after interchain-messaging)
      const interchainMessagingIndex = pages.indexOf('interchain-messaging', icmSectionIndex);
      
      if (interchainMessagingIndex !== -1) {
        // Insert signature-aggregator right after interchain-messaging
        pages.splice(interchainMessagingIndex + 1, 0, 'signature-aggregator');
        console.log('  ✅ Moved signature-aggregator to ICM Services section');
      } else {
        // If interchain-messaging not found, insert right after the section header
        pages.splice(icmSectionIndex + 1, 0, 'signature-aggregator');
        console.log('  ✅ Added signature-aggregator to ICM Services section');
      }
    } else {
      console.log('  ⚠️  ICM Services section not found, skipping reorder');
      return;
    }

    // Update the meta.json
    meta.pages = pages;
    writeFileSync(dataApiMetaPath, JSON.stringify(meta, null, 2) + '\n');
    console.log('  ✅ Data API sections reordered successfully');

  } catch (error) {
    console.error('  ⚠️  Failed to reorder Data API sections:', error);
  }
}

console.log('🔧 Reordering Data API sections...');
reorderDataApiSections();

