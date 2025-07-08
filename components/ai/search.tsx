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
import { Loader2, RefreshCw, Send, X, User, Bot, Sparkles, StopCircle, MessageCircleQuestion, ChevronRight, ChevronLeft, Maximize2, Minimize2 } from 'lucide-react';
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
        'flex items-center gap-3 px-4 pb-4 pt-3 border-t border-fd-border/50',
        props.className,
      )}
      onSubmit={onStart}
    >
      <div className="flex-1 relative flex items-end bg-fd-muted/50 rounded-xl border border-fd-border/50 focus-within:border-fd-ring transition-all">
        <Input
          value={input}
          placeholder="Message AI Assistant..."
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
            'mb-[7px] mr-2 p-1.5 rounded-lg transition-all shrink-0',
            isLoading 
              ? 'bg-fd-background hover:bg-fd-muted text-fd-foreground border border-fd-border' 
              : input.length > 0 
                ? 'bg-red-600 hover:bg-red-700 text-white' 
                : 'text-fd-muted-foreground cursor-not-allowed hover:text-fd-muted-foreground/70',
          )}
          disabled={!isLoading && input.length === 0}
          onClick={isLoading ? stop : undefined}
        >
          {isLoading ? (
            <StopCircle className="size-4" />
          ) : (
            <Send className="size-4" />
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

const roleName: Record<string, string> = {
  user: 'You',
  assistant: 'AI Assistant',
};

const roleIcon: Record<string, ReactElement> = {
  user: <User className="size-5" />,
  assistant: <Bot className="size-5" />,
};

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
    <div className="px-4 py-3 border-t border-fd-border/30">
      <p className="text-xs font-medium text-fd-muted-foreground mb-3">
        Related topics you might find helpful:
      </p>
      <div className="grid grid-cols-1 gap-2">
        {questions.map((question, index) => (
          <button
            key={index}
            onClick={() => onQuestionClick(question)}
            className={cn(
              "group relative p-3 rounded-lg border border-fd-border/30 bg-fd-card/50",
              "hover:border-red-600/30 hover:bg-red-50 dark:hover:bg-red-950/30 hover:shadow-sm",
              "transition-all duration-200 ease-out",
              "text-left text-xs"
            )}
          >
            <div className="flex items-start gap-2">
              <div className="mt-0.5 p-1 rounded-md bg-fd-muted/50 transition-all duration-200">
                <MessageCircleQuestion className="size-3 text-red-600" />
              </div>
              <span className="flex-1 text-fd-foreground/70 group-hover:text-fd-foreground leading-relaxed transition-colors duration-200">
                {question}
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// Extract tool references from message content
function extractToolReferences(content: string): string[] {
  const toolPattern = /tools\/l1-toolbox#(\w+)/g;
  const matches = content.matchAll(toolPattern);
  return Array.from(matches, m => m[1]);
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
  
  useEffect(() => {
    if (!isUser && !isStreaming && !isMobile) {
      const toolRefs = extractToolReferences(message.content);
      setDetectedTools(toolRefs);
      // Only auto-open once per message
      if (toolRefs.length > 0 && onToolReference && !hasAutoOpened) {
        setHasAutoOpened(true);
        // Use the first tool reference
        onToolReference(toolRefs[0]);
      }
    }
  }, [message.content, isUser, isStreaming, onToolReference, isMobile, hasAutoOpened]);
  
  return (
    <div className={cn(
      'group relative',
      !isUser && 'bg-fd-muted/30',
    )}>
      <div className="flex gap-4 px-4 py-6">
        <div className={cn(
          'flex size-8 shrink-0 items-center justify-center rounded-full',
          isUser ? 'bg-red-100 dark:bg-red-950 text-red-600' : 'bg-fd-secondary text-fd-secondary-foreground',
        )}>
          {roleIcon[message.role] ?? <User className="size-5" />}
        </div>
        <div className="flex-1 space-y-2 overflow-hidden">
          <p className="text-xs font-medium text-fd-muted-foreground">
            {roleName[message.role] ?? 'Unknown'}
          </p>
          <div className="prose prose-sm max-w-none dark:prose-invert">
            <Markdown text={cleanContent} onToolClick={isMobile ? undefined : onToolReference} />
          </div>
          
          {/* Show tool reopener if tools were detected and we're on desktop */}
          {!isUser && detectedTools.length > 0 && !isMobile && onToolReference && (
            <div className="mt-3 flex flex-wrap gap-2">
              {detectedTools.map((toolId) => (
                <button
                  key={toolId}
                  onClick={() => onToolReference(toolId)}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs",
                    "bg-fd-muted hover:bg-fd-muted/80 rounded-md",
                    "border border-fd-border hover:border-red-600/30",
                    "transition-all duration-200"
                  )}
                >
                  <ChevronRight className="size-3" />
                  Open {toolId} in sidebar
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      
      {/* Show follow-up suggestions only for the last assistant message and not while streaming */}
      {!isUser && isLast && !isStreaming && followUpQuestions.length > 0 && (
        <SuggestedFollowUps 
          questions={followUpQuestions}
          onQuestionClick={onFollowUpClick}
        />
      )}
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
          const href = props.href || '';
          const toolMatch = href.match(/tools\/l1-toolbox#(\w+)/);
          
          if (toolMatch && onToolClick) {
            return (
              <a
                {...props}
                href={href}
                onClick={(e) => {
                  e.preventDefault();
                  onToolClick(toolMatch[1]);
                }}
                className={cn(props.className, "cursor-pointer hover:underline")}
              />
            );
          }
          
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

// Dynamically import the ToolboxApp to avoid SSR issues
const ToolboxApp = dynamic(() => import('../../toolbox/src/toolbox/ToolboxApp').then(mod => {
  // Wrap the ToolboxApp to inject the embedded prop
  const OriginalToolboxApp = mod.default;
  return {
    default: (props: any) => {
      // Add a class to the root element when embedded
      useEffect(() => {
        document.body.classList.add('toolbox-embedded');
        
        // Override hashchange behavior to prevent unwanted navigation
        const handleHashChange = (e: HashChangeEvent) => {
          if (e.newURL.includes('#') && !e.newURL.endsWith('#')) {
            // Allow the hash change but prevent default behavior
            e.stopImmediatePropagation();
          }
        };
        
        window.addEventListener('hashchange', handleHashChange, true);
        
        return () => {
          document.body.classList.remove('toolbox-embedded');
          window.removeEventListener('hashchange', handleHashChange, true);
        };
      }, []);
      
      return <OriginalToolboxApp {...props} />;
    }
  };
}), {
  ssr: false,
  loading: () => (
    <div className="flex justify-center items-center h-full">
      <Loader2 className="size-6 animate-spin text-fd-muted-foreground" />
    </div>
  ),
});

// Add embedded styles
const EmbeddedStyles = () => {
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      /* Hide sidebar when embedded */
      .toolbox-embedded .w-80.flex-shrink-0 {
        display: none !important;
      }
      
      /* Make content full width */
      .toolbox-embedded .flex-1.p-6 {
        max-width: 100% !important;
        padding: 1.5rem !important;
      }
      
      /* Adjust container */
      .toolbox-embedded .container.mx-auto {
        margin: 0 !important;
      }
      
      /* Hide background effects */
      .toolbox-embedded .fixed.inset-0.-z-10 {
        display: none !important;
      }
      
      /* Ensure close button is always on top */
      .toolbox-embedded-header {
        position: relative;
        z-index: 9999 !important;
      }
      
      /* Lower z-index for wallet modals when embedded */
      .toolbox-embedded [role="dialog"],
      .toolbox-embedded .fixed.inset-0.z-50 {
        z-index: 9998 !important;
      }
      
      /* Override hash-based navigation */
      .toolbox-embedded {
        pointer-events: auto !important;
      }
    `;
    document.head.appendChild(style);
    
    return () => {
      document.head.removeChild(style);
    };
  }, []);
  
  return null;
};

export default function AISearch(props: DialogProps & { onToolSelect?: (toolId: string) => void }) {
  const [selectedTool, setSelectedTool] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<'chat' | 'tool'>('chat');
  const [isClosing, setIsClosing] = useState(false);
  const [closedTools, setClosedTools] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'big' | 'small'>('big'); // Default to big view
  const isMobile = useIsMobile();
  
  // Debug selectedTool changes
  useEffect(() => {
    console.log('selectedTool changed to:', selectedTool);
  }, [selectedTool]);
  
  // Define handleCloseTool before useEffect that uses it
  const handleCloseTool = () => {
    console.log('Close button clicked', { isClosing, selectedTool });
    if (isClosing) return; // Prevent multiple close attempts
    
    setIsClosing(true);
    
    // Don't clear the hash, just hide the tool
    setTimeout(() => {
      console.log('Closing tool panel');
      if (selectedTool) {
        setClosedTools(prev => new Set(prev).add(selectedTool));
      }
      setSelectedTool(null);
      setIsClosing(false);
    }, 50);
  };
  
  // Add escape key handler to close toolbox
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedTool && !isClosing) {
        e.preventDefault();
        e.stopPropagation();
        handleCloseTool();
      }
    };
    
    if (selectedTool) {
      document.addEventListener('keydown', handleEscape, true);
      return () => document.removeEventListener('keydown', handleEscape, true);
    }
  }, [selectedTool, isClosing]);
  
  // Component to render the tool
  const ToolRenderer = ({ toolId }: { toolId: string }) => {
    const hasSetHash = useRef(false);
    
    useEffect(() => {
      // Only set hash once to prevent re-triggering
      if (toolId && !hasSetHash.current && !isClosing) {
        hasSetHash.current = true;
        // Small delay to ensure the component is mounted
        setTimeout(() => {
          window.location.hash = toolId;
        }, 50);
      }
      
      return () => {
        hasSetHash.current = false;
      };
    }, [toolId]);
    
    return (
      <>
        <EmbeddedStyles />
        <ToolboxApp />
      </>
    );
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
              <div className="flex h-full bg-fd-background rounded-xl border border-fd-border shadow-2xl overflow-hidden flex-col">
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
                selectedTool && !isMobile ? "md:max-w-[1400px] md:w-[95vw]" : "md:max-w-2xl md:w-[90vw]",
                "md:h-[85vh] max-h-[90vh] focus-visible:outline-none data-[state=closed]:animate-fd-fade-out data-[state=open]:animate-fd-fade-in transition-all duration-300"
              )}
            >
              <div className="flex h-full bg-fd-background rounded-xl border border-fd-border shadow-2xl overflow-hidden">
                {/* Desktop view - side by side */}
                <div className={cn(
                  "hidden md:flex md:flex-col",
                  selectedTool ? "md:w-[40%] md:border-r md:border-fd-border" : "md:w-full"
                )}>
                  <Content 
                    onToolReference={(toolId) => {
                      if (!isMobile && !isClosing) {
                        // Remove from closedTools if it was there
                        setClosedTools(prev => {
                          const newSet = new Set(prev);
                          newSet.delete(toolId);
                          return newSet;
                        });
                        setSelectedTool(toolId);
                        props.onToolSelect?.(toolId);
                      }
                    }}
                    onCollapse={() => setViewMode('small')}
                  />
                </div>
                
                {/* Mobile view - chat only */}
                <div className="flex md:hidden flex-col w-full">
                  <Content onCollapse={() => setViewMode('small')} />
                </div>
                
                {/* Desktop tool panel */}
                {selectedTool && !isMobile && (
                  <div key={selectedTool} className="hidden md:flex md:w-[60%] md:flex-col bg-fd-muted/20">
                                    <div className="toolbox-embedded-header flex items-center justify-between border-b border-fd-border px-4 py-3 relative z-[9999]">
                  <a 
                    href={`/tools/l1-toolbox#${selectedTool}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium hover:text-red-600 hover:underline transition-colors cursor-pointer flex items-center gap-1"
                  >
                    Toolbox: {selectedTool}
                    <ChevronRight className="size-3" />
                  </a>
                  <button
                    onClick={handleCloseTool}
                    className={cn(
                      buttonVariants({ size: 'icon', variant: 'ghost' }),
                      'size-6 rounded-md relative z-[9999]',
                    )}
                    style={{ position: 'relative', zIndex: 9999 }}
                  >
                    <X className="size-3" />
                  </button>
                </div>
                    <div className="flex-1 overflow-auto bg-fd-background relative">
                      <ToolRenderer toolId={selectedTool} />
                    </div>
                  </div>
                )}
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
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-red-600" />
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
              <div className="mx-auto size-10 rounded-full bg-red-100 dark:bg-red-950 flex items-center justify-center">
                <Sparkles className="size-5 text-red-600" />
              </div>
              <h3 className="text-sm font-medium">How can I help?</h3>
              <p className="text-xs text-fd-muted-foreground">
                Ask me anything about Avalanche
              </p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-fd-border">
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
              <div className="flex gap-3 px-4 py-4 bg-fd-muted/30">
                <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-fd-secondary text-fd-secondary-foreground">
                  <Bot className="size-4" />
                </div>
                <div className="flex items-center gap-2 text-xs text-fd-muted-foreground">
                  <div className="flex gap-1">
                    <span className="size-1.5 rounded-full bg-fd-muted-foreground/50 animate-bounce [animation-delay:-0.3s]"></span>
                    <span className="size-1.5 rounded-full bg-fd-muted-foreground/50 animate-bounce [animation-delay:-0.15s]"></span>
                    <span className="size-1.5 rounded-full bg-fd-muted-foreground/50 animate-bounce"></span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
        {messages.length > 0 && <SearchAIActions />}
      </List>
      
      <SearchAIInput className="px-3 pb-3 pt-2" />
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
    "How do I deploy a smart contract on C-Chain?",
    "How do I create an Avalanche L1?",
    "How do I set up a local node?",
    "Explain Avalanche consensus mechanism",
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
        <div className="flex items-center gap-2">
          <Sparkles className="size-5 text-red-600" />
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
                <div className="mx-auto size-12 rounded-full bg-red-100 dark:bg-red-950 flex items-center justify-center">
                  <Sparkles className="size-6 text-red-600" />
                </div>
                <h3 className="text-lg font-medium">How can I help you today?</h3>
                <p className="text-sm text-fd-muted-foreground">
                  Ask me anything about the documentation or get help with your code.
                </p>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-8">
                {suggestedQuestions.map((question, index) => (
                  <button
                    key={index}
                    onClick={() => handleSuggestionClick(question)}
                    className={cn(
                      "group relative p-4 rounded-xl border border-fd-border/50 bg-fd-card",
                      "hover:border-red-600/50 hover:bg-red-50 dark:hover:bg-red-950/50 hover:shadow-md",
                      "transition-all duration-200 ease-out transform hover:scale-[1.02]",
                      "text-left text-sm overflow-hidden"
                    )}
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-red-600/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    <div className="relative flex items-start gap-3">
                      <div className="mt-0.5 p-2 rounded-lg bg-fd-muted/50 transition-all duration-200">
                        <MessageCircleQuestion className="size-4 text-red-600 transition-colors duration-200" />
                      </div>
                      <span className="flex-1 text-fd-foreground/80 group-hover:text-fd-foreground leading-relaxed transition-colors duration-200">
                        {question}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-fd-border">
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
              <div className="flex gap-4 px-4 py-6 bg-fd-muted/30">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-fd-secondary text-fd-secondary-foreground">
                  <Bot className="size-5" />
                </div>
                <div className="flex items-center gap-2 text-sm text-fd-muted-foreground">
                  <div className="flex gap-1">
                    <span className="size-2 rounded-full bg-fd-muted-foreground/50 animate-bounce [animation-delay:-0.3s]"></span>
                    <span className="size-2 rounded-full bg-fd-muted-foreground/50 animate-bounce [animation-delay:-0.15s]"></span>
                    <span className="size-2 rounded-full bg-fd-muted-foreground/50 animate-bounce"></span>
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
