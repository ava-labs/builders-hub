import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

export interface FileConfig {
  sourceUrl: string;
  outputPath: string;
  title: string;
  description: string;
  contentUrl: string;
}

export async function fetchFileContent(url: string): Promise<string | null> {
  try {
    const response = await axios.get<string>(url);
    return response.data;
  } catch (error) {
    console.error(`Failed to fetch ${url}:`, error);
    return null;
  }
}

export function deriveEditUrlFromSourceUrl(sourceUrl: string): string {
  let editUrl = sourceUrl.replace('https://raw.githubusercontent.com/', 'https://github.com/');

  // Handle refs/heads patterns first
  if (editUrl.includes('/refs/heads/main/')) {
    editUrl = editUrl.replace('/refs/heads/main/', '/edit/main/');
  } else if (editUrl.includes('/refs/heads/master/')) {
    editUrl = editUrl.replace('/refs/heads/master/', '/edit/master/');
  } else {
    // Handle direct main/master patterns only if no refs/heads pattern was found
    editUrl = editUrl.replace(/\/main\//, '/edit/main/');
    editUrl = editUrl.replace(/\/master\//, '/edit/master/');
  }

  return editUrl;
}

export function replaceRelativeLinks(content: string, sourceBaseUrl: string): string {
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)|<img([^>]*)src=([^"'\s>]+|['"][^'"]*['"])/g;
  
  function convertGitHubBlobToRaw(url: string): string {
    // Convert GitHub blob URLs to raw URLs for direct access
    if (url.includes('github.com') && url.includes('/blob/')) {
      return url.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/');
    }
    return url;
  }
  
  // Replace both markdown-style links and img src attributes with absolute links
  const updatedContent = content.replace(
    linkRegex,
    (match, text, markdownLink, imgAttrs, imgSrc) => {
      if (markdownLink) {
        if (
          markdownLink.startsWith("http") ||
          markdownLink.startsWith("#") ||
          markdownLink.startsWith("mailto:")
        ) {
          // Convert GitHub blob URLs to raw URLs for images
          if (markdownLink.includes('github.com') && markdownLink.includes('/blob/') && 
              (markdownLink.toLowerCase().endsWith('.png') || 
               markdownLink.toLowerCase().endsWith('.jpg') || 
               markdownLink.toLowerCase().endsWith('.jpeg') || 
               markdownLink.toLowerCase().endsWith('.gif') || 
               markdownLink.toLowerCase().endsWith('.svg'))) {
            return `[${text}](${convertGitHubBlobToRaw(markdownLink)})`;
          }
          return match;
        }
        // Convert markdown-style relative link to absolute link
        return `[${text}](${new URL(markdownLink, sourceBaseUrl).href})`;
      } else if (imgSrc) {
        // Remove quotes if they exist
        const cleanSrc = imgSrc.replace(/^['"]|['"]$/g, '');
        if (cleanSrc.startsWith("http") || cleanSrc.startsWith("data:")) {
          // Convert GitHub blob URLs to raw URLs for direct image access
          const finalSrc = convertGitHubBlobToRaw(cleanSrc);
          const cleanAttrs = imgAttrs.trim();
          const spaceBefore = cleanAttrs ? ' ' : '';
          const spaceAfter = cleanAttrs ? ' ' : '';
          return `<img${spaceBefore}${cleanAttrs}${spaceAfter}src="${finalSrc}" />`;
        }
        // Convert img src attribute relative link to absolute link, and properly close the tag as self-closing
        const cleanAttrs = imgAttrs.trim();
        const spaceBefore = cleanAttrs ? ' ' : '';
        const spaceAfter = cleanAttrs ? ' ' : '';
        return `<img${spaceBefore}${cleanAttrs}${spaceAfter}src="${new URL(cleanSrc, sourceBaseUrl).href}" />`;
      }
      return match;
    }
  );
  return updatedContent;
}

export function transformContent(content: string, customTitle: string, customDescription: string, sourceBaseUrl: string, editUrl?: string): string {
  // Remove any existing frontmatter
  content = content.replace(/^---\n[\s\S]*?\n---\n/, '');

  // Remove the first heading as we'll use the frontmatter title
  content = content.replace(/^#\s+.+\n/, '');

  // Store math expressions, flowcharts, and problematic components to preserve them
  const mathExpressions: string[] = [];
  const flowcharts: string[] = [];
  const preservedComponents: string[] = [];
  
  // Preserve problematic Callout components first
  content = content
    .replace(/<Callout\s+title="([^"]*?)"\s+icon\s*=\s*\{[^}]*\}\s*>/g, (match) => {
      const index = preservedComponents.length;
      preservedComponents.push(match.replace(/\s+icon\s*=\s*/, ' icon=').replace(/\s+/g, ' '));
      return `__CALLOUT_${index}__`;
    });
  
  // Preserve LaTeX math expressions (both inline and block)
  content = content
    // Block math: $$...$$
    .replace(/\$\$[\s\S]*?\$\$/g, (match) => {
      const index = mathExpressions.length;
      mathExpressions.push(match);
      return `__MATH_BLOCK_${index}__`;
    })
    // Inline math: $...$ (improved to handle single characters and complex expressions)
    .replace(/\$([^$\n]*?)\$/g, (match, content) => {
      const index = mathExpressions.length;
      mathExpressions.push(match);
      return `__MATH_INLINE_${index}__`;
    })
    // LaTeX expressions: \(...\) and \[...\]
    .replace(/\\\([\s\S]*?\\\)/g, (match) => {
      const index = mathExpressions.length;
      mathExpressions.push(match);
      return `__MATH_INLINE_${index}__`;
    })
    .replace(/\\\[[\s\S]*?\\\]/g, (match) => {
      const index = mathExpressions.length;
      mathExpressions.push(match);
      return `__MATH_BLOCK_${index}__`;
    })
    // Mermaid flowcharts and diagrams
    .replace(/```mermaid[\s\S]*?```/g, (match) => {
      const index = flowcharts.length;
      flowcharts.push(match);
      return `__FLOWCHART_${index}__`;
    });

  // Fix common malformed HTML patterns very early in the process
  content = content
    .replace(/<\/di>/g, '</div>'); // Fix specific malformed closing tag

      // Convert GitHub-flavored markdown to MDX-compatible syntax
  content = content
    // Convert note blocks to proper MDX format
    .replace(/>\s*\[NOTE\]\s*(.*?)$/gm, ':::note\n$1\n:::')
    .replace(/>\s*\[TIP\]\s*(.*?)$/gm, ':::tip\n$1\n:::')
    // Handle note/warning/info blocks
    .replace(/^:::(\s*note|tip|warning|info|caution)\s*$/gm, ':::$1')
    // Convert image syntax to MDX-compatible format BEFORE handling other ! characters
    .replace(/!\[(.*?)\]\((.*?)\)/g, '<img alt="$1" src="$2" />')
    // Convert admonitions to MDX callouts
    .replace(/^!!!\s+(\w+)\s*\n/gm, ':::$1\n')
    .replace(/^!!\s+(\w+)\s*\n/gm, '::$1\n')
    // Convert any remaining ! at start of lines to text
    .replace(/^!([^[{].*?)$/gm, '$1')
    // Ensure proper spacing around HTML comments
    .replace(/<!--(.*?)-->/g, '{/* $1 */}')
    // Handle any inline ! that might be causing issues
    .replace(/([^`]|^)!([^[{])/g, '$1$2')
    // Fix any malformed JSX or problematic characters
    .replace(/\{\/\*\s*\*\/\}/g, '') // Remove empty comments
    .replace(/\{\s*\/\*\s*\*\/\s*\}/g, '') // Remove empty comments with spaces
    // Fix malformed img tags with extra spaces and slashes
    .replace(/<img([^>]*?)\s+\/\s+\/>/gi, (match, attrs) => {
      // Fix malformed img tags with extra spaces and slashes
      let cleanAttrs = attrs
        .replace(/(\w+)=/g, ' $1=')
        .replace(/=([^"'\s][^\s>]*)/g, '="$1"')
        .replace(/=\.\//g, '="')
        .trim();
      return `<img${cleanAttrs ? ' ' + cleanAttrs : ''} />`;
    })
    // Convert HTML to JSX-compatible format
    .replace(/<img([^>]*?)>/gi, (match, attrs) => {
      // Clean up attributes for JSX compatibility
      let cleanAttrs = attrs
        .replace(/(\w+)=/g, ' $1=')
        .replace(/=([^"'\s][^\s>]*)/g, '="$1"') // Quote unquoted attribute values
        .replace(/=\.\//g, '="') // Fix malformed relative paths
        .trim();
      return `<img${cleanAttrs ? ' ' + cleanAttrs : ''} />`;
    })
    // Fix malformed Callout components with spaces around = in props - comprehensive fix
    .replace(/<Callout\s+title="([^"]*?)"\s+icon\s*=\s*\{([^}]+)\}\s*>/g, '<Callout title="$1" icon={$2}>')
    .replace(/<Callout([^>]*?)\s+(\w+)\s*=\s*\{/g, '<Callout$1 $2={')
    .replace(/<Callout([^>]*?)\s+(\w+)\s*=\s*"/g, '<Callout$1 $2="')
    // Skip the general HTML tag transformation since it can cause issues with closing tags
    // Fix any malformed self-closing tags
    .replace(/<([a-zA-Z]+)([^>]*?)\/>/g, (match, tag, attrs) => {
      let cleanAttrs = attrs
        .replace(/(\w+)=/g, ' $1=')
        .replace(/=([^"'\s][^\s>]*)/g, '="$1"')
        .replace(/=\.\//g, '="')
        .trim();
      return `<${tag}${cleanAttrs ? ' ' + cleanAttrs : ''} />`;
    })
    // Fix any remaining malformed JSX fragments (only if they're not part of valid HTML)
    .replace(/(?<!<[^>]*)<>/g, '`<>`') // Convert empty JSX fragments to code
    .replace(/(?<!<[^>]*)<\/>/g, '`</>`') // Convert closing JSX fragments to code
    // Fix malformed HTML with forward slashes in wrong places
    .replace(/<\/([a-zA-Z]+)([^>]*?)\/>/g, '</$1>') // Clean up closing tags with extra slashes
    .replace(/<([a-zA-Z]+)([^>]*?)\/\s*([^>]*?)>/g, (match, tag, beforeSlash, afterSlash) => {
      // Handle misplaced forward slashes in opening tags
      if (afterSlash.trim() === '') {
        return `<${tag}${beforeSlash.trim()} />`;
      }
      // If there's content after the slash, it's likely not a self-closing tag
      return `<${tag}${beforeSlash} ${afterSlash}>`;
    })
    // Fix attribute values with dots and other problematic characters
    .replace(/=\.([^"\s>]*)/g, '=".$1"') // Quote attribute values starting with dots
    .replace(/=([^"'\s>]+\.[^"'\s>]*)/g, '="$1"') // Quote attribute values containing dots
    // Escape any stray braces that might cause JSX issues (but not in code blocks or math placeholders)
    .replace(/(?<!{)\{(?![/{]|\/\*|`[^`]*|__MATH_|__FLOWCHART_)/g, '\\{')
    .replace(/(?<!})\}(?![}]|\*\/|[^`]*`|__\d+__)/g, '\\}')
    // Fix any remaining malformed HTML tags
    .replace(/<(\w+)([^>]*?)(?<!\/|>)$/gm, '&lt;$1$2');

  const title = (customTitle || 'Untitled').replace(/"/g, '\\"');
  const description = (customDescription || '').replace(/"/g, '\\"');
  const safeEditUrl = editUrl || '';

  const frontmatter = `---
title: "${title}"
description: "${description}"
edit_url: ${safeEditUrl}
---

`;

  content = content.replace(/^(#{2,6})\s/gm, (match) => '#'.repeat(match.length - 1) + ' ');
  content = replaceRelativeLinks(content, sourceBaseUrl);

  // Restore preserved math expressions, flowcharts, and components
  content = content
    .replace(/__MATH_BLOCK_(\d+)__/g, (match, index) => mathExpressions[parseInt(index)])
    .replace(/__MATH_INLINE_(\d+)__/g, (match, index) => mathExpressions[parseInt(index)])
    .replace(/__FLOWCHART_(\d+)__/g, (match, index) => flowcharts[parseInt(index)])
    .replace(/__CALLOUT_(\d+)__/g, (match, index) => preservedComponents[parseInt(index)]);

  // Final cleanup fixes - apply these last to catch any issues from earlier transformations
  content = content
    .replace(/<\/di>/g, '</div>') // Fix malformed closing div tags
    .replace(/<imgsrc=/g, '<img src=') // Fix missing space in img tags
    .replace(/>\s*\/\s*\/>/g, ' />') // Fix malformed self-closing tags with extra slashes
    .replace(/<img([^>]*?)\s+\/>\s+\/>/g, '<img$1 />') // Fix double self-closing patterns
    .replace(/<img([^>]*?)>(?!\s*\/>)/g, '<img$1 />') // Make non-self-closing img tags self-closing
    .replace(/<img([^>]*?)\s+\/\s+\/>/g, '<img$1 />') // Fix spaced self-closing patterns
    .replace(/<http:\s*\/+/g, '<http://') // Fix broken HTTP URLs in angle brackets
    .replace(/<https:\s*\/+/g, '<https://') // Fix broken HTTPS URLs in angle brackets
    .replace(/\s+\/\s+\/>/g, ' />') // Fix any remaining spaced self-closing patterns
    .replace(/<(https?:\/\/[^>]+)>/g, '[$1]($1)') // Convert angle-bracket URLs to markdown links
    .replace(/```golang/g, '```go') // Fix golang language identifier to go
    .replace(/([`\w]+)\s*<=\s*([`\w()]+)/g, '$1 ≤ $2') // Replace <= with ≤ to avoid MDX parsing issues
    .replace(/([`\w]+)\s*>=\s*([`\w()]+)/g, '$1 ≥ $2') // Replace >= with ≥ to avoid MDX parsing issues
    .replace(/\s<>\s/g, ' ↔ ') // Replace empty angle brackets with bidirectional arrow to avoid MDX parsing issues
    .replace(/`<>`/g, '`↔`'); // Replace backtick-wrapped empty angle brackets

  return frontmatter + content;
}

export async function updateGitignore(fileConfigs: FileConfig[]): Promise<void> {
  const gitignorePath = '.gitignore';
  const remoteContentComment = '# Remote content output paths';

  let gitignoreContent = '';
  try {
    gitignoreContent = fs.readFileSync(gitignorePath, 'utf-8');
  } catch (error) {
    console.log('No .gitignore file found, creating new one');
  }

  const outputPaths = fileConfigs.map(config => config.outputPath);
  const existingLines = gitignoreContent.split('\n');

  // Find where the remote content section starts and ends
  const commentIndex = existingLines.findIndex(line => line.trim() === remoteContentComment);
  let insertIndex = existingLines.length;
  let remoteContentEndIndex = existingLines.length;

  if (commentIndex !== -1) {
    // Find the end of the remote content section (next comment or empty line)
    remoteContentEndIndex = existingLines.findIndex((line, index) =>
      index > commentIndex && (line.trim().startsWith('#') || line.trim() === '')
    );
    if (remoteContentEndIndex === -1) {
      remoteContentEndIndex = existingLines.length;
    }
    insertIndex = commentIndex;
  }

  // Extract existing remote content paths
  const existingRemotePaths = commentIndex !== -1
    ? existingLines.slice(commentIndex + 1, remoteContentEndIndex).filter(line => line.trim() && !line.startsWith('#'))
    : [];

  // Find missing paths
  const missingPaths = outputPaths.filter(path => !existingRemotePaths.includes(path));

  if (missingPaths.length === 0) {
    console.log('All output paths already exist in .gitignore');
    return;
  }

  // Prepare the new remote content section
  const newRemoteSection = [
    '',
    remoteContentComment,
    ...outputPaths.sort()
  ];

  // Rebuild the .gitignore content
  const beforeSection = commentIndex !== -1 ? existingLines.slice(0, insertIndex) : existingLines;
  const afterSection = commentIndex !== -1 ? existingLines.slice(remoteContentEndIndex) : [];

  const newGitignoreContent = [
    ...beforeSection,
    ...newRemoteSection,
    ...afterSection
  ].join('\n');

  fs.writeFileSync(gitignorePath, newGitignoreContent);
  console.log(`Updated .gitignore with ${missingPaths.length} new remote content paths`);
  missingPaths.forEach(path => console.log(`  Added: ${path}`));
}

export async function processFile(fileConfig: FileConfig): Promise<void> {
  const content = await fetchFileContent(fileConfig.sourceUrl);
  if (content) {
    const contentBaseUrl = new URL('.', fileConfig.contentUrl).href;
    const editUrl = deriveEditUrlFromSourceUrl(fileConfig.sourceUrl);

    const transformedContent = transformContent(content, fileConfig.title, fileConfig.description, contentBaseUrl, editUrl);
    const outputDir = path.dirname(fileConfig.outputPath);
    fs.mkdirSync(outputDir, { recursive: true });

    fs.writeFileSync(fileConfig.outputPath, transformedContent);
    console.log(`Processed and saved: ${fileConfig.outputPath}`);
  }
} 