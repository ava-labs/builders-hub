import axios from 'axios';

const GITHUB_API_VERSION = '2022-11-28';

export function getGitHubApiHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'Avalanche-Docs-Bot',
    'X-GitHub-Api-Version': GITHUB_API_VERSION,
  };

  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  return headers;
}

export function formatGitHubApiError(context: string, error: unknown): string {
  if (!axios.isAxiosError(error)) {
    const message = error instanceof Error ? error.message : String(error);
    return `${context}: ${message}`;
  }

  const parts = [context];
  const status = error.response?.status;
  const remaining = error.response?.headers?.['x-ratelimit-remaining'];
  const reset = error.response?.headers?.['x-ratelimit-reset'];
  const data = error.response?.data as { message?: string } | undefined;

  if (status) {
    parts.push(`status=${status}`);
  }

  if (data?.message) {
    parts.push(data.message);
  } else if (error.message) {
    parts.push(error.message);
  }

  if (remaining !== undefined) {
    parts.push(`remaining=${remaining}`);
  }

  if (reset !== undefined) {
    const resetTimestamp = Number(reset);
    if (Number.isFinite(resetTimestamp)) {
      parts.push(`reset=${new Date(resetTimestamp * 1000).toISOString()}`);
    }
  }

  if (!process.env.GITHUB_TOKEN) {
    parts.push('GITHUB_TOKEN not set');
  }

  return parts.join(' | ');
}
