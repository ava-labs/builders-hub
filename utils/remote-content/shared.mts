import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { rewriteMovedLinks } from './moved-links.mts';
// Intentionally no global MDX fixer; section parsers handle transformations

export interface FileConfig {
  sourceUrl: string;
  outputPath: string;
  title: string;
  description: string;
  contentUrl: string;
  content?: string; // Optional: directly provide content instead of fetching from sourceUrl
  embeds?: EmbedConfig[];
}

// Another upstream file whose sections replace the body of the page's `##` section that links to it, so the page
// keeps every option when upstream splits its options across files. A page that doesn't link to it is left as it is.
export interface EmbedConfig {
  sourceUrl: string;
  contentUrl: string;
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
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)|<img([^>]*?)src=([^"'\s>]+|['"][^'"]*['"])([^>]*?)\/?>/g;
  
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
    (match, text, markdownLink, imgAttrs, imgSrc, imgRest) => {
      if (markdownLink) {
        // CommonMark allows the destination in angle brackets, so that it can hold spaces: ![a](<my chart.png>).
        // Unwrap it, or new URL() encodes the brackets into the path (%3Cmy%20chart.png%3E).
        const destination: string = markdownLink.match(/^<([^<>\n]*)>$/)?.[1] ?? markdownLink;
        const isImage = /\.(png|jpe?g|gif|svg)$/i.test(destination);
        if (
          destination.startsWith("http") ||
          destination.startsWith("#") ||
          destination.startsWith("mailto:")
        ) {
          // Convert GitHub blob URLs to raw URLs for images
          if (destination.includes('github.com') && destination.includes('/blob/') && isImage) {
            return `[${text}](${convertGitHubBlobToRaw(destination)})`;
          }
          return match;
        }
        // Convert markdown-style relative link to absolute link. A blob URL serves an HTML page, so an image
        // gets the raw URL.
        const absoluteUrl = new URL(destination, sourceBaseUrl).href;
        return `[${text}](${isImage ? convertGitHubBlobToRaw(absoluteUrl) : absoluteUrl})`;
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
          const cleanAttrs = `${imgAttrs ?? ''} ${imgRest ?? ''}`.replace(/\s+/g, ' ').trim();
          return `<img${cleanAttrs ? ' ' + cleanAttrs : ''} src="${finalSrc}" />`;
        }
        // Convert img src attribute relative link to absolute link, and properly close the tag as self-closing
        try {
          const absoluteUrl = new URL(cleanSrc, sourceBaseUrl).href;
          const finalSrc = convertGitHubBlobToRaw(absoluteUrl);
          const cleanAttrs = `${imgAttrs ?? ''} ${imgRest ?? ''}`.replace(/\s+/g, ' ').trim();
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

const FENCE = /^\s*(```|~~~)/;

function headingSlug(heading: string): string {
  return heading.trim().toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
}

// Each line with whether it is inside a fenced code block, so "#" comments in code are not taken for headings.
function linesWithFences(content: string): { line: string; code: boolean }[] {
  let inFence = false;
  return content.split('\n').map((line) => {
    const fence = FENCE.test(line);
    if (fence) inFence = !inFence;
    return { line, code: inFence || fence };
  });
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Replaces the body of the page's first `##` section that links to the embedded file with the sections of the
 * embedded file (from its first `##` heading on, one level deeper), and points the page's links to the embedded
 * file at the embedded headings.
 */
export function embedSections(
  content: string,
  embedded: string,
  meta: { contentUrl: string; embedContentUrl: string; embedSourceUrl: string },
): string {
  const embedDir = new URL('.', meta.embedContentUrl).href;
  const embeddedPage = escapeRegExp(new URL(path.basename(new URL(meta.embedSourceUrl).pathname), embedDir).href);
  const linksToEmbedded = new RegExp(`\\]\\(${embeddedPage}(#[^)]*)?\\)`);

  const lines = linesWithFences(replaceRelativeLinks(content, new URL('.', meta.contentUrl).href));
  const isSection = ({ line, code }: { line: string; code: boolean }) => !code && /^##\s/.test(line);
  const sectionEnd = (start: number) => {
    const next = lines.findIndex((l, i) => i > start && isSection(l));
    return next === -1 ? lines.length : next;
  };
  const start = lines.findIndex(
    (l, i) => isSection(l) && lines.slice(i + 1, sectionEnd(i)).some(({ line }) => linksToEmbedded.test(line)),
  );
  if (start === -1) return content;

  const embeddedLines = linesWithFences(replaceRelativeLinks(embedded, embedDir));
  const first = embeddedLines.findIndex(isSection);
  if (first === -1) return content;
  const body = embeddedLines
    .slice(first)
    .map(({ line, code }) => (!code && /^#{2,5}\s/.test(line) ? `#${line}` : line))
    .join('\n')
    .trim();

  const page = [
    ...lines.slice(0, start + 1).map(({ line }) => line),
    '',
    body,
    '',
    ...lines.slice(sectionEnd(start)).map(({ line }) => line),
  ].join('\n');

  return page
    .replace(new RegExp(`\\]\\(${embeddedPage}(#[^)]+)\\)`, 'g'), ']($1)')
    .replace(new RegExp(`\\]\\(${embeddedPage}\\)`, 'g'), `](#${headingSlug(lines[start].line.replace(/^##\s+/, ''))})`);
}

async function applyEmbeds(content: string, fileConfig: FileConfig): Promise<string> {
  let page = content;
  for (const embed of fileConfig.embeds ?? []) {
    const embedded = await fetchFileContent(embed.sourceUrl);
    if (!embedded) throw new Error(`Failed to fetch ${embed.sourceUrl}, embedded in ${fileConfig.outputPath}`);
    page = embedSections(page, embedded, {
      contentUrl: fileConfig.contentUrl,
      embedContentUrl: embed.contentUrl,
      embedSourceUrl: embed.sourceUrl,
    });
  }
  return page;
}

export async function processFile(fileConfig: FileConfig, parser?: SectionParser): Promise<void> {
  // Use provided content or fetch from sourceUrl
  const fetched = fileConfig.content || await fetchFileContent(fileConfig.sourceUrl);
  const content = fetched && !fileConfig.content ? await applyEmbeds(fetched, fileConfig) : fetched;
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

    // Every remote file gets the dead-link rewrites, also the generated release notes that skip the parser.
    fs.writeFileSync(fileConfig.outputPath, rewriteMovedLinks(transformedContent));
    console.log(`Processed and saved: ${fileConfig.outputPath}`);
  }
} 