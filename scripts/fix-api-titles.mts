import fs from 'fs';
import path from 'path';

// Convert camelCase or snake_case to Title Case
function toTitleCase(str: string): string {
  // Handle snake_case
  str = str.replace(/_/g, ' ');
  
  // Handle camelCase and kebab-case
  str = str.replace(/([A-Z])/g, ' $1').replace(/-/g, ' ');
  
  // Special cases for acronyms
  const acronyms = ['evm', 'api', 'rpc', 'nft', 'icm', 'l1', 'id', 'utxo', 'btcb', 'gps', 'tps', 'tx'];
  
  // Capitalize first letter of each word
  return str
    .split(' ')
    .filter(word => word.length > 0)
    .map(word => {
      const lower = word.toLowerCase();
      if (acronyms.includes(lower)) {
        return word.toUpperCase();
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ')
    .trim();
}

function getAllMdxFiles(dir: string): string[] {
  const files: string[] = [];
  
  function walk(currentPath: string) {
    const entries = fs.readdirSync(currentPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);
      
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.name.endsWith('.mdx') && entry.name !== 'index.mdx') {
        files.push(fullPath);
      }
    }
  }
  
  walk(dir);
  return files;
}

// Strip redundant prefixes from Data API folder titles
function stripRedundantPrefixes(folderName: string, title: string, parentDir: string): string {
  // Only apply to Data API
  if (!parentDir.includes('data-api')) {
    return title;
  }

  // Special case: keep "primary-network" as "Primary Network" (it's the overview page)
  if (folderName === 'primary-network') {
    return title;
  }

  // Strip "EVM " prefix for folders starting with evm-
  if (folderName.startsWith('evm-') && title.startsWith('EVM ')) {
    return title.slice(4); // Remove "EVM "
  }

  // Strip "Primary Network " prefix for folders starting with primary-network-
  if (folderName.startsWith('primary-network-') && title.startsWith('Primary Network ')) {
    return title.slice(16); // Remove "Primary Network "
  }

  return title;
}

function createFolderMetaFiles(dir: string, folders: string[]) {
  for (const folder of folders) {
    const folderPath = path.join(dir, folder);
    const metaPath = path.join(folderPath, 'meta.json');
    
    if (fs.existsSync(folderPath) && fs.statSync(folderPath).isDirectory()) {
      let title = toTitleCase(folder);
      title = stripRedundantPrefixes(folder, title, dir);
      
      // Check if meta.json exists
      if (fs.existsSync(metaPath)) {
        // Update existing meta.json if title is different
        const existingMeta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
        if (existingMeta.title !== title) {
          existingMeta.title = title;
          fs.writeFileSync(metaPath, JSON.stringify(existingMeta, null, 2) + '\n', 'utf-8');
          console.log(`Updated meta: ${path.relative('.', metaPath)} with title "${title}"`);
        }
      } else {
        // Create new meta.json
        const meta = {
          title: title,
        };
        fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2) + '\n', 'utf-8');
        console.log(`Created meta: ${path.relative('.', metaPath)} with title "${title}"`);
      }
    }
  }
}

function fixTitles() {
  const apiDirs = [
    './content/docs/api-reference/data-api',
    './content/docs/api-reference/metrics-api',
  ];

  let fixedCount = 0;

  for (const dir of apiDirs) {
    // Get all subdirectories
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const folders = entries
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name);
    
    // Create meta.json for folders
    createFolderMetaFiles(dir, folders);
    
    // Fix file titles
    const files = getAllMdxFiles(dir);
    
    for (const file of files) {
      let content = fs.readFileSync(file, 'utf-8');
      
      // Check if title is empty
      if (content.includes("title: ''") || content.includes('title: ""')) {
        // Extract the filename without extension
        const filename = path.basename(file, '.mdx');
        const title = toTitleCase(filename);
        
        // Replace empty title with generated one
        content = content.replace(/title: ['"]{2}/, `title: '${title}'`);
        
        fs.writeFileSync(file, content, 'utf-8');
        console.log(`Fixed: ${path.relative('.', file)} -> "${title}"`);
        fixedCount++;
      }
    }
  }
  
  console.log(`\n✅ Fixed ${fixedCount} file titles!`);
}

fixTitles();

