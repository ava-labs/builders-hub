import type { ToolDomain, ToolResult } from '../types';

const GITHUB_API = 'https://api.github.com';
const ALLOWED_REPOS = ['ava-labs/avalanchego', 'ava-labs/icm-services', 'ava-labs/builders-hub'];

interface SearchCodeParams {
  query: string;
  repo?: 'avalanchego' | 'icm-services' | 'builders-hub' | 'all';
  language?: 'go' | 'solidity' | 'typescript' | 'any';
  perPage?: number;
}

interface GetFileParams {
  repo: 'avalanchego' | 'icm-services' | 'builders-hub';
  path: string;
  ref?: string;
}

async function searchCode(params: SearchCodeParams) {
  const { query, repo = 'all', language = 'any', perPage = 10 } = params;

  // Simplify query for better GitHub API compatibility
  // Remove very long queries that cause timeouts
  const simplifiedQuery = query.length > 100 ? query.slice(0, 100) : query;

  // Build GitHub search query
  let searchQuery = simplifiedQuery;

  if (repo === 'all') {
    // Search all repos
    searchQuery = `${simplifiedQuery} repo:ava-labs/avalanchego repo:ava-labs/icm-services repo:ava-labs/builders-hub`;
  } else {
    searchQuery = `${simplifiedQuery} repo:ava-labs/${repo}`;
  }

  if (language !== 'any') {
    searchQuery += ` language:${language}`;
  }

  const url = new URL(`${GITHUB_API}/search/code`);
  url.searchParams.set('q', searchQuery);
  url.searchParams.set('per_page', String(Math.min(perPage, 5))); // Limit to 5 results to avoid timeouts

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

  // Validate repo is in allowed list
  const fullRepo = `${owner}/${repo}`;
  if (!ALLOWED_REPOS.includes(fullRepo)) {
    return {
      error: `Repository ${fullRepo} is not in the allowed list`,
      allowedRepos: ALLOWED_REPOS
    };
  }

  const url = `${GITHUB_API}/repos/${owner}/${repo}/contents/${path}?ref=${ref}`;

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
        path: path
      };
    }
    // Return error instead of throwing to avoid disrupting the AI stream
    const errorText = await response.text().catch(() => '');
    return {
      error: `GitHub API error: ${response.status}`,
      details: errorText.substring(0, 500),
      path: path
    };
  }

  const data = await response.json();

  // Decode base64 content
  if (data.content && data.encoding === 'base64') {
    const content = atob(data.content.replace(/\n/g, ''));
    return {
      name: data.name,
      path: data.path,
      size: data.size,
      html_url: data.html_url,
      content: content,
      // Truncate very large files
      truncated: content.length > 50000,
    };
  }

  return data;
}

export const githubTools: ToolDomain = {
  tools: [
    {
      name: 'github_search_code',
      description: 'Search for code across Avalanche GitHub repositories (avalanchego, icm-services, builders-hub).',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The search query string to find relevant code.',
          },
          repo: {
            type: 'string',
            enum: ['avalanchego', 'icm-services', 'builders-hub', 'all'],
            description: 'The repository to search in. Defaults to "all".',
          },
          language: {
            type: 'string',
            enum: ['go', 'solidity', 'typescript', 'any'],
            description: 'Filter results by programming language. Defaults to "any".',
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
            enum: ['avalanchego', 'icm-services', 'builders-hub'],
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
  ],
  handlers: {
    github_search_code: async (args): Promise<ToolResult> => {
      try {
        const result = await searchCode({
          query: args.query as string,
          repo: args.repo as SearchCodeParams['repo'],
          language: args.language as SearchCodeParams['language'],
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
  },
};
