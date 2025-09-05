import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { fixMDXSyntax } from '../fix-mdx-syntax.mts';

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
        let cleanSrc = imgSrc.replace(/^['"]|['"]$/g, '');
        
        // Fix malformed URLs with spaces and query parameters
        cleanSrc = cleanSrc
          .replace(/\s+/g, '') // Remove all spaces
          .replace(/\?.*$/, ''); // Remove query parameters that might be malformed
        
        if (cleanSrc.startsWith("http") || cleanSrc.startsWith("data:")) {
          // Convert GitHub blob URLs to raw URLs for direct image access
          const finalSrc = convertGitHubBlobToRaw(cleanSrc);
          const cleanAttrs = imgAttrs.trim();
          return `<img${cleanAttrs ? ' ' + cleanAttrs : ''} src="${finalSrc}" />`;
        }
        // Convert img src attribute relative link to absolute link, and properly close the tag as self-closing
        try {
          const absoluteUrl = new URL(cleanSrc, sourceBaseUrl).href;
          const finalSrc = convertGitHubBlobToRaw(absoluteUrl);
          const cleanAttrs = imgAttrs.trim();
          return `<img${cleanAttrs ? ' ' + cleanAttrs : ''} src="${finalSrc}" />`;
        } catch (error) {
          // If URL construction fails, return original match
          console.warn(`Failed to process img src: ${cleanSrc}`);
          return match;
        }
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
  const codeBlocks: string[] = [];
  
  // Preserve div blocks and their content to prevent internal tag escaping
  const divBlocks: string[] = [];
  content = content.replace(/<div[^>]*>[\s\S]*?<\/div>/gi, (match) => {
    const index = divBlocks.length;
    divBlocks.push(match);
    return `__DIV_BLOCK_${index}__`;
  });
  
  // Preserve table rows to prevent img tags in tables from being escaped
  const tableRows: string[] = [];
  content = content.replace(/^\|.*\|$/gm, (match) => {
    const index = tableRows.length;
    tableRows.push(match);
    return `__TABLE_ROW_${index}__`;
  });
  
  // Preserve code blocks first to avoid processing their content
  content = content
    // Preserve fenced code blocks
    .replace(/```[\s\S]*?```/g, (match) => {
      const index = codeBlocks.length;
      codeBlocks.push(match);
      return `__CODE_BLOCK_${index}__`;
    })
    // Preserve inline code (including multiline)
    .replace(/`[^`]*`/g, (match) => {
      const index = codeBlocks.length;
      codeBlocks.push(match);
      return `__CODE_INLINE_${index}__`;
    });
  
  // Preserve problematic Callout components
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
    .replace(/<\/di>/g, '</div>') // Fix specific malformed closing tag
    // Fix image tags with broken attributes (like the ones in installation.mdx)
    .replace(/<img([^>]*?)\s+\/>\s+alt="([^"]*?)"\s*\/>/g, '<img$1 alt="$2" />')
    .replace(/<img([^>]*?)\s+\/>\s+([^/>]+)\s*\/>/g, '<img$1 $2 />'); // Fix attributes after self-closing

      // Convert GitHub-flavored markdown to MDX-compatible syntax
  content = content
    // Convert note blocks to proper MDX format
    .replace(/>\s*\[NOTE\]\s*(.*?)$/gm, ':::note\n$1\n:::')
    .replace(/>\s*\[TIP\]\s*(.*?)$/gm, ':::tip\n$1\n:::')
    // Handle note/warning/info blocks
    .replace(/^:::(\s*note|tip|warning|info|caution)\s*$/gm, ':::$1')
    // Convert image syntax to MDX-compatible format BEFORE handling other ! characters
    // But preserve images that are inside markdown links
    .replace(/(?<!\[)!\[(.*?)\]\((.*?)\)/g, '<img alt="$1" src="$2" />')
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
    .replace(/<img([^>]*?)\s+\/>\s+alt="([^"]*?)"\s*\/>/gi, (match, attrs, alt) => {
      // Fix img tags where alt attribute is outside the tag
      let cleanAttrs = attrs
        .replace(/(\w+)=/g, ' $1=')
        .replace(/=([^"'\s][^\s>]*)/g, '="$1"')
        // Remove MDX/JS comments inside tag context
        .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
        .replace(/\s\/\/[^>\n]*/g, ' ')
        // Replace commas between attributes (but not inside quotes)
        .replace(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/g, ' ')
        .replace(/\s{2,}/g, ' ')
        .trim();
      return `<img${cleanAttrs ? ' ' + cleanAttrs : ''} alt="${alt}" />`;
    })
    .replace(/<img([^>]*?)\s+\/\s+\/>/gi, (match, attrs) => {
      // Fix malformed img tags with extra spaces and slashes
      let cleanAttrs = attrs
        .replace(/(\w+)=/g, ' $1=')
        .replace(/=([^"'\s][^\s>]*)/g, '="$1"')
        .replace(/=\.\//g, '="')
        .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
        .replace(/\s\/\/[^>\n]*/g, ' ')
        .replace(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/g, ' ')
        .replace(/\s{2,}/g, ' ')
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
        .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
        .replace(/\s\/\/[^>\n]*/g, ' ')
        .replace(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/g, ' ')
        .replace(/\s{2,}/g, ' ')
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
        .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
        .replace(/\s\/\/[^>\n]*/g, ' ')
        .replace(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/g, ' ')
        .replace(/\s{2,}/g, ' ')
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
  
  // Fix URLs that have been corrupted with spaces before applying link replacement
  content = content
    .replace(/https:\s+\/\//g, 'https://')
    .replace(/http:\s+\/\//g, 'http://')
    // Fix specific pattern where img tags get corrupted with attributes outside
    .replace(/<img\s+src="([^"]+)"\s*\/>\s*alt="([^"]+)"\s*\/>/gi, '<img src="$1" alt="$2" />');
  
  content = replaceRelativeLinks(content, sourceBaseUrl);

  // Helper: convert a fenced mermaid block to <Mermaid chart={`...`} />
  function convertMermaidFenceToComponent(fence: string): string {
    // Strip the ```mermaid fence
    let inner = fence.replace(/^```mermaid\s*/, '').replace(/```$/, '');
    inner = inner.trim();

    // Convert optional YAML-like config block at the start to Mermaid init directive
    // Example handled: ---\n  config:\n    class:\n      hideEmptyMembersBox: true\n---\n
    if (inner.startsWith('---')) {
      const secondFenceIndex = inner.indexOf('---', 3);
      if (secondFenceIndex !== -1) {
        const yamlSection = inner.slice(3, secondFenceIndex).trim();
        const diagramBody = inner.slice(secondFenceIndex + 3).trim();
        let initPrefix = '';
        if (/config:\s*[\s\S]*class:\s*[\s\S]*hideEmptyMembersBox:\s*true/i.test(yamlSection)) {
          initPrefix = "%%{init: { 'class': { 'hideEmptyMembersBox': true } }}%%\n";
        }
        inner = `${initPrefix}${diagramBody}`;
      }
    }

    // Escape backticks to avoid breaking the template literal
    inner = inner.replace(/`/g, '\\`');

    return `<Mermaid chart={\`${inner}\`} />`;
  }

  // Restore div blocks early to prevent their content from being escaped
  content = content.replace(/__DIV_BLOCK_(\d+)__/g, (match, index) => {
    let divContent = divBlocks[parseInt(index)];
    // Fix any URL corruption within div blocks
    divContent = divContent
      .replace(/https:\s*\/\//g, 'https://')
      .replace(/http:\s*\/\//g, 'http://');
    // Sanitize JSX comments and stray commas or inline // comments inside tag bodies
    divContent = divContent.replace(/<([A-Za-z][^>]*?)(\/)?>/g, (m, inside, selfClose) => {
      let cleaned = String(inside)
        .replace(/\{\/\*[\s\S]*?\*\/\}/g, '') // remove MDX comments inside tags
        .replace(/\s\/\/[^>\n]*/g, ' ') // remove inline // comments inside tags
        .replace(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/g, ' ') // replace commas between attrs
        .replace(/\s{2,}/g, ' ') // collapse whitespace
        .trim();
      return `<${cleaned}${selfClose ? ' />' : '>'}`;
    });
    return divContent;
  });
  
  // Restore preserved math expressions, flowcharts, and components
  content = content
    .replace(/__MATH_BLOCK_(\d+)__/g, (match, index) => mathExpressions[parseInt(index)])
    .replace(/__MATH_INLINE_(\d+)__/g, (match, index) => mathExpressions[parseInt(index)])
    .replace(/__FLOWCHART_(\d+)__/g, (match, index) => convertMermaidFenceToComponent(flowcharts[parseInt(index)]))
    .replace(/__CALLOUT_(\d+)__/g, (match, index) => preservedComponents[parseInt(index)])
    .replace(/__CODE_BLOCK_(\d+)__/g, (match, index) => codeBlocks[parseInt(index)])
    .replace(/__CODE_INLINE_(\d+)__/g, (match, index) => codeBlocks[parseInt(index)])
    .replace(/__TABLE_ROW_(\d+)__/g, (match, index) => tableRows[parseInt(index)]);

  // Final cleanup fixes - apply these last to catch any issues from earlier transformations
  content = content
    .replace(/<\/di>/g, '</div>') // Fix malformed closing div tags
    .replace(/<imgsrc=/g, '<img src=') // Fix missing space in img tags
    // Fix escaped tags
    .replace(/&lt;(p|a|h[1-6]|span|div)(\s+[^&]*?)?&gt;/gi, '<$1$2>') // Unescape opening tags
    .replace(/&lt;\/(p|a|h[1-6]|span|div)&gt;/gi, '</$1>') // Unescape closing tags
    // Fix escaped img tags with malformed closing
    .replace(/&lt;img\s+([^&]*?)\s*\/&gt;/gi, (match, attrs) => {
      // Unescape the img tag and fix the closing
      return `<img ${attrs} />`;
    })
    // Fix escaped img tags that have attributes after the closing
    .replace(/&lt;img\s+([^&]*?)\s*\/&gt;\s*([^<\n]+)/gi, (match, attrs, trailing) => {
      // Check if trailing content looks like attributes
      if (trailing.includes('alt=') || trailing.includes('src=')) {
        // Sanitize trailing attribute chunk (remove leading commas/comments)
        const sanitizedTrailing = trailing
          .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
          .replace(/\s\/\/[^>\n]*/g, ' ')
          .replace(/^[,;:]+/, '')
          .replace(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/g, ' ')
          .replace(/\s{2,}/g, ' ')
          .trim();
        return `<img ${attrs} ${sanitizedTrailing} />`;
      }
      return `<img ${attrs} />${trailing}`;
    })
    .replace(/>\s*\/\s*\/>/g, ' />') // Fix malformed self-closing tags with extra slashes
    .replace(/<img([^>]*?)\s+\/>\s+\/>/g, '<img$1 />') // Fix double self-closing patterns
    .replace(/<img([^>]*?)\s+\/\/\s*>/g, '<img$1 />') // Fix `<img ... //>` pattern
    .replace(/<img([^>]*?)>(?!\s*\/>)/g, '<img$1 />') // Make non-self-closing img tags self-closing
    .replace(/<img([^>]*?)\s+\/\s+\/>/g, '<img$1 />') // Fix spaced self-closing patterns
    // Fix malformed img tags with broken URLs and closing tags
    .replace(/<img([^>]*?)src="([^"]*?)\?\s*raw="[^>]*?>true"[^>]*?\/>\s*<\/img>/g, (match, attrs, src) => {
      const cleanSrc = src.replace(/\s+/g, '').replace(/\?.*$/, '');
      const cleanAttrs = attrs.trim();
      return `<img${cleanAttrs ? ' ' + cleanAttrs : ''} src="${cleanSrc}" />`;
    })
    // Fix other malformed img patterns with invalid closing tags
    .replace(/<img([^>]*?)\/>\s*[^<]*?<\/img>/g, '<img$1 />')
    .replace(/\/>\s*true"*\s*\/*\s*\/>/g, ' />') // Fix patterns like />true"/" />
    .replace(/<img([^>]*?)\/>\s*true"[^>]*?\/\s*\/>/g, '<img$1 />') // Fix />true"/" /> patterns
    .replace(/<img([^>]*?)\/>\s*true"[^>]*?alt="[^"]*"[^>]*?\/\s*\/>/g, '<img$1 />') // Fix more complex patterns
    .replace(/"\s*\/>\s*true"[^>]*?\/\s*\/>/g, '" />') // Fix malformed attribute endings
    .replace(/\/>\s*true"\/"\s*\/>/g, ' />') // Fix specific />true"/" /> pattern
    .replace(/\/>\s*true""\s*alt="[^"]*"\/\s*\/>/g, ' />') // Fix />true"" alt="..."/ /> pattern
    .replace(/<\/img>/g, '') // Remove any remaining invalid </img> closing tags
    // Fix malformed URLs in src attributes
    .replace(/src="https:\/([^"]+)"/g, 'src="https://$1"') // Fix missing colon in https URLs
    .replace(/<http:\s*\/+/g, '<http://') // Fix broken HTTP URLs in angle brackets
    .replace(/<https:\s*\/+/g, '<https://') // Fix broken HTTPS URLs in angle brackets
    .replace(/\s+\/\s+\/>/g, ' />') // Fix any remaining spaced self-closing patterns
    .replace(/<(https?:\/\/[^>]+)>/g, '[$1]($1)') // Convert angle-bracket URLs to markdown links
    .replace(/```golang/g, '```go') // Fix golang language identifier to go
    .replace(/([`\w]+)\s*<=\s*([`\w()]+)/g, '$1 ≤ $2') // Replace <= with ≤ to avoid MDX parsing issues
    .replace(/([`\w]+)\s*>=\s*([`\w()]+)/g, '$1 ≥ $2') // Replace >= with ≥ to avoid MDX parsing issues
    .replace(/\s<>\s/g, ' ↔ ') // Replace empty angle brackets with bidirectional arrow to avoid MDX parsing issues
    .replace(/`<>`/g, '`↔`') // Replace backtick-wrapped empty angle brackets
    // Fix standalone angle brackets that might cause JSX parsing issues
    .replace(/([^<])<([^/>][^>]*)>([^<])/g, '$1&lt;$2&gt;$3') // Escape standalone angle brackets
    .replace(/<([A-Z][a-zA-Z0-9]*)\s*\/>/g, '<$1 />') // Ensure proper spacing in self-closing JSX tags
    // Don't escape valid HTML tags like div, span, p, etc.
    .replace(/<((?!div|span|p|img|a|h[1-6]|ul|ol|li|table|tr|td|th|br|hr|code|pre|blockquote|em|strong|b|i)[a-z]+)>/g, '&lt;$1&gt;') // Escape non-standard lowercase HTML-like tags
    .replace(/<\/((?!div|span|p|img|a|h[1-6]|ul|ol|li|table|tr|td|th|br|hr|code|pre|blockquote|em|strong|b|i)[a-z]+)>/g, '&lt;/$1&gt;'); // Escape non-standard lowercase closing tags

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

    let transformedContent = transformContent(content, fileConfig.title, fileConfig.description, contentBaseUrl, editUrl);
    
    // Apply MDX syntax fixes as a final post-processing step
    transformedContent = fixMDXSyntax(transformedContent);
    
    const outputDir = path.dirname(fileConfig.outputPath);
    fs.mkdirSync(outputDir, { recursive: true });

    fs.writeFileSync(fileConfig.outputPath, transformedContent);
    console.log(`Processed and saved: ${fileConfig.outputPath}`);
  }
} 