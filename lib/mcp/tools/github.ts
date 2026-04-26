import type { ToolDomain, ToolResult } from '../types';

const GITHUB_API = 'https://api.github.com';
const MAX_FILE_CONTENT_CHARS = 50_000;

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
  if (path.startsWith('/')) return 'File path must be relative to the repository root';
  if (path.includes('..')) return 'File path must not include path traversal';
  if (path.includes('://')) return 'File path must not include a protocol';
  return null;
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

  // Simplify query for better GitHub API compatibility
  // Remove very long queries that cause timeouts
  const simplifiedQuery = trimmedQuery.length > 100 ? trimmedQuery.slice(0, 100) : trimmedQuery;

  // Build GitHub search query
  let searchQuery = simplifiedQuery;

  if (repo === 'all') {
    searchQuery = `${simplifiedQuery} ${ALLOWED_REPOS.map((fullName) => `repo:${fullName}`).join(' ')}`;
  } else {
    searchQuery = `${simplifiedQuery} repo:${getRepoFullName(repo)}`;
  }

  if (language !== 'any') {
    searchQuery += ` language:${language}`;
  }

  const url = new URL(`${GITHUB_API}/search/code`);
  url.searchParams.set('q', searchQuery);
  url.searchParams.set('per_page', String(Math.min(Math.max(perPage, 1), 10)));

  const headers: HeadersInit = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'Avalanche-Builders-Hub',
  };

  // Add auth token if available for higher rate limits
  const token = process.env.GITHUB_TOKEN;
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url.toString(), { headers });

  if (!response.ok) {
    const error = await response.text();
    console.error('GitHub search error:', response.status, error);

    // Return helpful error info instead of throwing
    if (response.status === 408) {
      return {
        total_count: 0,
        items: [],
        error: 'Search timed out. Try a simpler query with fewer keywords.',
        suggestion: 'Use specific function or type names instead of long phrases.'
      };
    }
    if (response.status === 403) {
      return {
        total_count: 0,
        items: [],
        error: 'Rate limit exceeded. Please wait a moment before searching again.',
        suggestion: 'GitHub allows ~30 searches per minute for authenticated users.'
      };
    }
    // Return error instead of throwing to avoid disrupting the AI stream
    return {
      total_count: 0,
      items: [],
      error: `GitHub API error: ${response.status}`,
      details: error.substring(0, 500)
    };
  }

  const data = await response.json();

  // Format results for the chat
  return {
    total_count: data.total_count,
    items: data.items.map((item: any) => ({
      name: item.name,
      path: item.path,
      repository: item.repository.full_name,
      html_url: item.html_url,
      // Include a snippet of the match context if available
      text_matches: item.text_matches?.map((match: any) => ({
        fragment: match.fragment,
      })),
    })),
  };
}

async function getFileContents(params: GetFileParams) {
  const { repo, path, ref = 'HEAD' } = params;
  const owner = 'ava-labs';
  const requestedPath = typeof path === 'string' ? path : '';

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

  const url = `${GITHUB_API}/repos/${owner}/${repo}/contents/${requestedPath}?ref=${ref}`;

  const headers: HeadersInit = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'Avalanche-Builders-Hub',
  };

  if (process.env.GITHUB_TOKEN) {
    headers['Authorization'] = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  const response = await fetch(url, { headers });

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
