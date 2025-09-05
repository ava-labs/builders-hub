#!/usr/bin/env tsx
/**
 * Post-process MDX files to fix common syntax issues
 * Run with: yarn tsx utils/fix-mdx-syntax.mts <file-path>
 */

import * as fs from 'fs';
import * as path from 'path';

export function fixMDXSyntax(content: string): string {
  let fixed = content;
  
  // First pass: Fix basic escaped HTML entities
  fixed = fixed
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
  
  // Second pass: Fix any malformed tags
  fixed = fixed
    // Fix URLs with spaces or extra slashes
    .replace(/https:\s*\/+/g, 'https://')
    .replace(/http:\s*\/+/g, 'http://')
    .replace(/https:\/\/\//g, 'https://') // Fix triple slashes
    .replace(/http:\/\/\//g, 'http://') // Fix triple slashes
    // Remove align attribute from div tags (not supported in MDX)
    .replace(/<div\s+align="[^"]*">/gi, '<div style={{ textAlign: "center" }}>')
    // Normalize details/summary formatting: deindent and ensure blank line before
    .replace(/\n[ \t]+<details/gi, '\n<details')
    .replace(/\n[ \t]+<summary/gi, '\n<summary')
    .replace(/\n[ \t]+<\/details>/gi, '\n</details>')
    .replace(/([^\n])\n<details/gi, '$1\n\n<details')
    // Ensure two blank lines between a list and a following <details>
    .replace(/(^\s*\*.*\n)\n(<details)/gmi, '$1\n\n<details')
    // Ensure <details><summary> on separate lines and blank line after summary
    .replace(/<details>\s*<summary>([\s\S]*?)<\/summary>\s*/gi, '<details>\n<summary>$1</summary>\n\n')
    // Ensure closing </details> on its own line with a trailing blank line
    .replace(/\n?<\/details>\s*/gi, '\n</details>\n\n')
    
  // Third pass: Escape problematic JSX-like expressions in markdown
  // But preserve actual MDX comments and JSX attributes
  fixed = fixed
    // Escape template literal-like patterns that aren't in code blocks
    .replace(/\{([^/*}][^}]*)\}/g, (match, content, offset) => {
      // Skip if it's an MDX comment
      if (content.startsWith('/*') && content.endsWith('*/')) {
        return match;
      }
      
      // Check if this is inside a JSX attribute (style, className, etc.)
      const beforeMatch = fixed.substring(Math.max(0, offset - 20), offset);
      if (beforeMatch.match(/\w+=$/)) {
        // This is likely a JSX attribute value, don't escape
        return match;
      }
      
      // Check if we're inside a code block by looking at context
      const codeBlockRegex = /```[\s\S]*?```/g;
      let isInCodeBlock = false;
      let m;
      while ((m = codeBlockRegex.exec(fixed)) !== null) {
        if (m.index <= offset && offset < m.index + m[0].length) {
          isInCodeBlock = true;
          break;
        }
      }
      if (isInCodeBlock) {
        return match;
      }
      // Escape the braces
      return `\\{${content}\\}`;
    })
    // Fix closing tags that appear as self-closing
    .replace(/<\/([\w]+)\s*\/>/g, '</$1>')
    // Fix img tags where attributes are split
    .replace(/<img\s+([^>]*?)\s*\/>\s*(alt|src|width|height|class)="([^"]*?)"\s*\/>/gi, 
      (match, attrs, attrName, attrValue) => `<img ${attrs} ${attrName}="${attrValue}" />`)
    // Fix double escaping
    .replace(/&amp;lt;/g, '&lt;')
    .replace(/&amp;gt;/g, '&gt;');
  
  // Fourth pass: Fix MDX comments that were accidentally escaped like `{/* ... */\}` → `{/* ... */}`
  fixed = fixed
    .replace(/\{\/\*([\s\S]*?)\*\/\\\}/g, (_m, inner) => `{/*${inner}*/}`);
    
  return fixed;
}

// Heuristic splitter for slugs like "addressdetails" → "Address Details"
function smartSplitSlugToTitle(slugRaw: string): string {
  const slug = slugRaw.toLowerCase();
  const tokens = [
    'responsebody','transactions','transaction','delegations','delegation','validators','validator','delegators','delegator',
    'addresses','address','blockchains','blockchain','subnetworks','subnetwork','networks','network',
    'balances','balance','requests','request','responses','response','details','metadata','message','messages',
    'contracts','contract','transfers','transfer','components','component','options','option','metrics','status',
    'errors','error','amount','amounts','chains','chain','blocks','block','tokens','token','owners','owner',
    'ids','id','dto','type','types','value','values','global','globals','list','get','set'
  ];
  const words: string[] = [];
  let rest = slug;
  // Greedy split from end by known tokens
  while (rest.length > 0) {
    let matched = false;
    for (const t of tokens) {
      if (rest.endsWith(t) && rest.length > t.length) {
        const prefix = rest.slice(0, rest.length - t.length);
        rest = prefix;
        words.unshift(t);
        matched = true;
        break;
      }
    }
    if (!matched) {
      // No token matched; take the remaining as one word
      words.unshift(rest);
      break;
    }
  }
  // Capitalize and apply acronym fixes
  const acronymFix = (w: string) => {
    const map: Record<string,string> = {
      'erc20':'ERC20','erc721':'ERC721','l1':'L1','icm':'ICM','evm':'EVM','rpc':'RPC','dto':'DTO','id':'ID','api':'API'
    };
    return map[w.toLowerCase()] || w.charAt(0).toUpperCase() + w.slice(1);
  };
  const cleaned = words.filter(Boolean).map(acronymFix);
  return cleaned.join(' ');
}

function maybeRetitleModelsFile(filePath: string, content: string): string {
  if (!/\/chainkit\/models\//.test(filePath)) return content;
  // Extract base name or parent folder for index files
  const base = path.basename(filePath).replace(/\.(md|mdx)$/i, '');
  const parent = path.basename(path.dirname(filePath));
  const slugCandidate = /^index$/i.test(base) ? parent : base;
  const newTitle = smartSplitSlugToTitle(slugCandidate);
  const newDesc = `Chainkit SDK documentation for ${newTitle.toLowerCase()}`;
  // Replace in frontmatter
  return content.replace(/^---([\s\S]*?)---/, (fm, inner) => {
    let updated = fm.replace(/title:\s*"[^"]*"/, `title: "${newTitle}"`);
    if (/description:\s*"[^"]*"/.test(updated)) {
      updated = updated.replace(/description:\s*"[^"]*"/, `description: "${newDesc}"`);
    }
    return updated;
  });
}

async function processFile(filePath: string) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    let fixed = fixMDXSyntax(content);
    // Adjust titles for models pages (e.g., chainkit/models/...)
    fixed = maybeRetitleModelsFile(filePath, fixed);
    
    if (content !== fixed) {
      fs.writeFileSync(filePath, fixed);
      console.log(`✅ Fixed: ${filePath}`);
    } else {
      console.log(`✓ No changes needed: ${filePath}`);
    }
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error.message);
  }
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    // Process all SDK MDX files
    const sdkDir = 'content/docs/sdks/avalanche-sdk-typescript';
    const files = [];
    
    function findMDXFiles(dir: string) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          findMDXFiles(fullPath);
        } else if (entry.name.endsWith('.mdx')) {
          files.push(fullPath);
        }
      }
    }
    
    if (fs.existsSync(sdkDir)) {
      findMDXFiles(sdkDir);
      console.log(`Found ${files.length} MDX files to process\n`);
      
      for (const file of files) {
        await processFile(file);
      }
    } else {
      console.error(`Directory not found: ${sdkDir}`);
    }
  } else {
    // Process specific file
    await processFile(args[0]);
  }
}

main().catch(console.error);
