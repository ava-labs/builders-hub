import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
// Intentionally no global MDX fixer; section parsers handle transformations

export interface FileConfig {
  sourceUrl: string;
  outputPath: string;
  title: string;
  description: string;
  contentUrl: string;
  content?: string; // Optional: directly provide content instead of fetching from sourceUrl
}

export type SectionParser = (content: string, meta: {
  title: string;
  description: string;
  sourceBaseUrl: string;
  editUrl?: string;
}) => string;

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

export async function processFile(fileConfig: FileConfig, parser?: SectionParser): Promise<void> {
  // Use provided content or fetch from sourceUrl
  const content = fileConfig.content || await fetchFileContent(fileConfig.sourceUrl);
  if (content) {
    let transformedContent: string;
    
    // Skip parser if content is directly provided (e.g., generated index files)
    if (fileConfig.content) {
      transformedContent = content;
    } else if (parser && fileConfig.contentUrl) {
      const contentBaseUrl = new URL('.', fileConfig.contentUrl).href;
      const editUrl = fileConfig.sourceUrl ? deriveEditUrlFromSourceUrl(fileConfig.sourceUrl) : undefined;
      transformedContent = parser(content, { 
        title: fileConfig.title, 
        description: fileConfig.description, 
        sourceBaseUrl: contentBaseUrl, 
        editUrl 
      });
    } else {
      transformedContent = content;
    }
    
    const outputDir = path.dirname(fileConfig.outputPath);
    fs.mkdirSync(outputDir, { recursive: true });

    fs.writeFileSync(fileConfig.outputPath, transformedContent);
    console.log(`Processed and saved: ${fileConfig.outputPath}`);
  }
} 