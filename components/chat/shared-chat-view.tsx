'use client';

import { type ReactNode, useEffect, useState, useRef, useCallback, type ComponentProps, Children, type ReactElement } from 'react';
import defaultMdxComponents from 'fumadocs-ui/mdx';
import { cn } from '@/lib/cn';
import { createProcessor, type Processor } from '@/components/ai/markdown-processor';
import Link from 'fumadocs-core/link';
import { DynamicCodeBlock } from 'fumadocs-ui/components/dynamic-codeblock';
import dynamic from 'next/dynamic';
import 'katex/dist/katex.min.css';
import {
  Eye,
  Calendar,
  User,
  MessageSquare,
  Sparkles,
  Play,
  BookOpen,
  Terminal,
  Puzzle,
  FileText,
  Newspaper,
  ExternalLink,
} from 'lucide-react';
import Image from 'next/image';
import {
  EmbeddedPanel,
  extractEmbeddableLinks,
  getEmbedTypeInfo,
  type EmbeddedReference,
  type EmbedType
} from '@/components/ai/embedded-panel';

// Hook to detect if we're on large screens (matches Tailwind's lg breakpoint)
const LG_BREAKPOINT = 1024;
function useIsLargeScreen() {
  const [isLarge, setIsLarge] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia(`(min-width: ${LG_BREAKPOINT}px)`);
    const onChange = () => setIsLarge(mql.matches);
    mql.addEventListener('change', onChange);
    setIsLarge(mql.matches);
    return () => mql.removeEventListener('change', onChange);
  }, []);
  return isLarge;
}

// Get icon for embed type
function getEmbedTypeIcon(type: EmbedType) {
  switch (type) {
    case 'youtube': return Play;
    case 'console': return Terminal;
    case 'docs': return FileText;
    case 'academy': return BookOpen;
    case 'integration': return Puzzle;
    case 'blog': return Newspaper;
    default: return ExternalLink;
  }
}

// X (Twitter) icon
function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

// Telegram icon
function TelegramIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
    </svg>
  );
}

const Mermaid = dynamic(() => import('@/components/content-design/mermaid'), {
  ssr: false,
});

interface SharedMessage {
  id: string;
  role: string;
  content: string;
  created_at: string;
}

interface Creator {
  name: string | null;
  image: string | null;
}

interface SharedConversation {
  id: string;
  title: string;
  messages: SharedMessage[];
  sharedAt: string;
  expiresAt: string | null;
  viewCount: number;
  creator: Creator | null;
}

interface SharedChatViewProps {
  conversation: SharedConversation;
}

// Markdown rendering
let processor: Processor | undefined;
const markdownCache = new Map<string, ReactNode>();

// Remove AI "thinking" patterns
function removeThinkingPatterns(content: string): string {
  if (!content) return '';

  const thinkingPatterns = [
    /^I'll search for[^.]*\.\s*/i,
    /^Let me search[^.]*\.\s*/i,
    /^I'll look for[^.]*\.\s*/i,
    /^Let me look[^.]*\.\s*/i,
    /^I'll find[^.]*\.\s*/i,
    /^Let me find[^.]*\.\s*/i,
    /^Searching for[^.]*\.\s*/i,
    /^Looking for[^.]*\.\s*/i,
    /^I'll gather[^.]*\.\s*/i,
    /^Let me gather[^.]*\.\s*/i,
    /^I'll check[^.]*\.\s*/i,
    /^Let me check[^.]*\.\s*/i,
    /^Based on my search[^,]*,\s*/i,
    /^After searching[^,]*,\s*/i,
    /^From my search[^,]*,\s*/i,
    /^I'll search for information about[^.]*\.\s*/i,
    /^Let me search more broadly[^.]*[.:]\s*/i,
    /^Based on my search of the[^,]*,\s*/i,
  ];

  let cleaned = content;
  for (const pattern of thinkingPatterns) {
    cleaned = cleaned.replace(pattern, '');
  }

  return cleaned;
}

function Pre(props: ComponentProps<'pre'>) {
  const code = Children.only(props.children) as ReactElement;
  const codeProps = code.props as ComponentProps<'code'>;
  let lang = codeProps.className
    ?.split(' ')
    .find((v) => v.startsWith('language-'))
    ?.slice('language-'.length) ?? 'text';
  if (lang === 'mdx') lang = 'md';
  if (lang === 'mermaid') {
    return <Mermaid chart={(codeProps.children ?? '') as string} />;
  }
  return <DynamicCodeBlock lang={lang} code={(codeProps.children ?? '') as string} />;
}

function Markdown({ text }: { text: string }) {
  const [rendered, setRendered] = useState<ReactNode>(null);
  useEffect(() => {
    let aborted = false;
    async function run() {
      let result = markdownCache.get(text);
      if (!result && text) {
        processor ??= createProcessor();
        result = await processor
          .process(text, { ...defaultMdxComponents, pre: Pre, a: Link, img: undefined })
          .catch(() => text);
        markdownCache.set(text, result);
      }
      if (!aborted && result) setRendered(result);
    }
    void run();
    return () => { aborted = true; };
  }, [text]);
  return <>{rendered || text}</>;
}

// AI Avatar
function AIAvatar() {
  return (
    <div className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
      <img
        src="/small-logo.png"
        alt="AI"
        className="h-5 object-contain"
      />
    </div>
  );
}

// Chat message (read-only)
function ChatMessage({
  message,
  onRefSelect,
}: {
  message: SharedMessage;
  onRefSelect?: (ref: EmbeddedReference) => void;
}) {
  const isUser = message.role === 'user';
  const cleanContent = isUser ? message.content : removeThinkingPatterns(message.content);
  const embeddableLinks = isUser ? [] : extractEmbeddableLinks(message.content);

  if (isUser) {
    return (
      <div className="flex justify-end mb-6">
        <div className="max-w-[85%] lg:max-w-[70%]">
          <div className="bg-zinc-200 dark:bg-zinc-700 rounded-3xl px-5 py-3 overflow-hidden">
            <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{cleanContent}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-6">
      <div className="flex items-start gap-4">
        <div className="shrink-0 mt-1">
          <AIAvatar />
        </div>
        <div className="flex-1 min-w-0">
          <div className="prose prose-sm prose-zinc dark:prose-invert max-w-none prose-p:leading-relaxed prose-pre:bg-zinc-900 prose-pre:border prose-pre:border-zinc-800 [&_.katex-display]:overflow-x-auto [&_.katex]:text-sm">
            <Markdown text={cleanContent} />
          </div>

          {/* Show clickable sources - color-coded by type with clear "view" action */}
          {embeddableLinks.length > 0 && onRefSelect && (
            <div className="mt-4 p-3 rounded-lg bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800">
              <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                <ExternalLink className="w-3 h-3" />
                Sources ({embeddableLinks.length}) — click to preview
              </p>
              <div className="flex flex-wrap gap-2">
                {embeddableLinks.map((link, idx) => {
                  const typeInfo = getEmbedTypeInfo(link.type);
                  const Icon = getEmbedTypeIcon(link.type);
                  return (
                    <button
                      type="button"
                      key={idx}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onRefSelect(link);
                      }}
                      className={cn(
                        "group inline-flex items-center gap-2 pl-2 pr-3 py-1.5 text-xs font-medium",
                        "rounded-full transition-all duration-200",
                        "hover:scale-[1.02] active:scale-[0.98]",
                        "border shadow-sm",
                        // Type-specific colors
                        link.type === 'youtube' && "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/40",
                        link.type === 'console' && "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-900/40",
                        link.type === 'integration' && "bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-900/40",
                        link.type === 'blog' && "bg-pink-50 dark:bg-pink-950/30 border-pink-200 dark:border-pink-800 text-pink-700 dark:text-pink-300 hover:bg-pink-100 dark:hover:bg-pink-900/40",
                        link.type === 'docs' && "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40",
                        link.type === 'academy' && "bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/40",
                      )}
                      title={`View ${typeInfo.label}: ${link.title || link.url}`}
                    >
                      <span className={cn(
                        "flex items-center justify-center w-5 h-5 rounded-full",
                        link.type === 'youtube' && "bg-red-500",
                        link.type === 'console' && "bg-green-500",
                        link.type === 'integration' && "bg-orange-500",
                        link.type === 'blog' && "bg-pink-500",
                        link.type === 'docs' && "bg-blue-500",
                        link.type === 'academy' && "bg-purple-500",
                      )}>
                        <Icon className="w-3 h-3 text-white" />
                      </span>
                      <span className="truncate max-w-[200px]">
                        {link.title || typeInfo.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function SharedChatView({ conversation }: SharedChatViewProps) {
  const { title, messages, sharedAt, viewCount, creator } = conversation;

  // Embedded panel state
  const [embeddedRef, setEmbeddedRef] = useState<EmbeddedReference | null>(null);
  const [panelWidth, setPanelWidth] = useState(35); // Percentage width of embedded panel
  const [isResizing, setIsResizing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const isLargeScreen = useIsLargeScreen();

  // Handle reference selection from inline source buttons
  const handleRefSelect = (ref: EmbeddedReference) => {
    setEmbeddedRef(ref);
  };

  // Handle closing the panel
  const handleClosePanel = () => {
    setEmbeddedRef(null);
  };

  // Handle panel resize with refs to avoid stale closures
  const isResizingRef = useRef(false);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    isResizingRef.current = true;
    setIsResizing(true);

    // Prevent text selection and set cursor globally
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingRef.current || !containerRef.current) return;

      e.preventDefault();
      const containerRect = containerRef.current.getBoundingClientRect();
      const newWidth = ((containerRect.right - e.clientX) / containerRect.width) * 100;
      // Clamp between 25% and 75%
      setPanelWidth(Math.min(75, Math.max(25, newWidth)));
    };

    const handleMouseUp = () => {
      if (!isResizingRef.current) return;

      isResizingRef.current = false;
      setIsResizing(false);

      // Restore cursor and selection
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    // Always listen - the ref check inside handles when to act
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  // Format date
  const formattedDate = new Date(sharedAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  // Get current URL for sharing (client-side only)
  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';
  const shareText = `Check out this conversation with Avalanche AI: "${title}"`;

  // Social share URLs
  const xShareUrl = `https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`;
  const telegramShareUrl = `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-zinc-200 dark:border-zinc-800 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <img src="/small-logo.png" alt="Avalanche" className="h-6 w-6" />
              <span className="font-semibold text-sm">Avalanche AI</span>
            </Link>

            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              {/* Stats */}
              <div className="hidden sm:flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <Eye className="w-4 h-4" />
                  <span>{viewCount}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4" />
                  <span>{formattedDate}</span>
                </div>
              </div>

              {/* Social share buttons */}
              <div className="flex items-center gap-1">
                <a
                  href={xShareUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    "p-2 rounded-lg transition-colors",
                    "hover:bg-zinc-100 dark:hover:bg-zinc-800",
                    "text-muted-foreground hover:text-foreground"
                  )}
                  title="Share on X"
                >
                  <XIcon className="w-4 h-4" />
                </a>
                <a
                  href={telegramShareUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    "p-2 rounded-lg transition-colors",
                    "hover:bg-zinc-100 dark:hover:bg-zinc-800",
                    "text-muted-foreground hover:text-[#0088cc]"
                  )}
                  title="Share on Telegram"
                >
                  <TelegramIcon className="w-4 h-4" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main content area (chat + embedded panel) */}
      <div ref={containerRef} className="flex-1 flex min-h-0 relative">
        {/* Overlay during resize to capture all mouse events (prevents iframe from stealing them) */}
        {isResizing && (
          <div className="fixed inset-0 z-50 cursor-col-resize" />
        )}

        {/* Chat content area */}
        <div
          className="flex-1 overflow-y-auto"
          style={{ width: embeddedRef && isLargeScreen ? `${100 - panelWidth}%` : '100%' }}
        >
          <div className="max-w-4xl mx-auto px-4 py-8">
            {/* Title and attribution */}
            <div className="mb-8 pb-6 border-b border-zinc-200 dark:border-zinc-800">
              <h1 className="text-2xl font-semibold mb-3">{title}</h1>

              {creator && creator.name && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  {creator.image ? (
                    <Image
                      src={creator.image}
                      alt={creator.name}
                      width={20}
                      height={20}
                      className="rounded-full"
                    />
                  ) : (
                    <User className="w-4 h-4" />
                  )}
                  <span>Shared by {creator.name}</span>
                </div>
              )}
            </div>

            {/* Messages */}
            <div className="space-y-0">
              {messages.map((message) => (
                <ChatMessage
                  key={message.id}
                  message={message}
                  onRefSelect={isLargeScreen ? handleRefSelect : undefined}
                />
              ))}
            </div>

            {/* Read-only notice */}
            <div className="mt-8 p-4 rounded-xl bg-zinc-100 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700">
              <div className="flex items-start gap-3">
                <MessageSquare className="w-5 h-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium">This is a read-only shared conversation</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Want to start your own conversation with Avalanche AI?
                  </p>
                  <Link
                    href="/chat"
                    className={cn(
                      "inline-flex items-center gap-1.5 mt-3 px-4 py-2 text-sm font-medium rounded-lg",
                      "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900",
                      "hover:bg-zinc-700 dark:hover:bg-zinc-200 transition-colors"
                    )}
                  >
                    <Sparkles className="w-4 h-4" />
                    Start your own chat
                  </Link>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-zinc-200 dark:border-zinc-800 mt-12 pt-6">
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>Powered by Avalanche AI</span>
                <Link href="/" className="hover:text-foreground transition-colors">
                  build.avax.network
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Embedded Panel (right side) - Desktop only */}
        {embeddedRef && isLargeScreen && (
          <>
            {/* Resize handle - wider hit area for easier grabbing */}
            <div
              onMouseDown={handleResizeStart}
              className={cn(
                "hidden lg:flex w-2 cursor-col-resize items-center justify-center",
                "hover:bg-zinc-200 dark:hover:bg-zinc-800",
                "group relative select-none",
                isResizing && "bg-zinc-300 dark:bg-zinc-700"
              )}
            >
              {/* Visual indicator */}
              <div className={cn(
                "w-1 h-12 rounded-full",
                "bg-zinc-300 dark:bg-zinc-700",
                "group-hover:bg-zinc-400 dark:group-hover:bg-zinc-500",
                isResizing && "bg-zinc-500 dark:bg-zinc-400"
              )} />
            </div>

            {/* Panel */}
            <div
              className="hidden lg:flex flex-col border-l border-zinc-200 dark:border-zinc-800"
              style={{ width: `${panelWidth}%` }}
            >
              <EmbeddedPanel
                reference={embeddedRef}
                onClose={handleClosePanel}
                className="flex-1"
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
