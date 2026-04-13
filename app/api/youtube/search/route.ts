import { withApi, successResponse, ValidationError, InternalError } from '@/lib/api';

// Official Avalanche channel: https://www.youtube.com/@Aboratory
const AVALANCHE_CHANNEL_ID = 'UCScsLTtz5DCwJodZ8ht9KNA';
const FETCH_TIMEOUT_MS = 10_000;

// NOTE: Cannot use edge runtime — withApi imports next-auth which requires Node.js runtime

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

const searchCache = new Map<string, { results: YouTubeSearchResult[]; timestamp: number }>();
const CACHE_DURATION = 60 * 60 * 1000;

export const GET = withApi(async (req) => {
  const query = req.nextUrl.searchParams.get('q');
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') || '5'), 10);

  if (!query) {
    throw new ValidationError('Query parameter "q" is required');
  }

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    throw new InternalError('YouTube API not configured');
  }

  const cacheKey = `${query}-${limit}`;
  const cached = searchCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return successResponse({ videos: cached.results, cached: true });
  }

  const searchUrl = new URL('https://www.googleapis.com/youtube/v3/search');
  searchUrl.searchParams.set('key', apiKey);
  searchUrl.searchParams.set('channelId', AVALANCHE_CHANNEL_ID);
  searchUrl.searchParams.set('q', query);
  searchUrl.searchParams.set('part', 'snippet');
  searchUrl.searchParams.set('type', 'video');
  searchUrl.searchParams.set('maxResults', limit.toString());
  searchUrl.searchParams.set('order', 'relevance');

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(searchUrl.toString(), { signal: controller.signal });
    const data: YouTubeAPIResponse = await response.json();

    if (data.error) {
      throw new InternalError(data.error.message);
    }

    const videos: YouTubeSearchResult[] = (data.items || [])
      .filter((item) => item.id.videoId)
      .map((item) => ({
        videoId: item.id.videoId!,
        title: item.snippet.title,
        description: item.snippet.description,
        thumbnail: item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default?.url || '',
        publishedAt: item.snippet.publishedAt,
        channelTitle: item.snippet.channelTitle,
      }));

    searchCache.set(cacheKey, { results: videos, timestamp: Date.now() });

    return successResponse({ videos, cached: false });
  } finally {
    clearTimeout(timeoutId);
  }
});
