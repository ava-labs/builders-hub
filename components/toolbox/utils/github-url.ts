/**
 * Generates a GitHub edit URL for console tools using import.meta.url
 * Automatically extracts the file path from import.meta.url and converts it to a GitHub edit URL
 * @example
 * In any console tool file:
 * const metadata: ConsoleToolMetadata = {
 *   ..., // other metadata
 *   githubUrl: generateConsoleToolGitHubUrl(import.meta.url)
 * };
 */
export function generateConsoleToolGitHubUrl(importMetaUrl: string): string {
  try {
    const url = new URL(importMetaUrl);
    const parts = url.pathname.split('components/toolbox/console/');
    if (parts.length !== 2) { return ''; }
    
    return `https://github.com/ava-labs/builders-hub/edit/master/components/toolbox/console/${parts[1]}`;
  } catch {
    return '';
  }
}

/**
 * Generates a GitHub URL for flow setup pages using import.meta.url
 * Automatically extracts the file path from import.meta.url and converts it to a GitHub URL
 * @example
 * In any flow setup page.tsx file:
 * const config: FlowConfig = {
 *   ..., // other config
 *   githubUrl: generateFlowSetupGitHubUrl(import.meta.url)
 * };
 */
export function generateFlowSetupGitHubUrl(importMetaUrl: string): string {
  try {
    const url = new URL(importMetaUrl);
    const parts = url.pathname.split('app/console/');
    if (parts.length !== 2) { return ''; }
    
    return `https://github.com/ava-labs/builders-hub/blob/main/app/console/${parts[1]}`;
  } catch {
    return '';
  }
}

/**
 * Extracts the console base path from import.meta.url
 * Automatically generates the basePath for flow setup pages
 * @example
 * In any flow setup page.tsx file:
 * const basePath = generateFlowBasePath(import.meta.url);
 * // Returns: "/console/icm/setup" or "/console/ictt/setup"
 */
export function generateFlowBasePath(importMetaUrl: string): string {
  try {
    const url = new URL(importMetaUrl);
    const parts = url.pathname.split('app/');
    if (parts.length !== 2) { return ''; }
    
    // Remove the filename (page.tsx) and get just the directory path
    const pathWithFile = parts[1];
    const pathParts = pathWithFile.split('/');
    pathParts.pop(); // Remove page.tsx
    
    return '/' + pathParts.join('/');
  } catch {
    return '';
  }
}
