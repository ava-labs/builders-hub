import { NextResponse } from 'next/server';

// Use nodejs runtime for access to all env vars (edge has restrictions)
export const runtime = 'nodejs';

const GITHUB_API = 'https://api.github.com';
const ALLOWED_REPOS = ['ava-labs/avalanchego', 'ava-labs/icm-services', 'ava-labs/builders-hub'];

interface SearchCodeParams {
  query: string;
  repo?: 'avalanchego' | 'icm-services' | 'builders-hub' | 'all';
  language?: 'go' | 'solidity' | 'typescript' | 'any';
  perPage?: number;
}

interface GetFileParams {
  owner: string;
  repo: string;
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
  console.log('GitHub token present:', !!token, token ? `(${token.substring(0, 10)}...)` : '(missing)');
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
  const { owner, repo, path, ref = 'HEAD' } = params;

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

export async function POST(req: Request) {
  try {
    const { tool, params } = await req.json();

    switch (tool) {
      case 'search_code': {
        const results = await searchCode(params as SearchCodeParams);
        return NextResponse.json({ success: true, data: results });
      }

      case 'get_file_contents': {
        const contents = await getFileContents(params as GetFileParams);
        return NextResponse.json({ success: true, data: contents });
      }

      default:
        return NextResponse.json(
          { success: false, error: `Unknown tool: ${tool}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('GitHub MCP error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// Health check
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    tools: ['search_code', 'get_file_contents'],
    repos: ALLOWED_REPOS,
  });
}
