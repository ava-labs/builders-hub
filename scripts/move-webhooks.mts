import { existsSync, renameSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';

async function moveWebhooks() {
  const dataApiPath = 'content/docs/api-reference/data-api';
  const webhookApiPath = 'content/docs/api-reference/webhook-api';
  const webhooksSourcePath = join(dataApiPath, 'webhooks');
  const webhooksDestPath = join(webhookApiPath, 'webhooks');
  const unknownFolderPath = join(dataApiPath, 'unknown');

  // Remove the "unknown" folder if it exists (contains stale webhook schemas)
  if (existsSync(unknownFolderPath)) {
    console.log('  🗑️  Removing stale "unknown" folder from data-api');
    rmSync(unknownFolderPath, { recursive: true, force: true, maxRetries: 3 });
    console.log('  ✅ Removed unknown folder successfully');
  }

  // Check if webhooks folder exists in data-api
  if (!existsSync(webhooksSourcePath)) {
    console.log('  ⚠️  Webhooks folder not found in data-api, skipping move');
    return;
  }

  // Ensure webhook-api directory exists
  mkdirSync(webhookApiPath, { recursive: true });

  // Remove existing webhooks folder in webhook-api if it exists
  if (existsSync(webhooksDestPath)) {
    console.log('  🗑️  Removing existing webhooks folder in webhook-api');
    rmSync(webhooksDestPath, { recursive: true, force: true, maxRetries: 3 });
  }

  // Move webhooks folder
  console.log('  📦 Moving webhooks from data-api to webhook-api');
  renameSync(webhooksSourcePath, webhooksDestPath);
  console.log('  ✅ Moved webhooks folder successfully');

  // Update data-api meta.json to remove webhooks entry
  const dataApiMetaPath = join(dataApiPath, 'meta.json');
  if (existsSync(dataApiMetaPath)) {
    try {
      const metaContent = readFileSync(dataApiMetaPath, 'utf-8');
      const meta = JSON.parse(metaContent);
      
      if (meta.pages && Array.isArray(meta.pages)) {
        const originalLength = meta.pages.length;
        meta.pages = meta.pages.filter((page: string) => page !== 'webhooks');
        
        if (meta.pages.length < originalLength) {
          writeFileSync(dataApiMetaPath, JSON.stringify(meta, null, 2) + '\n');
          console.log('  ✅ Removed webhooks entry from data-api meta.json');
        }
      }
    } catch (error) {
      console.error('  ⚠️  Failed to update data-api meta.json:', error);
    }
  }

  console.log('  ✅ Webhook migration complete!');
}

moveWebhooks();

