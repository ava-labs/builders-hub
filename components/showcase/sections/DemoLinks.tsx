'use client';

import { useState } from 'react';
import { Separator } from '@/components/ui/separator';
import { ExternalLink, Play, FileText, Globe, Camera, Video, ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

type LinkType = 'youtube' | 'vimeo' | 'loom' | 'instagram' | 'video-file' | 'drive' | 'figma' | 'website';

type LinkInfo = {
  url: string;
  type: LinkType;
  label: string;
  icon: React.ReactNode;
  embedUrl?: string;
};

const EMBED_PATTERNS: Record<string, { regex: RegExp; getEmbed: (match: RegExpMatchArray) => string }> = {
  youtube: {
    regex: /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    getEmbed: (match) => `https://www.youtube.com/embed/${match[1]}`,
  },
  vimeo: {
    regex: /vimeo\.com\/(\d+)/,
    getEmbed: (match) => `https://player.vimeo.com/video/${match[1]}`,
  },
  loom: {
    regex: /loom\.com\/share\/([a-zA-Z0-9]+)/,
    getEmbed: (match) => `https://www.loom.com/embed/${match[1]}`,
  },
  instagram: {
    regex: /instagram\.com\/(p|reel|tv)\/([a-zA-Z0-9_-]+)/,
    getEmbed: (match) => `https://www.instagram.com/${match[1]}/${match[2]}/embed`,
  },
};

const LINK_MATCHERS: Array<{
  test: (url: string) => boolean;
  type: LinkType;
  label: string;
  icon: React.ReactNode;
  embedKey?: string;
}> = [
  { test: (url) => /youtube\.com|youtu\.be/.test(url), type: 'youtube', label: 'YouTube', icon: <Play className="w-5 h-5" />, embedKey: 'youtube' },
  { test: (url) => /vimeo\.com/.test(url), type: 'vimeo', label: 'Vimeo', icon: <Play className="w-5 h-5" />, embedKey: 'vimeo' },
  { test: (url) => /loom\.com/.test(url), type: 'loom', label: 'Loom', icon: <Play className="w-5 h-5" />, embedKey: 'loom' },
  { test: (url) => /instagram\.com|instagr\.am/.test(url), type: 'instagram', label: 'Instagram', icon: <Camera className="w-5 h-5" />, embedKey: 'instagram' },
  { test: (url) => /\.(mp4|mov|webm|avi|mkv)(\?|$)/i.test(url), type: 'video-file', label: 'Video', icon: <Video className="w-5 h-5" /> },
  { test: (url) => /drive\.google\.com|docs\.google\.com/.test(url), type: 'drive', label: 'Google Drive', icon: <FileText className="w-5 h-5" /> },
  { test: (url) => /figma\.com/.test(url), type: 'figma', label: 'Figma', icon: <FileText className="w-5 h-5" /> },
];

function parseLinks(demoLink: string): string[] {
  if (!demoLink) return [];
  return demoLink
    .split(/[,\s\n]+/)
    .map(link => link.trim())
    .filter(link => link.startsWith('http://') || link.startsWith('https://'));
}

function getDomainName(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return 'Link';
  }
}

function getEmbedUrl(url: string, embedKey?: string): string | undefined {
  if (!embedKey) return undefined;
  const pattern = EMBED_PATTERNS[embedKey];
  if (!pattern) return undefined;
  const match = url.match(pattern.regex);
  return match ? pattern.getEmbed(match) : undefined;
}

function identifyLinkType(url: string): LinkInfo {
  const lowerUrl = url.toLowerCase();
  const matcher = LINK_MATCHERS.find(m => m.test(lowerUrl));

  if (matcher) {
    return {
      url,
      type: matcher.type,
      label: matcher.label,
      icon: matcher.icon,
      embedUrl: getEmbedUrl(url, matcher.embedKey),
    };
  }

  return {
    url,
    type: 'website',
    label: getDomainName(url),
    icon: <Globe className="w-5 h-5" />,
  };
}

type Props = {
  demoLink: string;
};

export default function DemoLinks({ demoLink }: Props) {
  const links = parseLinks(demoLink);
  const [currentIndex, setCurrentIndex] = useState(0);

  if (links.length === 0) return null;

  const linkInfos = links.map(identifyLinkType);
  const currentLink = linkInfos[currentIndex];
  const hasMultiple = linkInfos.length > 1;

  return (
    <div>
      <h2 className="text-2xl">Demo & Resources</h2>
      <Separator className="my-4 bg-zinc-300 dark:bg-zinc-800" />

      <div className="space-y-4">
        <div className="relative">
          <MediaPreview linkInfo={currentLink} />

          {hasMultiple && (
            <>
              <Button
                variant="outline"
                size="icon"
                className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/80 dark:bg-zinc-900/80 hover:bg-white dark:hover:bg-zinc-900 z-10"
                onClick={() => setCurrentIndex(prev => prev === 0 ? linkInfos.length - 1 : prev - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/80 dark:bg-zinc-900/80 hover:bg-white dark:hover:bg-zinc-900 z-10"
                onClick={() => setCurrentIndex(prev => prev === linkInfos.length - 1 ? 0 : prev + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>

        <div className="flex items-center justify-between">
          <Link
            href={currentLink.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
          >
            {currentLink.icon}
            <span className="truncate max-w-[300px]">{currentLink.label}</span>
            <ExternalLink className="w-4 h-4 flex-shrink-0" />
          </Link>

          {hasMultiple && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-zinc-500">
                {currentIndex + 1} / {linkInfos.length}
              </span>
              <div className="flex gap-1">
                {linkInfos.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentIndex(index)}
                    className={`w-2 h-2 rounded-full transition-colors ${
                      index === currentIndex
                        ? 'bg-red-500'
                        : 'bg-zinc-300 dark:bg-zinc-600 hover:bg-zinc-400 dark:hover:bg-zinc-500'
                    }`}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MediaPreview({ linkInfo }: { linkInfo: LinkInfo }) {
  const videoContainerClass = "relative w-full aspect-video rounded-lg overflow-hidden bg-zinc-100 dark:bg-zinc-900";

  // Embeddable video (YouTube, Vimeo, Loom)
  if (['youtube', 'vimeo', 'loom'].includes(linkInfo.type) && linkInfo.embedUrl) {
    return (
      <div className={videoContainerClass}>
        <iframe
          src={linkInfo.embedUrl}
          className="w-full h-full"
          title={linkInfo.label}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }

  // Instagram embed
  if (linkInfo.type === 'instagram' && linkInfo.embedUrl) {
    return (
      <div className="relative w-full max-w-[540px] mx-auto rounded-lg overflow-hidden bg-zinc-100 dark:bg-zinc-900">
        <iframe
          src={linkInfo.embedUrl}
          className="w-full min-h-[600px]"
          title={linkInfo.label}
          allowFullScreen
        />
      </div>
    );
  }

  // Video file
  if (linkInfo.type === 'video-file') {
    return (
      <div className={videoContainerClass}>
        <video src={linkInfo.url} className="w-full h-full object-contain" controls preload="metadata">
          Your browser does not support the video tag.
        </video>
      </div>
    );
  }

  // Non-embeddable links - card view
  return (
    <Link href={linkInfo.url} target="_blank" rel="noopener noreferrer" className="block">
      <div className="flex items-center gap-4 p-6 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
        <div className="flex items-center justify-center w-16 h-16 rounded-full bg-red-500 text-white">
          {linkInfo.icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-lg text-zinc-900 dark:text-zinc-100">{linkInfo.label}</p>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 truncate">{linkInfo.url}</p>
        </div>
        <ExternalLink className="w-6 h-6 text-zinc-400 flex-shrink-0" />
      </div>
    </Link>
  );
}
