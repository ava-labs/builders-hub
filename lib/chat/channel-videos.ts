/* Videos of the Avalanche channel that match a question, for the chat's context. Each new search costs quota at
   the video API, so only the chat route runs one (after its own limit per caller), the question is cut to a
   search's length, and an answer is kept for an hour. */

// Official Avalanche channel: https://www.youtube.com/@Aboratory
const AVALANCHE_CHANNEL_ID = 'UCScsLTtz5DCwJodZ8ht9KNA';
const KEPT_MS = 60 * 60 * 1000;
const MAX_KEPT = 500;
export const MAX_VIDEO_QUERY_CHARS = 200;

export interface ChannelVideo {
  videoId: string;
  title: string;
  description: string;
  thumbnail: string;
  publishedAt: string;
  channelTitle: string;
}

interface SearchAnswer {
  items?: Array<{
    id: { kind: string; videoId?: string };
    snippet: {
      title: string;
      description: string;
      thumbnails: { medium?: { url: string }; default?: { url: string } };
      publishedAt: string;
      channelTitle: string;
    };
  }>;
  error?: { message: string; code: number };
}

const kept = new Map<string, { videos: ChannelVideo[]; at: number }>();

/** The search text of a question: one line, cut to the length of a search. */
export function videoQuery(question: string): string {
  return question.replace(/\s+/g, ' ').trim().slice(0, MAX_VIDEO_QUERY_CHARS);
}

export async function searchChannelVideos(question: string, limit = 3): Promise<ChannelVideo[]> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  const query = videoQuery(question);
  if (!apiKey || !query) return [];
  const count = Math.min(Math.max(1, Math.floor(limit) || 1), 10);

  const key = `${count}:${query}`;
  const hit = kept.get(key);
  if (hit && Date.now() - hit.at < KEPT_MS) return hit.videos;

  const url = new URL('https://www.googleapis.com/youtube/v3/search');
  url.searchParams.set('key', apiKey);
  url.searchParams.set('channelId', AVALANCHE_CHANNEL_ID);
  url.searchParams.set('q', query);
  url.searchParams.set('part', 'snippet');
  url.searchParams.set('type', 'video');
  url.searchParams.set('maxResults', String(count));
  url.searchParams.set('order', 'relevance');

  const answer = (await (await fetch(url, { signal: AbortSignal.timeout(8_000) })).json()) as SearchAnswer;
  if (answer.error) throw new Error(`video search failed (${answer.error.code})`);

  const videos = (answer.items ?? [])
    .filter((item) => item.id.videoId)
    .map((item) => ({
      videoId: item.id.videoId!,
      title: item.snippet.title,
      description: item.snippet.description,
      thumbnail: item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default?.url || '',
      publishedAt: item.snippet.publishedAt,
      channelTitle: item.snippet.channelTitle,
    }));

  // the oldest answer goes first when the store is full (a Map keeps the order of its sets)
  kept.delete(key);
  if (kept.size >= MAX_KEPT) kept.delete(kept.keys().next().value as string);
  kept.set(key, { videos, at: Date.now() });
  return videos;
}
