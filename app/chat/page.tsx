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
  Loader2,
  Share2,
  Copy,
  Check,
  Pencil,
} from 'lucide-react';
import defaultMdxComponents from 'fumadocs-ui/mdx';
import { cn } from '@/lib/cn';
import { createProcessor, type Processor } from '@/components/ai/markdown-processor';
import { MessageFeedback } from '@/components/ai/feedback';
import InlineChatComponent from '@/components/chat/inline-component';
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
import { marked } from 'marked';
import 'katex/dist/katex.min.css';
import posthog from 'posthog-js';
import { useTheme } from 'next-themes';
import { useSession } from 'next-auth/react';
import { useLoginModalTrigger } from '@/hooks/useLoginModal';

import { ShareButton } from '@/components/chat/share-button';
import { ShareModal } from '@/components/chat/share-modal';

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

// Chat image — renders doc/blog images inline with nice styling
function ChatImage(props: ComponentProps<'img'>) {
  const { src, alt, ...rest } = props;
  if (!src) return null;
  return (
    <span className="block my-4">
      <img
        src={src}
        alt={alt || ''}
        loading="lazy"
        className="rounded-lg border border-zinc-200 dark:border-zinc-700 max-w-full h-auto shadow-sm"
        {...rest}
      />
      {alt && <span className="block text-xs text-muted-foreground mt-1.5">{alt}</span>}
    </span>
  );
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
          .process(text, { ...defaultMdxComponents, pre: Pre, a: Link, img: ChatImage })
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

// Streaming markdown — throttled to avoid mid-syntax visual breaks.
// Parses on a 100ms interval instead of every token, so incomplete
// markdown (unclosed fences, half-written bold) is less likely to render.
function StreamingMarkdown({ text }: { text: string }) {
  const [html, setHtml] = useState('');
  const textRef = useRef(text);
  textRef.current = text;

  useEffect(() => {
    const tick = () => {
      try {
        setHtml(marked.parse(textRef.current, { async: false }) as string);
      } catch { /* keep last good render */ }
    };
    tick();
    const id = setInterval(tick, 100);
    return () => clearInterval(id);
  }, []);

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
    <div className={cn(sizeClasses, "flex items-center justify-center")}>
      <img
        src="/small-logo.png"
        alt="AI"
        className={cn(imgClasses, "object-contain")}
      />
    </div>
  );
}

// Chat message — iterates over message parts to render text + inline components
function ChatMessage({ message, isLast, isStreaming }: {
  message: Message;
  isLast: boolean;
  isStreaming?: boolean;
}) {
  const isUser = message.role === 'user';
  const textContent = getMessageText(message);
  const cleanContent = isUser ? textContent : (isStreaming ? textContent : removeThinkingPatterns(textContent));
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

  // Render assistant message parts: text + tool invocations
  const parts = message.parts && message.parts.length > 0 ? message.parts : [];

  return (
    <div className="mb-6">
      <div className="flex items-start gap-4">
        <div className="shrink-0 mt-1">
          <AIAvatar />
        </div>
        <div className="flex-1 min-w-0">
          {parts.map((part, idx) => {
            // Text part
            if (part.type === 'text' && typeof part.text === 'string' && part.text.trim()) {
              const text = isStreaming ? part.text : removeThinkingPatterns(part.text);
              if (isStreaming) {
                return (
                  <div key={idx} className="prose prose-sm prose-zinc dark:prose-invert max-w-none prose-p:leading-relaxed prose-pre:bg-zinc-900 prose-pre:border prose-pre:border-zinc-800 [&_.katex-display]:overflow-x-auto [&_.katex]:text-sm">
                    <StreamingMarkdown text={text} />
                  </div>
                );
              }
              return (
                <div key={idx} className="prose prose-sm prose-zinc dark:prose-invert max-w-none prose-p:leading-relaxed prose-pre:bg-zinc-900 prose-pre:border prose-pre:border-zinc-800 [&_.katex-display]:overflow-x-auto [&_.katex]:text-sm animate-in fade-in duration-300">
                  <Markdown text={text} />
                </div>
              );
            }

            // Tool invocation part — AI SDK v6 uses type "tool-{name}" for static tools
            // e.g. "tool-render_component", with output (not result) holding the return value
            const toolPart = part as any;
            if (
              (part.type === 'tool-render_component' || (part.type.startsWith('tool-') && toolPart.toolName === 'render_component'))
              && toolPart.state === 'output-available'
              && toolPart.output
            ) {
              const { component, props } = toolPart.output;
              return (
                <InlineChatComponent
                  key={idx}
                  componentType={component}
                  props={props}
                />
              );
            }

            // Other tool invocations (blockchain lookups etc) — don't render
            if (typeof part.type === 'string' && part.type.startsWith('tool-')) {
              return null;
            }

            return null;
          })}

          {/* Fallback: if no parts rendered text, show cleanContent */}
          {parts.length === 0 && cleanContent && (
            isStreaming ? (
              <div className="prose prose-sm prose-zinc dark:prose-invert max-w-none prose-p:leading-relaxed prose-pre:bg-zinc-900 prose-pre:border prose-pre:border-zinc-800 [&_.katex-display]:overflow-x-auto [&_.katex]:text-sm">
                <StreamingMarkdown text={cleanContent} />
              </div>
            ) : (
              <div className="prose prose-sm prose-zinc dark:prose-invert max-w-none prose-p:leading-relaxed prose-pre:bg-zinc-900 prose-pre:border prose-pre:border-zinc-800 [&_.katex-display]:overflow-x-auto [&_.katex]:text-sm animate-in fade-in duration-300">
                <Markdown text={cleanContent} />
              </div>
            )
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

// Chat input
function ChatInput({ suggestions, onSuggestionClick }: {
  suggestions?: string[];
  onSuggestionClick?: (q: string) => void;
}) {
  const { status, sendMessage, stop, error } = useChatContext();
  const [inputValue, setInputValue] = useState('');
  const [dismissedError, setDismissedError] = useState<Error | null>(null);
  const isLoading = status === 'streaming' || status === 'submitted';
  // Show error if not dismissed
  const visibleError = error && error !== dismissedError ? error : null;

  const onSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (inputValue.trim()) {
      posthog.capture('ai_chat_message_sent', {
        query_length: inputValue.length,
        query: inputValue.substring(0, 100),
        view: 'fullscreen',
      });
      sendMessage({ text: inputValue });
      setInputValue('');
    }
  };

  const hasSuggestions = suggestions && suggestions.length > 0 && !isLoading;

  return (
    <div className="w-full max-w-4xl mx-auto px-4 pb-4">
      {/* Follow-up suggestions */}
      {hasSuggestions && (
        <div className="flex flex-wrap gap-2 mb-3 justify-center animate-in fade-in slide-in-from-bottom-2 duration-300">
          {suggestions.map((q, i) => (
            <button
              key={i}
              type="button"
              onClick={() => onSuggestionClick?.(q)}
              className={cn(
                "px-3.5 py-2 text-[13px] rounded-full",
                "border border-zinc-200 dark:border-zinc-700",
                "text-muted-foreground hover:text-foreground",
                "hover:bg-zinc-100 dark:hover:bg-zinc-800",
                "hover:border-zinc-300 dark:hover:border-zinc-600",
                "transition-all duration-150",
              )}
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Error banner */}
      {visibleError && (
        <div className="flex items-center justify-between gap-3 mb-3 px-4 py-2.5 rounded-xl text-sm bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400">
          <span>
            {visibleError.message?.includes('413') || visibleError.message?.toLowerCase().includes('too long')
              ? 'Your message is too long. Please shorten it and try again.'
              : visibleError.message?.includes('429') || visibleError.message?.toLowerCase().includes('rate limit')
                ? "You've sent too many messages. Please wait a moment and try again."
                : 'Something went wrong. Please try again.'}
          </span>
          <button
            type="button"
            onClick={() => setDismissedError(error ?? null)}
            className="shrink-0 text-red-500 hover:text-red-700 dark:hover:text-red-300 transition-colors"
            aria-label="Dismiss error"
          >
            ✕
          </button>
        </div>
      )}

      <form onSubmit={onSubmit} className="relative">
        <div className={cn(
          "relative flex items-end rounded-2xl border transition-colors duration-200",
          "bg-zinc-50 dark:bg-zinc-800/80",
          "border-zinc-200 dark:border-zinc-700",
          "focus-within:border-zinc-400 dark:focus-within:border-zinc-500",
          "focus-within:bg-white dark:focus-within:bg-zinc-800",
        )}>
          <TextareaInput
            value={inputValue}
            placeholder="Ask anything about Avalanche..."
            className="w-full px-5 py-4 pr-16 text-sm"
            disabled={isLoading}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(event) => {
              if (!event.shiftKey && event.key === 'Enter') {
                onSubmit();
                event.preventDefault();
              }
            }}
          />
          <div className="absolute right-3 bottom-3">
            <button
              type={isLoading ? 'button' : 'submit'}
              onClick={isLoading ? stop : undefined}
              disabled={!isLoading && inputValue.length === 0}
              className={cn(
                "p-2 rounded-xl transition-all duration-150",
                isLoading
                  ? "bg-zinc-200 dark:bg-zinc-600 text-zinc-500 dark:text-zinc-300 hover:bg-zinc-300 dark:hover:bg-zinc-500"
                  : inputValue.length > 0
                    ? "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-200 shadow-sm"
                    : "bg-zinc-200 dark:bg-zinc-700 text-zinc-400 dark:text-zinc-500 cursor-not-allowed"
              )}
              title={isLoading ? "Stop generating" : "Send message"}
            >
              {isLoading ? <StopCircle className="w-5 h-5" /> : <ArrowUp className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </form>
      <p className="text-center text-xs text-muted-foreground/40 mt-2">
        Avalanche AI can make mistakes. Consider checking important information.
      </p>
    </div>
  );
}

// Chat actions (regenerate + share)
function ChatActions({ onShare, isShared }: { onShare?: () => void; isShared?: boolean }) {
  const { messages, status, setMessages, regenerate } = useChatContext();
  const isLoading = status === 'streaming';
  if (messages.length === 0) return null;

  return (
    <div className="flex items-center justify-center gap-3 py-2">
      {!isLoading && messages.at(-1)?.role === 'assistant' && (
        <>
          <button
            type="button"
            onClick={() => { posthog.capture('ai_chat_regenerate'); regenerate(); }}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            title="Regenerate response"
          >
            <RefreshCw className="w-4 h-4" />
            Regenerate
          </button>
          {onShare && (
            <>
              <span className="text-muted-foreground/30">|</span>
              <button
                type="button"
                onClick={onShare}
                className={cn(
                  "flex items-center gap-1.5 text-sm transition-colors",
                  isShared
                    ? "text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300"
                    : "text-muted-foreground hover:text-foreground"
                )}
                title={isShared ? "Manage sharing" : "Share conversation"}
              >
                <Share2 className="w-4 h-4" />
                {isShared ? "Shared" : "Share"}
              </button>
            </>
          )}
        </>
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
  onLogin,
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
  onLogin: () => void;
  isLoadingConversations: boolean;
}) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 top-14 bg-black/30 z-40 lg:hidden"
          onClick={onToggle}
        />
      )}

      {/* Sidebar */}
      <div className={cn(
        "fixed lg:relative top-14 lg:top-0 bottom-0 left-0 z-50 lg:z-auto",
        "bg-sidebar border-r border-sidebar-border flex flex-col transition-all duration-200 ease-in-out",
        isOpen
          ? "w-64 translate-x-0"
          : "w-[52px] -translate-x-full lg:translate-x-0"
      )}>
        {/* Top section - Toggle + New Chat */}
        <div className="p-1.5 space-y-1">
          {/* Toggle button */}
          <button
            onClick={onToggle}
            className={cn(
              "w-full h-10 flex items-center rounded-lg hover:bg-sidebar-accent transition-colors",
              isOpen ? "px-3 gap-3" : "justify-center"
            )}
            title={isOpen ? "Close sidebar" : "Open sidebar"}
          >
            {isOpen ? <PanelLeftClose className="w-5 h-5 text-muted-foreground" /> : <PanelLeft className="w-5 h-5 text-muted-foreground" />}
            {isOpen && <span className="text-sm text-muted-foreground">Close</span>}
          </button>

          {/* New chat button */}
          <button
            onClick={onNewChat}
            className={cn(
              "w-full h-10 flex items-center rounded-lg border border-border hover:bg-sidebar-accent transition-colors",
              isOpen ? "px-3 gap-3" : "justify-center"
            )}
            title="New chat"
          >
            <Plus className="w-5 h-5 text-sidebar-foreground" />
            {isOpen && <span className="text-sm text-sidebar-foreground font-medium">New chat</span>}
          </button>
        </div>

        {/* Middle section - Conversations or quick icons */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          {isOpen ? (
            // Expanded: show conversation list
            <div className="px-1.5">
              {isLoadingConversations ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : !isAuthenticated ? (
                <div className="text-center py-8 px-2">
                  <p className="text-muted-foreground text-sm mb-3">Sign in to save chats</p>
                  <button
                    onClick={onLogin}
                    className="px-4 py-2 text-sm font-medium rounded-lg bg-sidebar-accent text-sidebar-accent-foreground hover:bg-accent transition-colors"
                  >
                    Sign In
                  </button>
                </div>
              ) : conversations.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
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
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "hover:bg-sidebar-accent/50"
                      )}
                      onClick={() => editingId !== conv.id && onSelectConversation(conv.id)}
                    >
                      <MessageSquare className="w-5 h-5 shrink-0 text-muted-foreground" />
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
                          className="flex-1 bg-transparent text-sm text-sidebar-foreground border-b border-border focus:outline-none focus:border-ring"
                        />
                      ) : (
                        <span className="flex-1 truncate text-sm text-sidebar-foreground">{conv.title}</span>
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
                            className="p-1 rounded hover:bg-sidebar-accent transition-colors"
                            title="Rename"
                          >
                            <Pencil className="w-4 h-4 text-muted-foreground hover:text-sidebar-foreground" />
                          </button>
                          <ShareButton
                            isShared={conv.isShared}
                            onClick={() => onShareConversation(conv)}
                          />
                          <button
                            onClick={(e) => { e.stopPropagation(); onDeleteConversation(conv.id); }}
                            className="p-1 rounded hover:bg-sidebar-accent transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4 text-muted-foreground hover:text-red-400" />
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
                className="w-full h-10 flex items-center justify-center rounded-lg hover:bg-sidebar-accent transition-colors"
                title="Chat history"
              >
                <MessageSquare className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
          )}
        </div>

        {/* Bottom border for visual closure */}
        <div className="border-t border-sidebar-border p-1.5" />
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

  // Auth state
  const { data: session, status: authStatus } = useSession();
  const isAuthenticated = authStatus === 'authenticated';
  const { openLoginModal } = useLoginModalTrigger();

  // Share modal state
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareModalConversation, setShareModalConversation] = useState<Conversation | null>(null);

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

  const currentConversation = conversations.find(c => c.id === currentConversationId);

  const chat = useChat({
    id: currentConversationId || 'new',
    onError(error) {
      console.error('Chat error:', error.message, error);
      // Error is automatically exposed via chat.error and displayed in ChatInput
    },
    async onFinish({ message }) {
      const messageText = getMessageText(message);
      posthog.capture('ai_chat_response_received', {
        response_length: messageText.length,
        view: 'fullscreen',
      });

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

  // Restore conversation from chat bubble if present
  useEffect(() => {
    const stored = sessionStorage.getItem('chat-bubble-messages');
    if (stored && messages.length === 0 && !currentConversationId) {
      try {
        const bubbleMessages = JSON.parse(stored);
        if (Array.isArray(bubbleMessages) && bubbleMessages.length > 0) {
          chat.setMessages(bubbleMessages);
        }
      } catch { /* ignore malformed data */ }
      sessionStorage.removeItem('chat-bubble-messages');
    }
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

  // Extract follow-up suggestions from the last assistant message
  const followUpSuggestions = useMemo(() => {
    const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant');
    if (!lastAssistant?.parts || isLoading || isWaitingForStream) return [];
    for (const part of lastAssistant.parts) {
      const p = part as any;
      if (
        (part.type === 'tool-suggest_followups' || (typeof part.type === 'string' && part.type.startsWith('tool-') && p.toolName === 'suggest_followups'))
        && p.state === 'output-available'
        && p.output?.questions
      ) {
        return p.output.questions as string[];
      }
    }
    return [];
  }, [messages, isLoading, isWaitingForStream]);

  return (
    <ChatContext value={chat}>
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
          onLogin={handleLogin}
          isLoadingConversations={isLoadingConversations}
        />

        {/* Main content area */}
        <div className="flex-1 flex flex-col min-w-0 relative">
            {/* Mobile sidebar toggle — floats over content */}
            {!sidebarOpen && (
              <button
                onClick={() => setSidebarOpen(true)}
                className="absolute top-3 left-3 z-10 p-2 rounded-lg hover:bg-accent/80 backdrop-blur-sm transition-colors lg:hidden"
                title="Open sidebar"
              >
                <PanelLeft className="w-5 h-5" />
              </button>
            )}

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
                      />
                    ))}
                    {(isLoading || isWaitingForStream) && messages[messages.length - 1]?.role === 'user' && <TypingIndicator />}
                    <ChatActions
                      isShared={currentConversation?.isShared}
                      onShare={async () => {
                        if (!isAuthenticated) {
                          openLoginModal(window.location.href);
                          return;
                        }
                        if (currentConversation) {
                          handleShareConversation(currentConversation);
                          return;
                        }
                        // Save first if no conversation exists yet
                        const titleText = getMessageText(messages[0]);
                        const title = titleText.slice(0, 50) || 'New chat';
                        const saved = await saveConversation({
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
                        });
                        if (saved) {
                          setCurrentConversationId(saved.id);
                          handleShareConversation(saved);
                        }
                      }}
                    />
                  </div>
                </MessageList>
              )}
            </main>

            {/* Input */}
            <div className="shrink-0 pt-2 pb-4 bg-gradient-to-t from-background via-background to-transparent">
              <ChatInput
                suggestions={followUpSuggestions}
                onSuggestionClick={handleSuggestionClick}
              />
            </div>
        </div>
      </div>
    </ChatContext>
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
