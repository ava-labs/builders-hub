/**
 * Generates a GitHub edit URL for console tools using import.meta.url
 * Automatically extracts the file path from import.meta.url and converts it to a GitHub edit URL
 * @example
 * // In any console tool file:
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
