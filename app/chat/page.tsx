'use client';

import {
  Children,
  type ComponentProps,
  createContext,
  type ReactElement,
  type ReactNode,
  type TextareaHTMLAttributes,
  use,
  useCallback,
  useDeferredValue,
  useEffect,
  useRef,
  useState,
  Suspense,
} from 'react';
import { useSearchParams } from 'next/navigation';
import {
  RefreshCw,
  StopCircle,
  ArrowUp,
  Plus,
  MessageSquare,
  PanelLeftClose,
  PanelLeft,
  Trash2,
  Home,
  Moon,
  Sun,
  ChevronRight,
  LogOut,
  CircleUserRound,
  Loader2,
  Share2,
  Play,
  BookOpen,
  Terminal,
  Puzzle,
  FileText,
  Newspaper,
  ExternalLink,
  Copy,
  Check,
  Zap,
  Brain,
  Pencil,
} from 'lucide-react';
import defaultMdxComponents from 'fumadocs-ui/mdx';
import { cn } from '@/lib/cn';
import { createProcessor, type Processor } from '@/components/ai/markdown-processor';
import { MessageFeedback } from '@/components/ai/feedback';
import { EmbeddedPanel, extractEmbeddableLinks, getEmbedTypeInfo, type EmbeddedReference, type EmbedType } from '@/components/ai/embedded-panel';
import Link from 'fumadocs-core/link';
import { type UIMessage, useChat, type UseChatHelpers } from '@ai-sdk/react';

// In v6, UIMessage has 'parts' array instead of 'content'
// Create a compatible Message type for our app
type Message = UIMessage;

// Helper to extract text content from UIMessage parts
function extractTextFromMessage(message: UIMessage): string {
  // Try parts first (v6 format)
  if (message.parts && message.parts.length > 0) {
    const textParts = message.parts
      .filter((p): p is { type: 'text'; text: string } => p.type === 'text' && typeof p.text === 'string')
      .map(p => p.text)
      .join('');
    if (textParts) return textParts;
  }
  // Fallback to content field (legacy or streaming)
  if ('content' in message && typeof (message as any).content === 'string') {
    return (message as any).content;
  }
  return '';
}
import { DynamicCodeBlock } from 'fumadocs-ui/components/dynamic-codeblock';
import dynamic from 'next/dynamic';
import React, { useMemo } from 'react';
import 'katex/dist/katex.min.css';
import { marked } from 'marked';
import posthog from 'posthog-js';
import { useTheme } from 'next-themes';
import { useSession, signOut } from 'next-auth/react';
import { useLoginModalTrigger } from '@/hooks/useLoginModal';
import { LoginModal } from '@/components/login/LoginModal';
import Image from 'next/image';
import { ShareButton } from '@/components/chat/share-button';
import { ShareModal } from '@/components/chat/share-modal';

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

const Mermaid = dynamic(() => import('@/components/content-design/mermaid'), {
  ssr: false,
});

// Types
interface DbChatMessage {
  id: string;
  conversation_id: string;
  role: string;
  content: string;
  created_at: string;
}

interface DbConversation {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  messages: DbChatMessage[];
  // Sharing fields
  is_shared: boolean;
  share_token: string | null;
  shared_at: string | null;
  share_expires_at: string | null;
  view_count: number;
}

interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
  // Sharing fields
  isShared: boolean;
  shareToken: string | null;
  sharedAt: string | null;
  expiresAt: string | null;
  viewCount: number;
}

// Convert DB conversation to local format
// In v6, messages need 'parts' array instead of 'content'
function dbToLocalConversation(db: DbConversation): Conversation {
  return {
    id: db.id,
    title: db.title,
    messages: db.messages.map(m => ({
      id: m.id,
      role: m.role as 'user' | 'assistant',
      parts: [{ type: 'text' as const, text: m.content }],
    })),
    createdAt: new Date(db.created_at).getTime(),
    updatedAt: new Date(db.updated_at).getTime(),
    // Sharing fields
    isShared: db.is_shared,
    shareToken: db.share_token,
    sharedAt: db.shared_at,
    expiresAt: db.share_expires_at,
    viewCount: db.view_count,
  };
}

// Chat context - use any to avoid complex generic issues with AI SDK v6
const ChatContext = createContext<UseChatHelpers<Message> | null>(null);
function useChatContext() {
  return use(ChatContext)!;
}

// Markdown rendering
let processor: Processor | undefined;
const markdownCache = new Map<string, ReactNode>();

// Remove AI "thinking" patterns that shouldn't be shown to users
function removeThinkingPatterns(content: string): string {
  if (!content) return '';

  // Patterns that indicate AI is thinking/searching (common prefixes)
  const thinkingPatterns = [
    // Search/lookup patterns
    /^I'll search for[^.]*\.\s*/i,
    /^Let me search[^.]*\.\s*/i,
    /^I'll look for[^.]*\.\s*/i,
    /^Let me look[^.]*\.\s*/i,
    /^I'll find[^.]*\.\s*/i,
    /^Let me find[^.]*\.\s*/i,
    /^Searching for[^.]*\.\s*/i,
    /^Looking for[^.]*\.\s*/i,
    // Information gathering patterns
    /^I'll gather[^.]*\.\s*/i,
    /^Let me gather[^.]*\.\s*/i,
    /^I'll check[^.]*\.\s*/i,
    /^Let me check[^.]*\.\s*/i,
    // Analysis patterns
    /^Based on my search[^,]*,\s*/i,
    /^After searching[^,]*,\s*/i,
    /^From my search[^,]*,\s*/i,
    // More specific patterns the user reported
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

// Helper to extract text content from AI SDK v6 message
// In v6, messages have 'parts' array instead of 'content'
function getMessageText(message: Message | any): string {
  // Handle direct UIMessage
  if (message && typeof message === 'object') {
    // Check if it's a UIMessage with parts
    if ('parts' in message) {
      return extractTextFromMessage(message);
    }
    // Legacy content field
    if ('content' in message && typeof message.content === 'string') {
      return message.content;
    }
    // Direct content value passed (legacy usage)
    if (typeof message === 'string') {
      return message;
    }
  }
  if (typeof message === 'string') return message;
  return '';
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

// Configure marked for streaming - synchronous and fast
marked.setOptions({
  gfm: true,
  breaks: true,
});

// Fast streaming markdown using marked (synchronous)
function StreamingMarkdown({ text }: { text: string }) {
  // Simple direct parsing - no deferred values or throttling
  const html = useMemo(() => {
    if (!text) return '';
    try {
      return marked.parse(text, { async: false }) as string;
    } catch {
      return text;
    }
  }, [text]);

  return (
    <div
      className="streaming-markdown"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

// Auto-growing textarea (resizes based on content, not draggable)
function TextareaInput(props: TextareaHTMLAttributes<HTMLTextAreaElement> & { className?: string }) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [props.value]);

  return (
    <textarea
      ref={textareaRef}
      id="chat-input"
      className={cn(
        'flex-1 bg-transparent',
        'placeholder:text-muted-foreground/50 focus:outline-none',
        'min-h-[24px] max-h-[200px] leading-relaxed',
        props.className,
      )}
      style={{ resize: 'none' }}
      rows={1}
      {...props}
    />
  );
}

// AI Avatar with Avalanche logo
function AIAvatar({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const sizeClasses = size === 'sm' ? 'w-6 h-6' : 'w-8 h-8';
  const imgClasses = size === 'sm' ? 'h-4' : 'h-5';

  return (
    <div className={cn(sizeClasses, "rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center")}>
      <img
        src="/small-logo.png"
        alt="AI"
        className={cn(imgClasses, "object-contain")}
      />
    </div>
  );
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

// Chat message
function ChatMessage({ message, isLast, isStreaming, onRefSelect }: {
  message: Message;
  isLast: boolean;
  isStreaming?: boolean;
  onRefSelect?: (ref: EmbeddedReference) => void;
}) {
  const isUser = message.role === 'user';
  const textContent = getMessageText(message);
  // For assistant messages: only remove thinking patterns AFTER streaming completes
  // During streaming, show raw text to avoid flickering when patterns partially match
  const cleanContent = isUser ? textContent : (isStreaming ? textContent : removeThinkingPatterns(textContent));
  const embeddableLinks = isUser ? [] : extractEmbeddableLinks(textContent);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(cleanContent);
      setCopied(true);
      posthog.capture('ai_chat_response_copied', { message_length: cleanContent.length });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

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
            {isStreaming ? (
              // During streaming: fast synchronous markdown with marked
              <StreamingMarkdown text={cleanContent} />
            ) : (
              // After streaming: full markdown with syntax highlighting & KaTeX
              <Markdown text={cleanContent} />
            )}
          </div>

          {/* Show clickable sources - color-coded by type with clear "view" action */}
          {embeddableLinks.length > 0 && onRefSelect && !isStreaming && (
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

          {/* Action buttons - show after streaming completes */}
          {!isStreaming && (
            <div className="flex items-center gap-3 mt-4">
              {/* Copy button */}
              <button
                onClick={handleCopy}
                className={cn(
                  "p-1.5 rounded-md transition-all",
                  copied
                    ? "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400"
                    : "text-muted-foreground/50 hover:text-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800"
                )}
                title={copied ? "Copied!" : "Copy response"}
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </button>

              {/* Feedback buttons */}
              <MessageFeedback
                messageId={message.id}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Typing indicator
function TypingIndicator() {
  return (
    <div className="mb-6">
      <div className="flex items-start gap-4">
        <div className="shrink-0 mt-1">
          <AIAvatar />
        </div>
        <div className="flex items-center gap-1.5 py-4">
          <span className="w-2 h-2 rounded-full bg-zinc-400 animate-bounce [animation-delay:-0.3s]" />
          <span className="w-2 h-2 rounded-full bg-zinc-400 animate-bounce [animation-delay:-0.15s]" />
          <span className="w-2 h-2 rounded-full bg-zinc-400 animate-bounce" />
        </div>
      </div>
    </div>
  );
}

// Message list with smart auto-scroll (only scrolls if user is near bottom)
function MessageList({ children }: { children: ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);

  // Track if user is near bottom (within 100px)
  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    isNearBottomRef.current = scrollHeight - scrollTop - clientHeight < 100;
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    const scrollToBottom = () => {
      // Only auto-scroll if user is near bottom (not scrolled up)
      if (isNearBottomRef.current && containerRef.current) {
        containerRef.current.scrollTo({ top: containerRef.current.scrollHeight, behavior: 'smooth' });
      }
    };
    const observer = new ResizeObserver(scrollToBottom);
    scrollToBottom();
    const firstChild = containerRef.current?.firstElementChild;
    if (firstChild) observer.observe(firstChild);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto overscroll-contain scrollbar-hide"
    >
      {children}
    </div>
  );
}

// Thinking mode context
const ThinkingModeContext = createContext<{
  thinkingMode: boolean;
  setThinkingMode: (mode: boolean) => void;
}>({ thinkingMode: false, setThinkingMode: () => {} });

function useThinkingMode() {
  return use(ThinkingModeContext);
}

// Chat input
function ChatInput() {
  const { status, sendMessage, stop } = useChatContext();
  const { thinkingMode, setThinkingMode } = useThinkingMode();
  const [inputValue, setInputValue] = useState('');
  const isLoading = status === 'streaming' || status === 'submitted';

  const onSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (inputValue.trim()) {
      posthog.capture('ai_chat_message_sent', {
        query_length: inputValue.length,
        query: inputValue.substring(0, 100),
        view: 'fullscreen',
        thinking_mode: thinkingMode,
      });
      // Pass thinking mode as a header so the server can adjust response style
      sendMessage(
        { text: inputValue },
        { headers: { 'X-Thinking-Mode': thinkingMode ? 'true' : 'false' } }
      );
      setInputValue('');
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4 pb-4">
      <form onSubmit={onSubmit} className="relative">
        <div className="relative flex items-end bg-zinc-100 dark:bg-zinc-800 rounded-3xl border border-zinc-200 dark:border-zinc-700">
          <TextareaInput
            value={inputValue}
            placeholder="Message Avalanche AI"
            className="w-full px-5 py-4 pr-28 text-sm"
            disabled={isLoading}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(event) => {
              if (!event.shiftKey && event.key === 'Enter') {
                onSubmit();
                event.preventDefault();
              }
            }}
          />
          <div className="absolute right-3 bottom-3 flex items-center gap-2">
            {/* Thinking mode toggle */}
            <button
              type="button"
              onClick={() => setThinkingMode(!thinkingMode)}
              disabled={isLoading}
              className={cn(
                "p-2 rounded-full transition-all",
                thinkingMode
                  ? "bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400"
                  : "text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700",
                isLoading && "opacity-50 cursor-not-allowed"
              )}
              title={thinkingMode ? "Thinking mode (slower, more thorough)" : "Quick mode (faster responses)"}
            >
              {thinkingMode ? <Brain className="w-5 h-5" /> : <Zap className="w-5 h-5" />}
            </button>
            {/* Send/Stop button */}
            <button
              type={isLoading ? 'button' : 'submit'}
              onClick={isLoading ? stop : undefined}
              disabled={!isLoading && inputValue.length === 0}
              className={cn(
                "p-2 rounded-full transition-all",
                isLoading
                  ? "bg-zinc-300 dark:bg-zinc-600 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-400 dark:hover:bg-zinc-500"
                  : inputValue.length > 0
                    ? "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-200"
                    : "bg-zinc-300 dark:bg-zinc-600 text-zinc-400 dark:text-zinc-500 cursor-not-allowed"
              )}
              title={isLoading ? "Stop generating" : "Send message"}
            >
              {isLoading ? <StopCircle className="w-5 h-5" /> : <ArrowUp className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </form>
      <div className="flex items-center justify-center gap-2 mt-2">
        {thinkingMode && (
          <span className="flex items-center gap-1 text-xs text-purple-600 dark:text-purple-400">
            <Brain className="w-3 h-3" />
            Thinking mode
          </span>
        )}
        <p className="text-xs text-muted-foreground/50">
          Avalanche AI can make mistakes. Consider checking important information.
        </p>
      </div>
    </div>
  );
}

// Chat actions
function ChatActions() {
  const { messages, status, setMessages, regenerate } = useChatContext();
  const isLoading = status === 'streaming';
  if (messages.length === 0) return null;

  return (
    <div className="flex items-center justify-center gap-3 py-2">
      {!isLoading && messages.at(-1)?.role === 'assistant' && (
        <button
          type="button"
          onClick={() => { posthog.capture('ai_chat_regenerate'); regenerate(); }}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          title="Regenerate response"
        >
          <RefreshCw className="w-4 h-4" />
          Regenerate
        </button>
      )}
    </div>
  );
}

// Dynamic greeting messages
const GREETING_MESSAGES = [
  "what are we shipping today?",
  "ready to build something great?",
  "let's build on Avalanche",
  "time to deploy some contracts?",
  "ready to launch your L1?",
  "what's on your mind?",
  "let's get building",
  "need help with your project?",
  "what can I help you build?",
  "let's make something awesome",
];

// Suggested starter questions
const SUGGESTED_QUESTIONS = [
  "How do I deploy a smart contract on Avalanche?",
  "What's the difference between C-Chain and an L1?",
  "How do I create my own Avalanche L1?",
  "Explain Avalanche consensus mechanism",
];

// Typewriter hook for cycling through messages
function useTypewriter(messages: string[], typingSpeed = 50, pauseDuration = 3000) {
  const [messageIndex, setMessageIndex] = useState(0);
  const [displayText, setDisplayText] = useState('');
  const [isTyping, setIsTyping] = useState(true);

  useEffect(() => {
    const currentMessage = messages[messageIndex];

    if (isTyping) {
      // Typing phase
      if (displayText.length < currentMessage.length) {
        const timeout = setTimeout(() => {
          setDisplayText(currentMessage.slice(0, displayText.length + 1));
        }, typingSpeed);
        return () => clearTimeout(timeout);
      } else {
        // Finished typing, pause before next message
        const timeout = setTimeout(() => {
          setIsTyping(false);
        }, pauseDuration);
        return () => clearTimeout(timeout);
      }
    } else {
      // Erasing phase - quick erase then move to next
      if (displayText.length > 0) {
        const timeout = setTimeout(() => {
          setDisplayText(displayText.slice(0, -1));
        }, typingSpeed / 2);
        return () => clearTimeout(timeout);
      } else {
        // Move to next message
        setMessageIndex((prev) => (prev + 1) % messages.length);
        setIsTyping(true);
      }
    }
  }, [displayText, isTyping, messageIndex, messages, typingSpeed, pauseDuration]);

  return { displayText, isTyping };
}

// Empty state
function EmptyState({ userName, onSuggestionClick }: { userName?: string | null; onSuggestionClick: (question: string) => void }) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const { displayText, isTyping } = useTypewriter(GREETING_MESSAGES, 40, 10000);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Get first name from full name
  const firstName = userName?.split(' ')[0];

  return (
    <div className="flex flex-col items-center justify-center h-full px-4">
      <div className="text-center max-w-2xl">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          {mounted && (
            <img
              src={resolvedTheme === 'dark' ? '/logo-white.png' : '/logo-black.png'}
              alt="Avalanche"
              className="h-8 object-contain opacity-60"
            />
          )}
        </div>

        {/* Greeting */}
        <h1 className="text-3xl sm:text-4xl font-light tracking-tight text-foreground/90 mb-8">
          {firstName ? (
            <>
              Hi {firstName},{' '}
              <span className="text-muted-foreground">
                {displayText}
                <span className="inline-block w-[2px] h-[1em] bg-muted-foreground/60 ml-0.5 align-middle animate-[blink_1s_step-end_infinite]" />
              </span>
            </>
          ) : (
            <span className="text-muted-foreground">
              {displayText}
              <span className="inline-block w-[2px] h-[1em] bg-muted-foreground/60 ml-0.5 align-middle animate-[blink_1s_step-end_infinite]" />
            </span>
          )}
        </h1>

        {/* Suggested questions */}
        <div className="flex flex-wrap justify-center gap-2">
          {SUGGESTED_QUESTIONS.map((question, index) => (
            <button
              key={index}
              onClick={() => onSuggestionClick(question)}
              className={cn(
                "px-4 py-2.5 text-sm rounded-full",
                "bg-zinc-100 dark:bg-zinc-800 text-muted-foreground",
                "hover:bg-zinc-200 dark:hover:bg-zinc-700 hover:text-foreground",
                "border border-zinc-200 dark:border-zinc-700",
                "transition-all duration-200"
              )}
            >
              {question}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// Simple Sidebar - expands/collapses with consistent spatial layout
function Sidebar({
  isOpen,
  onToggle,
  conversations,
  currentConversationId,
  onNewChat,
  onSelectConversation,
  onDeleteConversation,
  onRenameConversation,
  onShareConversation,
  isAuthenticated,
  isLoadingAuth,
  userImage,
  userName,
  onLogin,
  onLogout,
  isLoadingConversations,
}: {
  isOpen: boolean;
  onToggle: () => void;
  conversations: Conversation[];
  currentConversationId: string | null;
  onNewChat: () => void;
  onSelectConversation: (id: string) => void;
  onDeleteConversation: (id: string) => void;
  onRenameConversation: (id: string, newTitle: string) => void;
  onShareConversation: (conv: Conversation) => void;
  isAuthenticated: boolean;
  isLoadingAuth: boolean;
  userImage?: string | null;
  userName?: string | null;
  onLogin: () => void;
  onLogout: () => void;
  isLoadingConversations: boolean;
}) {
  const { theme, setTheme } = useTheme();
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onToggle}
        />
      )}

      {/* Sidebar */}
      <div className={cn(
        "fixed lg:relative inset-y-0 left-0 z-50 lg:z-auto",
        "bg-[#171720] flex flex-col transition-all duration-200 ease-in-out",
        isOpen
          ? "w-64 translate-x-0"
          : "w-[52px] -translate-x-full lg:translate-x-0"
      )}>
        {/* Logo/Brand header - links back to main site */}
        <div className="p-1.5 border-b border-zinc-800/50">
          <Link
            href="/"
            className={cn(
              "w-full h-10 flex items-center rounded-lg hover:bg-white/5 transition-colors group",
              isOpen ? "px-3 gap-3" : "justify-center"
            )}
            title="Back to Builder Hub"
          >
            <div className="w-7 h-7 flex items-center justify-center">
              <img
                src="/small-logo.png"
                alt="Avalanche"
                className="h-5 w-5 object-contain opacity-70 group-hover:opacity-100 transition-opacity"
              />
            </div>
            {isOpen && (
              <span className="text-sm font-medium text-zinc-300 group-hover:text-white transition-colors">
                Avalanche AI
              </span>
            )}
          </Link>
        </div>

        {/* Top section - Toggle + New Chat */}
        <div className="p-1.5 space-y-1">
          {/* Toggle button */}
          <button
            onClick={onToggle}
            className={cn(
              "w-full h-10 flex items-center rounded-lg hover:bg-white/10 transition-colors",
              isOpen ? "px-3 gap-3" : "justify-center"
            )}
            title={isOpen ? "Close sidebar" : "Open sidebar"}
          >
            {isOpen ? <PanelLeftClose className="w-5 h-5 text-zinc-400" /> : <PanelLeft className="w-5 h-5 text-zinc-400" />}
            {isOpen && <span className="text-sm text-zinc-400">Close</span>}
          </button>

          {/* New chat button */}
          <button
            onClick={onNewChat}
            className={cn(
              "w-full h-10 flex items-center rounded-lg border border-zinc-700 hover:bg-white/10 hover:border-zinc-600 transition-colors",
              isOpen ? "px-3 gap-3" : "justify-center"
            )}
            title="New chat"
          >
            <Plus className="w-5 h-5 text-zinc-300" />
            {isOpen && <span className="text-sm text-zinc-300 font-medium">New chat</span>}
          </button>
        </div>

        {/* Middle section - Conversations or quick icons */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          {isOpen ? (
            // Expanded: show conversation list
            <div className="px-1.5">
              {isLoadingConversations ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-zinc-400" />
                </div>
              ) : !isAuthenticated ? (
                <div className="text-center py-8 px-2">
                  <p className="text-zinc-400 text-sm mb-3">Sign in to save chats</p>
                  <button
                    onClick={onLogin}
                    className="px-4 py-2 text-sm font-medium rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors"
                  >
                    Sign In
                  </button>
                </div>
              ) : conversations.length === 0 ? (
                <div className="text-center py-8 text-zinc-500 text-sm">
                  No conversations yet
                </div>
              ) : (
                <div className="space-y-0.5">
                  {conversations.map((conv) => (
                    <div
                      key={conv.id}
                      onMouseEnter={() => setHoveredId(conv.id)}
                      onMouseLeave={() => setHoveredId(null)}
                      className={cn(
                        "group flex items-center gap-3 px-3 h-10 rounded-lg cursor-pointer transition-colors",
                        currentConversationId === conv.id
                          ? "bg-white/10"
                          : "hover:bg-white/5"
                      )}
                      onClick={() => editingId !== conv.id && onSelectConversation(conv.id)}
                    >
                      <MessageSquare className="w-5 h-5 shrink-0 text-zinc-400" />
                      {/* Editable title or static title */}
                      {editingId === conv.id ? (
                        <input
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              onRenameConversation(conv.id, editTitle);
                              setEditingId(null);
                            } else if (e.key === 'Escape') {
                              setEditingId(null);
                            }
                          }}
                          onBlur={() => {
                            if (editTitle.trim() && editTitle !== conv.title) {
                              onRenameConversation(conv.id, editTitle);
                            }
                            setEditingId(null);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          autoFocus
                          className="flex-1 bg-transparent text-sm text-zinc-200 border-b border-zinc-500 focus:outline-none focus:border-zinc-300"
                        />
                      ) : (
                        <span className="flex-1 truncate text-sm text-zinc-200">{conv.title}</span>
                      )}
                      {/* Share indicator (always visible if shared) */}
                      {conv.isShared && hoveredId !== conv.id && editingId !== conv.id && (
                        <div className="w-2 h-2 rounded-full bg-emerald-500" title="Shared" />
                      )}
                      {/* Action buttons on hover */}
                      {hoveredId === conv.id && editingId !== conv.id && (
                        <div className="flex items-center gap-0.5">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditTitle(conv.title);
                              setEditingId(conv.id);
                            }}
                            className="p-1 rounded hover:bg-white/10 transition-colors"
                            title="Rename"
                          >
                            <Pencil className="w-4 h-4 text-zinc-400 hover:text-zinc-200" />
                          </button>
                          <ShareButton
                            isShared={conv.isShared}
                            onClick={() => onShareConversation(conv)}
                          />
                          <button
                            onClick={(e) => { e.stopPropagation(); onDeleteConversation(conv.id); }}
                            className="p-1 rounded hover:bg-white/10 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4 text-zinc-400 hover:text-red-400" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            // Collapsed: show icon for chat history
            <div className="flex flex-col items-center px-1.5 py-1">
              <button
                onClick={onToggle}
                className="w-full h-10 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors"
                title="Chat history"
              >
                <MessageSquare className="w-5 h-5 text-zinc-400" />
              </button>
            </div>
          )}
        </div>

        {/* Bottom section - Actions + User */}
        <div className="border-t border-zinc-800/50 p-1.5 space-y-0.5">
          {/* Home link */}
          <Link
            href="/"
            className={cn(
              "w-full h-10 flex items-center rounded-lg hover:bg-white/10 transition-colors",
              isOpen ? "px-3 gap-3" : "justify-center"
            )}
            title="Go to Home"
          >
            <Home className="w-5 h-5 text-zinc-400" />
            {isOpen && <span className="text-sm text-zinc-300">Home</span>}
          </Link>

          {/* Theme toggle */}
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className={cn(
              "w-full h-10 flex items-center rounded-lg hover:bg-white/10 transition-colors",
              isOpen ? "px-3 gap-3" : "justify-center"
            )}
            title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
          >
            {theme === 'dark' ? <Sun className="w-5 h-5 text-zinc-400" /> : <Moon className="w-5 h-5 text-zinc-400" />}
            {isOpen && <span className="text-sm text-zinc-300">{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>}
          </button>

          {/* User section */}
          {isLoadingAuth ? (
            <div className={cn(
              "w-full h-10 flex items-center",
              isOpen ? "px-3 gap-3" : "justify-center"
            )}>
              <Loader2 className="w-5 h-5 animate-spin text-zinc-400" />
              {isOpen && <span className="text-sm text-zinc-400">Loading...</span>}
            </div>
          ) : isAuthenticated ? (
            <div className={cn(
              "w-full h-10 flex items-center rounded-lg hover:bg-white/10 transition-colors",
              isOpen ? "px-3 gap-3" : "justify-center"
            )}>
              <button
                onClick={isOpen ? undefined : onToggle}
                className={cn("flex items-center", isOpen ? "gap-3 flex-1 min-w-0" : "")}
                title={isOpen ? undefined : "Account"}
              >
                {userImage ? (
                  <Image src={userImage} alt="Profile" width={28} height={28} className="rounded-full shrink-0" />
                ) : (
                  <CircleUserRound className="w-7 h-7 text-zinc-400 shrink-0" />
                )}
                {isOpen && <span className="text-sm text-zinc-200 truncate">{userName || 'User'}</span>}
              </button>
              {isOpen && (
                <button onClick={onLogout} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors ml-auto" title="Sign out">
                  <LogOut className="w-4 h-4 text-zinc-400" />
                </button>
              )}
            </div>
          ) : (
            <button
              onClick={onLogin}
              className={cn(
                "w-full h-10 flex items-center rounded-lg hover:bg-white/10 transition-colors",
                isOpen ? "px-3 gap-3" : "justify-center"
              )}
              title="Sign in"
            >
              <CircleUserRound className="w-5 h-5 text-zinc-400" />
              {isOpen && <span className="text-sm text-zinc-300">Sign In</span>}
            </button>
          )}
        </div>
      </div>
    </>
  );
}

// Inner chat component that uses searchParams
function ChatPageInner() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q');
  const hasSubmittedInitialQuery = useRef(false);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [isLoadingConversations, setIsLoadingConversations] = useState(false);

  // Thinking mode state (slower, more thorough responses)
  // Note: Currently UI-only. Server-side implementation can be added later
  // by reading thinkingMode from localStorage or a custom header.
  const [thinkingMode, setThinkingMode] = useState(false);

  // Auth state
  const { data: session, status: authStatus } = useSession();
  const isAuthenticated = authStatus === 'authenticated';
  const isLoadingAuth = authStatus === 'loading';
  const { openLoginModal } = useLoginModalTrigger();

  // Share modal state
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareModalConversation, setShareModalConversation] = useState<Conversation | null>(null);

  // Embedded panel state
  const [embeddedRef, setEmbeddedRef] = useState<EmbeddedReference | null>(null);
  const [closedRefs, setClosedRefs] = useState<Set<string>>(new Set());
  const [panelWidth, setPanelWidth] = useState(35); // Percentage width of embedded panel (chat gets 65%)
  const [isResizing, setIsResizing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const isLargeScreen = useIsLargeScreen(); // Detect if we're on desktop (lg breakpoint)

  // Load conversations from API when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      setIsLoadingConversations(true);
      fetch('/api/chat-history')
        .then(res => res.json())
        .then((data: DbConversation[]) => {
          if (Array.isArray(data)) {
            const convs = data.map(dbToLocalConversation);
            setConversations(convs);
          }
        })
        .catch(err => console.error('Failed to load conversations:', err))
        .finally(() => setIsLoadingConversations(false));
    } else {
      setConversations([]);
      setCurrentConversationId(null);
    }
  }, [isAuthenticated]);

  // Save conversation to API
  const saveConversation = useCallback(async (conv: Conversation) => {
    if (!isAuthenticated) return;

    try {
      const res = await fetch('/api/chat-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: conv.id.includes('-') ? conv.id : undefined, // Only pass ID if it's a UUID (from DB)
          title: conv.title,
          messages: conv.messages.map(m => ({ role: m.role, content: getMessageText(m) })),
        }),
      });

      if (res.ok) {
        const saved: DbConversation = await res.json();
        const localConv = dbToLocalConversation(saved);

        setConversations(prev => {
          const exists = prev.some(c => c.id === localConv.id);
          if (exists) {
            return prev.map(c => c.id === localConv.id ? localConv : c);
          }
          return [localConv, ...prev];
        });

        return localConv;
      }
    } catch (err) {
      console.error('Failed to save conversation:', err);
    }
    return null;
  }, [isAuthenticated]);

  // Delete conversation from API
  const deleteConversation = useCallback(async (id: string) => {
    if (!isAuthenticated) return;

    try {
      const res = await fetch(`/api/chat-history/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setConversations(prev => prev.filter(c => c.id !== id));
        if (currentConversationId === id) {
          setCurrentConversationId(null);
        }
      }
    } catch (err) {
      console.error('Failed to delete conversation:', err);
    }
  }, [isAuthenticated, currentConversationId]);

  // Rename conversation
  const renameConversation = useCallback(async (id: string, newTitle: string) => {
    if (!isAuthenticated || !newTitle.trim()) return;

    try {
      const res = await fetch(`/api/chat-history/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle.trim() }),
      });
      if (res.ok) {
        setConversations(prev =>
          prev.map(c => c.id === id ? { ...c, title: newTitle.trim() } : c)
        );
        posthog.capture('ai_chat_conversation_renamed', { conversation_id: id });
      }
    } catch (err) {
      console.error('Failed to rename conversation:', err);
    }
  }, [isAuthenticated]);

  // Handle share conversation
  const handleShareConversation = useCallback((conv: Conversation) => {
    setShareModalConversation(conv);
    setShareModalOpen(true);
  }, []);

  // Handle share toggle (called when share status changes)
  const handleShareToggle = useCallback(() => {
    // Refresh conversations to get updated share status
    if (isAuthenticated) {
      fetch('/api/chat-history')
        .then(res => res.json())
        .then((data: DbConversation[]) => {
          if (Array.isArray(data)) {
            const convs = data.map(dbToLocalConversation);
            setConversations(convs);
            // Update the modal conversation if it's still open
            if (shareModalConversation) {
              const updated = convs.find(c => c.id === shareModalConversation.id);
              if (updated) setShareModalConversation(updated);
            }
          }
        })
        .catch(err => console.error('Failed to refresh conversations:', err));
    }
  }, [isAuthenticated, shareModalConversation]);

  // Handle reference selection from inline source buttons
  const handleRefSelect = (ref: EmbeddedReference) => {
    setEmbeddedRef(ref);
  };

  // Handle closing the panel
  const handleClosePanel = () => {
    if (embeddedRef) {
      setClosedRefs(prev => new Set(prev).add(embeddedRef.url));
    }
    setEmbeddedRef(null);
  };

  // Handle panel resize with refs to avoid stale closures
  const isResizingRef = useRef(false);
  const containerRefForResize = containerRef;

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
      if (!isResizingRef.current || !containerRefForResize.current) return;

      e.preventDefault();
      const containerRect = containerRefForResize.current.getBoundingClientRect();
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

  const currentConversation = conversations.find(c => c.id === currentConversationId);

  const chat = useChat({
    id: currentConversationId || 'new',
    onError(error) {
      console.error('Chat error:', error);
    },
    async onFinish({ message }) {
      const messageText = getMessageText(message);
      posthog.capture('ai_chat_response_received', {
        response_length: messageText.length,
        view: 'fullscreen',
      });

      // Detect embeddable links and auto-open panel with the highest priority link
      const links = extractEmbeddableLinks(messageText);
      if (links.length > 0) {
        const firstLink = links[0]; // Already sorted by priority (youtube > console > etc)
        if (!closedRefs.has(firstLink.url)) {
          setEmbeddedRef(firstLink);
        }
      }

      // Save conversation to database (only if authenticated)
      // Note: chat.messages already contains the completed message when onFinish fires,
      // so we don't need to add `message` again - that would cause duplicates
      if (isAuthenticated) {
        const msgs = chat.messages.filter(m => m.role !== 'system');
        if (msgs.length > 0) {
          const titleText = getMessageText(msgs[0]);
          const title = titleText.slice(0, 50) || 'New chat';
          const convToSave: Conversation = {
            id: currentConversationId || '',
            title,
            messages: msgs,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            // Default sharing fields (will be updated from server response)
            isShared: false,
            shareToken: null,
            sharedAt: null,
            expiresAt: null,
            viewCount: 0,
          };

          const saved = await saveConversation(convToSave);
          if (saved && !currentConversationId) {
            setCurrentConversationId(saved.id);
          }
        }
      }
    },
  });

  // Sync messages when switching conversations
  useEffect(() => {
    if (currentConversation) {
      chat.setMessages(currentConversation.messages);
    } else {
      chat.setMessages([]);
    }
  }, [currentConversationId]);

  const messages = chat.messages.filter((msg) => msg.role !== 'system');
  const { status, sendMessage, setMessages } = chat;
  const isLoading = status === 'streaming';
  const isWaitingForStream = status === 'submitted';

  useEffect(() => {
    posthog.capture('ai_chat_opened', { view: 'fullscreen' });
  }, []);

  // Auto-submit initial query from URL parameter
  useEffect(() => {
    if (initialQuery && !hasSubmittedInitialQuery.current && messages.length === 0 && status === 'ready') {
      hasSubmittedInitialQuery.current = true;
      sendMessage({ text: initialQuery });
    }
  }, [initialQuery, messages.length, status, sendMessage]);

  const handleNewChat = () => {
    // Track conversation start
    posthog.capture('ai_chat_conversation_started', {
      is_authenticated: !!session?.user,
      entry_point: 'new_chat_button',
    });
    setCurrentConversationId(null);
    setMessages([]);
  };

  const handleSelectConversation = (id: string) => {
    setCurrentConversationId(id);
    setSidebarOpen(false); // Close on mobile
  };

  const handleDeleteConversation = async (id: string) => {
    await deleteConversation(id);
  };

  const handleRenameConversation = async (id: string, newTitle: string) => {
    await renameConversation(id, newTitle);
  };

  const handleSuggestionClick = (question: string) => {
    // Fire-and-forget to avoid blocking UI (fixes INP performance issue)
    void sendMessage({ text: question });
  };

  const handleLogin = () => {
    openLoginModal(window.location.href);
  };

  const handleLogout = () => {
    signOut({ redirect: false });
  };

  return (
    <ThinkingModeContext value={{ thinkingMode, setThinkingMode }}>
    <ChatContext value={chat}>
      <LoginModal />
      {/* Share Modal */}
      {shareModalConversation && (
        <ShareModal
          isOpen={shareModalOpen}
          onClose={() => {
            setShareModalOpen(false);
            setShareModalConversation(null);
          }}
          conversationId={shareModalConversation.id}
          conversationTitle={shareModalConversation.title}
          isShared={shareModalConversation.isShared}
          shareToken={shareModalConversation.shareToken}
          sharedAt={shareModalConversation.sharedAt}
          expiresAt={shareModalConversation.expiresAt}
          viewCount={shareModalConversation.viewCount}
          onShareToggle={handleShareToggle}
        />
      )}
      <div className="flex h-full w-full overflow-hidden">
        {/* Sidebar */}
        <Sidebar
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen(!sidebarOpen)}
          conversations={conversations}
          currentConversationId={currentConversationId}
          onNewChat={handleNewChat}
          onSelectConversation={handleSelectConversation}
          onDeleteConversation={handleDeleteConversation}
          onRenameConversation={handleRenameConversation}
          onShareConversation={handleShareConversation}
          isAuthenticated={isAuthenticated}
          isLoadingAuth={isLoadingAuth}
          userImage={session?.user?.image}
          userName={session?.user?.name}
          onLogin={handleLogin}
          onLogout={handleLogout}
          isLoadingConversations={isLoadingConversations}
        />

        {/* Main content area (chat + embedded panel) */}
        <div ref={containerRef} className="flex-1 flex min-w-0 relative">
          {/* Overlay during resize to capture all mouse events (prevents iframe from stealing them) */}
          {isResizing && (
            <div className="fixed inset-0 z-50 cursor-col-resize" />
          )}
          {/* Chat area */}
          <div
            className="flex flex-col min-w-0"
            style={{ width: embeddedRef && isLargeScreen ? `${100 - panelWidth}%` : '100%' }}
          >
            {/* Header with mobile toggle and share button */}
            <div className="shrink-0 flex items-center justify-between px-3 py-2 border-b border-zinc-200 dark:border-zinc-800/50">
              {/* Left: Mobile sidebar toggle */}
              <div className="flex items-center">
                {!sidebarOpen && (
                  <button
                    onClick={() => setSidebarOpen(true)}
                    className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors lg:hidden"
                    title="Open sidebar"
                  >
                    <PanelLeft className="w-5 h-5" />
                  </button>
                )}
                {/* Conversation title on desktop */}
                {currentConversation && (
                  <span
                    className="hidden lg:block text-sm text-muted-foreground truncate max-w-[200px] ml-2"
                    title={currentConversation.title}
                  >
                    {currentConversation.title}
                  </span>
                )}
              </div>

              {/* Right: Share button */}
              <div className="flex items-center gap-2">
                {/* Share button */}
                {messages.length > 0 && (
                  <button
                    onClick={async () => {
                      if (!isAuthenticated) {
                        // Prompt for login
                        openLoginModal(window.location.href);
                        return;
                      }

                      // If we have a current conversation, open share modal directly
                      if (currentConversation) {
                        handleShareConversation(currentConversation);
                        return;
                      }

                      // If no conversation saved yet, save it first then open share modal
                      const titleText = getMessageText(messages[0]);
                      const title = titleText.slice(0, 50) || 'New chat';
                      const convToSave: Conversation = {
                        id: '',
                        title,
                        messages,
                        createdAt: Date.now(),
                        updatedAt: Date.now(),
                        isShared: false,
                        shareToken: null,
                        sharedAt: null,
                        expiresAt: null,
                        viewCount: 0,
                      };

                      const saved = await saveConversation(convToSave);
                      if (saved) {
                        setCurrentConversationId(saved.id);
                        handleShareConversation(saved);
                      }
                    }}
                    disabled={isLoading || isWaitingForStream}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors",
                      "border border-zinc-200 dark:border-zinc-700",
                      (isLoading || isWaitingForStream)
                        ? "opacity-50 cursor-not-allowed"
                        : "hover:bg-zinc-100 dark:hover:bg-zinc-800",
                      currentConversation?.isShared && "text-emerald-600 dark:text-emerald-400 border-emerald-300 dark:border-emerald-600"
                    )}
                    title={
                      (isLoading || isWaitingForStream) ? "Wait for response to complete" :
                      !isAuthenticated ? "Sign in to share" :
                      currentConversation?.isShared ? "Manage sharing" : "Share conversation"
                    }
                  >
                    <Share2 className="w-4 h-4" />
                    <span className="hidden sm:inline">
                      {currentConversation?.isShared ? "Shared" : "Share"}
                    </span>
                  </button>
                )}
              </div>
            </div>

            {/* Messages */}
            <main className="flex-1 min-h-0 flex flex-col overflow-hidden">
              {messages.length === 0 ? (
                <EmptyState userName={session?.user?.name} onSuggestionClick={handleSuggestionClick} />
              ) : (
                <MessageList>
                  <div className="max-w-4xl mx-auto w-full px-4 py-6">
                    {messages.map((message, index) => (
                      <ChatMessage
                        key={message.id}
                        message={message}
                        isLast={index === messages.length - 1}
                        isStreaming={isLoading && index === messages.length - 1 && message.role === 'assistant'}
                        onRefSelect={handleRefSelect}
                      />
                    ))}
                    {(isLoading || isWaitingForStream) && messages[messages.length - 1]?.role === 'user' && <TypingIndicator />}
                    <ChatActions />
                  </div>
                </MessageList>
              )}
            </main>

            {/* Input */}
            <div className="shrink-0 pt-2 pb-4 bg-gradient-to-t from-background via-background to-transparent">
              <ChatInput />
            </div>
          </div>

          {/* Embedded Panel (right side) */}
          {embeddedRef && (
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

              {/* Panel - no transitions during resize for smooth dragging */}
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
    </ChatContext>
    </ThinkingModeContext>
  );
}

// Main page component with Suspense boundary for useSearchParams
export default function ChatPage() {
  return (
    <Suspense fallback={
      <div className="flex h-full w-full items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
      </div>
    }>
      <ChatPageInner />
    </Suspense>
  );
}
