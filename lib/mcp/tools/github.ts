import type { ToolDomain, ToolResult } from '../types';

const GITHUB_API = 'https://api.github.com';
const MAX_FILE_CONTENT_CHARS = 50_000;
const MAX_USER_QUERY_CHARS = 100;
const MAX_PATH_CHARS = 512;
// Conservative subset of valid git refs: branches, tags, SHAs (e.g. "main", "v1.2.3", "feat/foo", "abc123def").
// Disallows whitespace, ?, &, #, %, NUL, and anything else that could change request semantics.
const REF_REGEX = /^[A-Za-z0-9._/\-]{1,200}$/;
// Strip GitHub search qualifiers a user might inject (repo:, org:, user:, in:, path:, etc.) — we'll add our own.
const QUALIFIER_REGEX = /\b(repo|org|user|in|path|filename|extension|language|fork|size|stars|forks|created|pushed|topic|topics|archived|mirror|is):\S*/gi;

export const GITHUB_REPOSITORIES = [
  {
    name: 'avalanchego',
    fullName: 'ava-labs/avalanchego',
    description: 'AvalancheGo node, consensus, PlatformVM, AVM, networking, and core node APIs',
  },
  {
    name: 'subnet-evm',
    fullName: 'ava-labs/subnet-evm',
    description: 'Subnet-EVM implementation, precompiles, EVM chain configuration, and VM plugin code',
  },
  {
    name: 'coreth',
    fullName: 'ava-labs/coreth',
    description: 'C-Chain EVM implementation history and Coreth code',
  },
  {
    name: 'avalanche-cli',
    fullName: 'ava-labs/avalanche-cli',
    description: 'Avalanche CLI commands for L1 creation, deployment, validation, and node workflows',
  },
  {
    name: 'platform-cli',
    fullName: 'ava-labs/platform-cli',
    description: 'Platform CLI commands for P-Chain, staking, validators, keys, and transfers',
  },
  {
    name: 'icm-services',
    fullName: 'ava-labs/icm-services',
    description: 'Interchain Messaging services, relayer code, and ICM contracts',
  },
  {
    name: 'avalanche-network-runner',
    fullName: 'ava-labs/avalanche-network-runner',
    description: 'Local Avalanche network orchestration and test network tooling',
  },
  {
    name: 'icm-contracts',
    fullName: 'ava-labs/icm-contracts',
    description: 'Interchain Messaging Solidity contracts (Teleporter, ICTT, registry)',
  },
  {
    name: 'hypersdk',
    fullName: 'ava-labs/hypersdk',
    description: 'HyperSDK framework for high-performance Avalanche VMs',
  },
  {
    name: 'libevm',
    fullName: 'ava-labs/libevm',
    description: 'libevm shared EVM library used by Avalanche VMs',
  },
  {
    name: 'builders-hub',
    fullName: 'ava-labs/builders-hub',
    description: 'Builders Hub docs, examples, MCP server, and developer site code',
  },
] as const;

export const GITHUB_REPO_NAMES = GITHUB_REPOSITORIES.map((repo) => repo.name);
export const GITHUB_LANGUAGE_FILTERS = [
  'go',
  'solidity',
  'typescript',
  'javascript',
  'python',
  'rust',
  'shell',
  'markdown',
  'yaml',
  'json',
  'any',
] as const;

type RepoName = (typeof GITHUB_REPO_NAMES)[number];
type RepoSearchName = RepoName | 'all';
type LanguageFilter = (typeof GITHUB_LANGUAGE_FILTERS)[number];

const ALLOWED_REPOS = GITHUB_REPOSITORIES.map((repo) => repo.fullName);

interface SearchCodeParams {
  query: string;
  repo?: RepoSearchName;
  language?: LanguageFilter;
  perPage?: number;
}

interface GetFileParams {
  repo: RepoName;
  path: string;
  ref?: string;
}

function isRepoName(repo: unknown): repo is RepoName {
  return typeof repo === 'string' && GITHUB_REPO_NAMES.includes(repo as RepoName);
}

function getRepoFullName(repo: RepoName): string {
  return `ava-labs/${repo}`;
}

function validateRepoPath(path: string): string | null {
  if (!path) return 'File path is required';
  if (path.length > MAX_PATH_CHARS) return `File path exceeds ${MAX_PATH_CHARS} characters`;

  // Decode once to catch percent-encoded traversal attempts.
  let decoded = path;
  try {
    decoded = decodeURIComponent(path);
  } catch {
    return 'File path contains invalid percent-encoded characters';
  }

  if (decoded.startsWith('/')) return 'File path must be relative to the repository root';
  if (decoded.includes('..')) return 'File path must not include path traversal';
  if (decoded.includes('://')) return 'File path must not include a protocol';
  if (decoded.includes('\\')) return 'File path must use forward slashes';
  if (/^[A-Za-z]:/.test(decoded)) return 'File path must not be an absolute Windows path';
  if (/[\x00-\x1f]/.test(decoded)) return 'File path must not contain control characters';
  return null;
}

function buildSearchQuery(rawQuery: string): string {
  // Strip qualifier-style tokens to prevent users from broadening the search scope to repos
  // outside the allowlist (the server-side GITHUB_TOKEN could otherwise expose private content).
  const sanitized = rawQuery.replace(QUALIFIER_REGEX, ' ').replace(/\s+/g, ' ').trim();
  return sanitized.length > MAX_USER_QUERY_CHARS ? sanitized.slice(0, MAX_USER_QUERY_CHARS) : sanitized;
}

function buildGithubHeaders(): HeadersInit {
  const headers: HeadersInit = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'Avalanche-Builders-Hub',
  };
  const token = process.env.GITHUB_TOKEN;
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

interface GithubSearchItem {
  name: string;
  path: string;
  repository: { full_name: string };
  html_url: string;
  text_matches?: Array<{ fragment?: string }>;
  score?: number;
}

interface GithubSearchResponse {
  total_count?: number;
  items?: GithubSearchItem[];
}

interface SingleRepoSearchOk {
  ok: true;
  total_count: number;
  items: Array<{
    name: string;
    path: string;
    repository: string;
    html_url: string;
    text_matches?: Array<{ fragment?: string }>;
    score?: number;
  }>;
}

interface SingleRepoSearchErr {
  ok: false;
  status: number;
  details: string;
}

async function searchSingleRepo(
  sanitizedQuery: string,
  repoFullName: string,
  language: LanguageFilter,
  perPage: number
): Promise<SingleRepoSearchOk | SingleRepoSearchErr> {
  let searchQuery = `${sanitizedQuery} repo:${repoFullName}`;
  if (language !== 'any') searchQuery += ` language:${language}`;

  const url = new URL(`${GITHUB_API}/search/code`);
  url.searchParams.set('q', searchQuery);
  url.searchParams.set('per_page', String(perPage));

  const response = await fetch(url.toString(), { headers: buildGithubHeaders() });

  if (!response.ok) {
    const details = await response.text().catch(() => '');
    return { ok: false, status: response.status, details: details.slice(0, 500) };
  }

  const data = (await response.json()) as GithubSearchResponse;
  const items = Array.isArray(data.items) ? data.items : [];

  return {
    ok: true,
    total_count: typeof data.total_count === 'number' ? data.total_count : items.length,
    items: items
      .filter((item): item is GithubSearchItem => !!item && !!item.repository?.full_name)
      .map((item) => ({
        name: item.name,
        path: item.path,
        repository: item.repository.full_name,
        html_url: item.html_url,
        text_matches: item.text_matches?.map((m) => ({ fragment: m.fragment })),
        score: typeof item.score === 'number' ? item.score : undefined,
      })),
  };
}

async function searchCode(params: SearchCodeParams) {
  const { query, repo = 'all', language = 'any', perPage = 10 } = params;
  const trimmedQuery = typeof query === 'string' ? query.trim() : '';

  if (!trimmedQuery) {
    return {
      total_count: 0,
      items: [],
      error: 'Search query is required',
    };
  }

  if (repo !== 'all' && !isRepoName(repo)) {
    return {
      total_count: 0,
      items: [],
      error: `Repository ${repo} is not in the allowed list`,
      allowedRepos: [...GITHUB_REPO_NAMES, 'all'],
    };
  }

  const sanitizedQuery = buildSearchQuery(trimmedQuery);
  if (!sanitizedQuery) {
    return {
      total_count: 0,
      items: [],
      error: 'Search query was empty after sanitization (qualifier tokens are stripped automatically)',
    };
  }

  const clampedPerPage = Math.min(Math.max(perPage, 1), 10);

  // Single-repo search: one round-trip.
  if (repo !== 'all') {
    const result = await searchSingleRepo(sanitizedQuery, getRepoFullName(repo), language, clampedPerPage);
    if (!result.ok) {
      console.error('GitHub search error:', result.status, result.details);
      return mapGithubError(result.status, result.details);
    }
    return { total_count: result.total_count, items: result.items };
  }

  // Multi-repo "all": fan out in parallel, then merge.
  // (Each `repo:` qualifier costs 14-38 chars; combining all 11 into one query exceeds GitHub's 256-char q limit.)
  const results = await Promise.all(
    ALLOWED_REPOS.map((fullName) => searchSingleRepo(sanitizedQuery, fullName, language, clampedPerPage))
  );

  const okResults = results.filter((r): r is SingleRepoSearchOk => r.ok);
  if (okResults.length === 0) {
    const firstErr = results.find((r): r is SingleRepoSearchErr => !r.ok);
    if (firstErr) {
      console.error('GitHub search error (all repos failed):', firstErr.status, firstErr.details);
      return mapGithubError(firstErr.status, firstErr.details);
    }
    return { total_count: 0, items: [] };
  }

  // Merge: total_count is the sum, items sorted by score desc and capped to perPage.
  const totalCount = okResults.reduce((sum, r) => sum + r.total_count, 0);
  const merged = okResults.flatMap((r) => r.items);
  merged.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  return {
    total_count: totalCount,
    items: merged.slice(0, clampedPerPage),
  };
}

function mapGithubError(status: number, details: string) {
  if (status === 408) {
    return {
      total_count: 0,
      items: [],
      error: 'Search timed out. Try a simpler query with fewer keywords.',
      suggestion: 'Use specific function or type names instead of long phrases.',
    };
  }
  if (status === 403) {
    return {
      total_count: 0,
      items: [],
      error: 'Rate limit exceeded. Please wait a moment before searching again.',
      suggestion: 'GitHub allows ~30 searches per minute for authenticated users.',
    };
  }
  if (status === 422) {
    return {
      total_count: 0,
      items: [],
      error: 'Query was rejected by GitHub (likely too long or malformed).',
      suggestion: 'Use a shorter query with specific symbol or function names.',
    };
  }
  return {
    total_count: 0,
    items: [],
    error: `GitHub API error: ${status}`,
  };
}

async function getFileContents(params: GetFileParams) {
  const { repo, path, ref = 'HEAD' } = params;
  const owner = 'ava-labs';
  const requestedPath = typeof path === 'string' ? path : '';
  const requestedRef = typeof ref === 'string' ? ref.trim() : 'HEAD';

  if (!isRepoName(repo)) {
    return {
      error: `Repository ${owner}/${String(repo)} is not in the allowed list`,
      allowedRepos: GITHUB_REPO_NAMES
    };
  }

  const pathError = validateRepoPath(requestedPath);
  if (pathError) {
    return {
      error: pathError,
      path: requestedPath,
    };
  }

  if (!REF_REGEX.test(requestedRef)) {
    return {
      error: 'Ref must be a valid git ref (alphanumerics, dot, underscore, slash, dash; max 200 chars)',
      ref: requestedRef,
    };
  }

  // Encode each path segment but preserve `/` as a separator (GitHub contents API expects path segments).
  const encodedPath = requestedPath
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');

  const url = new URL(`${GITHUB_API}/repos/${owner}/${repo}/contents/${encodedPath}`);
  url.searchParams.set('ref', requestedRef);

  const response = await fetch(url.toString(), { headers: buildGithubHeaders() });

  if (!response.ok) {
    if (response.status === 404) {
      return {
        error: `File not found: ${path}`,
        suggestion: 'Check the file path from the search results.'
      };
    }
    if (response.status === 403) {
      return {
        error: 'Rate limit exceeded or file access restricted.',
        suggestion: 'Wait a moment and try again, or try a different file.',
        path: requestedPath
      };
    }
    // Return error instead of throwing to avoid disrupting the AI stream
    const errorText = await response.text().catch(() => '');
    return {
      error: `GitHub API error: ${response.status}`,
      details: errorText.substring(0, 500),
      path: requestedPath
    };
  }

  const data = await response.json();

  // Decode base64 content
  if (data.content && data.encoding === 'base64') {
    const content = Buffer.from(data.content.replace(/\n/g, ''), 'base64').toString('utf-8');
    const truncated = content.length > MAX_FILE_CONTENT_CHARS;
    return {
      name: data.name,
      path: data.path,
      size: data.size,
      html_url: data.html_url,
      content: truncated
        ? `${content.slice(0, MAX_FILE_CONTENT_CHARS)}\n\n... [truncated at ${MAX_FILE_CONTENT_CHARS} characters]`
        : content,
      truncated,
    };
  }

  return data;
}

export const githubTools: ToolDomain = {
  tools: [
    {
      name: 'github_search_code',
      description:
        'Search for code across core Avalanche GitHub repositories including avalanchego, subnet-evm, coreth, libevm, avalanche-cli, platform-cli, icm-services, icm-contracts, avalanche-network-runner, hypersdk, and builders-hub.',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The search query string to find relevant code.',
          },
          repo: {
            type: 'string',
            enum: [...GITHUB_REPO_NAMES, 'all'],
            description: 'The repository to search in. Defaults to "all".',
          },
          language: {
            type: 'string',
            enum: GITHUB_LANGUAGE_FILTERS,
            description: 'Filter results by programming language. Defaults to "any".',
          },
          perPage: {
            type: 'number',
            minimum: 1,
            maximum: 10,
            description: 'Maximum number of GitHub results to return (default: 10).',
          },
        },
        required: ['query'],
      },
    },
    {
      name: 'github_get_file',
      description: 'Retrieve the contents of a specific file from an Avalanche GitHub repository.',
      inputSchema: {
        type: 'object',
        properties: {
          repo: {
            type: 'string',
            enum: GITHUB_REPO_NAMES,
            description: 'The repository to fetch the file from (owner is always ava-labs).',
          },
          path: {
            type: 'string',
            description: 'The path to the file within the repository.',
          },
          ref: {
            type: 'string',
            description: 'The git ref (branch, tag, or commit SHA) to fetch from. Defaults to "HEAD".',
          },
        },
        required: ['repo', 'path'],
      },
    },
    {
      name: 'github_list_repositories',
      description: 'List the Avalanche GitHub repositories covered by github_search_code and github_get_file.',
      inputSchema: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  ],
  handlers: {
    github_search_code: async (args): Promise<ToolResult> => {
      try {
        const result = await searchCode({
          query: args.query as string,
          repo: args.repo as SearchCodeParams['repo'],
          language: args.language as SearchCodeParams['language'],
          perPage: typeof args.perPage === 'number' ? args.perPage : undefined,
        });
        return {
          content: [{ type: 'text', text: JSON.stringify(result) }],
        };
      } catch (error) {
        console.error('github_search_code error:', error);
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }) }],
          isError: true,
        };
      }
    },
    github_get_file: async (args): Promise<ToolResult> => {
      try {
        const result = await getFileContents({
          repo: args.repo as GetFileParams['repo'],
          path: args.path as string,
          ref: args.ref as string | undefined,
        });
        return {
          content: [{ type: 'text', text: JSON.stringify(result) }],
        };
      } catch (error) {
        console.error('github_get_file error:', error);
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }) }],
          isError: true,
        };
      }
    },
    github_list_repositories: async (_args): Promise<ToolResult> => ({
      content: [{ type: 'text', text: JSON.stringify({ repositories: GITHUB_REPOSITORIES }) }],
    }),
  },
};
