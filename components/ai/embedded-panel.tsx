'use client';

import { useState, useEffect } from 'react';
import { X, ExternalLink, Loader2, ChevronLeft, ChevronRight, Play } from 'lucide-react';
import { cn } from '@/lib/cn';
import posthog from 'posthog-js';

export type EmbedType = 'docs' | 'academy' | 'console' | 'integration' | 'youtube' | 'blog';

export interface EmbeddedReference {
  type: EmbedType;
  url: string;
  title?: string;
  videoId?: string; // For YouTube videos
  thumbnail?: string; // For YouTube thumbnails
}

interface EmbeddedPanelProps {
  reference: EmbeddedReference | null;
  onClose: () => void;
  className?: string;
}

// Extract YouTube video ID from various URL formats
export function extractYouTubeVideoId(url: string): string | null {
  if (!url) return null;

  // Handle various YouTube URL formats:
  // - https://www.youtube.com/watch?v=VIDEO_ID
  // - https://youtu.be/VIDEO_ID
  // - https://www.youtube.com/embed/VIDEO_ID
  // - https://www.youtube.com/v/VIDEO_ID

  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([^&\s?]+)/,
    /^([a-zA-Z0-9_-]{11})$/ // Just the video ID
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  return null;
}

// Detect the type of internal link
export function detectLinkType(url: string): EmbedType | null {
  if (!url) return null;

  // Check for YouTube URLs first
  if (url.includes('youtube.com') || url.includes('youtu.be')) {
    return 'youtube';
  }

  // Relative URLs or full URLs to our domain
  const path = url.startsWith('http')
    ? new URL(url).pathname
    : url;

  // Detect all content types
  if (path.startsWith('/console')) return 'console';
  if (path.startsWith('/blog')) return 'blog';
  if (path.startsWith('/docs')) return 'docs';
  if (path.startsWith('/academy')) return 'academy';
  if (path.startsWith('/integrations')) return 'integration';

  return null;
}

// Priority order for embed types (lower = higher priority, shown first)
const EMBED_TYPE_PRIORITY: Record<EmbedType, number> = {
  youtube: 0,    // Videos first - visual learning
  console: 1,    // Console tools - interactive, hands-on
  integration: 2,
  blog: 3,       // Blog posts - announcements, tutorials
  docs: 4,
  academy: 5,
};

// Extract all embeddable links from markdown content
// Returns links sorted by priority: youtube > console > integration > blog > docs > academy
export function extractEmbeddableLinks(content: string): EmbeddedReference[] {
  const links: EmbeddedReference[] = [];

  // Match markdown links: [text](url)
  const markdownLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  let match;

  while ((match = markdownLinkRegex.exec(content)) !== null) {
    const [, title, url] = match;
    const type = detectLinkType(url);
    if (type) {
      const ref: EmbeddedReference = { type, url, title };
      // For YouTube links, extract the video ID
      if (type === 'youtube') {
        const videoId = extractYouTubeVideoId(url);
        if (videoId) {
          ref.videoId = videoId;
        }
      }
      links.push(ref);
    }
  }

  // Match YouTube URLs in content (both full URLs and youtu.be)
  const youtubeRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/g;
  while ((match = youtubeRegex.exec(content)) !== null) {
    const videoId = match[1];
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    if (!links.some(l => l.videoId === videoId || l.url === url)) {
      links.push({ type: 'youtube', url, videoId });
    }
  }

  // Also match raw URLs that start with /docs, /academy, /console, /integrations, /blog
  const rawUrlRegex = /(?:^|\s)(\/(?:docs|academy|console|integrations|blog)[^\s\)]*)/g;
  while ((match = rawUrlRegex.exec(content)) !== null) {
    const url = match[1];
    const type = detectLinkType(url);
    if (type && !links.some(l => l.url === url)) {
      links.push({ type, url });
    }
  }

  // Sort by priority: youtube > console > integration > blog > docs > academy
  return links.sort((a, b) => EMBED_TYPE_PRIORITY[a.type] - EMBED_TYPE_PRIORITY[b.type]);
}

// Get display info for embed type
export function getEmbedTypeInfo(type: EmbedType): { label: string; color: string } {
  switch (type) {
    case 'docs':
      return { label: 'Documentation', color: 'bg-blue-500' };
    case 'academy':
      return { label: 'Academy', color: 'bg-purple-500' };
    case 'console':
      return { label: 'Console Tool', color: 'bg-green-500' };
    case 'integration':
      return { label: 'Integration', color: 'bg-orange-500' };
    case 'youtube':
      return { label: 'Video', color: 'bg-red-500' };
    case 'blog':
      return { label: 'Blog', color: 'bg-pink-500' };
  }
}

export function EmbeddedPanel({ reference, onClose, className }: EmbeddedPanelProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (reference) {
      setIsLoading(true);
      setError(null);
    }
  }, [reference?.url]);

  if (!reference) return null;

  const typeInfo = getEmbedTypeInfo(reference.type);
  const isYouTube = reference.type === 'youtube';

  // For YouTube, get the video ID and build embed URL
  const videoId = reference.videoId || extractYouTubeVideoId(reference.url);
  const youtubeEmbedUrl = videoId ? `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1` : null;

  // Build URL with embed query parameter to trigger embed-specific styling
  const baseUrl = reference.url.startsWith('http')
    ? reference.url
    : `${typeof window !== 'undefined' ? window.location.origin : ''}${reference.url}`;

  let embedUrl: string;
  if (isYouTube && youtubeEmbedUrl) {
    embedUrl = youtubeEmbedUrl;
  } else {
    const fullUrl = new URL(baseUrl, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
    fullUrl.searchParams.set('embed', 'true');
    embedUrl = fullUrl.toString();
  }

  return (
    <div className={cn("flex flex-col h-full bg-background", className)}>
      {/* Panel header */}
      <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-3 min-w-0">
          <span className={cn("shrink-0 px-2 py-0.5 text-xs font-medium text-white rounded flex items-center gap-1", typeInfo.color)}>
            {isYouTube && <Play className="w-3 h-3" />}
            {typeInfo.label}
          </span>
          <span className="text-sm font-medium truncate">
            {reference.title || (isYouTube ? 'Avalanche Video' : reference.url)}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <a
            href={isYouTube ? `https://www.youtube.com/watch?v=${videoId}` : baseUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            title="Open in new tab"
            onClick={() => posthog.capture('ai_chat_source_clicked', {
              source_type: reference.type,
              url: isYouTube ? `https://www.youtube.com/watch?v=${videoId}` : baseUrl,
              title: reference.title,
            })}
          >
            <ExternalLink className="w-4 h-4" />
          </a>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            title="Close panel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 relative min-h-0">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background z-10">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {isYouTube ? 'Loading video...' : 'Loading content...'}
              </span>
            </div>
          </div>
        )}

        {error ? (
          <div className="absolute inset-0 flex items-center justify-center bg-background">
            <div className="text-center p-6">
              <p className="text-sm text-muted-foreground mb-4">{error}</p>
              <a
                href={isYouTube ? `https://www.youtube.com/watch?v=${videoId}` : baseUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                onClick={() => posthog.capture('ai_chat_source_clicked', {
                  source_type: reference.type,
                  url: isYouTube ? `https://www.youtube.com/watch?v=${videoId}` : baseUrl,
                  title: reference.title,
                  context: 'error_fallback',
                })}
              >
                <ExternalLink className="w-4 h-4" />
                {isYouTube ? 'Watch on YouTube' : 'Open in new tab'}
              </a>
            </div>
          </div>
        ) : isYouTube ? (
          // YouTube embed with proper 16:9 aspect ratio
          <div className="w-full h-full flex items-center justify-center bg-black p-4">
            <div className="w-full max-h-full aspect-video">
              <iframe
                src={embedUrl}
                className="w-full h-full border-0 rounded-lg"
                onLoad={() => setIsLoading(false)}
                onError={() => {
                  setIsLoading(false);
                  setError('Failed to load video');
                }}
                title={reference.title || 'Avalanche Video'}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </div>
        ) : (
          <iframe
            src={embedUrl}
            className="w-full h-full border-0"
            onLoad={() => setIsLoading(false)}
            onError={() => {
              setIsLoading(false);
              setError('Failed to load content');
            }}
            title={reference.title || 'Embedded content'}
            sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
          />
        )}
      </div>
    </div>
  );
}

// Link navigation component for multiple detected links
export function EmbeddedLinkNav({
  links,
  currentIndex,
  onSelect,
  className,
}: {
  links: EmbeddedReference[];
  currentIndex: number;
  onSelect: (index: number) => void;
  className?: string;
}) {
  if (links.length <= 1) return null;

  return (
    <div className={cn("flex items-center gap-2 px-4 py-2 border-b border-border bg-zinc-50 dark:bg-zinc-900", className)}>
      <button
        onClick={() => onSelect(Math.max(0, currentIndex - 1))}
        disabled={currentIndex === 0}
        className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      <div className="flex-1 flex items-center gap-1 overflow-x-auto">
        {links.map((link, index) => {
          const typeInfo = getEmbedTypeInfo(link.type);
          return (
            <button
              key={index}
              onClick={() => onSelect(index)}
              className={cn(
                "shrink-0 px-2 py-1 text-xs rounded-full transition-colors",
                index === currentIndex
                  ? `${typeInfo.color} text-white`
                  : "bg-zinc-200 dark:bg-zinc-700 text-muted-foreground hover:bg-zinc-300 dark:hover:bg-zinc-600"
              )}
            >
              {link.title?.slice(0, 20) || link.type}
            </button>
          );
        })}
      </div>

      <button
        onClick={() => onSelect(Math.min(links.length - 1, currentIndex + 1))}
        disabled={currentIndex === links.length - 1}
        className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <ChevronRight className="w-4 h-4" />
      </button>

      <span className="text-xs text-muted-foreground shrink-0">
        {currentIndex + 1} / {links.length}
      </span>
    </div>
  );
}
