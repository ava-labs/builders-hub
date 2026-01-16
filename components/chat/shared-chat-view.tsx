'use client';

import { type ReactNode, useEffect, useState, type ComponentProps, Children, type ReactElement } from 'react';
import defaultMdxComponents from 'fumadocs-ui/mdx';
import { cn } from '@/lib/cn';
import { createProcessor, type Processor } from '@/components/ai/markdown-processor';
import Link from 'fumadocs-core/link';
import { DynamicCodeBlock } from 'fumadocs-ui/components/dynamic-codeblock';
import dynamic from 'next/dynamic';
import 'katex/dist/katex.min.css';
import { Eye, Calendar, User, MessageSquare, Sparkles, Share2 } from 'lucide-react';
import Image from 'next/image';

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
function ChatMessage({ message }: { message: SharedMessage }) {
  const isUser = message.role === 'user';
  const cleanContent = isUser ? message.content : removeThinkingPatterns(message.content);

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
        </div>
      </div>
    </div>
  );
}

export function SharedChatView({ conversation }: SharedChatViewProps) {
  const { title, messages, sharedAt, viewCount, creator } = conversation;

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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-zinc-200 dark:border-zinc-800 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 py-4">
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

      {/* Chat content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
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
            <ChatMessage key={message.id} message={message} />
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
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-200 dark:border-zinc-800 mt-12">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Powered by Avalanche AI</span>
            <Link href="/" className="hover:text-foreground transition-colors">
              build.avax.network
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
