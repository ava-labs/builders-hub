import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';

interface MetaJson {
  title?: string;
  description?: string;
  icon?: string;
  root?: boolean;
  pages?: string[];
}

function hasEndpointFiles(dirPath: string): boolean {
  if (!existsSync(dirPath)) {
    return false;
  }

  try {
    const entries = readdirSync(dirPath, { withFileTypes: true });
    
    // Check if directory has any .mdx files (excluding index.mdx and meta.json)
    const hasMdxFiles = entries.some(
      entry => entry.isFile() && 
      entry.name.endsWith('.mdx') && 
      entry.name !== 'index.mdx'
    );
    
    return hasMdxFiles;
  } catch (error) {
    return false;
  }
}

function cleanupMetaJson(metaPath: string, apiName: string) {
  console.log(`\n🧹 Cleaning up ${apiName} meta.json...`);
  
  if (!existsSync(metaPath)) {
    console.log(`  ⚠️  meta.json not found at ${metaPath}`);
    return;
  }

  const baseDir = join(metaPath, '..');
  const metaContent = readFileSync(metaPath, 'utf-8');
  const meta: MetaJson = JSON.parse(metaContent);
  
  if (!meta.pages || !Array.isArray(meta.pages)) {
    console.log(`  ⚠️  No pages array found in meta.json`);
    return;
  }

  const originalPages = [...meta.pages];
  const updatedPages: string[] = [];
  const removedSections: string[] = [];

  for (const page of meta.pages) {
    // Keep separators (lines starting with ---)
    if (page.startsWith('---')) {
      updatedPages.push(page);
      continue;
    }

    // Keep index page
    if (page === 'index') {
      updatedPages.push(page);
      continue;
    }

    // Check if the directory exists and has endpoint files
    const pagePath = join(baseDir, page);
    
    if (hasEndpointFiles(pagePath)) {
      updatedPages.push(page);
    } else {
      removedSections.push(page);
      console.log(`  ❌ Removing section: ${page} (no endpoint files found)`);
    }
  }

  // Remove consecutive separators and trailing separators
  const finalPages: string[] = [];
  for (let i = 0; i < updatedPages.length; i++) {
    const current = updatedPages[i];
    const next = updatedPages[i + 1];
    
    // Skip separator if it's followed by another separator or if it's the last item
    if (current.startsWith('---')) {
      if (next && !next.startsWith('---')) {
        finalPages.push(current);
      }
    } else {
      finalPages.push(current);
    }
  }

  // Update meta.json if changes were made
  if (removedSections.length > 0) {
    meta.pages = finalPages;
    writeFileSync(metaPath, JSON.stringify(meta, null, 2) + '\n', 'utf-8');
    console.log(`  ✅ Removed ${removedSections.length} empty sections from meta.json`);
  } else {
    console.log(`  ✅ No empty sections found`);
  }

  return removedSections.length;
}

async function cleanupEmptySections() {
  console.log('🧹 Cleaning up empty sections from meta.json files...');

  const dataApiRemoved = cleanupMetaJson(
    'content/docs/api-reference/data-api/meta.json',
    'Data API'
  );

  const metricsApiRemoved = cleanupMetaJson(
    'content/docs/api-reference/metrics-api/meta.json',
    'Metrics API'
  );

  const totalRemoved = (dataApiRemoved || 0) + (metricsApiRemoved || 0);
  
  if (totalRemoved > 0) {
    console.log(`\n🎉 Cleaned up ${totalRemoved} empty sections in total!`);
  } else {
    console.log(`\n✅ All meta.json files are up to date!`);
  }
}

cleanupEmptySections();

