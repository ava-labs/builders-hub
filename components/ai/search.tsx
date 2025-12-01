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
import { type Message, useChat, type UseChatHelpers } from '@ai-sdk/react';
import { DynamicCodeBlock } from 'fumadocs-ui/components/dynamic-codeblock';
import dynamic from 'next/dynamic';
import { useIsMobile } from '../../hooks/use-mobile';
import React from 'react';
import 'katex/dist/katex.min.css';

const Mermaid = dynamic(() => import('@/components/content-design/mermaid'), {
  ssr: false,
});

const ChatContext = createContext<UseChatHelpers | null>(null);
function useChatContext() {
  return use(ChatContext)!;
}

function SearchAIActions() {
  const { messages, status, setMessages, reload } = useChatContext();
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
          onClick={() => reload()}
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
        onClick={() => setMessages([])}
      >
        Clear Chat
      </button>
    </div>
  );
}

function SearchAIInput(props: FormHTMLAttributes<HTMLFormElement>) {
  const { status, input, setInput, handleSubmit, stop } = useChatContext();
  const isLoading = status === 'streaming' || status === 'submitted';
  const onStart = (e?: React.FormEvent) => {
    e?.preventDefault();
    handleSubmit(e);
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
          value={input}
          placeholder="Ask anything..."
          className="w-full px-4 py-4 text-lg bg-transparent border-b border-border/20 focus:border-blue-500/50 rounded-none transition-all min-h-[50px] placeholder:text-muted-foreground/30 resize-none"
          disabled={status === 'streaming' || status === 'submitted'}
          onChange={(e) => {
            setInput(e.target.value);
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
              : input.length > 0
                ? 'bg-blue-600 text-white hover:bg-blue-700 hover:scale-110 shadow-lg shadow-blue-500/20'
                : 'text-muted-foreground/30 cursor-not-allowed',
          )}
          disabled={!isLoading && input.length === 0}
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

function Message({ message, isLast, onFollowUpClick, isStreaming, onToolReference }: {
  message: Message;
  isLast: boolean;
  onFollowUpClick: (question: string) => void;
  isStreaming?: boolean;
  onToolReference?: (toolId: string) => void;
}) {
  const isUser = message.role === 'user';
  const isMobile = useIsMobile();

  // Parse content immediately - this should happen synchronously
  const cleanContent = isUser ? message.content : removeFollowUpQuestions(message.content);
  const followUpQuestions = isUser ? [] : parseFollowUpQuestions(message.content);

  // Extract tool references from AI responses - only on desktop
  const [detectedTools, setDetectedTools] = useState<string[]>([]);
  const [hasAutoOpened, setHasAutoOpened] = useState(false);

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
          {/* <img 
            src="/avax-gpt.png" 
            alt="AI" 
            className="size-8 object-contain mt-1 shrink-0"
          /> */}
          <div className="flex-1 min-w-0">
            {/* <p className="text-sm font-semibold text-foreground mb-2">AI Assistant</p> */}
            <div className="prose prose-sm max-w-none dark:prose-invert [&_.katex-display]:overflow-x-auto [&_.katex-display]:overflow-y-hidden [&_.katex]:text-sm [&_.katex-display]:my-4">
              <Markdown text={cleanContent} onToolClick={isMobile ? undefined : onToolReference} />
            </div>

            {/* Show all tools referenced */}
            {detectedTools.length > 0 && !isMobile && onToolReference && (
              <div className="mt-4 flex flex-wrap gap-2">
                <p className="text-xs text-muted-foreground w-full mb-1">Tools referenced:</p>
                {detectedTools.map((toolId) => (
                  <button
                    key={toolId}
                    onClick={() => onToolReference(toolId)}
                    className={cn(
                      "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs",
                      "bg-slate-100 dark:bg-zinc-900 hover:bg-slate-200 dark:hover:bg-zinc-800 rounded-md",
                      "border border-border/40 hover:border-blue-500/30",
                      "transition-all duration-200"
                    )}
                  >
                    <ChevronRight className="size-3" />
                    {toolId}
                  </button>
                ))}
              </div>
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

function Markdown({ text, onToolClick }: { text: string; onToolClick?: (toolId: string) => void }) {
  const [rendered, setRendered] = useState<ReactNode>(null);

  useEffect(() => {
    let aborted = false;
    async function run() {
      let result = map.get(text);
      if (!result && text) {
        processor ??= createProcessor();

        // Custom link component to intercept tool clicks
        const LinkWithToolDetection = (props: ComponentProps<'a'>) => {
      
          // On mobile or when no handler, just use regular link
          return <Link {...props} />;
        };

        result = await processor
          .process(text, {
            ...defaultMdxComponents,
            pre: Pre,
            a: LinkWithToolDetection,
            img: undefined, // use JSX
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
  }, [text, onToolClick]);

  return <>{rendered || text}</>;
}

export default function AISearch(props: DialogProps & { onToolSelect?: (toolId: string) => void }) {
  const [selectedTool, setSelectedTool] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<'chat' | 'tool'>('chat');
  const [isClosing, setIsClosing] = useState(false);
  const [closedTools, setClosedTools] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'big' | 'small'>('big'); // Default to big view
  const isMobile = useIsMobile();
  const toolSwitchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Define handleCloseTool before useEffect that uses it
  const handleCloseTool = () => {
    if (isClosing) return; // Prevent multiple close attempts

    setIsClosing(true);

    // Clear any pending tool switches
    if (toolSwitchTimeoutRef.current) {
      clearTimeout(toolSwitchTimeoutRef.current);
    }

    // Don't clear the hash, just hide the tool
    setTimeout(() => {
      if (selectedTool) {
        setClosedTools(prev => new Set(prev).add(selectedTool));
      }
      setSelectedTool(null);
      setIsClosing(false);
    }, 50);
  };

  // Handle tool selection
  const handleToolSelect = (toolId: string) => {
    if (!isMobile && !isClosing) {
      // If we're already showing this tool, do nothing
      if (selectedTool === toolId) {
        return;
      }

      // Clear any existing timeout
      if (toolSwitchTimeoutRef.current) {
        clearTimeout(toolSwitchTimeoutRef.current);
      }

      // Remove from closedTools if it was there
      setClosedTools(prev => {
        const newSet = new Set(prev);
        newSet.delete(toolId);
        return newSet;
      });

      // Switch to the new tool immediately
      setSelectedTool(toolId);
      props.onToolSelect?.(toolId);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (toolSwitchTimeoutRef.current) {
        clearTimeout(toolSwitchTimeoutRef.current);
      }
    };
  }, []);

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
                selectedTool && !isMobile ? "md:max-w-[1600px] md:w-[95vw]" : "md:max-w-5xl md:w-[90vw]",
                "md:h-[85vh] max-h-[90vh] focus-visible:outline-none data-[state=closed]:animate-fd-fade-out data-[state=open]:animate-fd-fade-in transition-all duration-300"
              )}
            >
              <div className="flex h-full bg-slate-50/80 dark:bg-zinc-950/80 backdrop-blur-xl rounded-2xl border border-border/40 shadow-2xl overflow-hidden">
                {/* Desktop view - side by side */}
                <div className={cn(
                  "hidden md:flex md:flex-col",
                  selectedTool ? "md:w-[40%] md:border-r md:border-fd-border" : "md:w-full"
                )}>
                  <Content
                    onToolReference={handleToolSelect}
                    onCollapse={() => setViewMode('small')}
                  />
                </div>

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

function SmallViewContent({ onExpand }: { onExpand: () => void }) {
  const chat = useChat({
    id: 'search',
    streamProtocol: 'data',
    sendExtraMessageFields: true,
    onResponse(response) {
      if (response.status === 401) {
        console.error(response.statusText);
      }
    },
  });

  const messages = chat.messages.filter((msg) => msg.role !== 'system');
  const { status } = chat;

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
            onClick={onExpand}
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
                  await chat.append({
                    content: question,
                    role: 'user',
                  });
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

function Content({ onToolReference, onCollapse }: { onToolReference?: (toolId: string) => void; onCollapse?: () => void }) {
  const chat = useChat({
    id: 'search',
    streamProtocol: 'data',
    sendExtraMessageFields: true,
    onResponse(response) {
      if (response.status === 401) {
        console.error(response.statusText);
      }
    },
  });

  const messages = chat.messages.filter((msg) => msg.role !== 'system');
  const { status, append } = chat;
  const isLoading = status === 'streaming';

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
    await append({
      content: question,
      role: 'user',
    });
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
              onClick={onCollapse}
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
                onToolReference={onToolReference}
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
