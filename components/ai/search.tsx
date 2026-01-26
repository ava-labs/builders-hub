'use client';
import {
  Children,
  type ComponentProps,
  createContext,
  type FormHTMLAttributes,
  type HTMLAttributes,
  type ReactElement,
  type ReactNode,
  type TextareaHTMLAttributes,
  use,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Loader2, RefreshCw, Send, X, User, Bot, Sparkles, StopCircle, HelpCircle, ChevronRight, Maximize2, Minimize2, ArrowRight } from 'lucide-react';
import defaultMdxComponents from 'fumadocs-ui/mdx';
import { cn } from '../../lib/cn';
import { buttonVariants } from '../ui/button';
import { createProcessor, type Processor } from './markdown-processor';
import { MessageFeedback } from './feedback';
import { EmbeddedPanel, EmbeddedLinkNav, extractEmbeddableLinks, type EmbeddedReference } from './embedded-panel';
import Link from 'fumadocs-core/link';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogOverlay,
  DialogPortal,
  type DialogProps,
  DialogTitle,
} from '@radix-ui/react-dialog';
import { type UIMessage, useChat, type UseChatHelpers } from '@ai-sdk/react';

// Type alias for backward compatibility
type Message = UIMessage;
import { DynamicCodeBlock } from 'fumadocs-ui/components/dynamic-codeblock';
import dynamic from 'next/dynamic';
import { useIsMobile } from '../../hooks/use-mobile';
import React from 'react';
import 'katex/dist/katex.min.css';
import posthog from 'posthog-js';

const Mermaid = dynamic(() => import('@/components/content-design/mermaid'), {
  ssr: false,
});

const ChatContext = createContext<UseChatHelpers<Message> | null>(null);
function useChatContext() {
  return use(ChatContext)!;
}

function SearchAIActions() {
  const { messages, status, setMessages, regenerate } = useChatContext();
  const isLoading = status === 'streaming';

  if (messages.length === 0) return null;
  return (
    <div className="flex items-center justify-center gap-2 py-4 border-t border-fd-border/50">
      {!isLoading && messages.at(-1)?.role === 'assistant' && (
        <button
          type="button"
          className={cn(
            buttonVariants({
              variant: 'ghost',
              size: 'sm',
            }),
            'text-fd-muted-foreground hover:text-fd-foreground gap-1.5',
          )}
          onClick={() => {
            posthog.capture('ai_chat_regenerate', {
              message_count: messages.length,
            });
            regenerate();
          }}
        >
          <RefreshCw className="size-3.5" />
          Regenerate
        </button>
      )}
      <button
        type="button"
        className={cn(
          buttonVariants({
            variant: 'ghost',
            size: 'sm',
          }),
          'text-fd-muted-foreground hover:text-fd-foreground',
        )}
        onClick={() => {
          posthog.capture('ai_chat_cleared', {
            message_count: messages.length,
          });
          setMessages([]);
        }}
      >
        Clear Chat
      </button>
    </div>
  );
}

function SearchAIInput(props: FormHTMLAttributes<HTMLFormElement>) {
  const { status, sendMessage, stop } = useChatContext();
  const [inputValue, setInputValue] = useState('');
  const isLoading = status === 'streaming' || status === 'submitted';

  const onStart = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (inputValue.trim()) {
      posthog.capture('ai_chat_message_sent', {
        query_length: inputValue.length,
        query: inputValue.substring(0, 100), // First 100 chars for privacy
      });
      sendMessage({ text: inputValue });
      setInputValue('');
    }
  };

  useEffect(() => {
    if (isLoading) document.getElementById('nd-ai-input')?.focus();
  }, [isLoading]);

  return (
    <form
      {...props}
      className={cn(
        'w-full flex items-center gap-3 px-6 pb-6 pt-4 border-t border-border/20',
        props.className,
      )}
      onSubmit={onStart}
    >
      <div className="flex-1 relative flex items-end bg-transparent border-0 group w-full">
        <Input
          value={inputValue}
          placeholder="Ask anything..."
          className="w-full px-4 py-4 text-lg bg-transparent border-b border-border/20 focus:border-blue-500/50 rounded-none transition-all min-h-[50px] placeholder:text-muted-foreground/30 resize-none"
          disabled={status === 'streaming' || status === 'submitted'}
          onChange={(e) => {
            setInputValue(e.target.value);
          }}
          onKeyDown={(event) => {
            if (!event.shiftKey && event.key === 'Enter') {
              onStart();
              event.preventDefault();
            }
          }}
        />
        <button
          type={isLoading ? 'button' : 'submit'}
          className={cn(
            'absolute right-2 bottom-3 p-2 rounded-full transition-all shrink-0',
            isLoading
              ? 'bg-transparent text-muted-foreground'
              : inputValue.length > 0
                ? 'bg-blue-600 text-white hover:bg-blue-700 hover:scale-110 shadow-lg shadow-blue-500/20'
                : 'text-muted-foreground/30 cursor-not-allowed',
          )}
          disabled={!isLoading && inputValue.length === 0}
          onClick={isLoading ? stop : undefined}
        >
          {isLoading ? (
            <StopCircle className="size-5" />
          ) : (
            <Send className="size-5" />
          )}
        </button>
      </div>
    </form>
  );
}

function List(props: Omit<HTMLAttributes<HTMLDivElement>, 'dir'>) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    function callback() {
      const container = containerRef.current;
      if (!container) return;

      container.scrollTo({
        top: container.scrollHeight,
        behavior: 'smooth',
      });
    }

    const observer = new ResizeObserver(callback);
    callback();

    const element = containerRef.current?.firstElementChild;

    if (element) {
      observer.observe(element);
    }

    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      {...props}
      className={cn(
        'fd-scroll-container overflow-y-auto flex-1 min-h-0',
        props.className,
      )}
    >
      {props.children}
    </div>
  );
}

function Input(props: TextareaHTMLAttributes<HTMLTextAreaElement> & { className?: string }) {
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
      id="nd-ai-input"
      className={cn(
        'flex-1 resize-none bg-transparent px-4 py-3',
        'placeholder:text-fd-muted-foreground focus:outline-none',
        'min-h-[48px] max-h-[200px] leading-relaxed',
        props.className,
      )}
      rows={1}
      {...props}
    />
  );
}

let processor: Processor | undefined;
const map = new Map<string, ReactNode>();

function parseFollowUpQuestions(content: string): string[] {
  if (!content) return [];

  const match = content.match(/---FOLLOW-UP-QUESTIONS---([\s\S]*?)---END-FOLLOW-UP-QUESTIONS---/);
  if (!match) return [];

  const questionsText = match[1].trim();
  const questions = questionsText
    .split('\n')
    .map(line => line.replace(/^\d+\.\s*/, '').trim())
    .filter(q => q.length > 0);

  return questions;
}

function removeFollowUpQuestions(content: string): string {
  if (!content) return '';

  // Remove the follow-up questions section and any trailing whitespace
  // Also handle partial matches during streaming
  let cleaned = content
    .replace(/---FOLLOW-UP-QUESTIONS---[\s\S]*?---END-FOLLOW-UP-QUESTIONS---/g, '')
    .replace(/---FOLLOW-UP-QUESTIONS---[\s\S]*$/g, '') // Remove incomplete section at end
    .trim();

  return cleaned;
}

function SuggestedFollowUps({ questions, onQuestionClick }: {
  questions: string[];
  onQuestionClick: (question: string) => void;
}) {
  if (questions.length === 0) return null;

  return (
    <div className="px-6 py-3 space-y-3 animate-in fade-in duration-300 slide-in-from-bottom-2">
      <p className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-widest">
        Suggested
      </p>
      <div className="flex flex-wrap gap-2">
        {questions.map((question, index) => (
          <button
            key={index}
            onClick={() => onQuestionClick(question)}
            className={cn(
              "px-4 py-2 text-xs font-medium rounded-full",
              "bg-slate-100 dark:bg-zinc-900 text-muted-foreground",
              "hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 dark:hover:text-blue-400",
              "transition-all duration-200 border border-transparent hover:border-blue-200 dark:hover:border-blue-800"
            )}
          >
            {question}
          </button>
        ))}
      </div>
    </div>
  );
}

function Message({ message, isLast, onFollowUpClick, isStreaming, onRefSelect }: {
  message: Message;
  isLast: boolean;
  onFollowUpClick: (question: string) => void;
  isStreaming?: boolean;
  onRefSelect?: (ref: EmbeddedReference) => void;
}) {
  const isUser = message.role === 'user';
  const isMobile = useIsMobile();

  // Extract text from message (v6 uses parts array, not content)
  const messageContent = 'parts' in message
    ? message.parts
        .filter((p: any): p is { type: 'text'; text: string } => p.type === 'text')
        .map((p: any) => p.text)
        .join('')
    : (message as any).content || '';

  // Parse content immediately
  const cleanContent = isUser ? messageContent : removeFollowUpQuestions(messageContent);
  const followUpQuestions = isUser ? [] : parseFollowUpQuestions(messageContent);

  // Extract embeddable links from this message
  const embeddableLinks = isUser ? [] : extractEmbeddableLinks(messageContent);

  if (isUser) {
    // User message - right aligned
    return (
      <div className="flex justify-end px-6 py-4">
        <div className="max-w-[80%] space-y-2">
          <div className="bg-blue-600 text-white rounded-2xl rounded-tr-sm px-4 py-3 shadow-sm">
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{cleanContent}</p>
          </div>
        </div>
      </div>
    );
  }

  // AI message - left aligned
  return (
    <div className="px-6 py-4">
      <div className="max-w-[95%] space-y-4">
        <div className="flex items-start gap-4">
          <div className="flex-1 min-w-0">
            <div className="prose prose-sm max-w-none dark:prose-invert [&_.katex-display]:overflow-x-auto [&_.katex-display]:overflow-y-hidden [&_.katex]:text-sm [&_.katex-display]:my-4">
              <Markdown text={cleanContent} />
            </div>

            {/* Show clickable links to embedded content - desktop only */}
            {embeddableLinks.length > 0 && !isMobile && onRefSelect && (
              <div className="mt-4 flex flex-wrap gap-2">
                <p className="text-xs text-muted-foreground w-full mb-1">Referenced pages:</p>
                {embeddableLinks.map((link, idx) => (
                  <button
                    key={idx}
                    onClick={() => onRefSelect(link)}
                    className={cn(
                      "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs",
                      "bg-slate-100 dark:bg-zinc-900 hover:bg-slate-200 dark:hover:bg-zinc-800 rounded-md",
                      "border border-border/40 hover:border-blue-500/30",
                      "transition-all duration-200"
                    )}
                  >
                    <ChevronRight className="size-3" />
                    {link.title || link.url}
                  </button>
                ))}
              </div>
            )}

            {/* Feedback buttons - show after streaming completes */}
            {!isStreaming && (
              <MessageFeedback
                messageId={message.id}
                className="mt-4"
              />
            )}
          </div>
        </div>

        {/* Show follow-up suggestions only for the last assistant message and not while streaming */}
        {isLast && !isStreaming && followUpQuestions.length > 0 && (
          <SuggestedFollowUps
            questions={followUpQuestions}
            onQuestionClick={onFollowUpClick}
          />
        )}
      </div>
    </div>
  );
}

function Pre(props: ComponentProps<'pre'>) {
  const code = Children.only(props.children) as ReactElement;
  const codeProps = code.props as ComponentProps<'code'>;

  let lang =
    codeProps.className
      ?.split(' ')
      .find((v) => v.startsWith('language-'))
      ?.slice('language-'.length) ?? 'text';

  if (lang === 'mdx') lang = 'md';

  // Handle Mermaid diagrams specially
  if (lang === 'mermaid') {
    return <Mermaid chart={(codeProps.children ?? '') as string} />;
  }

  return (
    <DynamicCodeBlock lang={lang} code={(codeProps.children ?? '') as string} />
  );
}

function Markdown({ text }: { text: string }) {
  const [rendered, setRendered] = useState<ReactNode>(null);

  useEffect(() => {
    let aborted = false;
    async function run() {
      let result = map.get(text);
      if (!result && text) {
        processor ??= createProcessor();

        result = await processor
          .process(text, {
            ...defaultMdxComponents,
            pre: Pre,
            a: Link,
            img: undefined,
          })
          .catch(() => text);

        map.set(text, result);
      }

      if (!aborted && result) {
        setRendered(result);
      }
    }

    void run();
    return () => {
      aborted = true;
    };
  }, [text]);

  return <>{rendered || text}</>;
}

export default function AISearch(props: DialogProps & { onToolSelect?: (toolId: string) => void }) {
  const [embeddedRef, setEmbeddedRef] = useState<EmbeddedReference | null>(null);
  const [detectedLinks, setDetectedLinks] = useState<EmbeddedReference[]>([]);
  const [currentLinkIndex, setCurrentLinkIndex] = useState(0);
  const [closedRefs, setClosedRefs] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'big' | 'small'>('big');
  const isMobile = useIsMobile();

  // Handle reference selection (from link click or auto-detect)
  const handleRefSelect = (ref: EmbeddedReference) => {
    if (!isMobile) {
      setEmbeddedRef(ref);
      // Find and set the current index
      const index = detectedLinks.findIndex(l => l.url === ref.url);
      if (index !== -1) setCurrentLinkIndex(index);
    }
  };

  // Handle closing the panel
  const handleClosePanel = () => {
    if (embeddedRef) {
      setClosedRefs(prev => new Set(prev).add(embeddedRef.url));
    }
    setEmbeddedRef(null);
  };

  // Handle new links detected from AI response
  const handleLinksDetected = (links: EmbeddedReference[]) => {
    if (links.length === 0) return;

    setDetectedLinks(links);

    // Auto-open the first link if not already closed
    const firstLink = links[0];
    if (!closedRefs.has(firstLink.url) && !isMobile) {
      setEmbeddedRef(firstLink);
      setCurrentLinkIndex(0);
    }
  };

  // Handle navigation between links
  const handleLinkNavigation = (index: number) => {
    if (detectedLinks[index]) {
      setCurrentLinkIndex(index);
      setEmbeddedRef(detectedLinks[index]);
    }
  };

  return (
    <Dialog {...props}>
      {props.children}
      <DialogPortal>
        {viewMode === 'small' ? (
          // Small view - positioned near the chatbot button
          <>
            <DialogContent
              onOpenAutoFocus={(e) => {
                document.getElementById('nd-ai-input')?.focus();
                e.preventDefault();
              }}
              aria-describedby={undefined}
              className={cn(
                "fixed bottom-24 right-4 z-50",
                "w-[380px] h-[600px] max-h-[80vh]",
                "focus-visible:outline-none data-[state=closed]:animate-fd-fade-out data-[state=open]:animate-fd-fade-in",
                "transition-all duration-300"
              )}
            >
              <div className="flex h-full bg-slate-50/80 dark:bg-zinc-950/80 backdrop-blur-xl rounded-2xl border border-border/40 shadow-2xl overflow-hidden flex-col">
                <SmallViewContent
                  onExpand={() => setViewMode('big')}
                />
              </div>
            </DialogContent>
          </>
        ) : (
          // Big view - current implementation
          <>
            <DialogOverlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm data-[state=closed]:animate-fd-fade-out data-[state=open]:animate-fd-fade-in" />
            <DialogContent
              onOpenAutoFocus={(e) => {
                document.getElementById('nd-ai-input')?.focus();
                e.preventDefault();
              }}
              aria-describedby={undefined}
              className={cn(
                "fixed inset-4 md:inset-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 z-50",
                embeddedRef && !isMobile ? "md:max-w-[1600px] md:w-[95vw]" : "md:max-w-5xl md:w-[90vw]",
                "md:h-[85vh] max-h-[90vh] focus-visible:outline-none data-[state=closed]:animate-fd-fade-out data-[state=open]:animate-fd-fade-in transition-all duration-300"
              )}
            >
              <div className="flex h-full bg-slate-50/80 dark:bg-zinc-950/80 backdrop-blur-xl rounded-2xl border border-border/40 shadow-2xl overflow-hidden">
                {/* Desktop view - side by side */}
                <div className={cn(
                  "hidden md:flex md:flex-col",
                  embeddedRef ? "md:w-[40%] md:border-r md:border-fd-border" : "md:w-full"
                )}>
                  <Content
                    onRefSelect={handleRefSelect}
                    onLinksDetected={handleLinksDetected}
                    onCollapse={() => setViewMode('small')}
                  />
                </div>

                {/* Embedded panel - desktop only */}
                {embeddedRef && !isMobile && (
                  <div className="hidden md:flex md:flex-col md:w-[60%]">
                    {detectedLinks.length > 1 && (
                      <EmbeddedLinkNav
                        links={detectedLinks}
                        currentIndex={currentLinkIndex}
                        onSelect={handleLinkNavigation}
                      />
                    )}
                    <EmbeddedPanel
                      reference={embeddedRef}
                      onClose={handleClosePanel}
                      className="flex-1"
                    />
                  </div>
                )}

                {/* Mobile view - chat only */}
                <div className="flex md:hidden flex-col w-full">
                  <Content onCollapse={() => setViewMode('small')} />
                </div>
              </div>
            </DialogContent>
          </>
        )}
      </DialogPortal>
    </Dialog>
  );
}

// Helper to extract text content from AI SDK v6 message
// In v6, messages have 'parts' array instead of 'content'
function getMessageText(message: Message | any): string {
  // Handle direct UIMessage
  if (message && typeof message === 'object') {
    // Check if it's a UIMessage with parts
    if ('parts' in message) {
      return message.parts
        .filter((p: any): p is { type: 'text'; text: string } => p.type === 'text')
        .map((p: any) => p.text)
        .join('');
    }
    // Legacy content field
    if ('content' in message && typeof message.content === 'string') {
      return message.content;
    }
  }
  if (typeof message === 'string') return message;
  return '';
}

function SmallViewContent({ onExpand }: { onExpand: () => void }) {
  const chat = useChat({
    id: 'search',
    onError(error) {
      console.error('Chat error:', error);
    },
    onFinish({ message }) {
      const messageText = getMessageText(message);
      posthog.capture('ai_chat_response_received', {
        response_length: messageText.length,
        message_count: chat.messages.length + 1,
        view: 'small',
      });
    },
  });

  const messages = chat.messages.filter((msg) => msg.role !== 'system');
  const { status } = chat;

  // Track chat opened in small view
  useEffect(() => {
    posthog.capture('ai_chat_opened', {
      view: 'small',
    });
  }, []);

  return (
    <ChatContext value={chat}>
      <div className="flex items-center justify-between border-b border-fd-border px-4 py-3">
        <div className="flex items-center gap-3">
          <img 
            src="/avax-gpt.png" 
            alt="AI" 
            className="size-6 object-contain dark:invert"
          />
          <DialogTitle className="text-sm font-semibold">AI Assistant</DialogTitle>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              posthog.capture('ai_chat_expanded');
              onExpand();
            }}
            className={cn(
              buttonVariants({ size: 'icon', variant: 'ghost' }),
              'size-7 rounded-md',
            )}
            aria-label="Expand to full view"
          >
            <Maximize2 className="size-3.5" />
          </button>
          <DialogClose
            aria-label="Close"
            className={cn(
              buttonVariants({ size: 'icon', variant: 'ghost' }),
              'size-7 rounded-md',
            )}
          >
            <X className="size-3.5" />
          </DialogClose>
        </div>
      </div>

      <List className="flex-1">
        {messages.length === 0 ? (
              <div className="flex h-full items-center justify-center p-6">
                <div className="text-center space-y-4">
                  <img 
                    src="/avax-gpt.png" 
                    alt="AI" 
                    className="mx-auto size-12 object-contain mb-4 dark:invert"
                  />
                  <h3 className="text-sm font-medium">How can I help?</h3>
                  <p className="text-xs text-fd-muted-foreground">
                    Ask me anything about Avalanche
                  </p>
                </div>
              </div>
        ) : (
          <div className="space-y-2">
            {messages.map((item, index) => (
              <Message
                key={item.id}
                message={item}
                isLast={index === messages.length - 1}
                onFollowUpClick={async (question) => {
                  posthog.capture('ai_chat_followup_clicked', {
                    question: question,
                  });
                  await chat.sendMessage({ text: question });
                }}
                isStreaming={status === 'streaming' && index === messages.length - 1 && item.role === 'assistant'}
              />
            ))}
            {status === 'streaming' && messages[messages.length - 1]?.role === 'user' && (
              <div className="flex px-6 py-4">
                <div className="max-w-[85%] space-y-2">
                  <div className="flex items-center gap-2 mb-1">
                    <img 
                      src="/avax-gpt.png" 
                      alt="AI" 
                      className="size-7 object-contain dark:invert"
                    />
                    <p className="text-xs font-medium text-muted-foreground">AI Assistant</p>
                  </div>
                  <div className="bg-slate-100 dark:bg-zinc-900 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <div className="flex gap-1">
                        <span className="size-2 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:-0.3s]"></span>
                        <span className="size-2 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:-0.15s]"></span>
                        <span className="size-2 rounded-full bg-muted-foreground/50 animate-bounce"></span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
        {messages.length > 0 && <SearchAIActions />}
      </List>

      <SearchAIInput className="px-3 pb-3 pt-2" />

      <div className="px-3 py-2 text-center">
        <p className="text-[10px] text-fd-muted-foreground">
          Powered by OpenAI • Responses may be inaccurate
        </p>
      </div>
    </ChatContext>
  );
}

function Content({ onRefSelect, onLinksDetected, onCollapse }: {
  onRefSelect?: (ref: EmbeddedReference) => void;
  onLinksDetected?: (links: EmbeddedReference[]) => void;
  onCollapse?: () => void;
}) {
  const chat = useChat({
    id: 'search',
    onError(error) {
      console.error('Chat error:', error);
    },
    onFinish({ message }) {
      const messageText = getMessageText(message);
      // Track when AI response is complete
      posthog.capture('ai_chat_response_received', {
        response_length: messageText.length,
        message_count: chat.messages.length + 1,
      });

      // Detect embeddable links in the response
      const links = extractEmbeddableLinks(messageText);
      if (links.length > 0 && onLinksDetected) {
        onLinksDetected(links);
      }
    },
  });

  const messages = chat.messages.filter((msg) => msg.role !== 'system');
  const { status, sendMessage } = chat;
  const isLoading = status === 'streaming';

  // Track chat opened
  useEffect(() => {
    posthog.capture('ai_chat_opened', {
      view: 'full',
    });
  }, []);

  const suggestedQuestions = [
    "How do I create a custom L1?",
    "How do I setup a block explorer for my L1?",
    "How do I setup a node?",
    "Where can I get testnet AVAX?",
    "Explain Avalanche's consensus mechanism",
    "What is the primary network?",
    "How do I setup ICTT?",
  ];

  const handleSuggestionClick = async (question: string) => {
    posthog.capture('ai_chat_suggested_question_clicked', {
      question: question,
    });
    await sendMessage({ text: question });
  };

  return (
    <ChatContext value={chat}>
      <div className="flex items-center justify-between border-b border-fd-border px-4 py-3">
        <div className="flex items-center gap-3">
          <img 
            src="/avax-gpt.png" 
            alt="AI" 
            className="size-7 object-contain dark:invert"
          />
          <DialogTitle className="text-lg font-semibold">AI Assistant</DialogTitle>
        </div>
        <div className="flex items-center gap-1">
          {onCollapse && (
            <button
              onClick={() => {
                posthog.capture('ai_chat_collapsed');
                onCollapse();
              }}
              className={cn(
                buttonVariants({ size: 'icon', variant: 'ghost' }),
                'size-8 rounded-md',
              )}
              aria-label="Collapse to small view"
            >
              <Minimize2 className="size-4" />
            </button>
          )}
          <DialogClose
            aria-label="Close"
            className={cn(
              buttonVariants({ size: 'icon', variant: 'ghost' }),
              'size-8 rounded-md',
            )}
          >
            <X className="size-4" />
          </DialogClose>
        </div>
      </div>

      <List className="flex-1">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center p-8">
            <div className="text-center space-y-6 max-w-2xl">
              <div className="space-y-4">
                <img 
                  src="/avax-gpt.png" 
                  alt="AI" 
                  className="mx-auto size-16 object-contain mb-6 dark:invert"
                />
                <h3 className="text-lg font-medium">How can I help you today?</h3>
                <p className="text-sm text-fd-muted-foreground">
                  Ask me anything about the documentation or get help with your code.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-12 max-w-3xl mx-auto">
                {suggestedQuestions.map((question, index) => (
                  <button
                    key={index}
                    onClick={() => handleSuggestionClick(question)}
                    className={cn(
                      "group flex items-center justify-between w-full px-4 py-3 rounded-xl",
                      "bg-transparent hover:bg-slate-100/50 dark:hover:bg-zinc-900/50",
                      "transition-all duration-300 ease-out",
                      "text-left text-sm text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <span className="font-medium">{question}</span>
                    <ArrowRight className="size-4 opacity-0 -translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 text-blue-500" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {messages.map((item, index) => (
              <Message
                key={item.id}
                message={item}
                isLast={index === messages.length - 1}
                onFollowUpClick={handleSuggestionClick}
                isStreaming={isLoading && index === messages.length - 1 && item.role === 'assistant'}
                onRefSelect={onRefSelect}
              />
            ))}
            {isLoading && messages[messages.length - 1]?.role === 'user' && (
              <div className="flex px-6 py-4">
                <div className="max-w-[85%] space-y-2">
                  <div className="flex items-center gap-2 mb-1">
                    <img 
                      src="/avax-gpt.png" 
                      alt="AI" 
                      className="size-7 object-contain dark:invert"
                    />
                    <p className="text-xs font-medium text-muted-foreground">AI Assistant</p>
                  </div>
                  <div className="bg-slate-100 dark:bg-zinc-900 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <div className="flex gap-1">
                        <span className="size-2 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:-0.3s]"></span>
                        <span className="size-2 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:-0.15s]"></span>
                        <span className="size-2 rounded-full bg-muted-foreground/50 animate-bounce"></span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
        {messages.length > 0 && <SearchAIActions />}
      </List>

      <SearchAIInput />

      <div className="px-4 py-2 text-center">
        <p className="text-xs text-fd-muted-foreground">
          Powered by OpenAI • Responses may be inaccurate
        </p>
      </div>
    </ChatContext>
  );
}
