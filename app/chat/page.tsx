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
} from 'react';
import {
  RefreshCw,
  StopCircle,
  ArrowUp,
  Plus,
  MessageSquare,
  PanelLeftClose,
  PanelLeft,
  Trash2,
  MoreHorizontal,
  ExternalLink,
  Moon,
  Sun,
} from 'lucide-react';
import defaultMdxComponents from 'fumadocs-ui/mdx';
import { cn } from '@/lib/cn';
import { createProcessor, type Processor } from '@/components/ai/markdown-processor';
import Link from 'fumadocs-core/link';
import { type Message, useChat, type UseChatHelpers } from '@ai-sdk/react';
import { DynamicCodeBlock } from 'fumadocs-ui/components/dynamic-codeblock';
import dynamic from 'next/dynamic';
import React from 'react';
import 'katex/dist/katex.min.css';
import posthog from 'posthog-js';
import { useTheme } from 'next-themes';

const Mermaid = dynamic(() => import('@/components/content-design/mermaid'), {
  ssr: false,
});

// Types
interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}

// Chat context
const ChatContext = createContext<UseChatHelpers | null>(null);
function useChatContext() {
  return use(ChatContext)!;
}

// Markdown rendering
let processor: Processor | undefined;
const markdownCache = new Map<string, ReactNode>();

function parseFollowUpQuestions(content: string): string[] {
  if (!content) return [];
  const match = content.match(/---FOLLOW-UP-QUESTIONS---([\s\S]*?)---END-FOLLOW-UP-QUESTIONS---/);
  if (!match) return [];
  return match[1].trim()
    .split('\n')
    .map(line => line.replace(/^\d+\.\s*/, '').trim())
    .filter(q => q.length > 0);
}

function removeFollowUpQuestions(content: string): string {
  if (!content) return '';
  return content
    .replace(/---FOLLOW-UP-QUESTIONS---[\s\S]*?---END-FOLLOW-UP-QUESTIONS---/g, '')
    .replace(/---FOLLOW-UP-QUESTIONS---[\s\S]*$/g, '')
    .trim();
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

// Auto-growing textarea
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
        'flex-1 resize-none bg-transparent',
        'placeholder:text-muted-foreground/50 focus:outline-none',
        'min-h-[24px] max-h-[200px] leading-relaxed',
        props.className,
      )}
      rows={1}
      {...props}
    />
  );
}

// Follow-up suggestions
function FollowUpSuggestions({ questions, onQuestionClick }: {
  questions: string[];
  onQuestionClick: (question: string) => void;
}) {
  if (questions.length === 0) return null;
  return (
    <div className="mt-4 flex flex-wrap gap-2 animate-in fade-in duration-300">
      {questions.map((question, index) => (
        <button
          key={index}
          onClick={() => onQuestionClick(question)}
          className={cn(
            "px-3 py-1.5 text-sm rounded-full",
            "bg-zinc-100 dark:bg-zinc-800 text-muted-foreground",
            "hover:bg-zinc-200 dark:hover:bg-zinc-700 hover:text-foreground",
            "transition-all duration-200"
          )}
        >
          {question}
        </button>
      ))}
    </div>
  );
}

// Chat message
function ChatMessage({ message, isLast, onFollowUpClick, isStreaming }: {
  message: Message;
  isLast: boolean;
  onFollowUpClick: (question: string) => void;
  isStreaming?: boolean;
}) {
  const isUser = message.role === 'user';
  const cleanContent = isUser ? message.content : removeFollowUpQuestions(message.content);
  const followUpQuestions = isUser ? [] : parseFollowUpQuestions(message.content);

  if (isUser) {
    return (
      <div className="flex justify-end mb-6">
        <div className="max-w-[85%] lg:max-w-[70%]">
          <div className="bg-zinc-200 dark:bg-zinc-700 rounded-3xl px-5 py-3">
            <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{cleanContent}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-6">
      <div className="flex items-start gap-4">
        <div className="shrink-0 mt-1">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center">
            <img src="/avax-gpt.png" alt="AI" className="w-5 h-5 object-contain invert" />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="prose prose-zinc dark:prose-invert max-w-none prose-p:leading-relaxed prose-pre:bg-zinc-900 prose-pre:border prose-pre:border-zinc-800 [&_.katex-display]:overflow-x-auto [&_.katex]:text-sm">
            <Markdown text={cleanContent} />
          </div>
          {isLast && !isStreaming && followUpQuestions.length > 0 && (
            <FollowUpSuggestions questions={followUpQuestions} onQuestionClick={onFollowUpClick} />
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
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center">
            <img src="/avax-gpt.png" alt="AI" className="w-5 h-5 object-contain invert" />
          </div>
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

// Message list with auto-scroll
function MessageList({ children }: { children: ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!containerRef.current) return;
    const scrollToBottom = () => {
      containerRef.current?.scrollTo({ top: containerRef.current.scrollHeight, behavior: 'smooth' });
    };
    const observer = new ResizeObserver(scrollToBottom);
    scrollToBottom();
    const firstChild = containerRef.current?.firstElementChild;
    if (firstChild) observer.observe(firstChild);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto overscroll-contain">
      {children}
    </div>
  );
}

// Chat input
function ChatInput() {
  const { status, input, setInput, handleSubmit, stop } = useChatContext();
  const isLoading = status === 'streaming' || status === 'submitted';

  const onSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (input.trim()) {
      posthog.capture('ai_chat_message_sent', {
        query_length: input.length,
        query: input.substring(0, 100),
        view: 'fullscreen',
      });
    }
    handleSubmit(e);
  };

  return (
    <div className="w-full max-w-3xl mx-auto px-4 pb-4">
      <form onSubmit={onSubmit} className="relative">
        <div className="relative flex items-end bg-zinc-100 dark:bg-zinc-800 rounded-3xl border border-zinc-200 dark:border-zinc-700">
          <TextareaInput
            value={input}
            placeholder="Message Avalanche AI..."
            className="w-full px-5 py-4 pr-14 text-[15px]"
            disabled={isLoading}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(event) => {
              if (!event.shiftKey && event.key === 'Enter') {
                onSubmit();
                event.preventDefault();
              }
            }}
          />
          <button
            type={isLoading ? 'button' : 'submit'}
            onClick={isLoading ? stop : undefined}
            disabled={!isLoading && input.length === 0}
            className={cn(
              "absolute right-3 bottom-3 p-2 rounded-full transition-all",
              isLoading
                ? "bg-zinc-300 dark:bg-zinc-600 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-400 dark:hover:bg-zinc-500"
                : input.length > 0
                  ? "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-200"
                  : "bg-zinc-300 dark:bg-zinc-600 text-zinc-400 dark:text-zinc-500 cursor-not-allowed"
            )}
          >
            {isLoading ? <StopCircle className="w-5 h-5" /> : <ArrowUp className="w-5 h-5" />}
          </button>
        </div>
      </form>
      <p className="text-center text-xs text-muted-foreground/50 mt-2">
        Avalanche AI can make mistakes. Consider checking important information.
      </p>
    </div>
  );
}

// Chat actions
function ChatActions() {
  const { messages, status, setMessages, reload } = useChatContext();
  const isLoading = status === 'streaming';
  if (messages.length === 0) return null;

  return (
    <div className="flex items-center justify-center gap-3 py-2">
      {!isLoading && messages.at(-1)?.role === 'assistant' && (
        <button
          type="button"
          onClick={() => { posthog.capture('ai_chat_regenerate'); reload(); }}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Regenerate
        </button>
      )}
    </div>
  );
}

// Empty state
function EmptyState({ onSuggestionClick }: { onSuggestionClick: (question: string) => void }) {
  const suggestions = [
    { title: "Create a custom L1", description: "Deploy your own Avalanche L1 blockchain" },
    { title: "Set up a validator node", description: "Run your own node to secure the network" },
    { title: "Cross-chain transfers with ICTT", description: "Move assets between chains seamlessly" },
    { title: "Deploy smart contracts", description: "Get started with Solidity on Avalanche" },
  ];

  return (
    <div className="flex flex-col items-center justify-center h-full px-4">
      <div className="text-center mb-10">
        <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center shadow-lg shadow-red-500/20">
          <img src="/avax-gpt.png" alt="Avalanche AI" className="w-10 h-10 object-contain invert" />
        </div>
        <h1 className="text-2xl font-semibold mb-2">Avalanche AI</h1>
        <p className="text-muted-foreground text-sm">Your intelligent guide to building on Avalanche</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-2xl">
        {suggestions.map((s, i) => (
          <button
            key={i}
            onClick={() => { posthog.capture('ai_chat_suggested_question_clicked', { question: s.title }); onSuggestionClick(s.title); }}
            className={cn(
              "group flex flex-col items-start text-left p-4 rounded-2xl",
              "bg-zinc-100 dark:bg-zinc-800/50 hover:bg-zinc-200 dark:hover:bg-zinc-800",
              "border border-zinc-200 dark:border-zinc-700/50 hover:border-zinc-300 dark:hover:border-zinc-600",
              "transition-all duration-200"
            )}
          >
            <span className="font-medium text-sm mb-1">{s.title}</span>
            <span className="text-xs text-muted-foreground">{s.description}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// Sidebar
function Sidebar({
  isOpen,
  onToggle,
  conversations,
  currentConversationId,
  onNewChat,
  onSelectConversation,
  onDeleteConversation,
}: {
  isOpen: boolean;
  onToggle: () => void;
  conversations: Conversation[];
  currentConversationId: string | null;
  onNewChat: () => void;
  onSelectConversation: (id: string) => void;
  onDeleteConversation: (id: string) => void;
}) {
  const { theme, setTheme } = useTheme();
  const [hoveredId, setHoveredId] = useState<string | null>(null);

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
        "w-72 bg-zinc-50 dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800",
        "flex flex-col transition-transform duration-300 ease-in-out",
        isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0 lg:w-0 lg:border-0 lg:overflow-hidden"
      )}>
        {/* Sidebar header */}
        <div className="flex items-center justify-between p-3 border-b border-zinc-200 dark:border-zinc-800">
          <button
            onClick={onToggle}
            className="p-2 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
          >
            <PanelLeftClose className="w-5 h-5" />
          </button>
          <button
            onClick={onNewChat}
            className="p-2 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
            title="New chat"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-2">
          {conversations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No conversations yet
            </div>
          ) : (
            <div className="space-y-1">
              {conversations.map((conv) => (
                <div
                  key={conv.id}
                  onMouseEnter={() => setHoveredId(conv.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  className={cn(
                    "group relative flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors",
                    currentConversationId === conv.id
                      ? "bg-zinc-200 dark:bg-zinc-800"
                      : "hover:bg-zinc-100 dark:hover:bg-zinc-800/50"
                  )}
                  onClick={() => onSelectConversation(conv.id)}
                >
                  <MessageSquare className="w-4 h-4 shrink-0 text-muted-foreground" />
                  <span className="flex-1 truncate text-sm">{conv.title}</span>
                  {hoveredId === conv.id && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onDeleteConversation(conv.id); }}
                      className="p-1 rounded hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-colors"
                    >
                      <Trash2 className="w-4 h-4 text-muted-foreground hover:text-red-500" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sidebar footer */}
        <div className="p-3 border-t border-zinc-200 dark:border-zinc-800 space-y-1">
          <Link
            href="/"
            className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors text-sm"
          >
            <ExternalLink className="w-4 h-4" />
            Back to Docs
          </Link>
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors text-sm w-full"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            {theme === 'dark' ? 'Light mode' : 'Dark mode'}
          </button>
        </div>
      </div>
    </>
  );
}

// Toggle button when sidebar is closed
function SidebarToggle({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="fixed top-3 left-3 z-30 p-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors lg:absolute"
    >
      <PanelLeft className="w-5 h-5" />
    </button>
  );
}

// Main page component
export default function ChatPage() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);

  // Load conversations from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('avalanche-ai-conversations');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setConversations(parsed);
        if (parsed.length > 0) {
          setCurrentConversationId(parsed[0].id);
        }
      } catch (e) {
        console.error('Failed to parse conversations', e);
      }
    }
  }, []);

  // Save conversations to localStorage
  const saveConversations = useCallback((convs: Conversation[]) => {
    localStorage.setItem('avalanche-ai-conversations', JSON.stringify(convs));
    setConversations(convs);
  }, []);

  const currentConversation = conversations.find(c => c.id === currentConversationId);

  const chat = useChat({
    id: currentConversationId || 'new',
    initialMessages: currentConversation?.messages || [],
    streamProtocol: 'data',
    sendExtraMessageFields: true,
    body: { id: typeof window !== 'undefined' ? posthog.get_distinct_id() : undefined },
    onFinish(message) {
      posthog.capture('ai_chat_response_received', {
        response_length: message.content.length,
        view: 'fullscreen',
      });

      // Update conversation
      const msgs = [...chat.messages, message].filter(m => m.role !== 'system');
      if (currentConversationId) {
        const updated = conversations.map(c =>
          c.id === currentConversationId
            ? { ...c, messages: msgs, updatedAt: Date.now() }
            : c
        );
        saveConversations(updated);
      } else if (msgs.length > 0) {
        // Create new conversation
        const title = msgs[0]?.content.slice(0, 50) || 'New chat';
        const newConv: Conversation = {
          id: Date.now().toString(),
          title,
          messages: msgs,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        setCurrentConversationId(newConv.id);
        saveConversations([newConv, ...conversations]);
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
  const { status, append, setMessages } = chat;
  const isLoading = status === 'streaming';

  useEffect(() => {
    posthog.capture('ai_chat_opened', { view: 'fullscreen' });
  }, []);

  const handleNewChat = () => {
    setCurrentConversationId(null);
    setMessages([]);
  };

  const handleSelectConversation = (id: string) => {
    setCurrentConversationId(id);
    setSidebarOpen(false); // Close on mobile
  };

  const handleDeleteConversation = (id: string) => {
    const updated = conversations.filter(c => c.id !== id);
    saveConversations(updated);
    if (currentConversationId === id) {
      setCurrentConversationId(updated[0]?.id || null);
    }
  };

  const handleSuggestionClick = async (question: string) => {
    await append({ content: question, role: 'user' });
  };

  return (
    <ChatContext value={chat}>
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
        />

        {/* Main chat area */}
        <div className="flex-1 flex flex-col min-w-0 relative">
          {/* Toggle button when sidebar closed */}
          {!sidebarOpen && <SidebarToggle onClick={() => setSidebarOpen(true)} />}

          {/* Header */}
          <header className="shrink-0 flex items-center justify-center px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center">
                <img src="/avax-gpt.png" alt="AI" className="w-4 h-4 object-contain invert" />
              </div>
              <span className="text-sm font-medium">Avalanche AI</span>
            </div>
          </header>

          {/* Messages */}
          <main className="flex-1 min-h-0 flex flex-col overflow-hidden">
            {messages.length === 0 ? (
              <EmptyState onSuggestionClick={handleSuggestionClick} />
            ) : (
              <MessageList>
                <div className="max-w-3xl mx-auto w-full px-4 py-6">
                  {messages.map((message, index) => (
                    <ChatMessage
                      key={message.id}
                      message={message}
                      isLast={index === messages.length - 1}
                      onFollowUpClick={handleSuggestionClick}
                      isStreaming={isLoading && index === messages.length - 1 && message.role === 'assistant'}
                    />
                  ))}
                  {isLoading && messages[messages.length - 1]?.role === 'user' && <TypingIndicator />}
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
      </div>
    </ChatContext>
  );
}
