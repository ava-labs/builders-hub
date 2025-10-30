import { readdirSync, rmSync, existsSync, statSync } from 'fs';
import { join } from 'path';

function cleanupGeneratedEndpoints(apiPath: string, apiName: string) {
  console.log(`\n🗑️  Cleaning up ${apiName} generated endpoints...`);
  
  if (!existsSync(apiPath)) {
    console.log(`  ⚠️  Directory not found: ${apiPath}`);
    return 0;
  }

  let removedCount = 0;
  const entries = readdirSync(apiPath, { withFileTypes: true });

  for (const entry of entries) {
    // Skip index.mdx and meta.json in the root
    if (entry.name === 'index.mdx' || entry.name === 'meta.json') {
      continue;
    }

    const fullPath = join(apiPath, entry.name);
    
    // Remove all subdirectories (these contain the generated endpoint docs)
    if (entry.isDirectory()) {
      try {
        rmSync(fullPath, { recursive: true, force: true });
        removedCount++;
        console.log(`  ❌ Removed: ${entry.name}/`);
      } catch (error) {
        console.error(`  ⚠️  Failed to remove ${entry.name}:`, error);
      }
    }
  }

  console.log(`  ✅ Removed ${removedCount} generated directories`);
  return removedCount;
}

async function cleanupGeneratedFiles() {
  console.log('🧹 Cleaning up generated endpoint files...');

  const dataApiRemoved = cleanupGeneratedEndpoints(
    'content/docs/api-reference/data-api',
    'Data API'
  );

  const webhookApiRemoved = cleanupGeneratedEndpoints(
    'content/docs/api-reference/webhook-api',
    'Webhook API'
  );

  const metricsApiRemoved = cleanupGeneratedEndpoints(
    'content/docs/api-reference/metrics-api',
    'Metrics API'
  );

  const totalRemoved = dataApiRemoved + webhookApiRemoved + metricsApiRemoved;
  console.log(`\n✅ Cleaned up ${totalRemoved} directories in total!`);
}

cleanupGeneratedFiles();

