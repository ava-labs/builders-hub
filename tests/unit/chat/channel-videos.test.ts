import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/* The chat looks up videos of the Avalanche channel for a question. A search costs quota, so the question is cut
   to a search's length and an answer is kept. */

const fetchMock = vi.fn();
const item = (videoId: string) => ({
  id: { kind: 'youtube#video', videoId },
  snippet: { title: 'T', description: 'D', thumbnails: { default: { url: 'u' } }, publishedAt: 'p', channelTitle: 'c' },
});

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv('YOUTUBE_API_KEY', 'test-key');
  fetchMock.mockReset().mockImplementation(async () => Response.json({ items: [item('v1'), { id: { kind: 'x' }, snippet: item('x').snippet }] }));
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('searchChannelVideos', () => {
  it('searches the channel with a query of at most 200 characters, on one line', async () => {
    const { searchChannelVideos } = await import('@/lib/chat/channel-videos');
    const videos = await searchChannelVideos(`How do I\n create an L1? ${'x'.repeat(12_000)}`, 3);
    expect(videos.map((v) => v.videoId)).toEqual(['v1']);
    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.origin + url.pathname).toBe('https://www.googleapis.com/youtube/v3/search');
    expect(url.searchParams.get('q')).toHaveLength(200);
    expect(url.searchParams.get('q')?.startsWith('How do I create an L1? x')).toBe(true);
    expect(url.searchParams.get('maxResults')).toBe('3');
  });

  it('keeps an answer, and asks the API once for the same question', async () => {
    const { searchChannelVideos } = await import('@/lib/chat/channel-videos');
    await searchChannelVideos('What is an L1?');
    await searchChannelVideos('  What is   an L1? ');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('asks nothing with no key or an empty question, and caps the count', async () => {
    const { searchChannelVideos } = await import('@/lib/chat/channel-videos');
    expect(await searchChannelVideos('   ')).toEqual([]);
    vi.stubEnv('YOUTUBE_API_KEY', '');
    expect(await searchChannelVideos('What is an L1?')).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
    vi.stubEnv('YOUTUBE_API_KEY', 'test-key');
    await searchChannelVideos('What is an L1?', 500);
    expect(new URL(String(fetchMock.mock.calls[0][0])).searchParams.get('maxResults')).toBe('10');
  });
});
