import { FileConfig } from './shared.mts';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

interface GitHubTreeItem {
  path: string;
  type: string;
  mode: string;
  sha: string;
}

interface GitHubTreeResponse {
  tree: GitHubTreeItem[];
}

interface AcpInfo {
  number: number;
  slug: string;
  title: string;
  track: string;
}

/**
 * Fetch all ACP directories from the GitHub repository
 */
async function fetchAllAcps(): Promise<GitHubTreeItem[]> {
  try {
    const response = await axios.get<GitHubTreeResponse>(
      'https://api.github.com/repos/avalanche-foundation/ACPs/git/trees/main:ACPs',
      {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Avalanche-Docs-Bot'
        }
      }
    );
    
    return response.data.tree.filter(item => 
      item.type === 'tree' && 
      item.path.match(/^\d+/) // Only directories starting with numbers (ACP directories)
    );
  } catch (error) {
    console.error('Failed to fetch ACPs from GitHub:', error);
    throw new Error('Unable to fetch ACPs from GitHub repository');
  }
}

/**
 * Extract ACP number and title from directory name
 */
function parseAcpInfo(directoryName: string): { number: string; title: string } {
  const match = directoryName.match(/^(\d+)-(.+)$/);
  if (match) {
    const [, number, titleSlug] = match;
    const title = titleSlug
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
    return { number, title };
  }
  return { number: directoryName, title: directoryName };
}

/**
 * Parse track information from an ACP file
 */
function parseAcpTrack(content: string): string {
  // Look for the Track field in the table
  const trackMatch = content.match(/\|\s*\*\*Track\*\*\s*\|\s*([^|]+)\s*\|/);
  if (trackMatch) {
    const track = trackMatch[1].trim();
    
    // Normalize track names
    if (track.toLowerCase().includes('standard')) {
      return 'Standards';
    } else if (track.toLowerCase().includes('best practices')) {
      return 'Best Practices';
    } else if (track.toLowerCase().includes('meta')) {
      return 'Meta';
    } else if (track.toLowerCase().includes('informational')) {
      return 'Informational';
    }
    
    return track;
  }
  
  // Default to Standards if not found
  return 'Standards';
}

/**
 * Analyze ACP files to extract metadata
 */
async function analyzeAcpFiles(acpDirectories: GitHubTreeItem[]): Promise<AcpInfo[]> {
  const acpInfos: AcpInfo[] = [];
  
  for (const acpDir of acpDirectories) {
    try {
      const { number } = parseAcpInfo(acpDir.path);
      const sourceUrl = `https://raw.githubusercontent.com/avalanche-foundation/ACPs/main/ACPs/${acpDir.path}/README.md`;
      
      // Fetch the content to parse track information
      const response = await axios.get(sourceUrl);
      const content = response.data;
      
      const track = parseAcpTrack(content);
      
      // Extract title from content
      const titleMatch = content.match(/\|\s*\*\*Title\*\*\s*\|\s*([^|]+)\s*\|/);
      const title = titleMatch ? titleMatch[1].trim() : parseAcpInfo(acpDir.path).title;
      
      acpInfos.push({
        number: parseInt(number),
        slug: acpDir.path,
        title,
        track
      });
    } catch (error) {
      console.warn(`Failed to analyze ACP ${acpDir.path}:`, error);
      // Add with minimal info if analysis fails
      const { number, title } = parseAcpInfo(acpDir.path);
      acpInfos.push({
        number: parseInt(number),
        slug: acpDir.path,
        title,
        track: 'Standards'
      });
    }
  }
  
  return acpInfos.sort((a, b) => b.number - a.number); // Sort by number descending (newest first)
}

/**
 * Generate meta.json for ACPs organized by track
 */
async function generateAcpMeta(acpInfos: AcpInfo[]): Promise<void> {
  // Group ACPs by track
  const trackGroups = acpInfos.reduce((groups, acp) => {
    const trackKey = acp.track;
    if (!groups[trackKey]) {
      groups[trackKey] = [];
    }
    groups[trackKey].push(acp);
    return groups;
  }, {} as Record<string, AcpInfo[]>);

  // Define track order and section headers
  const trackOrder = [
    { key: 'Standards', header: 'Standards Track ACPs' },
    { key: 'Best Practices', header: 'Best Practices Track ACPs' },
    { key: 'Informational', header: 'Informational Track ACPs' },
    { key: 'Meta', header: 'Meta Track ACPs' }
  ];

  // Build pages array
  const pages: string[] = [
    "---Overview---",
    "index"
  ];

  // Add each track section
  for (const { key, header } of trackOrder) {
    if (trackGroups[key] && trackGroups[key].length > 0) {
      pages.push(`---${header}---`);
      // Sort ACPs within each track by number (descending)
      const sortedAcps = trackGroups[key].sort((a, b) => b.number - a.number);
      pages.push(...sortedAcps.map(acp => acp.slug));
    }
  }

  // Create meta.json content
  const metaContent = {
    title: "ACPs",
    description: "Official Avalanche Community Proposals (ACPs) for network improvements and best practices",
    icon: "FileText",
    root: true,
    pages
  };

  // Write meta.json file
  const metaPath = path.join('content/docs/acps/meta.json');
  fs.writeFileSync(metaPath, JSON.stringify(metaContent, null, 2));
  
  console.log(`Generated meta.json with ${acpInfos.length} ACPs organized by track`);
  console.log(`Track distribution: ${Object.entries(trackGroups).map(([track, acps]) => `${track}: ${acps.length}`).join(', ')}`);
}

/**
 * Generate configurations for all ACPs dynamically
 */
async function generateAcpConfigs(): Promise<FileConfig[]> {
  const acpDirectories = await fetchAllAcps();
  
  console.log(`Found ${acpDirectories.length} ACPs to process`);
  
  // Analyze ACP files to get metadata
  const acpInfos = await analyzeAcpFiles(acpDirectories);
  
  // Generate meta.json
  await generateAcpMeta(acpInfos);
  
  const configs: FileConfig[] = [];

  // Add main ACP repository README as index page
  configs.push({
    sourceUrl: "https://raw.githubusercontent.com/avalanche-foundation/ACPs/main/README.md",
    outputPath: "content/docs/acps/index.mdx",
    title: "Avalanche Community Proposals (ACPs)",
    description: "Official framework for proposing improvements and gathering consensus around changes to the Avalanche Network",
    contentUrl: "https://raw.githubusercontent.com/avalanche-foundation/ACPs/main/",
  });

  // Generate configs for each ACP
  for (const acpDir of acpDirectories) {
    const { number, title } = parseAcpInfo(acpDir.path);
    
    configs.push({
      sourceUrl: `https://raw.githubusercontent.com/avalanche-foundation/ACPs/main/ACPs/${acpDir.path}/README.md`,
      outputPath: `content/docs/acps/${acpDir.path}.mdx`,
      title: `ACP-${number}: ${title}`,
      description: `Details for Avalanche Community Proposal ${number}: ${title}`,
      contentUrl: `https://github.com/avalanche-foundation/ACPs/blob/main/ACPs/${acpDir.path}/`,
    });
  }

  return configs.sort((a, b) => {
    // Sort by ACP number
    const aNum = parseInt(a.outputPath.match(/acps\/(\d+)/)?.[1] || '0');
    const bNum = parseInt(b.outputPath.match(/acps\/(\d+)/)?.[1] || '0');
    return aNum - bNum;
  });
}

export async function getAcpsConfigs(): Promise<FileConfig[]> {
  return await generateAcpConfigs();
} 