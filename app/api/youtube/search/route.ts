import { NextRequest, NextResponse } from 'next/server';

// Avalanche YouTube channel ID
// Official Avalanche channel: https://www.youtube.com/@Aboratory
const AVALANCHE_CHANNEL_ID = 'UCScsLTtz5DCwJodZ8ht9KNA';

export const runtime = 'edge';

interface YouTubeSearchResult {
  videoId: string;
  title: string;
  description: string;
  thumbnail: string;
  publishedAt: string;
  channelTitle: string;
}

interface YouTubeAPIResponse {
  items?: Array<{
    id: {
      kind: string;
      videoId?: string;
    };
    snippet: {
      title: string;
      description: string;
      thumbnails: {
        medium?: { url: string };
        default?: { url: string };
      };
      publishedAt: string;
      channelTitle: string;
    };
  }>;
  error?: {
    message: string;
    code: number;
  };
}

// Cache for search results (in-memory, resets on cold start)
const searchCache = new Map<string, { results: YouTubeSearchResult[]; timestamp: number }>();
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q');
  const limit = Math.min(parseInt(searchParams.get('limit') || '5'), 10);

  if (!query) {
    return NextResponse.json({ error: 'Query parameter "q" is required' }, { status: 400 });
  }

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    console.error('YOUTUBE_API_KEY not configured');
    return NextResponse.json({ error: 'YouTube API not configured' }, { status: 500 });
  }

  // Check cache
  const cacheKey = `${query}-${limit}`;
  const cached = searchCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return NextResponse.json({ videos: cached.results, cached: true });
  }

  try {
    // Search YouTube for videos from the Avalanche channel
    const searchUrl = new URL('https://www.googleapis.com/youtube/v3/search');
    searchUrl.searchParams.set('key', apiKey);
    searchUrl.searchParams.set('channelId', AVALANCHE_CHANNEL_ID);
    searchUrl.searchParams.set('q', query);
    searchUrl.searchParams.set('part', 'snippet');
    searchUrl.searchParams.set('type', 'video');
    searchUrl.searchParams.set('maxResults', limit.toString());
    searchUrl.searchParams.set('order', 'relevance');

    const response = await fetch(searchUrl.toString());
    const data: YouTubeAPIResponse = await response.json();

    if (data.error) {
      console.error('YouTube API error:', data.error);
      return NextResponse.json({ error: data.error.message }, { status: data.error.code });
    }

    const videos: YouTubeSearchResult[] = (data.items || [])
      .filter(item => item.id.videoId)
      .map(item => ({
        videoId: item.id.videoId!,
        title: item.snippet.title,
        description: item.snippet.description,
        thumbnail: item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default?.url || '',
        publishedAt: item.snippet.publishedAt,
        channelTitle: item.snippet.channelTitle,
      }));

    // Cache results
    searchCache.set(cacheKey, { results: videos, timestamp: Date.now() });

    return NextResponse.json({ videos, cached: false });
  } catch (error) {
    console.error('YouTube search error:', error);
    return NextResponse.json({ error: 'Failed to search YouTube' }, { status: 500 });
  }
}

// Also support POST for more complex queries
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, limit = 5 } = body;

    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    // Redirect to GET handler
    const url = new URL(request.url);
    url.searchParams.set('q', query);
    url.searchParams.set('limit', limit.toString());

    return GET(new NextRequest(url));
  } catch (error) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
}
